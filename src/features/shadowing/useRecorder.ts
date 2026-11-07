// One "say it" take: speech recognition + audio recording running together.
// Everything (recognizer, mic tracks, level meter, timers, object URLs) is released on
// reset, on a new take and on unmount.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLevelMeter,
  createRecognizer,
  micErrorInfo,
  microphoneSupported,
  recognitionErrorInfo,
  speechRecognitionSupported,
  startRecording,
  type RecordingHandle,
  type Recognizer,
  type SpeechErrorInfo,
} from '../../core/speech';
import { stopSpeaking } from '../../core/tts';
import { quietDelayMs } from './autostop';

export type RecPhase = 'idle' | 'starting' | 'recording' | 'stopping' | 'done';

export interface RecOutcome {
  transcript: string; // '' when nothing was recognised (or recognition unavailable)
  audioUrl: string | null; // object URL of the learner's recording (memory only)
  usedRecognition: boolean;
  recognitionError: SpeechErrorInfo | null;
}

export interface RecError {
  kind: string;
  message: string;
}

export interface ShadowRecorder {
  phase: RecPhase;
  interim: string;
  outcome: RecOutcome | null;
  error: RecError | null;
  notice: string | null; // non-fatal message while a take is running
  canRecognize: boolean; // speech recognition usable in this browser (and not disabled after a fatal error)
  canRecord: boolean; // microphone + MediaRecorder available
  start: () => void;
  stop: () => void;
  toggle: () => void;
  reset: () => void;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  const box: { resolve: () => void } = { resolve: () => {} };
  const promise = new Promise<void>((r) => {
    box.resolve = r;
  });
  return { promise, resolve: () => box.resolve() };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export interface RecorderOptions {
  maxMs: number; // hard limit for one take
  onLevel?: (level: number) => void; // mic loudness 0..1 while recording
  /** True when the transcript already reaches the end of the sentence (ends the take sooner). */
  isComplete?: (transcript: string) => boolean;
}

export function useShadowRecorder(opts: RecorderOptions): ShadowRecorder {
  const [srSupported] = useState(speechRecognitionSupported);
  const [micSupported] = useState(microphoneSupported);
  const [srOff, setSrOff] = useState(false);
  const [phase, setPhaseState] = useState<RecPhase>('idle');
  const [interim, setInterim] = useState('');
  const [outcome, setOutcome] = useState<RecOutcome | null>(null);
  const [error, setError] = useState<RecError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const session = useRef(0);
  const phaseRef = useRef<RecPhase>('idle');
  const recognizer = useRef<Recognizer | null>(null);
  const recording = useRef<RecordingHandle | null>(null);
  const meterOff = useRef<(() => void) | null>(null);
  const timer = useRef<number | null>(null);
  const quiet = useRef<number | null>(null);
  const transcript = useRef('');
  const srError = useRef<SpeechErrorInfo | null>(null);
  const srEnded = useRef<Promise<void> | null>(null);
  const finishing = useRef(false);
  const url = useRef<string | null>(null);
  const srOffRef = useRef(false);
  const srUsed = useRef(false);
  // Some Android builds cannot record and recognise at the same time ("audio-capture"):
  // after that happens once, later takes skip the recording so recognition gets the mic.
  const micConflict = useRef(false);
  const maxMsRef = useRef(opts.maxMs);
  const onLevelRef = useRef(opts.onLevel);
  const isCompleteRef = useRef(opts.isComplete);

  useEffect(() => {
    maxMsRef.current = opts.maxMs;
    onLevelRef.current = opts.onLevel;
    isCompleteRef.current = opts.isComplete;
  });

  const clearTimers = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (quiet.current !== null) {
      window.clearTimeout(quiet.current);
      quiet.current = null;
    }
  }, []);

  const setPhase = useCallback((p: RecPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  /** Stop every live resource of the current take (does not touch the finished audio URL). */
  const teardown = useCallback(() => {
    clearTimers();
    meterOff.current?.();
    meterOff.current = null;
    recognizer.current?.dispose();
    recognizer.current = null;
    recording.current?.cancel();
    recording.current = null;
  }, [clearTimers]);

  const revokeUrl = useCallback(() => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, []);

  const finish = useCallback(
    async (id: number) => {
      if (id !== session.current || finishing.current) return;
      finishing.current = true;
      setPhase('stopping');
      clearTimers();
      meterOff.current?.();
      meterOff.current = null;

      const rec = recognizer.current;
      if (rec) {
        rec.stop();
        await Promise.race([srEnded.current ?? Promise.resolve(), delay(2500)]);
        if (id !== session.current) return;
        rec.dispose();
        recognizer.current = null;
      }

      let audioUrl: string | null = null;
      const handle = recording.current;
      recording.current = null;
      if (handle) {
        try {
          const blob = await handle.stop();
          if (blob.size > 0) audioUrl = URL.createObjectURL(blob);
        } catch {
          handle.cancel();
        }
      }
      if (id !== session.current) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        return;
      }
      revokeUrl();
      url.current = audioUrl;
      setOutcome({
        transcript: transcript.current.trim(),
        audioUrl,
        usedRecognition: srUsed.current,
        recognitionError: srError.current,
      });
      setPhase('done');
    },
    [clearTimers, revokeUrl, setPhase],
  );

  const start = useCallback(async () => {
    const id = ++session.current;
    teardown();
    stopSpeaking();
    finishing.current = false;
    revokeUrl();
    transcript.current = '';
    srError.current = null;
    srUsed.current = false;
    setOutcome(null);
    setInterim('');
    setError(null);
    setNotice(null);
    setPhase('starting');

    const useSR = srSupported && !srOffRef.current;
    if (!micSupported && !useSR) {
      setError({
        kind: 'unsupported',
        message: 'Trình duyệt này không cho dùng micro. Bạn vẫn có thể nói to theo mẫu rồi tự chấm bên dưới.',
      });
      setPhase('idle');
      return;
    }

    const record = micSupported && !(useSR && micConflict.current);
    if (record) {
      try {
        const h = await startRecording();
        if (id !== session.current) {
          h.cancel();
          return;
        }
        recording.current = h;
        meterOff.current = createLevelMeter(h.stream, (lv) => onLevelRef.current?.(lv));
      } catch (e) {
        if (id !== session.current) return;
        const info = micErrorInfo(e);
        // Recorder unsupported but recognition works: carry on without a recording.
        if (!(info.kind === 'unsupported' && useSR)) {
          setError(info);
          setPhase('idle');
          return;
        }
      }
    }

    if (useSR) {
      // Continuous: a short pause mid-sentence must not end the take; a quiet spell does (below).
      const rec = createRecognizer({ lang: 'en-US', interim: true, continuous: true });
      if (rec) {
        recognizer.current = rec;
        srUsed.current = true;
        const ended = deferred();
        srEnded.current = ended.promise;
        rec.onResult((text, isFinal) => {
          if (id !== session.current) return;
          transcript.current = text;
          setInterim(text);
          if (finishing.current || !text.trim()) return;
          // Auto-stop once the learner has gone quiet for a moment.
          if (quiet.current !== null) window.clearTimeout(quiet.current);
          let complete = false;
          try {
            complete = isCompleteRef.current?.(text) ?? false;
          } catch {
            complete = false;
          }
          quiet.current = window.setTimeout(() => {
            quiet.current = null;
            void finish(id);
          }, quietDelayMs(isFinal, complete));
        });
        rec.onError((code) => {
          if (id !== session.current) return;
          const info = recognitionErrorInfo(code);
          if (info.kind === 'ignore') return;
          srError.current = info;
          if (info.kind === 'unavailable') {
            srOffRef.current = true;
            setSrOff(true);
          }
        });
        rec.onEnd(() => {
          ended.resolve();
          if (id !== session.current || finishing.current) return;
          const err = srError.current;
          if (err && err.code !== 'no-speech' && recording.current) {
            const conflict = err.code === 'audio-capture' && !micConflict.current;
            if (err.code === 'audio-capture') micConflict.current = true;
            // Recognition broke (network, service…) but the mic still records: keep the take going.
            if (recognizer.current === rec) {
              rec.dispose();
              recognizer.current = null;
            }
            if (quiet.current !== null) {
              window.clearTimeout(quiet.current);
              quiet.current = null;
            }
            setNotice(
              conflict
                ? 'Trình duyệt không cho vừa ghi âm vừa nhận dạng giọng nói cùng lúc. Lần này bạn vẫn được ghi âm — nói xong bấm nút để dừng; từ lần sau máy chỉ nhận dạng để chấm điểm (không lưu bản ghi để nghe lại).'
                : `${err.message} Bạn vẫn đang được ghi âm — nói xong bấm nút để dừng.`,
            );
            return;
          }
          // Recognition ends by itself after the utterance: stop the take too.
          void finish(id);
        });
        rec.start();
      }
    }

    if (id !== session.current || finishing.current) return;
    setPhase('recording');
    timer.current = window.setTimeout(() => void finish(id), Math.max(5000, maxMsRef.current));
  }, [finish, micSupported, revokeUrl, setPhase, srSupported, teardown]);

  const reset = useCallback(() => {
    session.current++;
    teardown();
    revokeUrl();
    finishing.current = false;
    setOutcome(null);
    setInterim('');
    setError(null);
    setNotice(null);
    setPhase('idle');
  }, [revokeUrl, setPhase, teardown]);

  const stop = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'recording') void finish(session.current);
    else if (p === 'starting') {
      // Still waiting for the permission prompt: cancel the take.
      session.current++;
      teardown();
      setPhase('idle');
    }
  }, [finish, setPhase, teardown]);

  const toggle = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'recording' || p === 'starting') stop();
    else if (p !== 'stopping') void start();
  }, [start, stop]);

  useEffect(
    () => () => {
      session.current++;
      teardown();
      revokeUrl();
      stopSpeaking();
    },
    [revokeUrl, teardown],
  );

  return {
    phase,
    interim,
    outcome,
    error,
    notice,
    canRecognize: srSupported && !srOff,
    canRecord: micSupported,
    start: () => void start(),
    stop,
    toggle,
    reset,
  };
}
