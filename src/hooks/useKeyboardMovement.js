import { useEffect, useRef } from 'react';
import { TRAY_PLAYABLE_RADIUS } from '../constants';
import { calculateDragPosition, getPieceDimensions } from '../utils/physicsUtils';

const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
const defaultAxes = { forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } };

function isEditing(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable || Boolean(target.closest('input, textarea, select'))
  );
}

export default function useKeyboardMovement({
  pieceId, contextKey, pieces, enabled, getAxes, onMove, onMovingChange
}) {
  const latest = useRef({ pieces, getAxes, onMove });
  latest.current = { pieces, getAxes, onMove };

  useEffect(() => {
    if (!pieceId || !enabled) return;

    const held = new Set();
    let session = null;
    let frame = null;
    let accelerated = false;

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      held.clear();
      if (session?.moved) onMovingChange(false);
      session = null;
    };

    const advance = (seconds, now) => {
      const { pieces: currentPieces, getAxes: cameraAxes, onMove: update } = latest.current;
      const piece = currentPieces.find((item) => item.id === pieceId);
      if (!piece) {
        stop();
        return;
      }

      const pressed = (key, alias) => Number(held.has(key) || held.has(alias));
      const forward = pressed('w', 'arrowup') - pressed('s', 'arrowdown');
      const right = pressed('d', 'arrowright') - pressed('a', 'arrowleft');
      if ((!forward && !right) || now < session.pauseUntil) return;

      const axes = cameraAxes?.() ?? defaultAxes;
      const speed = (accelerated ? 6 : 3) * ((piece.y || 0) > 0.05 ? 0.55 : 1);
      const step = speed * seconds / Math.hypot(forward, right);

      // Conserva il bersaglio anche quando una collisione ferma il pezzo.
      // Così, continuando verso il centro di un altro pezzo, si raggiunge la sua sommità.
      session.x += (axes.forward.x * forward + axes.right.x * right) * step;
      session.z += (axes.forward.z * forward + axes.right.z * right) * step;
      const radius = TRAY_PLAYABLE_RADIUS - getPieceDimensions(piece).collisionRadius;
      const distance = Math.hypot(session.x, session.z);
      if (distance > radius) {
        session.x *= radius / distance;
        session.z *= radius / distance;
      }

      const position = calculateDragPosition(session.x, session.z, pieceId, currentPieces);
      const last = session.lastPosition ?? piece;
      if (position.x === last.x && position.z === last.z && position.y === (last.y || 0)) return;

      if (position.y > (last.y || 0) + 0.05) session.pauseUntil = now + 220;
      if (!session.moved) onMovingChange(true);
      update(pieceId, position, session.moved);
      session.lastPosition = position;
      session.moved = true;
    };

    const tick = (now) => {
      frame = null;
      const seconds = Math.max(0, Math.min((now - session.lastTime) / 1000, 0.05));
      session.lastTime = now;
      advance(seconds, now);
      if (session) frame = requestAnimationFrame(tick);
    };

    const keydown = (event) => {
      const key = event.key.toLowerCase();
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isEditing(event.target)) {
        stop();
        return;
      }
      if (key === 'escape' && session) {
        event.preventDefault();
        stop();
        return;
      }
      accelerated = event.shiftKey;
      if (!movementKeys.has(key)) {
        if (key !== 'shift') stop();
        return;
      }

      event.preventDefault();
      if (event.repeat) return;
      held.add(key);
      if (session) return;

      const piece = latest.current.pieces.find((item) => item.id === pieceId);
      if (!piece) return;
      const now = performance.now();
      session = { x: piece.x, z: piece.z, lastTime: now, pauseUntil: 0, moved: false };
      // Un tocco breve sposta comunque il pezzo di un piccolo passo.
      advance(0.035, now);
      if (session) frame = requestAnimationFrame(tick);
    };

    const keyup = (event) => {
      accelerated = event.shiftKey;
      if (held.delete(event.key.toLowerCase()) && held.size === 0) stop();
    };

    const focusin = (event) => { if (isEditing(event.target)) stop(); };
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', stop);
    window.addEventListener('pointerdown', stop, true);
    document.addEventListener('focusin', focusin);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', stop);
      window.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('focusin', focusin);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [pieceId, contextKey, enabled, onMovingChange]);
}
