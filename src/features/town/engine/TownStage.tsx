import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { TOWN_WORLD, type PlaceId, type Tile } from '../../../data/townWorld';
import type { EmoteKind } from './draw/overlay';
import { TownEngine, type ActKind, type BurstKind, type Near, type SafeInsets, type StageTarget } from './engine';
import type { StageState } from './sim';

export type { ActKind, BurstKind, Near, SafeInsets, StageTarget } from './engine';
export type { EmoteKind } from './draw/overlay';
export type { Marker, StageState } from './sim';
export type { TownTheme } from './palette';

export interface TownStageHandle {
  /** Zoom in on a place's resident (a conversation); null zooms back out and follows the player again. */
  focusOn: (placeId: PlaceId | null) => void;
  /** A little picture popping up over somebody's head. */
  emote: (target: 'player' | PlaceId, kind: EmoteKind) => void;
  /** Somebody plays a short animation once: a nod ('yes'), a head shake ('no'), a wave. Nothing under reduced motion. */
  act: (target: 'player' | PlaceId, anim: ActKind) => void;
  /** Particles at somebody or at a point of the stage (CSS pixels); coins fly on to `to`. */
  burst: (kind: BurstKind, at: StageTarget, to?: { x: number; y: number }) => void;
  /** Walk to a place's resident (or to the gate of its empty lot), then call back. False = no way there. */
  walkTo: (placeId: PlaceId, then?: () => void) => boolean;
  /** Where somebody's head is on the stage, in CSS pixels (to hang a bubble on); null when they are not in town. */
  pointOf: (target: 'player' | PlaceId) => { x: number; y: number } | null;
  /** A short text with a coin rising over somebody's head ("+3"). */
  float: (target: 'player' | PlaceId, text: string) => void;
  /**
   * A place was just built or a decoration bought: the camera goes there and the thing pops out of the ground.
   * Returns the seconds until it appears (0 under reduced motion).
   */
  celebrate: (id: string) => number;
  /** Put the keyboard on the stage (after a panel closed). */
  focus: () => void;
  /** The stage's own box (to put it full screen); null before it is on the page. */
  box: () => HTMLDivElement | null;
  /** Where the stage is in the window (to place things relative to it); null before it is on the page. */
  rect: () => DOMRect | null;
}

export interface TownStageProps {
  state: StageState;
  /** The player walked up to a resident after clicking them (or their house), or pressed Enter beside them. */
  onTalk?: (placeId: PlaceId) => void;
  /** The player reached the gate of an empty lot after clicking it, or pressed Enter there. */
  onLot?: (placeId: PlaceId) => void;
  /** Who the player now stands next to (null = nobody): lets the shell offer "Nói chuyện" / "Xây". */
  onNear?: (near: Near) => void;
  /** Enter / E / Space was pressed with nobody beside the player. */
  onIdleAct?: () => void;
  /** The resident whose line is sounding now: a bubble with moving bars over their head. */
  speaking?: PlaceId | null;
  /** CSS pixels of the stage covered by a panel, from its right and bottom edges: the camera centres in the rest. */
  inset?: { right?: number; bottom?: number };
  /** Input off (a conversation or a dialog is open). The town keeps moving. */
  paused?: boolean;
  /** CSS pixels along each edge under the game's own buttons: name tags keep out, the camera centres in the rest. */
  safe?: SafeInsets;
  /** The resident the page suggests next: always named, framed with the player while near. */
  hint?: PlaceId | null;
  /** A lot the build panel is about: the camera shows it. */
  peek?: PlaceId | null;
  /** The stage covers the window: on a big screen the camera shows the whole built town. */
  full?: boolean;
  /** A short text kept over an empty lot, by place id (e.g. its price: "20 xu"). Without it a lot shows its name under the pointer only. */
  lotLabels?: Readonly<Record<string, string>>;
  /** Show the whole town at once instead of following the player. */
  overview?: boolean;
  /** Where the player stands when the stage opens (default: where they were this session, else the plaza). */
  startAt?: Tile;
  /** For screen readers: what this picture is. */
  label?: string;
  className?: string;
  /** Drawn over the canvas, inside the stage's box (a counter, a speech bubble): position them absolutely. */
  children?: ReactNode;
  ref?: Ref<TownStageHandle>;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // a dialog, or a control that uses the arrow keys itself (segmented control, tabs, a list, a slider)
  return !!el.closest('[data-popover], [role="dialog"], dialog, [role="radiogroup"], [role="tablist"], [role="listbox"], [role="menu"], [role="slider"]');
}

/** A dialog is open somewhere on the page: the keys belong to it. */
function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]');
}

/**
 * The town: one canvas that fills its container. Click or tap the ground to walk there, a resident to walk up and
 * talk, an empty lot to walk to its gate; arrow keys or W A S D walk, Enter talks to whoever is beside the player.
 * All it is told comes in `state` (plain data); all it tells comes out through the callbacks.
 */
