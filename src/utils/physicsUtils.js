import { PIECE_SIZES, TRAY_PLAYABLE_RADIUS } from '../constants';

// Calcola dimensioni fisiche base e dimensioni effettive considerando eventuale inclinazione/ribaltamento (rotationX, rotationZ)
export function getPieceDimensions(piece) {
  const sizeDef = PIECE_SIZES.find((s) => s.id === piece.size) || PIECE_SIZES[1];
  const m = sizeDef.multiplier || 1.0;
  const h = sizeDef.height || 2.2;
  const w = 1.1 * m;

  let baseHeight = h;
  let baseWidth = w;
  let baseDepth = w * 0.85;
  let collisionRadius = w * 0.62;
  let topRadius = w * 0.52;
  let gazeY = h * 0.76;
  let gazeZ = (w * 0.85) / 2;

  switch (piece.shape) {
    case 'cylinder':
      baseHeight = h;
      baseWidth = w * 1.14;
      baseDepth = w * 1.14;
      collisionRadius = w * 0.58;
      topRadius = w * 0.5;
      gazeY = h * 0.76;
      gazeZ = w * 0.55;
      break;

    case 'cube': {
      const s = 1.45 * m;
      baseHeight = s;
      baseWidth = s;
      baseDepth = s;
      collisionRadius = s * 0.64;
      topRadius = s * 0.52;
      gazeY = s * 0.72;
      gazeZ = s * 0.5;
      break;
    }

    case 'token':
      baseHeight = 0.36;
      baseWidth = w * 1.36;
      baseDepth = w * 1.36;
      collisionRadius = w * 0.68;
      topRadius = w * 0.62;
      gazeY = 0.32;
      gazeZ = w * 0.52;
      break;

    case 'sphere': {
      const radius = w * 0.62;
      const baseH = 0.36 * m;
      baseHeight = baseH + radius * 1.92;
      baseWidth = radius * 2;
      baseDepth = radius * 2;
      collisionRadius = Math.max(radius, w * 0.58);
      topRadius = radius * 0.55;
      gazeY = baseH + radius * 1.05;
      gazeZ = radius * 0.96;
      break;
    }

    case 'wedge':
      baseHeight = h;
      baseWidth = w * 1.15;
      baseDepth = w * 1.1;
      collisionRadius = w * 0.62;
      topRadius = w * 0.45;
      gazeY = h * 0.72;
      gazeZ = (w * 1.1) * 0.45;
      break;

    case 'box':
    default:
      baseHeight = h;
      baseWidth = w;
      baseDepth = w * 0.85;
      collisionRadius = w * 0.62;
      topRadius = w * 0.52;
      gazeY = h * 0.76;
      gazeZ = (w * 0.85) * 0.5;
      break;
  }

  // Calcola l'altezza effettiva dell'ingombro verticale quando il pezzo è inclinato o sdraiato (rotationX / rotationZ)
  const rx = piece.rotationX || 0;
  const rz = piece.rotationZ || 0;
  let height = baseHeight;

  if (Math.abs(rx) > 0.01 || Math.abs(rz) > 0.01) {
    const cosX = Math.abs(Math.cos(rx));
    const sinX = Math.abs(Math.sin(rx));
    const cosZ = Math.abs(Math.cos(rz));
    const sinZ = Math.abs(Math.sin(rz));

    // Altezza del bounding box ruotato attorno a X e Z
    const hAfterX = baseHeight * cosX + baseDepth * sinX;
    height = hAfterX * cosZ + baseWidth * sinZ;

    // Raggio orizzontale aumentato se il pezzo è sdraiato
    const horizontalReach = Math.max(
      baseWidth * cosZ + baseHeight * sinZ,
      baseDepth * cosX + baseHeight * sinX
    );
    collisionRadius = Math.max(collisionRadius, horizontalReach * 0.45);
  }

  return {
    height,
    baseHeight,
    baseWidth,
    baseDepth,
    collisionRadius,
    topRadius,
    gazeY,
    gazeZ,
    width: w,
    multiplier: m
  };
}

