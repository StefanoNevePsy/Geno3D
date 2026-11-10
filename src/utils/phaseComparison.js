import * as THREE from 'three';
import { DEFAULT_PHASES } from '../constants';
import { createCameraForProjection, drawOverlayLabelsAndGaze } from './exportUtils';
import { applyPieceTransform3D, buildLinkMeshGroup, createPieceGeometry, getPieceMaterial, updateGazePinOnGroup } from './threeUtils';

const GHOST_COLORS = ['#3d6385', '#a35635'];
const EMPTY = { pieces: [], links: [] };
const POSE = ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotationZ'];
const TINT = '#f5f2eb';
const HOLD = 600;
const TRAVEL = 1500;
export const TIMELINE_DURATION = HOLD * 3 + TRAVEL * 2;

function normalizeName(piece) {
  const name = piece.name?.trim().normalize('NFC').toLocaleLowerCase('it');
  return name && !['senza nome', 'nuovo membro'].includes(name) ? name : null;
}

function uniqueNames(pieces) {
  const names = new Map();
  for (const piece of pieces) {
    const name = normalizeName(piece);
    if (name) names.set(name, names.has(name) ? null : piece);
  }
  return names;
}

export function pairPieces(before, after) {
  const ids = new Map(after.map((piece) => [piece.id, piece]));
  const leftNames = uniqueNames(before);
  const rightNames = uniqueNames(after);
  const reserved = new Set(before.filter((piece) => ids.has(piece.id)).map((piece) => ids.get(piece.id)));
  const used = new Set(reserved);
  const pairs = before.map((piece) => {
    let match = ids.get(piece.id);
    if (!match) {
      const name = normalizeName(piece);
      const candidate = leftNames.get(name) === piece && rightNames.get(name);
      if (candidate && !used.has(candidate)) match = candidate;
    }
    if (match) used.add(match);
    return [piece, match ?? null];
  });
  for (const piece of after) {
    if (!used.has(piece)) pairs.push([null, piece]);
  }
  return pairs;
}

function sameLook(a, b) {
  return a.shape === b.shape && a.size === b.size && a.color === b.color;
}

function pieceModel(piece, material, showPin = true) {
  const model = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.name = 'tilt-pivot';
  const body = new THREE.Mesh(createPieceGeometry(piece.shape, piece.size), material);
  body.name = 'piece-body';
  pivot.add(body);
  if (showPin) updateGazePinOnGroup(pivot, piece);
  model.add(pivot);
  applyPieceTransform3D(model, piece);
  return model;
}

function setOpacity(model, opacity) {
  model.visible = opacity > 0.005;
  if (!model.visible) return;
  model.traverse((part) => {
    if (!part.isMesh) return;
    const material = part.material;
    const transparent = opacity < 0.995;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.depthWrite = !transparent;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
  });
}

function phaseAt(time) {
  const firstEnd = HOLD + TRAVEL;
  const secondStart = firstEnd + HOLD;
  if (time <= firstEnd) return [0, THREE.MathUtils.clamp((time - HOLD) / TRAVEL, 0, 1)];
  return [1, THREE.MathUtils.clamp((time - secondStart) / TRAVEL, 0, 1)];
}

function caption(ctx, text, color, x, y, width) {
  const height = Math.round(width * 0.07);
  ctx.fillStyle = '#f9f7f0';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(height * 0.49)}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + height * 0.48, y + height * 0.5, width - height);
  return height;
}