export default function TownStage({
  state,
  onTalk,
  onLot,
  onNear,
  onIdleAct,
  speaking = null,
  inset,
  paused = false,
  safe,
  hint = null,
  peek = null,
  full = false,
  overview = false,
  lotLabels,
  startAt,
  label,
  className,
  children,
  ref,
}: TownStageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TownEngine | null>(null);
  const cbRef = useRef({ onTalk, onLot, onNear, onIdleAct });
  const insetRight = inset?.right ?? 0;
  const insetBottom = inset?.bottom ?? 0;
  const insetRef = useRef({ right: insetRight, bottom: insetBottom });
  const speakingRef = useRef(speaking);
  const safeTop = safe?.top ?? 0;
  const safeRight = safe?.right ?? 0;
  const safeBottom = safe?.bottom ?? 0;
  const safeLeft = safe?.left ?? 0;
  const safeRef = useRef<SafeInsets>({ top: safeTop, right: safeRight, bottom: safeBottom, left: safeLeft });
  const hintRef = useRef(hint);
  const peekRef = useRef(peek);
  const fullRef = useRef(full);
  /** Who the camera leans in on: asked for through the handle, kept so a re-made engine (React strict mode) leans in again. */
  const focusRef = useRef<PlaceId | null>(null);
  const stateRef = useRef(state);
  const pausedRef = useRef(paused);
  const overviewRef = useRef(overview);
  const labelsRef = useRef(lotLabels);
  const startRef = useRef(startAt);

  useEffect(() => {
    cbRef.current = { onTalk, onLot, onNear, onIdleAct };
  }, [onTalk, onLot, onNear, onIdleAct]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    let engine: TownEngine;
    try {
      engine = new TownEngine(
        canvas,
        {
          onTalk: (id) => cbRef.current.onTalk?.(id),
          onLot: (id) => cbRef.current.onLot?.(id),
          onNear: (n) => cbRef.current.onNear?.(n),
          onIdleAct: () => cbRef.current.onIdleAct?.(),
        },
        TOWN_WORLD,
        startRef.current,
      );
    } catch {
      // no 2D canvas: the page around the stage still works
      return;
    }
    engineRef.current = engine;
    engine.setState(stateRef.current);
    engine.setPaused(pausedRef.current);
    engine.setOverview(overviewRef.current);
    engine.setLotLabels(labelsRef.current ?? {});
    engine.setInset(insetRef.current.right, insetRef.current.bottom);
    engine.setSpeaking(speakingRef.current);
    engine.setSafe(safeRef.current);
    engine.setHint(hintRef.current);
    engine.setPeek(peekRef.current);
    engine.setFull(fullRef.current);
    engine.focusOn(focusRef.current);
    const fit = () => engine.resize(box.clientWidth, box.clientHeight);
    fit();
    engine.start();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(box);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => engine.setVisible(entries.some((e) => e.isIntersecting))) : null;
    io?.observe(box);

    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const p = local(e);
      engine.pointerMove(p.x, p.y);
    };
    const onLeave = () => engine.pointerLeave();
    const onClick = (e: MouseEvent) => {
      const p = local(e);
      engine.click(p.x, p.y);
    };
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown';
      // letting go always counts, so no key stays held; pressing only when the keys are the town's
      if (down && (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || dialogOpen())) return;
      // Enter / Space on a button or a link belong to that control
      if ((e.code === 'Enter' || e.code === 'Space') && e.target instanceof HTMLElement && e.target !== document.body && e.target !== canvas) return;
      if (engine.key(e.code, down) && down) e.preventDefault();
    };
    const onBlur = () => engine.releaseKeys();
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      ro?.disconnect();
      io?.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
    engineRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    pausedRef.current = paused;
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    overviewRef.current = overview;
    engineRef.current?.setOverview(overview);
  }, [overview]);

  useEffect(() => {
    labelsRef.current = lotLabels;
    engineRef.current?.setLotLabels(lotLabels ?? {});
  }, [lotLabels]);

  useEffect(() => {
    insetRef.current = { right: insetRight, bottom: insetBottom };
    engineRef.current?.setInset(insetRight, insetBottom);
  }, [insetRight, insetBottom]);

  useEffect(() => {
    speakingRef.current = speaking;
    engineRef.current?.setSpeaking(speaking);
  }, [speaking]);

  useEffect(() => {
    safeRef.current = { top: safeTop, right: safeRight, bottom: safeBottom, left: safeLeft };
    engineRef.current?.setSafe(safeRef.current);
  }, [safeTop, safeRight, safeBottom, safeLeft]);

  useEffect(() => {
    hintRef.current = hint;
    engineRef.current?.setHint(hint);
  }, [hint]);

  useEffect(() => {
    peekRef.current = peek;
    engineRef.current?.setPeek(peek);
  }, [peek]);

  useEffect(() => {
    fullRef.current = full;
    engineRef.current?.setFull(full);
  }, [full]);

  useImperativeHandle(
    ref,
    () => ({
      focusOn: (id) => {
        focusRef.current = id;
        engineRef.current?.focusOn(id);
      },
      emote: (target, kind) => engineRef.current?.emote(target, kind),
      act: (target, anim) => engineRef.current?.act(target, anim),
      burst: (kind, at, to) => engineRef.current?.burst(kind, at, to),
      walkTo: (id, then) => engineRef.current?.walkTo(id, then) ?? false,
      pointOf: (target) => engineRef.current?.screenPointOf(target) ?? null,
      float: (target, text) => engineRef.current?.float(target, text),
      celebrate: (id) => engineRef.current?.celebrate(id) ?? 0,
      focus: () => canvasRef.current?.focus({ preventScroll: true }),
      box: () => boxRef.current,
      rect: () => boxRef.current?.getBoundingClientRect() ?? null,
    }),
    [],
  );

  return (
    <div ref={boxRef} className={'town-stage' + (className ? ' ' + className : '')}>
      <canvas ref={canvasRef} className="town-stage-canvas" role="img" aria-label={label ?? 'Thị trấn'} tabIndex={0} />
      {children}
    </div>
  );
}
