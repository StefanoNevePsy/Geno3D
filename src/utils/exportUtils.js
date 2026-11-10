import * as THREE from 'three';
import {
  CAMERA_PROJECTIONS,
  DEFAULT_PHASES,
  LINK_TYPES,
  PIECE_COLORS,
  PIECE_SHAPES,
  TRAY_RADIUS
} from '../constants';
import { getPieceDimensions } from './physicsUtils';

// Helper per scaricare un Blob o DataURL
export function triggerDownload(urlOrBlob, filename) {
  const link = document.createElement('a');
  let url = urlOrBlob;
  let shouldRevoke = false;

  if (urlOrBlob instanceof Blob) {
    url = URL.createObjectURL(urlOrBlob);
    shouldRevoke = true;
  }

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}

// Calcola il bounding box dei pezzi per centrare le proiezioni ortogonali/prospettiche
export function computePiecesBounds(pieces) {
  const box = new THREE.Box3();
  if (!pieces || pieces.length === 0) {
    box.min.set(-5, 0, -5);
    box.max.set(5, 3, 5);
    return box;
  }

  pieces.forEach((p) => {
    const dims = getPieceDimensions(p);
    const r = dims.collisionRadius;
    const y0 = p.y || 0;
    box.expandByPoint(new THREE.Vector3(p.x - r, y0, p.z - r));
    box.expandByPoint(new THREE.Vector3(p.x + r, y0 + dims.height, p.z + r));
  });

  return box;
}