// Trova se le coordinate (x, z) si trovano EFFETTIVAMENTE sopra la sommità di un altro pezzo
export function getSupportingPieceAt(x, z, pieceId, pieces, stackedOnSelf = findStackedPiecesRecursive(pieceId, pieces)) {
  let highestSupport = null;
  let maxTopY = -1;

  for (const other of pieces) {
    if (other.id === pieceId || stackedOnSelf.has(other.id)) continue;

    const otherDims = getPieceDimensions(other);
    const dx = x - other.x;
    const dz = z - other.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const effectiveTopRadius = otherDims.topRadius * 0.88;

    if (dist <= effectiveTopRadius) {
      const otherTopY = (other.y || 0) + otherDims.height;
      if (otherTopY > maxTopY) {
        maxTopY = otherTopY;
        highestSupport = {
          piece: other,
          topY: otherTopY,
          height: otherDims.height,
          topRadius: otherDims.topRadius
        };
      }
    }
  }

  return highestSupport;
}

// Calcola la posizione precisa (x, y, z) durante il trascinamento o lo spostamento da tastiera
export function calculateDragPosition(rawMouseX, rawMouseZ, draggedPieceId, pieces) {
  const selfPiece = pieces.find((p) => p.id === draggedPieceId);
  if (!selfPiece) return { x: rawMouseX, y: 0, z: rawMouseZ };

  const selfDims = getPieceDimensions(selfPiece);
  const stackedOnSelf = findStackedPiecesRecursive(draggedPieceId, pieces);

  // 1. Verifichiamo se la posizione è direttamente sulla sommità di un altro pezzo
  const support = getSupportingPieceAt(rawMouseX, rawMouseZ, draggedPieceId, pieces, stackedOnSelf);

  if (support) {
    const targetY = support.topY;

    const dx = rawMouseX - support.piece.x;
    const dz = rawMouseZ - support.piece.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxOffset = support.topRadius * 0.72;

    let x = rawMouseX;
    let z = rawMouseZ;
    if (dist > maxOffset && dist > 0.001) {
      x = support.piece.x + (dx / dist) * maxOffset;
      z = support.piece.z + (dz / dist) * maxOffset;
    }

    return {
      x: Math.round(x * 100) / 100,
      y: Math.round(targetY * 100) / 100,
      z: Math.round(z * 100) / 100
    };
  }

  // 2. A livello del tavolo (y = 0)
  let x = rawMouseX;
  let z = rawMouseZ;

  // 3. Risoluzione collisioni orizzontali contro tutti i pezzi a livello del tavolo
  for (let iter = 0; iter < 3; iter++) {
    for (const other of pieces) {
      if (other.id === draggedPieceId || stackedOnSelf.has(other.id)) continue;

      if ((other.y || 0) >= selfDims.height) continue;

      const otherDims = getPieceDimensions(other);
      const minDist = selfDims.collisionRadius + otherDims.collisionRadius;

      let dx = x - other.x;
      let dz = z - other.z;
      let dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < minDist) {
        if (dist < 0.001) {
          dx = 1;
          dz = 0;
          dist = 1;
        }
        const pushFactor = minDist / dist;
        x = other.x + dx * pushFactor;
        z = other.z + dz * pushFactor;
      }
    }
  }

  // 4. Limita all'interno del vassoio circolare
  const distFromCenter = Math.sqrt(x * x + z * z);
  const maxRadius = TRAY_PLAYABLE_RADIUS - selfDims.collisionRadius;
  if (distFromCenter > maxRadius && distFromCenter > 0) {
    const factor = maxRadius / distFromCenter;
    x *= factor;
    z *= factor;
  }

  return {
    x: Math.round(x * 100) / 100,
    y: 0,
    z: Math.round(z * 100) / 100
  };
}

// Trova una posizione libera sul vassoio partendo da (preferredX, preferredZ) con spirale aurea
export function findFreePositionOnTray(pieces, shape = 'box', size = 'medium', preferredX = 0, preferredZ = 0, excludeId = null) {
  const dummyDims = getPieceDimensions({ shape, size });
  const maxRadius = TRAY_PLAYABLE_RADIUS - 0.2 - dummyDims.collisionRadius;

  const isFree = (cx, cz) => {
    const r = Math.sqrt(cx * cx + cz * cz);
    if (r > maxRadius) return false;
    for (const other of pieces) {
      if (other.id === excludeId) continue;
      if ((other.y || 0) > dummyDims.height) continue;
      const otherDims = getPieceDimensions(other);
      const minDist = dummyDims.collisionRadius + otherDims.collisionRadius + 0.18;
      const dx = cx - other.x;
      const dz = cz - other.z;
      if (dx * dx + dz * dz < minDist * minDist) return false;
    }
    return true;
  };

  if (isFree(preferredX, preferredZ)) {
    return {
      x: Math.round(preferredX * 100) / 100,
      y: 0,
      z: Math.round(preferredZ * 100) / 100
    };
  }

  const goldenAngle = 2.399963229728653;
  // Cerca prima vicino alla posizione richiesta, poi su tutta la superficie utile.
  for (const [originX, originZ, radius] of [[preferredX, preferredZ, 6], [0, 0, maxRadius]]) {
    const sampleCount = Math.ceil((radius / 0.55) ** 2);
    for (let i = 0; i <= sampleCount; i++) {
      const dist = radius * Math.sqrt(i / sampleCount);
      const angle = i * goldenAngle;
      const x = originX + Math.cos(angle) * dist;
      const z = originZ + Math.sin(angle) * dist;
      if (isFree(x, z)) {
        return { x: Math.round(x * 100) / 100, y: 0, z: Math.round(z * 100) / 100 };
      }
    }
  }

  return { x: 0, y: 0, z: 0 };
}

