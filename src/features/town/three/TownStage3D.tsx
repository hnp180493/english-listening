import { LoaderCircle } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { TOWN_WORLD, type PlaceId } from '../../../data/townWorld';
import type { MapResident, MapSnapshot, Marker, SafeInsets, TownStageHandle, TownStageProps } from '../engine/stage';
import { warpSpot } from '../map/mapGeo';
import type { TalkSetting } from '../engine/staging';
import { talkIsFar, TownEngine3D } from './scene/engine3d';

function isTyping(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!el.closest('[data-popover], [role="dialog"], dialog, [role="radiogroup"], [role="tablist"], [role="listbox"], [role="menu"], [role="slider"]');
}

function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]');
}

/** What the map reads from the engine (engine/stage.ts MapSnapshot). */
function snapshotOf(e: TownEngine3D | null, marker: Readonly<Record<string, Marker>>): MapSnapshot | null {
  if (!e) return null;
  const p = e.sim.player;
  const residents: MapResident[] = [];
  for (const r of e.sim.residents.values()) residents.push({ id: r.place.id, x: r.x, y: r.y, marker: marker[r.place.id] ?? null, inside: r.hidden });
  const view = e.mapView();
  return { player: { x: p.x, y: p.y, heading: p.yaw ?? (p.oct * Math.PI) / 4 }, residents, goal: e.sim.goal, cameraYaw: view.yaw, away: view.away };
}

const LAYER = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } as const;

/** A lost graphics context gets this long (ms) to come back before the page is told the 3D town is gone. */
const RESTORE_WAIT_MS = 3000;

export interface TownStage3DProps extends TownStageProps {
  /**
   * No world: this browser cannot draw the 3D town (no WebGL 2 on a real graphics card, or the context was lost and
   * did not come back). The same box, handle and children, without the canvases: nothing walks, so every "walk
   * there, then…" says there is no way and the page goes straight to the conversation or the panel. The page puts
   * its own calm card and the list of residents inside (TownPage `town-flat`). One component either way, so an
   * open panel (a child) stays mounted when the world goes away.
   */
  flat?: boolean;
}

/**
 * The town in real 3D (three.js): the simulation of engine/sim.ts drawn as a soft pastel diorama with lights and
 * shadows (scene/engine3d.ts); props and handle in engine/stage.ts. Click or tap to walk, a resident to talk, a lot on offer to build;
 * arrows / W A S D steer the player directly (relative to the camera, Shift runs), Enter / E / Space acts; a pinch zooms, and the wheel too in full screen, with Ctrl / ⌘, or
 * once the town has the keyboard (else the wheel scrolls the page); a right-button drag turns the view.
 */
