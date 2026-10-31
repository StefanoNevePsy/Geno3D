import * as THREE from 'three';
import { PIECE_COLORS, PIECE_SIZES, LINK_TYPES } from '../constants';
import { getPieceDimensions } from './physicsUtils';

// Cache globali per evitare allocazioni ridondanti e ridurre il consumo energetico GPU/CPU
const textureCache = new Map();
const materialCache = new Map();
const geometryCache = new Map();
const sharedHelperGeos = {};
const sharedHelperMats = {};

// Generatore deterministico pseudo-random per texture coerenti
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Genera texture legno + bump map procedurale (risoluzione 256x256: nitida sui pezzi e 4x più leggera in VRAM)
export function getWoodTextures(colorDef) {
  const cacheKey = `wood-${colorDef.id}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const baseColor = new THREE.Color(colorDef.hex);
  const darkGrain = baseColor.clone().multiplyScalar(1 - (colorDef.grainDarkness || 0.08));
  const lightGrain = baseColor.clone().lerp(new THREE.Color('#FFFFFF'), (colorDef.grainDarkness || 0.08) * 0.45);

  ctx.fillStyle = colorDef.hex;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const rand = seededRandom(colorDef.id.split('').reduce((acc, c) => acc + c.charCodeAt(0) * 31, 17));

  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, `#${baseColor.getHexString()}`);
  grad.addColorStop(0.35, `#${lightGrain.getHexString()}`);
  grad.addColorStop(0.7, `#${baseColor.getHexString()}`);
  grad.addColorStop(1, `#${darkGrain.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.globalAlpha = colorDef.isWood ? 0.35 : 0.12;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1.0;

  const numLines = colorDef.isWood ? 90 : 48;
  for (let i = 0; i < numLines; i++) {
    const xBase = (i / numLines) * size;
    const freq = 0.015 + rand() * 0.02;
    const amp = 3 + rand() * 8;
    const phase = rand() * Math.PI * 2;
    const alpha = (colorDef.grainDarkness || 0.06) * (0.35 + rand() * 0.65);

    ctx.strokeStyle = i % 3 === 0
      ? `rgba(255, 248, 235, ${alpha * 0.45})`
      : `rgba(30, 18, 8, ${alpha})`;
    ctx.lineWidth = 0.8 + rand() * 1.2;

    bCtx.strokeStyle = i % 3 === 0 ? 'rgba(200,200,200,0.35)' : 'rgba(60,60,60,0.45)';
    bCtx.lineWidth = ctx.lineWidth;

    ctx.beginPath();
    bCtx.beginPath();
    for (let y = 0; y <= size; y += 16) {
      const offset = Math.sin(y * freq + phase) * amp + Math.cos(y * freq * 0.4) * (amp * 0.5);
      const px = xBase + offset;
      if (y === 0) {
        ctx.moveTo(px, y);
        bCtx.moveTo(px, y);
      } else {
        ctx.lineTo(px, y);
        bCtx.lineTo(px, y);
      }
    }
    ctx.stroke();
    bCtx.stroke();
  }

  const poreCount = colorDef.isWood ? 110 : 35;
  for (let p = 0; p < poreCount; p++) {
    const px = rand() * size;
    const py = rand() * size;
    const len = 4 + rand() * 10;
    ctx.fillStyle = `rgba(25, 15, 5, ${(colorDef.grainDarkness || 0.05) * 0.45})`;
    ctx.fillRect(px, py, 1, len);
    bCtx.fillStyle = 'rgba(45, 45, 45, 0.35)';
    bCtx.fillRect(px, py, 1, len);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  const result = { map, bumpMap };
  textureCache.set(cacheKey, result);
  return result;
}

// Genera texture per il vassoio di lavoro
export function createTrayWoodTexture() {
  if (textureCache.has('tray-wood')) return textureCache.get('tray-wood');

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#EAE0D0';
  ctx.fillRect(0, 0, size, size);

  const rand = seededRandom(4201);

  const numPlanks = 6;
  const plankWidth = size / numPlanks;
  for (let p = 0; p < numPlanks; p++) {
    const x0 = p * plankWidth;
    const toneShift = Math.round((rand() - 0.5) * 10);
    ctx.fillStyle = `rgb(${234 + toneShift}, ${224 + toneShift}, ${208 + toneShift})`;
    ctx.fillRect(x0, 0, plankWidth, size);

    if (p > 0) {
      ctx.strokeStyle = 'rgba(110, 88, 65, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, size);
      ctx.stroke();
    }

    for (let i = 0; i < 36; i++) {
      const lx = x0 + (i / 36) * plankWidth;
      const phase = rand() * Math.PI * 2;
      const amp = 4 + rand() * 9;
      ctx.strokeStyle = `rgba(115, 90, 65, ${0.03 + rand() * 0.045})`;
      ctx.lineWidth = 1 + rand() * 1.2;
      ctx.beginPath();
      for (let y = 0; y <= size; y += 24) {
        const dx = Math.sin(y * 0.009 + phase) * amp;
        const px = Math.min(x0 + plankWidth - 2, Math.max(x0 + 2, lx + dx));
        if (y === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
  }

  const center = size / 2;
  const radGrad = ctx.createRadialGradient(center, center, size * 0.25, center, center, size * 0.5);
  radGrad.addColorStop(0, 'rgba(255, 252, 245, 0.08)');
  radGrad.addColorStop(0.8, 'rgba(160, 135, 105, 0.02)');
  radGrad.addColorStop(1, 'rgba(110, 88, 64, 0.18)');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, size, size);

  const rings = [90, 175, 260, 345, 430];
  rings.forEach((r, idx) => {
    ctx.strokeStyle = idx === 1 ? 'rgba(65, 55, 45, 0.15)' : 'rgba(65, 55, 45, 0.09)';
    ctx.lineWidth = idx === 1 ? 1.8 : 1.2;
    ctx.setLineDash(idx % 2 === 0 ? [6, 8] : []);
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(55, 45, 35, 0.11)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(center - 440, center);
  ctx.lineTo(center + 440, center);
  ctx.moveTo(center, center - 440);
  ctx.lineTo(center, center + 440);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(46, 71, 59, 0.28)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(center - 18, center);
  ctx.lineTo(center + 18, center);
  ctx.moveTo(center, center - 18);
  ctx.lineTo(center, center + 18);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, 5, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('tray-wood', texture);
  return texture;
}

// Materiale cachato per ogni pezzo
export function getPieceMaterial(colorId, isSelected = false) {
  const key = `${colorId}-${isSelected ? 'sel' : 'norm'}`;
  if (materialCache.has(key)) return materialCache.get(key);

  const colorDef = PIECE_COLORS.find((c) => c.id === colorId) || PIECE_COLORS[0];
  const { map, bumpMap } = getWoodTextures(colorDef);

  const mat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map,
    bumpMap,
    bumpScale: colorDef.isWood ? 0.008 : 0.0035,
    roughness: colorDef.roughness || 0.62,
    metalness: 0.03
  });

  if (isSelected) {
    mat.emissive = new THREE.Color('#2E473B');
    mat.emissiveIntensity = 0.18;
  }

  materialCache.set(key, mat);
  return mat;
}

// Helper: crea un profilo rettangolare con angoli arrotondati
function createRoundedRectShape(width, depth, radius) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw * 0.45, hd * 0.45);

  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  return shape;
}

// Crea e memorizza in cache la geometria artigianale del pezzo (ottimizzata per fluidità 60fps e raycasting rapido)
export function createPieceGeometry(shape, sizeId) {
  const key = `${shape}-${sizeId}`;
  if (geometryCache.has(key)) return geometryCache.get(key);

  const sizeDef = PIECE_SIZES.find((s) => s.id === sizeId) || PIECE_SIZES[1];
  const m = sizeDef.multiplier;
  const h = sizeDef.height;
  const w = 1.1 * m;

  let geo;

  switch (shape) {
    case 'cylinder': {
      const rBot = w * 0.57;
      const rTop = w * 0.52;
      const bevel = 0.05 * m;
      const grooveY = h * 0.76;

      const points = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(rBot - bevel, 0),
        new THREE.Vector2(rBot, bevel),
        new THREE.Vector2(rBot * 0.98, grooveY - 0.08 * m),
        new THREE.Vector2(rTop * 0.91, grooveY - 0.03 * m),
        new THREE.Vector2(rTop * 0.87, grooveY),
        new THREE.Vector2(rTop * 0.92, grooveY + 0.03 * m),
        new THREE.Vector2(rTop, grooveY + 0.08 * m),
        new THREE.Vector2(rTop, h - bevel * 1.4),
        new THREE.Vector2(rTop - bevel * 1.2, h - bevel * 0.3),
        new THREE.Vector2(rTop * 0.65, h),
        new THREE.Vector2(0, h)
      ];
      geo = new THREE.LatheGeometry(points, 28);
      break;
    }

    case 'cube': {
      const s = 1.45 * m;
      const bevel = 0.05 * m;
      const rectShape = createRoundedRectShape(s - bevel * 2, s - bevel * 2, 0.13 * m);
      geo = new THREE.ExtrudeGeometry(rectShape, {
        depth: s - bevel * 2,
        bevelEnabled: true,
        bevelSegments: 2,
        curveSegments: 4,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel
      });
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
      break;
    }

    case 'wedge': {
      const baseW = w * 1.15;
      const depth = w * 1.1;
      const bevel = 0.04 * m;
      const shape2d = new THREE.Shape();

      shape2d.moveTo(-baseW / 2, depth * 0.45);
      shape2d.lineTo(baseW / 2, depth * 0.45);
      shape2d.lineTo(0, -depth * 0.55);
      shape2d.closePath();

      geo = new THREE.ExtrudeGeometry(shape2d, {
        depth: h - bevel * 2,
        bevelEnabled: true,
        bevelSegments: 2,
        curveSegments: 3,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel
      });
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
      break;
    }

    case 'sphere': {
      const radius = w * 0.62;
      const baseH = 0.36 * m;
      const points = [];

      points.push(new THREE.Vector2(0, 0));
      points.push(new THREE.Vector2(radius * 0.78, 0));
      points.push(new THREE.Vector2(radius * 0.82, baseH * 0.25));
      points.push(new THREE.Vector2(radius * 0.68, baseH * 0.65));
      points.push(new THREE.Vector2(radius * 0.52, baseH));

      const centerY = baseH + radius * 0.92;
      const startAngle = -Math.acos(0.92) + 0.05;
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const theta = startAngle + (i / steps) * (Math.PI - startAngle);
        const rx = Math.sin(theta) * radius;
        const ry = centerY - Math.cos(theta) * radius;
        points.push(new THREE.Vector2(Math.max(0, rx), ry));
      }
      points.push(new THREE.Vector2(0, centerY + radius));

      geo = new THREE.LatheGeometry(points, 28);
      break;
    }

    case 'token': {
      const diskH = 0.36;
      const diskR = w * 0.68;
      const points = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(diskR - 0.04, 0),
        new THREE.Vector2(diskR, 0.05),
        new THREE.Vector2(diskR, diskH - 0.06),
        new THREE.Vector2(diskR - 0.05, diskH),
        new THREE.Vector2(diskR * 0.68, diskH),
        new THREE.Vector2(diskR * 0.6, diskH - 0.035),
        new THREE.Vector2(0, diskH - 0.035)
      ];
      geo = new THREE.LatheGeometry(points, 28);
      break;
    }

    case 'box':
    default: {
      const bevel = 0.045 * m;
      const bw = w - bevel * 2;
      const bd = w * 0.85 - bevel * 2;
      const rectShape = createRoundedRectShape(bw, bd, 0.11 * m);
      geo = new THREE.ExtrudeGeometry(rectShape, {
        depth: h - bevel * 2,
        bevelEnabled: true,
        bevelSegments: 2,
        curveSegments: 4,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel
      });
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
      break;
    }
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  geometryCache.set(key, geo);
  return geo;
}

// Crea o aggiorna l'intarsio direzionale dello sguardo ("occhio/naso" sul fronte +Z del pezzo)
export function updateGazePinOnGroup(targetGroup, piece) {
  let pinGroup = targetGroup.getObjectByName('front-dot');
  if (!pinGroup) {
    pinGroup = new THREE.Group();
    pinGroup.name = 'front-dot';

    if (!sharedHelperGeos.pinPeg) {
      sharedHelperGeos.pinPeg = new THREE.CylinderGeometry(0.065, 0.065, 0.08, 12);
      sharedHelperGeos.pinPeg.rotateX(Math.PI / 2);
      sharedHelperGeos.pinRing = new THREE.RingGeometry(0.068, 0.105, 16);
      sharedHelperMats.pinDark = new THREE.MeshStandardMaterial({
        color: '#232B26',
        roughness: 0.35,
        metalness: 0.2
      });
      sharedHelperMats.pinBrass = new THREE.MeshStandardMaterial({
        color: '#C8A464',
        roughness: 0.3,
        metalness: 0.55,
        side: THREE.DoubleSide
      });
    }

    const peg = new THREE.Mesh(sharedHelperGeos.pinPeg, sharedHelperMats.pinDark);
    const ring = new THREE.Mesh(sharedHelperGeos.pinRing, sharedHelperMats.pinBrass);
    ring.position.z = 0.042;
    pinGroup.add(peg);
    pinGroup.add(ring);
    targetGroup.add(pinGroup);
  }

  const dims = getPieceDimensions(piece);
  const scale = Math.max(0.75, Math.min(1.25, dims.multiplier));
  pinGroup.scale.setScalar(scale);

  if (piece.shape === 'token') {
    pinGroup.position.set(0, dims.baseHeight - 0.01, dims.gazeZ * 0.72);
    pinGroup.rotation.set(-Math.PI / 2, 0, 0);
  } else {
    pinGroup.position.set(0, dims.gazeY, dims.gazeZ);
    pinGroup.rotation.set(0, 0, 0);
  }
}

// Applica la rotazione tridimensionale completa (asse Y = sguardo, asse X = beccheggio/ribaltamento, asse Z = rollio/fianco)
// garantendo che il punto più basso del pezzo poggi sempre esattamente sul piano d'appoggio (y = 0 locale) senza compenetrare il tavolo
const _tempEuler = new THREE.Euler();
const _tempQuat = new THREE.Quaternion();
const _tempCorner = new THREE.Vector3();

export function applyPieceTransform3D(meshGroup, piece) {
  meshGroup.position.set(piece.x, piece.y || 0, piece.z);
  meshGroup.rotation.set(0, piece.rotationY || 0, 0);

  let tiltGroup = meshGroup.getObjectByName('tilt-pivot');
  if (!tiltGroup) return;

  const rx = piece.rotationX || 0;
  const rz = piece.rotationZ || 0;

  if (Math.abs(rx) < 0.001 && Math.abs(rz) < 0.001) {
    tiltGroup.rotation.set(0, 0, 0);
    tiltGroup.position.set(0, 0, 0);
    return;
  }

  _tempEuler.set(rx, 0, rz, 'ZXY');
  _tempQuat.setFromEuler(_tempEuler);
  tiltGroup.quaternion.copy(_tempQuat);

  const mainMesh = tiltGroup.getObjectByName('piece-body');
  const bbox = mainMesh?.geometry?.boundingBox;

  if (bbox) {
    let minY = Infinity;
    const min = bbox.min;
    const max = bbox.max;

    for (let ix = 0; ix < 2; ix++) {
      for (let iy = 0; iy < 2; iy++) {
        for (let iz = 0; iz < 2; iz++) {
          _tempCorner.set(
            ix ? max.x : min.x,
            iy ? max.y : min.y,
            iz ? max.z : min.z
          );
          _tempCorner.applyQuaternion(_tempQuat);
          if (_tempCorner.y < minY) {
            minY = _tempCorner.y;
          }
        }
      }
    }

    tiltGroup.position.set(0, -minY, 0);
  } else {
    tiltGroup.position.set(0, 0, 0);
  }
}

// Costruisce la geometria 3D specifica per ciascuno dei 5 tipi di filo relazionale sistemico
export function buildLinkMeshGroup(link, sourcePiece, targetPiece) {
  const linkGroup = new THREE.Group();
  const linkTypeDef = LINK_TYPES.find((t) => t.id === link.type) || LINK_TYPES[0];

  const p1 = new THREE.Vector3(sourcePiece.x, (sourcePiece.y || 0) + 0.26, sourcePiece.z);
  const p2 = new THREE.Vector3(targetPiece.x, (targetPiece.y || 0) + 0.26, targetPiece.z);

  const dir = new THREE.Vector3().subVectors(p2, p1);
  const dist = dir.length();
  if (dist < 0.05) return linkGroup;

  const unitDir = dir.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(unitDir, up).normalize();
  if (side.lengthSq() < 0.001) side.set(1, 0, 0);

  const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const baseArcY = Math.max(0.12, Math.min(p1.y, p2.y) + Math.min(0.35, dist * 0.04));
  midPoint.y = baseArcY;

  const mat = new THREE.MeshStandardMaterial({
    color: linkTypeDef.color,
    roughness: 0.58,
    metalness: 0.08
  });

  const radius = linkTypeDef.thickness || 0.07;

  if (linkTypeDef.style === 'zigzag') {
    const segments = Math.max(8, Math.min(20, Math.floor(dist * 3.0)));
    const points = [p1.clone()];
    const amp = Math.min(0.26, Math.max(0.12, dist * 0.055));

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const basePt = new THREE.Vector3().lerpVectors(p1, p2, t);
      basePt.y = THREE.MathUtils.lerp(p1.y, p2.y, t) + Math.sin(t * Math.PI) * 0.12;
      const sign = i % 2 === 0 ? 1 : -1;
      const env = Math.sin(t * Math.PI);
      basePt.addScaledVector(side, sign * amp * env);
      basePt.y += (i % 2 === 0 ? 0.04 : -0.04) * env;
      points.push(basePt);
    }
    points.push(p2.clone());

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.12);
    const geo = new THREE.TubeGeometry(curve, segments * 4, radius * 0.88, 6, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    linkGroup.add(mesh);
  } else if (linkTypeDef.style === 'dashed') {
    const curve = new THREE.CatmullRomCurve3([p1, midPoint, p2]);
    const dashCount = Math.max(5, Math.min(16, Math.floor(dist * 2.0)));
    for (let i = 0; i < dashCount; i++) {
      const tStart = (i + 0.15) / dashCount;
      const tEnd = (i + 0.72) / dashCount;
      const ptA = curve.getPoint(tStart);
      const ptB = curve.getPoint(tEnd);
      const segCurve = new THREE.LineCurve3(ptA, ptB);
      const segGeo = new THREE.TubeGeometry(segCurve, 2, radius * 0.95, 6, false);
      const segMesh = new THREE.Mesh(segGeo, mat);
      segMesh.castShadow = true;
      linkGroup.add(segMesh);
    }
  } else if (linkTypeDef.style === 'double') {
    const steps = 24;
    const strandA = [];
    const strandB = [];
    const twistTurns = Math.max(2, Math.round(dist * 0.85));
    const offsetR = radius * 1.35;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const basePt = new THREE.Vector3().lerpVectors(p1, p2, t);
      basePt.y = THREE.MathUtils.lerp(p1.y, p2.y, t) + Math.sin(t * Math.PI) * 0.16;

      const env = Math.sin(t * Math.PI);
      const angle = t * Math.PI * 2 * twistTurns;
      const dx = Math.cos(angle) * offsetR * env;
      const dy = Math.sin(angle) * offsetR * 0.65 * env;

      const ptA = basePt.clone().addScaledVector(side, dx);
      ptA.y += dy;
      strandA.push(ptA);

      const ptB = basePt.clone().addScaledVector(side, -dx);
      ptB.y -= dy;
      strandB.push(ptB);
    }

    const curveA = new THREE.CatmullRomCurve3(strandA);
    const curveB = new THREE.CatmullRomCurve3(strandB);
    const geoA = new THREE.TubeGeometry(curveA, 32, radius * 0.78, 6, false);
    const geoB = new THREE.TubeGeometry(curveB, 32, radius * 0.78, 6, false);

    const meshA = new THREE.Mesh(geoA, mat);
    const meshB = new THREE.Mesh(geoB, mat);
    meshA.castShadow = true;
    meshB.castShadow = true;
    linkGroup.add(meshA, meshB);
  } else if (linkTypeDef.style === 'cutoff') {
    const curve = new THREE.CatmullRomCurve3([p1, midPoint, p2]);
    const leftPts = [];
    const rightPts = [];
    for (let i = 0; i <= 10; i++) {
      leftPts.push(curve.getPoint((i / 10) * 0.43));
      rightPts.push(curve.getPoint(0.57 + (i / 10) * 0.43));
    }

    const leftGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftPts), 12, radius, 6, false);
    const rightGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightPts), 12, radius, 6, false);
    const leftMesh = new THREE.Mesh(leftGeo, mat);
    const rightMesh = new THREE.Mesh(rightGeo, mat);
    leftMesh.castShadow = true;
    rightMesh.castShadow = true;
    linkGroup.add(leftMesh, rightMesh);

    const barrierGroup = new THREE.Group();
    barrierGroup.position.copy(midPoint);
    barrierGroup.lookAt(p2.x, midPoint.y, p2.z);

    const barGeo = new THREE.BoxGeometry(0.65, 0.55, 0.07);
    const bar1 = new THREE.Mesh(barGeo, mat);
    bar1.position.set(0, 0.08, -0.09);
    bar1.rotation.z = 0.22;
    bar1.castShadow = true;

    const bar2 = new THREE.Mesh(barGeo, mat);
    bar2.position.set(0, 0.08, 0.09);
    bar2.rotation.z = 0.22;
    bar2.castShadow = true;

    barrierGroup.add(bar1, bar2);
    linkGroup.add(barrierGroup);
  } else {
    const curve = new THREE.CatmullRomCurve3([p1, midPoint, p2]);
    const tubeGeo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
    const mesh = new THREE.Mesh(tubeGeo, mat);
    mesh.castShadow = true;
    linkGroup.add(mesh);
  }

  return linkGroup;
}