// Crea la telecamera per una specifica proiezione di base o clona quella attuale
export function createCameraForProjection(projectionId, aspect, userCamera, pieces, framing = 'pieces') {
  const preset = CAMERA_PROJECTIONS.find((item) => item.id === projectionId);
  if (projectionId === 'camera' && userCamera && framing === 'tray') {
    const camera = userCamera.clone();
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
  }

  const full = framing === 'tray' || pieces.length === 0;
  const bounds = computePiecesBounds(pieces);
  if (full) {
    const radius = TRAY_RADIUS + 0.95;
    bounds.expandByPoint(new THREE.Vector3(-radius, -0.45, -radius));
    bounds.expandByPoint(new THREE.Vector3(radius, 0, radius));
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(...(preset?.position || [13.5, 13.5, 13.5]))
    .sub(new THREE.Vector3(...(preset?.target || [0, 0.8, 0]))).normalize();
  if (projectionId === 'camera' && userCamera) userCamera.getWorldDirection(direction).negate();

  const camera = preset?.isOrtho || projectionId !== 'camera'
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 800)
    : new THREE.PerspectiveCamera(38, aspect, 0.1, 800);
  if (projectionId === 'top') camera.up.set(0, 0, -1);
  camera.position.copy(center).addScaledVector(direction, Math.max(60, bounds.min.distanceTo(bounds.max) + 10));
  camera.lookAt(center);
  camera.updateMatrixWorld();

  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const corner = new THREE.Vector3();
  const tan = Math.tan(THREE.MathUtils.degToRad(19));
  let halfHeight = 1.5;
  let distance = 5;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z).sub(center);
        const halfExtent = Math.max(Math.abs(corner.dot(right)) / aspect, Math.abs(corner.dot(up)));
        halfHeight = Math.max(halfHeight, halfExtent);
        distance = Math.max(distance, halfExtent * 1.28 / tan + corner.dot(direction));
      }
    }
  }

  if (camera.isOrthographicCamera) {
    halfHeight *= 1.27;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
  } else {
    camera.position.copy(center).addScaledVector(direction, distance);
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

// Disegna un rettangolo con angoli arrotondati su Canvas 2D
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Disegna le etichette 2D dei membri e le frecce di sguardo (in pianta) sopra al render WebGL
export function drawOverlayLabelsAndGaze(ctx, width, height, camera, pieces, projectionId, scaleFactor = 1) {
  if (!pieces || pieces.length === 0) return;

  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  // 1. Se siamo in vista Zenitale (top), disegniamo frecce vettoriali nitide dello sguardo
  if (projectionId === 'top') {
    pieces.forEach((p) => {
      const dims = getPieceDimensions(p);
      const rot = p.rotationY || 0;
      const startDist = dims.collisionRadius * 0.75;
      const endDist = dims.collisionRadius + 0.95;

      const start3D = new THREE.Vector3(
        p.x + Math.sin(rot) * startDist,
        (p.y || 0) + dims.height * 0.5,
        p.z + Math.cos(rot) * startDist
      );
      const end3D = new THREE.Vector3(
        p.x + Math.sin(rot) * endDist,
        (p.y || 0) + dims.height * 0.5,
        p.z + Math.cos(rot) * endDist
      );

      const sProj = start3D.project(camera);
      const eProj = end3D.project(camera);

      const sx = ((sProj.x + 1) * width) / 2;
      const sy = ((-sProj.y + 1) * height) / 2;
      const ex = ((eProj.x + 1) * width) / 2;
      const ey = ((-eProj.y + 1) * height) / 2;

      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 9 * scaleFactor;

      ctx.save();
      ctx.strokeStyle = '#2E473B';
      ctx.fillStyle = '#2E473B';
      ctx.lineWidth = 2.4 * scaleFactor;
      ctx.setLineDash([4 * scaleFactor, 3 * scaleFactor]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  // 2. Disegna badge con Nome e Ruolo per ogni membro
  pieces.forEach((p) => {
    const dims = getPieceDimensions(p);
    const labelWorldPos =
      projectionId === 'top'
        ? new THREE.Vector3(p.x, (p.y || 0) + dims.height, p.z + dims.collisionRadius + 0.19)
        : new THREE.Vector3(p.x, (p.y || 0) + dims.height + 0.42, p.z);

    const screenPos = labelWorldPos.clone().project(camera);
    if (screenPos.z > 1) return;

    const x = ((screenPos.x + 1) * width) / 2;
    const y = ((-screenPos.y + 1) * height) / 2;

    const nameText = p.name || 'Senza nome';
    const roleText = projectionId === 'top' ? '' : (p.role || '');

    ctx.save();
    const fontNameSize = Math.round(13 * scaleFactor);
    const fontRoleSize = Math.round(10.5 * scaleFactor);

    ctx.font = `600 ${fontNameSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    const nameWidth = ctx.measureText(nameText).width;

    let roleWidth = 0;
    if (roleText) {
      ctx.font = `400 ${fontRoleSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
      roleWidth = ctx.measureText(roleText).width;
    }

    const padX = 11 * scaleFactor;
    const padY = 6 * scaleFactor;
    const boxW = Math.min(Math.max(nameWidth, roleWidth) + padX * 2, width * 0.34);
    const boxH = roleText ? (fontNameSize + fontRoleSize + padY * 2.2) : (fontNameSize + padY * 2);

    const bx = Math.max(2, Math.min(width - boxW - 2, x - boxW / 2));
    const labelTop = projectionId === 'top' ? y - boxH / 2 : y - boxH - 5 * scaleFactor;
    const by = Math.max(2, Math.min(height - boxH - 2, labelTop));

    // Ombra morbida
    ctx.shadowColor = 'rgba(29, 36, 33, 0.14)';
    ctx.shadowBlur = 10 * scaleFactor;
    ctx.shadowOffsetY = 3 * scaleFactor;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    roundRect(ctx, bx, by, boxW, boxH, 12 * scaleFactor);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.2 * scaleFactor;
    ctx.strokeStyle = 'rgba(195, 185, 170, 0.85)';
    ctx.stroke();

    // Pallino colore pezzo a sinistra del nome
    const colorDef = PIECE_COLORS.find((c) => c.id === p.color) || PIECE_COLORS[0];
    ctx.fillStyle = colorDef.hex;
    ctx.beginPath();
    ctx.arc(bx + padX * 0.65, by + padY + fontNameSize * 0.45, 3.5 * scaleFactor, 0, Math.PI * 2);
    ctx.fill();

    // Testo Nome
    ctx.fillStyle = '#1D2421';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${fontNameSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillText(nameText, bx + boxW / 2 + 2 * scaleFactor, by + padY, boxW - padX * 2);

    // Testo Ruolo
    if (roleText) {
      ctx.fillStyle = '#667069';
      ctx.font = `400 ${fontRoleSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
      ctx.fillText(roleText, bx + boxW / 2, by + padY + fontNameSize + 2 * scaleFactor, boxW - padX * 2);
    }

    ctx.restore();
  });
}

// Disegna intestazione e legenda su una singola immagine esportata
function drawSingleImageHeaderAndLegend(ctx, width, height, projectionId, currentPhaseId, links, scaleFactor = 1) {
  const projDef = CAMERA_PROJECTIONS.find((p) => p.id === projectionId) || CAMERA_PROJECTIONS[0];
  const phaseDef = DEFAULT_PHASES.find((ph) => ph.id === currentPhaseId) || DEFAULT_PHASES[1];
  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  ctx.save();
  const pad = 22 * scaleFactor;
  const headerH = 54 * scaleFactor;
  const headerW = 430 * scaleFactor;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = 'rgba(210, 202, 188, 0.85)';
  ctx.lineWidth = 1.2 * scaleFactor;
  roundRect(ctx, pad, pad, headerW, headerH, 12 * scaleFactor);
  ctx.fill();
  ctx.stroke();

  // Badge G3
  ctx.fillStyle = '#2E473B';
  roundRect(ctx, pad + 12 * scaleFactor, pad + 11 * scaleFactor, 32 * scaleFactor, 32 * scaleFactor, 7 * scaleFactor);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(13 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G3', pad + 28 * scaleFactor, pad + 27 * scaleFactor);

  // Titolo e Sottotitolo
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1D2421';
  ctx.font = `700 ${Math.round(14 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(`Geno 3D — ${phaseDef.name}`, pad + 54 * scaleFactor, pad + 20 * scaleFactor);

  ctx.fillStyle = '#667069';
  ctx.font = `500 ${Math.round(11.5 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(`${projDef.name}  •  ${dateStr}`, pad + 54 * scaleFactor, pad + 37 * scaleFactor);

  // Legenda fili relazionali in basso a sinistra (se presenti)
  if (links && links.length > 0) {
    const activeTypes = LINK_TYPES.filter((lt) => links.some((l) => l.type === lt.id));
    if (activeTypes.length > 0) {
      const legW = 240 * scaleFactor;
      const rowH = 20 * scaleFactor;
      const legH = 28 * scaleFactor + activeTypes.length * rowH;
      const ly = height - pad - legH;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      roundRect(ctx, pad, ly, legW, legH, 10 * scaleFactor);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#667069';
      ctx.font = `600 ${Math.round(10 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText('LEGENDA FILI RELAZIONALI', pad + 12 * scaleFactor, ly + 15 * scaleFactor);

      activeTypes.forEach((lt, idx) => {
        const ry = ly + 30 * scaleFactor + idx * rowH;
        ctx.strokeStyle = lt.color;
        ctx.lineWidth = 3 * scaleFactor;
        if (lt.style === 'dashed') ctx.setLineDash([4 * scaleFactor, 3 * scaleFactor]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(pad + 12 * scaleFactor, ry);
        ctx.lineTo(pad + 36 * scaleFactor, ry);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#1D2421';
        ctx.font = `500 ${Math.round(11 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(lt.label, pad + 44 * scaleFactor, ry + 1 * scaleFactor);
      });
    }
  }

  ctx.restore();
}

// Renderizza una specifica proiezione in un Canvas 2D offscreen e restituisce il Canvas + DataURL
export function renderProjectionToCanvas({
  renderer,
  scene,
  userCamera,
  pieces,
  links,
  currentPhaseId,
  projectionId = 'camera',
  width = 1920,
  height = 1440,
  includeLabels = true,
  includeHeader = true,
  gazeIndicator = null,
  framing = 'pieces'
}) {
  if (!renderer || !scene) return null;

  // Salva stato originale del renderer e del gaze indicator
  const origSize = renderer.getSize(new THREE.Vector2());
  const origPixelRatio = renderer.getPixelRatio();
  const origGazeVisible = gazeIndicator ? gazeIndicator.visible : false;

  try {
    if (gazeIndicator) gazeIndicator.visible = false;
    const scaleFactor = width / 950;
    const headerScale = width / 1280;
    const legendRows = LINK_TYPES.filter(({ id }) => links.some(({ type }) => type === id)).length;
    const top = includeHeader ? Math.round(84 * headerScale) : 0;
    const bottom = includeHeader && legendRows ? Math.round((56 + legendRows * 20) * headerScale) : 0;
    const frameHeight = height - top - bottom;
    renderer.setDrawingBufferSize(width, frameHeight, 1);

    const exportCam = createCameraForProjection(projectionId, width / frameHeight, userCamera, pieces, framing);
    renderer.render(scene, exportCam);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const ctx = outCanvas.getContext('2d');
    ctx.fillStyle = '#f5f2eb';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(renderer.domElement, 0, top, width, frameHeight);

    if (includeLabels) {
      ctx.save();
      ctx.translate(0, top);
      drawOverlayLabelsAndGaze(ctx, width, frameHeight, exportCam, pieces, projectionId, scaleFactor);
      ctx.restore();
    }
    if (includeHeader) {
      drawSingleImageHeaderAndLegend(ctx, width, height, projectionId, currentPhaseId, links, headerScale);
    }
    return outCanvas;
  } finally {
    if (gazeIndicator) gazeIndicator.visible = origGazeVisible;
    renderer.setDrawingBufferSize(origSize.x, origSize.y, origPixelRatio);
  }
}

// Genera una Tavola Sinottica Multi-Proiezione (4 viste cliniche + elenco membri e note + legenda)
export function renderMultiProjectionSheet({
  renderer,
  scene,
  userCamera,
  pieces,
  links,
  currentPhaseId,
  includeLabels = true,
  gazeIndicator = null,
  resolutionScale = 1,
  framing = 'pieces'
}) {
  const sheetW = Math.round(2400 * resolutionScale);
  const sheetH = Math.round(1800 * resolutionScale);
  const s = resolutionScale;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = sheetW;
  sheetCanvas.height = sheetH;
  const ctx = sheetCanvas.getContext('2d');

  // Sfondo carta scandinava
  ctx.fillStyle = '#F5F2EB';
  ctx.fillRect(0, 0, sheetW, sheetH);

  // Header tavola clinica
  const pad = Math.round(36 * s);
  const headerH = Math.round(96 * s);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#D7D0C2';
  ctx.lineWidth = 2 * s;
  roundRect(ctx, pad, pad, sheetW - pad * 2, headerH, 16 * s);
  ctx.fill();
  ctx.stroke();

  // Logo G3
  ctx.fillStyle = '#2E473B';
  roundRect(ctx, pad + 20 * s, pad + 20 * s, 56 * s, 56 * s, 12 * s);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(24 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G3', pad + 48 * s, pad + 48 * s);

  const phaseDef = DEFAULT_PHASES.find((ph) => ph.id === currentPhaseId) || DEFAULT_PHASES[1];
  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1D2421';
  ctx.font = `700 ${Math.round(24 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(`Tavola Sinottica Geno 3D — ${phaseDef.name}`, pad + 94 * s, pad + 38 * s);

  ctx.fillStyle = '#667069';
  ctx.font = `500 ${Math.round(15 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(
    `Metodologia Sistemico-Relazionale (Bassoli & Mariotti)  •  Esportato il ${dateStr}  •  ${pieces.length} membri, ${links.length} legami`,
    pad + 94 * s,
    pad + 68 * s
  );

  // Griglia 2x2 per le 4 proiezioni + colonna laterale destra con membri e legami
  const contentTop = pad + headerH + Math.round(24 * s);
  const contentH = sheetH - contentTop - pad;
  const sidePanelW = Math.round(520 * s);
  const gridAreaW = sheetW - pad * 2 - sidePanelW - Math.round(24 * s);
  const gap = Math.round(20 * s);
  const cellW = Math.floor((gridAreaW - gap) / 2);
  const cellH = Math.floor((contentH - gap) / 2);

  const viewsToRender = [
    { id: 'camera', title: '1. Vista Telecamera Attuale (3D)' },
    { id: 'top', title: '2. Pianta Zenitale (Mappa 2D & Sguardi)' },
    { id: 'front', title: '3. Proiezione Frontale (Gerarchie & Altezze)' },
    { id: 'isometric', title: '4. Assonometria Isometrica (45°)' }
  ];

  viewsToRender.forEach((v, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = pad + col * (cellW + gap);
    const cy = contentTop + row * (cellH + gap);

    const subCanvas = renderProjectionToCanvas({
      renderer,
      scene,
      userCamera,
      pieces,
      links,
      currentPhaseId,
      projectionId: v.id,
      width: cellW,
      height: cellH,
      includeLabels,
      includeHeader: false,
      gazeIndicator,
      framing
    });

    ctx.save();
    roundRect(ctx, cx, cy, cellW, cellH, 14 * s);
    ctx.clip();
    if (subCanvas) {
      ctx.drawImage(subCanvas, cx, cy, cellW, cellH);
    }
    ctx.restore();

    ctx.strokeStyle = '#D7D0C2';
    ctx.lineWidth = 2 * s;
    roundRect(ctx, cx, cy, cellW, cellH, 14 * s);
    ctx.stroke();

    // Etichetta vista in alto a sinistra della cella
    ctx.fillStyle = 'rgba(29, 36, 33, 0.82)';
    roundRect(ctx, cx + 14 * s, cy + 14 * s, 320 * s, 32 * s, 8 * s);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 ${Math.round(13 * s)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(v.title, cx + 26 * s, cy + 30 * s);
  });

  // Pannello laterale destro: Elenco Membri, Coordinate, Sguardo e Legami
  const sideX = pad + gridAreaW + Math.round(24 * s);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#D7D0C2';
  ctx.lineWidth = 2 * s;
  roundRect(ctx, sideX, contentTop, sidePanelW, contentH, 16 * s);
  ctx.fill();
  ctx.stroke();

  let cursorY = contentTop + 28 * s;
  const innerX = sideX + 24 * s;
  const innerW = sidePanelW - 48 * s;

  ctx.fillStyle = '#2E473B';
  ctx.font = `700 ${Math.round(15 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MEMBRI DELLA SCULTURA FAMILIARE', innerX, cursorY);
  cursorY += 28 * s;

  pieces.slice(0, 12).forEach((p) => {
    const colorDef = PIECE_COLORS.find((c) => c.id === p.color) || PIECE_COLORS[0];
    const shapeDef = PIECE_SHAPES.find((sh) => sh.id === p.shape) || PIECE_SHAPES[0];
    const deg = Math.round((((p.rotationY || 0) * 180) / Math.PI + 360) % 360);

    ctx.fillStyle = '#FAF8F4';
    ctx.strokeStyle = '#E6E0D4';
    ctx.lineWidth = 1 * s;
    const cardH = p.notes ? 64 * s : 46 * s;
    roundRect(ctx, innerX, cursorY, innerW, cardH, 10 * s);
    ctx.fill();
    ctx.stroke();

    // Pallino colore
    ctx.fillStyle = colorDef.hex;
    ctx.beginPath();
    ctx.arc(innerX + 18 * s, cursorY + 18 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1D2421';
    ctx.font = `600 ${Math.round(14 * s)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(`${p.name} ${p.role ? `— ${p.role}` : ''}`, innerX + 34 * s, cursorY + 10 * s);

    ctx.fillStyle = '#667069';
    ctx.font = `500 ${Math.round(11.5 * s)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(
      `${shapeDef.shortName} • Sguardo ${deg}° • Quota ${(p.y || 0).toFixed(1)}m`,
      innerX + 34 * s,
      cursorY + 28 * s
    );

    if (p.notes) {
      ctx.fillStyle = '#52677A';
      ctx.font = `italic ${Math.round(11.5 * s)}px "Plus Jakarta Sans", sans-serif`;
      const noteTrunc = p.notes.length > 56 ? `${p.notes.slice(0, 56)}…` : p.notes;
      ctx.fillText(`"${noteTrunc}"`, innerX + 34 * s, cursorY + 45 * s);
    }

    cursorY += cardH + 8 * s;
  });

  // Sezione Legami Relazionali nel pannello laterale
  cursorY += 12 * s;
  if (cursorY < contentTop + contentH - 120 * s) {
    ctx.fillStyle = '#2E473B';
    ctx.font = `700 ${Math.round(15 * s)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(`FILI RELAZIONALI ATTIVI (${links.length})`, innerX, cursorY);
    cursorY += 26 * s;

    const getPName = (id) => pieces.find((item) => item.id === id)?.name || 'Membro';

    links.slice(0, 10).forEach((l) => {
      if (cursorY > contentTop + contentH - 34 * s) return;
      const lt = LINK_TYPES.find((t) => t.id === l.type) || LINK_TYPES[0];

      ctx.fillStyle = lt.color;
      roundRect(ctx, innerX, cursorY + 4 * s, 18 * s, 6 * s, 3 * s);
      ctx.fill();

      ctx.fillStyle = '#1D2421';
      ctx.font = `600 ${Math.round(12.5 * s)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(`${getPName(l.sourceId)} ↔ ${getPName(l.targetId)}`, innerX + 28 * s, cursorY);

      ctx.fillStyle = '#667069';
      ctx.font = `400 ${Math.round(11.5 * s)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(`(${lt.shortLabel})`, innerX + 260 * s, cursorY + 1 * s);

      cursorY += 22 * s;
    });
  }

  return sheetCanvas;
}

// Costruisce una scena 3D pulita per l'esportazione (GLB, GLTF, OBJ, STL)
function buildExportable3DGroup({
  pieceMeshesMap,
  linkMeshesMap,
  trayGroup,
  pieces,
  includeTray = true,
  includeLinks = true
}) {
  const root = new THREE.Group();
  root.name = 'Geno3D_Scultura_Sistemica';

  if (includeTray && trayGroup) {
    const clonedTray = trayGroup.clone(true);
    clonedTray.name = 'Vassoio_Legno_Frassino';
    root.add(clonedTray);
  }

  if (pieceMeshesMap) {
    const piecesById = new Map(pieces?.map((piece) => [piece.id, piece]));
    pieceMeshesMap.forEach((meshGroup, pieceId) => {
      const pieceData = piecesById.get(pieceId);
      const clonedPiece = meshGroup.clone(true);
      const { shape, size, color } = pieceData || {};
      clonedPiece.userData = { pieceId, shape, size, color };
      const pin = clonedPiece.getObjectByName('front-dot');
      if (pin) pin.visible = true;
      const safeName = (pieceData?.name || pieceId).replace(/[^a-zA-Z0-9_-]/g, '_');
      clonedPiece.name = `Membro_${safeName}`;
      root.add(clonedPiece);
    });
  }

  if (includeLinks && linkMeshesMap) {
    linkMeshesMap.forEach((linkGroup, linkId) => {
      const clonedLink = linkGroup.clone(true);
      clonedLink.name = `Filo_${linkId}`;
      root.add(clonedLink);
    });
  }

  root.updateMatrixWorld(true);
  return root;
}

// Esporta la scena 3D nel formato selezionato ('glb' | 'gltf' | 'obj' | 'stl')
export async function exportScene3D({
  format = 'glb',
  pieceMeshesMap,
  linkMeshesMap,
  trayGroup,
  pieces,
  currentPhaseId = 'presente',
  includeTray = true,
  includeLinks = true
}) {
  const exportGroup = buildExportable3DGroup({
    pieceMeshesMap,
    linkMeshesMap,
    trayGroup,
    pieces,
    includeTray,
    includeLinks
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `geno3d-${currentPhaseId}-${dateStr}.${format}`;
  if (format === 'glb' || format === 'gltf') {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const binary = format === 'glb';
    const result = await new GLTFExporter().parseAsync(exportGroup, { binary });
    const data = binary ? result : JSON.stringify(result, null, 2);
    const type = binary ? 'model/gltf-binary' : 'model/gltf+json';
    triggerDownload(new Blob([data], { type }), filename);
  } else if (format === 'obj') {
    const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
    const data = new OBJExporter().parse(exportGroup);
    triggerDownload(new Blob([data], { type: 'text/plain;charset=utf-8' }), filename);
  } else if (format === 'stl') {
    const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
    const data = new STLExporter().parse(exportGroup, { binary: true });
    triggerDownload(new Blob([data], { type: 'application/octet-stream' }), filename);
  } else {
    throw new Error(`Formato 3D non supportato: ${format}`);
  }
  return true;
}