export default function TownStage3D({
  flat = false,
  state,
  onTalk,
  onLot,
  onNear,
  onIdleAct,
  onActivity,
  onTalkCancel,
  onReady,
  onFail,
  speaking = null,
  visitorIn = true,
  inset,
  paused = false,
  safe,
  hint = null,
  full = false,
  overview = false,
  lotLabels,
  startAt,
  label,
  className,
  children,
  ref,
}: TownStage3DProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TownEngine3D | null>(null);
  const flatRef = useRef(flat);
  const [ready, setReady] = useState(false);
  /** Made again after a lost graphics context came back. */
  const [generation, setGeneration] = useState(0);
  const cbRef = useRef({ onTalk, onLot, onNear, onIdleAct, onActivity, onTalkCancel, onReady, onFail });
  const insetRight = inset?.right ?? 0;
  const insetBottom = inset?.bottom ?? 0;
  const safeTop = safe?.top ?? 0;
  const safeRight = safe?.right ?? 0;
  const safeBottom = safe?.bottom ?? 0;
  const safeLeft = safe?.left ?? 0;
  /** Everything the engine is told, kept so a re-made engine (strict mode, a lost context) starts where it was. */
  const latest = useRef({
    state,
    paused,
    overview,
    lotLabels,
    inset: { right: insetRight, bottom: insetBottom },
    speaking,
    visitorIn,
    safe: { top: safeTop, right: safeRight, bottom: safeBottom, left: safeLeft } as SafeInsets,
    hint,
    full,
    /** The talk staged now (made again with the engine: there at once), and its ready not yet run. */
    talk: null as { placeId: PlaceId; setting: TalkSetting; visitor: PlaceId | null; ready: (() => void) | null } | null,
    startAt,
  });

  useEffect(() => {
    cbRef.current = { onTalk, onLot, onNear, onIdleAct, onActivity, onTalkCancel, onReady, onFail };
  }, [onTalk, onLot, onNear, onIdleAct, onActivity, onTalkCancel, onReady, onFail]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const box = boxRef.current;
    if (flat || !canvas || !overlay || !box) return;
    const life: { gone: boolean; engine: TownEngine3D | null } = { gone: false, engine: null };

    const cleanups: (() => void)[] = [];
    const second = { id: 0 };
    // the loading card paints first; the town is built in the next frame
    const startId = requestAnimationFrame(() => {
      if (life.gone) return;
      try {
        life.engine = new TownEngine3D(
          canvas,
          overlay,
          skyRef.current,
          {
            onTalk: (id, inPerson) => cbRef.current.onTalk?.(id, inPerson),
            onLot: (id) => cbRef.current.onLot?.(id),
            onNear: (n) => cbRef.current.onNear?.(n),
            onIdleAct: () => cbRef.current.onIdleAct?.(),
            onActivity: (id) => cbRef.current.onActivity?.(id),
            onTalkCancel: () => {
              latest.current.talk = null;
              cbRef.current.onTalkCancel?.();
            },
          },
          TOWN_WORLD,
          latest.current.startAt,
        );
      } catch {
        // no graphics context after all: the page shows the town without a world (flat)
        cbRef.current.onFail?.();
        return;
      }
      // the rest a frame later: making the town and laying out what is built are two slices, not one long task
      second.id = requestAnimationFrame(() => {
        if (life.gone || !life.engine) return;
        const e = life.engine;
        engineRef.current = e;
        const l = latest.current;
        e.setState(l.state);
        e.setPaused(l.paused);
        e.setOverview(l.overview);
        e.setLotLabels(l.lotLabels ?? {});
        e.setInset(l.inset.right, l.inset.bottom);
        e.setSpeaking(l.speaking);
        e.setVisitorIn(l.visitorIn);
        e.setSafe(l.safe);
        e.setHint(l.hint);
        e.setFull(l.full);
        const fit = () => e.resize(box.clientWidth, box.clientHeight);
        fit();
        // a talk staged before the engine was there (a link), or by the one before it (a lost context): there at once
        const talk = l.talk;
        if (talk) {
          const ready = talk.ready;
          talk.ready = null;
          e.talkAt(talk.placeId, talk.setting, { visitor: talk.visitor, instant: true }, () => ready?.());
        }
        e.whenReady(() => {
          if (life.gone) return;
          setReady(true);
          cbRef.current.onReady?.();
        });
        e.start();

        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
        ro?.observe(box);
        const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => e.setVisible(entries.some((x) => x.isIntersecting))) : null;
        io?.observe(box);

        const local = (ev: { clientX: number; clientY: number }) => {
          const r = canvas.getBoundingClientRect();
          return { x: ev.clientX - r.left, y: ev.clientY - r.top };
        };
        // pointers: a click walks, a right-button drag turns the view, two fingers pinch to zoom
        const touches = new Map<number, { x: number; y: number }>();
        let drag: { x: number; y: number; turned: number; button: number } | null = null;
        let pinch = 0;
        let swallowClick = false;
        let swallowTimer = 0;
        const onDown = (ev: PointerEvent) => {
          const p = local(ev);
          if (ev.pointerType === 'touch') {
            touches.set(ev.pointerId, p);
            if (touches.size === 2) {
              const [a, b] = [...touches.values()];
              pinch = Math.hypot(a.x - b.x, a.y - b.y);
            }
            return;
          }
          if (ev.button === 2 || ev.button === 1) {
            drag = { x: p.x, y: p.y, turned: 0, button: ev.button };
            // turning the view: no square under the pointer meanwhile
            e.pointerLeave();
            canvas.setPointerCapture?.(ev.pointerId);
            ev.preventDefault();
          }
        };
        const onMove = (ev: PointerEvent) => {
          const p = local(ev);
          if (ev.pointerType === 'touch') {
            if (!touches.has(ev.pointerId)) return;
            touches.set(ev.pointerId, p);
            if (touches.size === 2 && pinch > 0) {
              const [a, b] = [...touches.values()];
              const d = Math.hypot(a.x - b.x, a.y - b.y);
              if (d > 0) {
                e.zoomBy({ pinch: d / pinch });
                pinch = d;
                swallowClick = true;
              }
            }
            return;
          }
          if (drag) {
            const dx = p.x - drag.x;
            drag.x = p.x;
            drag.turned += Math.abs(dx);
            e.turnBy(dx);
            return;
          }
          if (ev.pointerType === 'mouse') e.pointerMove(p.x, p.y);
        };
        const onUp = (ev: PointerEvent) => {
          if (ev.pointerType === 'touch') {
            touches.delete(ev.pointerId);
            if (touches.size < 2) pinch = 0;
            // the gesture is over: a click it causes still lands in this task, the next tap walks
            if (touches.size === 0 && swallowClick) {
              window.clearTimeout(swallowTimer);
              swallowTimer = window.setTimeout(() => {
                swallowClick = false;
              }, 0);
            }
            return;
          }
          if (drag) {
            canvas.releasePointerCapture?.(ev.pointerId);
            drag = null;
          }
        };
        const onLeave = () => e.pointerLeave();
        const onClick = (ev: MouseEvent) => {
          if (swallowClick) return;
          const p = local(ev);
          e.click(p.x, p.y);
        };
        const onWheel = (ev: WheelEvent) => {
          // the wheel scrolls the page past the town, unless the town is the page (full screen), Ctrl / ⌘ is held, or the
          // town has the keyboard (a click or Tab put it there)
          if (!latest.current.full && !ev.ctrlKey && !ev.metaKey && document.activeElement !== canvas) return;
          ev.preventDefault();
          const k = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
          e.zoomBy({ wheel: Math.max(-200, Math.min(200, ev.deltaY * k)) });
        };
        const onMenu = (ev: Event) => ev.preventDefault();
        const onKey = (ev: KeyboardEvent) => {
          const down = ev.type === 'keydown';
          if (down && (ev.ctrlKey || ev.metaKey || ev.altKey || isTyping(ev.target) || dialogOpen())) return;
          if ((ev.code === 'Enter' || ev.code === 'Space') && ev.target instanceof HTMLElement && ev.target !== document.body && ev.target !== canvas) return;
          if (e.key(ev.code, down) && down) ev.preventDefault();
        };
        const onBlur = () => e.releaseKeys();
        // the graphics card was taken away (a driver reset, too many contexts): stop drawing and wait for it; when it
        // comes back the town is built again, when it does not the page goes on without the world
        let lostTimer = 0;
        const onLost = (ev: Event) => {
          ev.preventDefault();
          e.stop();
          window.clearTimeout(lostTimer);
          lostTimer = window.setTimeout(() => {
            if (!life.gone) cbRef.current.onFail?.();
          }, RESTORE_WAIT_MS);
        };
        const onRestored = () => {
          window.clearTimeout(lostTimer);
          if (!life.gone) setGeneration((g) => g + 1);
        };
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onLeave);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', onMenu);
        canvas.addEventListener('webglcontextlost', onLost);
        canvas.addEventListener('webglcontextrestored', onRestored);
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        window.addEventListener('blur', onBlur);
        cleanups.push(() => {
          ro?.disconnect();
          io?.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerup', onUp);
          canvas.removeEventListener('pointercancel', onUp);
          canvas.removeEventListener('pointerleave', onLeave);
          canvas.removeEventListener('click', onClick);
          canvas.removeEventListener('wheel', onWheel);
          canvas.removeEventListener('contextmenu', onMenu);
          canvas.removeEventListener('webglcontextlost', onLost);
          canvas.removeEventListener('webglcontextrestored', onRestored);
          window.clearTimeout(lostTimer);
          window.clearTimeout(swallowTimer);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
          window.removeEventListener('blur', onBlur);
        });
      });
    });
    return () => {
      life.gone = true;
      cancelAnimationFrame(startId);
      cancelAnimationFrame(second.id);
      for (const c of cleanups) c();
      life.engine?.destroy();
      engineRef.current = null;
      setReady(false);
    };
  }, [generation, flat]);

  useEffect(() => {
    flatRef.current = flat;
  }, [flat]);

  useEffect(() => {
    latest.current.state = state;
    engineRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    latest.current.paused = paused;
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    latest.current.overview = overview;
    engineRef.current?.setOverview(overview);
  }, [overview]);

  useEffect(() => {
    latest.current.lotLabels = lotLabels;
    engineRef.current?.setLotLabels(lotLabels ?? {});
  }, [lotLabels]);

  useEffect(() => {
    latest.current.inset = { right: insetRight, bottom: insetBottom };
    engineRef.current?.setInset(insetRight, insetBottom);
  }, [insetRight, insetBottom]);

  useEffect(() => {
    latest.current.speaking = speaking;
    engineRef.current?.setSpeaking(speaking);
  }, [speaking]);

  useEffect(() => {
    latest.current.visitorIn = visitorIn;
    engineRef.current?.setVisitorIn(visitorIn);
  }, [visitorIn]);

  useEffect(() => {
    latest.current.safe = { top: safeTop, right: safeRight, bottom: safeBottom, left: safeLeft };
    engineRef.current?.setSafe(latest.current.safe);
  }, [safeTop, safeRight, safeBottom, safeLeft]);

  useEffect(() => {
    latest.current.hint = hint;
    engineRef.current?.setHint(hint);
  }, [hint]);

  useEffect(() => {
    latest.current.full = full;
    engineRef.current?.setFull(full);
  }, [full]);

  useImperativeHandle(
    ref,
    (): TownStageHandle => ({
      talkAt: (placeId, setting, opts, ready) => {
        if (flatRef.current) return false;
        const e = engineRef.current;
        latest.current.talk = { placeId, setting, visitor: opts.visitor ?? null, ready: e ? null : ready };
        if (!e) return true;
        return e.talkAt(placeId, setting, opts, ready);
      },
      endTalk: () => {
        latest.current.talk = null;
        engineRef.current?.endTalk();
      },
      meet: (placeId, ready) => (flatRef.current ? false : (engineRef.current?.meet(placeId, ready) ?? false)),
      crowd: (except) => {
        if (!flatRef.current) engineRef.current?.crowd(except);
      },
      emote: (target, kind) => engineRef.current?.emote(target, kind),
      act: (target, anim) => engineRef.current?.act(target, anim),
      burst: (kind, at, to) => engineRef.current?.burst(kind, at, to),
      walkTo: (id, then) => engineRef.current?.walkTo(id, then) ?? false,
      walkToActivity: (id, then) => {
        const e = flatRef.current ? null : engineRef.current;
        if (!e) return false;
        // far away (the map's WARP_FAR, as a far talk): a dip to dark and the player is there, not a walk of ten seconds
        const spot = TOWN_WORLD.activities?.[id];
        if (spot && talkIsFar(e.sim.player, { x: spot.stand.x + 0.5, y: spot.stand.y + 0.5 })) {
          const snap = snapshotOf(e, latest.current.state.marker);
          const at = snap ? warpSpot({ kind: 'activity', id }, snap.residents.filter((r) => !r.inside), snap.player.heading, TOWN_WORLD) : null;
          if (at && e.warpPlayer(at, at.heading, then)) return true;
        }
        return e.walkToActivity(id, then);
      },
      pointOf: (target) => engineRef.current?.screenPointOf(target) ?? null,
      float: (target, text) => engineRef.current?.float(target, text),
      celebrate: (id) => engineRef.current?.celebrate(id) ?? 0,
      focus: () => {
        if (canvasRef.current) {
          canvasRef.current.focus({ preventScroll: true });
          return;
        }
        // no world: the first resident of the list, once the panel that was open has given its place back to it
        requestAnimationFrame(() => boxRef.current?.querySelector<HTMLElement>('.town-flat button')?.focus({ preventScroll: true }));
      },
      box: () => boxRef.current,
      rect: () => boxRef.current?.getBoundingClientRect() ?? null,
      mapSnapshot: () => snapshotOf(flatRef.current ? null : engineRef.current, latest.current.state.marker),
      fishing: (phase, tier) => {
        if (!flatRef.current) engineRef.current?.fishing(phase, tier);
      },
      travelTo: (target, mode, then) => {
        const e = flatRef.current ? null : engineRef.current;
        if (!e) return false;
        if (mode === 'walk') {
          if (target.kind === 'place') return e.sim.walkToDoor(target.id, then);
          if (target.kind === 'resident') return e.walkTo(target.id, then);
          if (target.kind === 'activity') return e.walkToActivity(target.id, then);
          return e.sim.walkToTile({ x: Math.floor(target.x), y: Math.floor(target.y) }, then);
        }
        const snap = snapshotOf(e, latest.current.state.marker);
        if (!snap) return false;
        const spot = warpSpot(target, snap.residents.filter((r) => !r.inside), snap.player.heading, TOWN_WORLD);
        return !!spot && e.warpPlayer(spot, spot.heading, then);
      },
    }),
    [],
  );

  return (
    <div
      ref={boxRef}
      className={'town-stage' + (flat ? ' is-flat' : '') + (className ? ' ' + className : '')}
      role={flat ? 'region' : undefined}
      aria-label={flat ? (label ?? 'Thị trấn') : undefined}
    >
      {!flat && (
        <>
          <canvas ref={skyRef} style={LAYER} aria-hidden="true" />
          <canvas key={generation} ref={canvasRef} className="town-stage-canvas" style={{ position: 'relative' }} role="img" aria-label={label ?? 'Thị trấn'} tabIndex={0} />
          <canvas ref={overlayRef} style={LAYER} aria-hidden="true" />
          {!ready && (
            <div className="town-loading" role="status">
              <p className="town-loading-text">
                <Icon icon={LoaderCircle} size={18} className="icon-spin" />
                Đang dựng thị trấn…
              </p>
            </div>
          )}
        </>
      )}
      {children}
    </div>
  );
}
