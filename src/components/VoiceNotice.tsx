import { TriangleAlert, X } from 'lucide-react';
import { dismissVoiceNotice, useVoiceStatus } from '../core/tts';
import { Icon } from './Icon';

/**
 * One-time, quiet notice when the AI voice failed and playback fell back to the browser voice
 * ("Giọng AI lỗi, đang dùng giọng trình duyệt: …"). Each distinct message shows once per session.
 * Mount once in the app shell; renders nothing otherwise.
 */
export default function VoiceNotice() {
  const { notice } = useVoiceStatus();
  if (!notice) return null;
  return (
    <div className="callout callout-warn voice-notice" role="status" aria-live="polite">
      <Icon icon={TriangleAlert} size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>{notice}</div>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={dismissVoiceNotice} aria-label="Ẩn thông báo" title="Ẩn">
        <Icon icon={X} size={15} />
      </button>
    </div>
  );
}