// Stabilizzazione fisica e gravità
export function stabilizeAllPieces(pieces) {
  if (!Array.isArray(pieces)) return [];
  const sorted = [...pieces].sort((a, b) => (a.y || 0) - (b.y || 0));
  const result = [];

  for (const piece of sorted) {
    let targetY = 0;

    if ((piece.y || 0) > 0.05) {
      let support = null;
      let maxSupportTop = -1;

      for (const other of result) {
        const otherDims = getPieceDimensions(other);
        const dx = piece.x - other.x;
        const dz = piece.z - other.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= otherDims.topRadius * 1.15) {
          const otherTopY = (other.y || 0) + otherDims.height;
          if (Math.abs((piece.y || 0) - otherTopY) <= 1.2) {
            if (otherTopY > maxSupportTop) {
              maxSupportTop = otherTopY;
              support = other;
            }
          }
        }
      }

      if (support) {
        targetY = (support.y || 0) + getPieceDimensions(support).height;
      } else {
        targetY = 0;
      }
    }

    result.push({
      ...piece,
      y: Math.round(targetY * 100) / 100
    });
  }

  // Risolvi compenetrazioni tra pezzi che poggiano sul tavolo (y = 0)
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < result.length; i++) {
      if (result[i].y > 0.1) continue;
      const dimsA = getPieceDimensions(result[i]);

      for (let j = i + 1; j < result.length; j++) {
        if (result[j].y > 0.1) continue;
        const dimsB = getPieceDimensions(result[j]);

        const minDist = dimsA.collisionRadius + dimsB.collisionRadius;
        let dx = result[i].x - result[j].x;
        let dz = result[i].z - result[j].z;
        let dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < minDist) {
          if (dist < 0.001) {
            dx = 1;
            dz = 0;
            dist = 1;
          }
          const overlap = minDist - dist;
          const half = overlap / 2;
          const nx = dx / dist;
          const nz = dz / dist;

          result[i].x = Math.round((result[i].x + nx * half) * 100) / 100;
          result[i].z = Math.round((result[i].z + nz * half) * 100) / 100;
          result[j].x = Math.round((result[j].x - nx * half) * 100) / 100;
          result[j].z = Math.round((result[j].z - nz * half) * 100) / 100;
        }
      }

      const distFromCenter = Math.sqrt(result[i].x * result[i].x + result[i].z * result[i].z);
      const maxR = TRAY_PLAYABLE_RADIUS - dimsA.collisionRadius;
      if (distFromCenter > maxR && distFromCenter > 0) {
        const f = maxR / distFromCenter;
        result[i].x = Math.round(result[i].x * f * 100) / 100;
        result[i].z = Math.round(result[i].z * f * 100) / 100;
      }
    }
  }

  const byId = new Map(result.map((p) => [p.id, p]));
  return pieces.map((p) => byId.get(p.id) || p);
}

// Trova ricorsivamente tutti i pezzi appoggiati sopra a un pezzo base
export function findStackedPiecesRecursive(basePieceId, pieces, resultIds = new Set()) {
  const basePiece = pieces.find((p) => p.id === basePieceId);
  if (!basePiece) return resultIds;

  const baseDims = getPieceDimensions(basePiece);
  const baseTopY = (basePiece.y || 0) + baseDims.height;

  for (const other of pieces) {
    if (other.id === basePieceId || resultIds.has(other.id)) continue;

    const otherBottomY = other.y || 0;
    if (Math.abs(otherBottomY - baseTopY) <= 0.35) {
      const dx = other.x - basePiece.x;
      const dz = other.z - basePiece.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= baseDims.topRadius * 1.15) {
        resultIds.add(other.id);
        findStackedPiecesRecursive(other.id, pieces, resultIds);
      }
    }
  }

  return resultIds;
}