export function createPhaseComparison(phasesData, tray) {
  const phases = DEFAULT_PHASES.map(({ id }) => phasesData[id] || EMPTY);
  const allPieces = phases.flatMap(({ pieces }) => pieces);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TINT);
  const trayCopy = tray?.clone(true);
  if (trayCopy) scene.add(trayCopy);
  scene.add(new THREE.HemisphereLight('#fffdf9', '#d6cec0', 0.98));
  const key = new THREE.DirectionalLight('#fff8ec', 1.38);
  key.position.set(11, 21, 13);
  const fill = new THREE.DirectionalLight('#e2eaf2', 0.48);
  fill.position.set(-13, 11, -9);
  scene.add(key, fill);

  const geometries = new Set();
  const materials = new Set();
  const stills = phases.map(({ pieces, links }) => {
    const group = new THREE.Group();
    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    for (const piece of pieces) group.add(pieceModel(piece, getPieceMaterial(piece.color)));
    for (const link of links) {
      const source = byId.get(link.sourceId);
      const target = byId.get(link.targetId);
      if (!source || !target) continue;
      const model = buildLinkMeshGroup(link, source, target);
      model.traverse((part) => {
        if (part.geometry) geometries.add(part.geometry);
        if (part.material) materials.add(part.material);
      });
      group.add(model);
    }
    return group;
  });

  const ghosts = new Map();
  const makeGhosts = (reference) => {
    if (ghosts.has(reference)) return ghosts.get(reference);
    const group = new THREE.Group();
    for (let index = 0; index < reference; index++) {
      const material = new THREE.MeshBasicMaterial({
        color: GHOST_COLORS[index], transparent: true, opacity: 0.39, depthWrite: false, toneMapped: false
      });
      materials.add(material);
      for (const [piece, current] of pairPieces(phases[index].pieces, phases[reference].pieces)) {
        if (!piece) continue;
        if (current && sameLook(piece, current) && POSE.every((key) => Math.abs((piece[key] || 0) - (current[key] || 0)) < 0.005)) continue;
        group.add(pieceModel(piece, material, false));
      }
    }
    ghosts.set(reference, group);
    return group;
  };

  const animatedModel = (piece) => {
    const model = pieceModel(piece, getPieceMaterial(piece.color));
    model.traverse((part) => {
      if (!part.isMesh) return;
      part.material = part.material.clone();
      materials.add(part.material);
    });
    return model;
  };

  const motion = new THREE.Group();
  const timeline = new Map();
  const segments = (index) => {
    if (!timeline.has(index)) {
      timeline.set(index, pairPieces(phases[index].pieces, phases[index + 1].pieces).map(([a, b]) => ({
        a, b,
        first: a && animatedModel(a),
        second: b && (!a || !sameLook(a, b)) ? animatedModel(b) : null,
        pose: {}
      })));
    }
    return timeline.get(index);
  };

  const frame = (ctx, camera, group, labels, view, x, y, width, height, compact = false) => {
    const size = renderer.domElement;
    if (size.width !== width || size.height !== height) renderer.setSize(width, height, false);
    scene.add(group);
    try {
      renderer.render(scene, camera);
      ctx.drawImage(size, x, y, width, height);
    } finally {
      scene.remove(group);
    }
    if (labels.length) {
      ctx.save();
      ctx.translate(x, y);
      const names = compact ? labels.map((piece) => ({ ...piece, role: '' })) : labels;
      drawOverlayLabelsAndGaze(ctx, width, height, camera, names, view, width / (compact ? 485 : 850));
      ctx.restore();
    }
  };

  const draw = (canvas, { mode, view, reference, labels, framing, time = 0 }) => {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const panelCount = mode === 'side' ? 3 : 1;
    const gap = panelCount > 1 ? Math.round(width * 0.006) : 0;
    const panelWidth = Math.floor((width - gap * (panelCount - 1)) / panelCount);
    const header = Math.round(panelWidth * 0.07);
    const camera = createCameraForProjection(view, panelWidth / (height - header), null, allPieces, framing);
    ctx.fillStyle = '#dbd6cb';
    ctx.fillRect(0, 0, width, height);

    if (mode === 'side') {
      phases.forEach((phase, index) => {
        const x = index * (panelWidth + gap);
        caption(ctx, DEFAULT_PHASES[index].shortName + (phase.pieces.length ? '' : ' · Piano vuoto'), '#293b32', x, 0, panelWidth);
        frame(ctx, camera, stills[index], labels ? phase.pieces : [], view, x, header, panelWidth, height - header, true);
      });
    } else if (mode === 'ghost') {
      const phase = phases[reference];
      const previous = makeGhosts(reference);
      const group = new THREE.Group();
      group.add(stills[reference], previous);
      const legend = reference === 1 ? 'Blu: Passato' : 'Blu: Passato  ·  Terra: Presente';
      caption(ctx, `${DEFAULT_PHASES[reference].shortName} · ${legend}`, '#293b32', 0, 0, width);
      frame(ctx, camera, group, labels ? phase.pieces : [], view, 0, header, width, height - header);
    } else {
      const [index, progress] = phaseAt(time);
      const t = progress * progress * (3 - 2 * progress);
      const frameLabels = [];
      motion.clear();
      for (const { a, b, first, second, pose } of segments(index)) {
        if (a && b) {
          for (const key of POSE) {
            const start = a[key] || 0;
            const end = b[key] || 0;
            const delta = end - start;
            pose[key] = start + (key.startsWith('rotation') ? Math.atan2(Math.sin(delta), Math.cos(delta)) : delta) * t;
          }
        } else {
          Object.assign(pose, a || b);
        }
        if (first) {
          applyPieceTransform3D(first, pose);
          setOpacity(first, second || !b ? 1 - t : 1);
          motion.add(first);
        }
        if (second) {
          applyPieceTransform3D(second, pose);
          setOpacity(second, t);
          motion.add(second);
        }
        const visible = a && b ? (t < 0.5 ? a : b) : (a && t < 0.55 ? a : b && t > 0.45 ? b : null);
        if (labels && visible) frameLabels.push({ ...visible, ...pose, role: '' });
      }
      const title = progress === 0 || progress === 1
        ? DEFAULT_PHASES[index + Number(progress === 1)].shortName
        : `${DEFAULT_PHASES[index].shortName} → ${DEFAULT_PHASES[index + 1].shortName}`;
      caption(ctx, title, '#293b32', 0, 0, width);
      frame(ctx, camera, motion, frameLabels, view, 0, header, width, height - header);
    }
  };

  return {
    draw,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}

export async function encodeComparisonGif(draw, signal, onProgress) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  const frames = 60;
  for (let index = 0; index <= frames; index++) {
    if (signal.aborted) return null;
    draw(canvas, index / frames * TIMELINE_DURATION);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 192);
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, {
      palette, delay: TIMELINE_DURATION / frames, repeat: 0
    });
    onProgress(index / frames);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
