import React, { useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createTrayWoodTexture,
  getPieceMaterial,
  createPieceGeometry,
  updateGazePinOnGroup,
  applyPieceTransform3D,
  buildLinkMeshGroup
} from '../utils/threeUtils';
import {
  calculateDragPosition,
  getPieceDimensions
} from '../utils/physicsUtils';
import { CAMERA_PROJECTIONS, TRAY_RADIUS, TRAY_VIEW_SCALE } from '../constants';
import {
  computePiecesBounds,
  renderProjectionToCanvas,
  renderMultiProjectionSheet,
  exportScene3D,
  triggerDownload
} from '../utils/exportUtils';

const STUDIO_VIEW = CAMERA_PROJECTIONS.find((view) => view.id === 'perspective');

function disposeLink(group) {
  group.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });
}

function updatePinInstances(scene, instances, groups) {
  if (groups.size === 0) {
    instances.forEach((mesh) => { mesh.count = 0; });
    return;
  }

  if (instances.length === 0 || instances[0].instanceMatrix.count < groups.size) {
    instances.forEach((mesh) => {
      scene.remove(mesh);
      mesh.dispose();
    });
    const sample = groups.values().next().value.getObjectByName('front-dot');
    const capacity = 2 ** Math.ceil(Math.log2(groups.size));
    instances.splice(0, instances.length, ...sample.children.map(({ geometry, material }) => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    }));
  }

  let index = 0;
  for (const group of groups.values()) {
    const pin = group.getObjectByName('front-dot');
    pin.children.forEach((child, part) => instances[part].setMatrixAt(index, child.matrixWorld));
    index++;
  }
  instances.forEach((mesh) => {
    mesh.count = groups.size;
    mesh.instanceMatrix.needsUpdate = true;
  });
}

function createStudioLights(scene, scale = 1) {
  const ambient = new THREE.HemisphereLight('#FFFDF9', '#D6CEC0', 0.98);
  const key = new THREE.DirectionalLight('#FFF8EC', 1.38);
  key.position.set(11, 21, 13).multiplyScalar(scale);
  const fill = new THREE.DirectionalLight('#E2EAF2', 0.48);
  fill.position.set(-13, 11, -9);
  scene.add(ambient, key, fill);
  return key;
}

function createPiecePreview() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  createStudioLights(scene);
  const camera = new THREE.OrthographicCamera(-2.8, 2.8, 2, -2, 0.1, 30);
  camera.position.set(4.5, 3.8, 8);
  const viewDirection = camera.position.clone().sub(new THREE.Vector3(0, 1.55, 0));
  const pieceGroup = new THREE.Group();
  const body = new THREE.Mesh(createPieceGeometry('box', 'medium'), getPieceMaterial('ash'));
  pieceGroup.add(body);
  scene.add(pieceGroup);
  return { scene, camera, viewDirection, pieceGroup, body };
}

function drawPiecePreview(renderer, preview, { piece, canvas }, isDark) {
  const { scene, camera, viewDirection, pieceGroup, body } = preview;
  const context = canvas.getContext('2d');
  if (!context) return;

  body.geometry = createPieceGeometry(piece.shape, piece.size);
  body.material = getPieceMaterial(piece.color);
  updateGazePinOnGroup(pieceGroup, piece);
  // L'inquadratura è costante per forma, così le tre altezze restano confrontabili.
  const flat = piece.shape === 'token';
  const compact = piece.shape === 'cube' || piece.shape === 'sphere';
  const centerY = flat ? 0.18 : compact ? 1.15 : 1.55;
  camera.zoom = flat ? 1.7 : compact ? 1.22 : 1;
  camera.position.copy(viewDirection);
  camera.position.y += centerY;
  camera.lookAt(0, centerY, 0);
  camera.updateProjectionMatrix();
  scene.background.set(isDark ? '#242D27' : '#EEE9DF');

  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  const shadows = renderer.shadowMap.enabled;
  try {
    renderer.shadowMap.enabled = false;
    renderer.setDrawingBufferSize(canvas.width, canvas.height, 1);
    renderer.render(scene, camera);
    context.drawImage(renderer.domElement, 0, 0);
  } finally {
    renderer.shadowMap.enabled = shadows;
    renderer.setDrawingBufferSize(size.x, size.y, ratio);
  }
}

export default function GenoCanvas({
  pieces,
  onUpdatePiece,
  onDragStart,
  onDragEnd,
  selectedPieceId,
  onSelectPiece,
  links,
  currentPhaseId,
  showLabels = true,
  cameraView = null,
  onCameraViewHandled,
  onRegisterExportApi,
  isDark,
  placementPieceId,
  onPlacePiece
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const trayGroupRef = useRef(null);

  // Dimensioni cachate del container per azzerare il layout thrashing (0 letture DOM nel render loop)
  const boundsRef = useRef({
    left: 0,
    top: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  // Mappe oggetti 3D
  const pieceMeshesRef = useRef(new Map());
  const pinInstancesRef = useRef([]);
  const previewRequestRef = useRef(null);
  const darkRef = useRef(isDark);
  darkRef.current = isDark;
  const cameraAnimationRef = useRef(null);
  const linkMeshesRef = useRef(new Map());
  const gazeIndicatorRef = useRef(null);
  const gazeHandleMeshRef = useRef(null);

  // Refs sempre sincronizzati per evitare stale closures
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const selectedPieceIdRef = useRef(selectedPieceId);
  selectedPieceIdRef.current = selectedPieceId;
  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  // Refs ai nodi DOM delle etichette 2D
  const labelDomMapRef = useRef(new Map());

  // Gestione Drag & Drop e stato Orbit
  const interactionModeRef = useRef(null); // 'move' | 'rotate' | null
  const activePieceIdRef = useRef(null);
  const dragPointerRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, z: 0 });
  const pendingDragRef = useRef(null);
  const dragFrameRef = useRef(null);
  const isOrbitingRef = useRef(false);
  const lastHoverCheckTimeRef = useRef(0);
  const hoverCursorRef = useRef('default');
  const raycasterRef = useRef(null);
  const mouseRef = useRef(null);
  const groundPlaneRef = useRef(null);
  const groundHitRef = useRef(null);
  const labelPointRef = useRef(null);
  raycasterRef.current ??= new THREE.Raycaster();
  mouseRef.current ??= new THREE.Vector2();
  groundPlaneRef.current ??= new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  groundHitRef.current ??= new THREE.Vector3();
  labelPointRef.current ??= new THREE.Vector3();

  // Funzione per risvegliare il render loop on-demand
  const wakeUpRenderRef = useRef(() => {});

  // Aggiorna le coordinate 2D delle etichette direttamente nel DOM senza layout thrashing
  const updateLabelsPositionDOM = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera || !showLabelsRef.current) return;

    const { width, height } = boundsRef.current;
    if (width === 0 || height === 0) return;

    camera.updateMatrixWorld();

    const currentPieces = piecesRef.current || [];
    const tempVec = labelPointRef.current;

    for (const p of currentPieces) {
      const domEl = labelDomMapRef.current.get(p.id);
      if (!domEl) continue;

      const mesh = pieceMeshesRef.current.get(p.id);
      if (!mesh) continue;
      tempVec.copy(mesh.userData.labelPosition);
      tempVec.project(camera);

      if (tempVec.z > 1 || tempVec.z < -1 || Math.abs(tempVec.x) > 1.1 || Math.abs(tempVec.y) > 1.1) {
        if (domEl._lastVis !== false) {
          domEl._lastVis = false;
          domEl.style.visibility = 'hidden';
        }
      } else {
        const tx = Math.round(((tempVec.x + 1) * width) * 5) / 10;
        const ty = Math.round(((-tempVec.y + 1) * height) * 5) / 10;

        if (domEl._lastVis !== true) {
          domEl._lastVis = true;
          domEl.style.visibility = 'visible';
        }
        if (domEl._lastTx !== tx || domEl._lastTy !== ty) {
          domEl._lastTx = tx;
          domEl._lastTy = ty;
          domEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -100%)`;
        }
      }
    }
  }, []);

  // Inizializzazione scena Three.js e ciclo Render-on-Demand ottimizzato
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    boundsRef.current = { left: rect.left, top: rect.top, width, height };

    // SCENA
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F5F2EB');
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 400);
    const studioTarget = new THREE.Vector3(...STUDIO_VIEW.target);
    camera.position.set(...STUDIO_VIEW.position).sub(studioTarget)
      .multiplyScalar(TRAY_VIEW_SCALE / Math.min(camera.aspect, 1)).add(studioTarget);
    camera.lookAt(studioTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    cameraRef.current = camera;

    // RENDERER OTTIMIZZATO (senza preserveDrawingBuffer per doppio buffering nativo veloce su macOS/Retina)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'low-power'
    });
    const sizeRenderer = (w, h) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_800_000 / (w * h)));
      renderer.setDrawingBufferSize(w, h, ratio);
    };
    sizeRenderer(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CONTROLS (Orbit) con smorzamento rapido e reattivo
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 4;
    controls.maxDistance = 160;
    controls.target.copy(studioTarget);
    controls.update();
    controlsRef.current = controls;

    const dirLight = createStudioLights(scene, TRAY_VIEW_SCALE);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 4;
    dirLight.shadow.camera.far = 90;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    const d = TRAY_RADIUS + 2;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    // TAVOLO IN LEGNO DI FRASSINO (Vassoio scandinavo tornito)
    const trayGroup = new THREE.Group();
    trayGroup.name = 'TrayGroup';
    const trayRadius = TRAY_RADIUS;
    const trayHeight = 0.38;

    const trayGeo = new THREE.CylinderGeometry(trayRadius, trayRadius * 0.98, trayHeight, 96);
    const trayTexture = createTrayWoodTexture();
    const trayMat = new THREE.MeshStandardMaterial({
      map: trayTexture,
      roughness: 0.62,
      metalness: 0.02
    });
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.position.y = -trayHeight / 2;
    trayMesh.receiveShadow = true;
    trayGroup.add(trayMesh);

    // Bordo rialzato tornito del vassoio
    const rimPoints = [
      new THREE.Vector2(trayRadius - 0.22, 0),
      new THREE.Vector2(trayRadius + 0.06, 0),
      new THREE.Vector2(trayRadius + 0.14, 0.12),
      new THREE.Vector2(trayRadius + 0.08, 0.24),
      new THREE.Vector2(trayRadius - 0.08, 0.26),
      new THREE.Vector2(trayRadius - 0.18, 0.12),
      new THREE.Vector2(trayRadius - 0.22, 0)
    ];
    const rimGeo = new THREE.LatheGeometry(rimPoints, 96);
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#CBB89D',
      roughness: 0.55,
      metalness: 0.04
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = -0.02;
    rimMesh.castShadow = true;
    rimMesh.receiveShadow = true;
    trayGroup.add(rimMesh);

    // Base in feltro scuro nordico sotto il vassoio
    const feltGeo = new THREE.CylinderGeometry(trayRadius * 0.94, trayRadius * 0.94, 0.06, 48);
    const feltMat = new THREE.MeshStandardMaterial({
      color: '#363C38',
      roughness: 0.9
    });
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = -trayHeight - 0.03;
    trayGroup.add(feltMesh);

    // Disco d'ombra morbida circoscritto sotto al vassoio (evita uno shader pesante su tutto lo schermo!)
    const floorGeo = new THREE.CircleGeometry(trayRadius + 0.85, 48);
    const floorMat = new THREE.MeshBasicMaterial({
      color: '#DFD9CC',
      transparent: true,
      opacity: 0.55
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -trayHeight - 0.05;
    trayGroup.add(floorMesh);

    scene.add(trayGroup);
    trayGroupRef.current = trayGroup;

    // INDICATORE DI SGUARDO 3D INTERATTIVO
    const gazeGroup = new THREE.Group();
    gazeGroup.visible = false;

    const gazeLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0, 0.04, 2.35)
    ]);
    const gazeLineMat = new THREE.LineDashedMaterial({
      color: '#2E473B',
      dashSize: 0.22,
      gapSize: 0.12
    });
    const gazeLine = new THREE.Line(gazeLineGeo, gazeLineMat);
    gazeLine.computeLineDistances();
    gazeGroup.add(gazeLine);

    const arrowHeadGeo = new THREE.ConeGeometry(0.22, 0.48, 16);
    arrowHeadGeo.rotateX(Math.PI / 2);
    const arrowHeadMat = new THREE.MeshBasicMaterial({ color: '#2E473B' });
    const arrowHead = new THREE.Mesh(arrowHeadGeo, arrowHeadMat);
    arrowHead.position.set(0, 0.05, 2.45);
    arrowHead.name = 'gaze-handle';
    gazeGroup.add(arrowHead);

    const hitSphereGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const hitSphereMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitSphere = new THREE.Mesh(hitSphereGeo, hitSphereMat);
    hitSphere.position.set(0, 0.1, 2.45);
    hitSphere.name = 'gaze-handle';
    gazeGroup.add(hitSphere);
    gazeHandleMeshRef.current = hitSphere;

    const ringGeo = new THREE.RingGeometry(1.12, 1.18, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#2E473B',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.025;
    gazeGroup.add(ringMesh);

    scene.add(gazeGroup);
    gazeIndicatorRef.current = gazeGroup;

    // Un solo fotogramma per modifica; lo smorzamento riattiva il disegno finché la vista si muove.
    let isDisposed = false;
    let animFrameId = null;
    let viewportChanged = false;
    let preview = null;
    const lightBackground = scene.background;
    const darkBackground = new THREE.Color('#1D2520');
    const lightFloor = floorMat.color.clone();
    const darkFloor = new THREE.Color('#141914');

    const loop = (now) => {
      animFrameId = null;
      if (document.hidden) return;

      if (viewportChanged) {
        const { width: w, height: h } = boundsRef.current;
        sizeRenderer(w, h);
        viewportChanged = false;
      }

      if (previewRequestRef.current) {
        const request = previewRequestRef.current;
        previewRequestRef.current = null;
        preview ??= createPiecePreview();
        drawPiecePreview(renderer, preview, request, darkRef.current);
      }

      cameraAnimationRef.current?.(now);
      if (controls.enabled) controls.update();
      if (darkRef.current) {
        scene.background = darkBackground;
        trayMat.color.set('#9C907F');
        rimMat.color.set('#98846A');
        floorMat.color.copy(darkFloor);
        renderer.render(scene, camera);
        scene.background = lightBackground;
        trayMat.color.set('#FFFFFF');
        rimMat.color.set('#CBB89D');
        floorMat.color.copy(lightFloor);
      } else {
        renderer.render(scene, camera);
      }
      updateLabelsPositionDOM();
    };

    const wakeUpRender = () => {
      if (!isDisposed && animFrameId === null && !document.hidden) {
        animFrameId = requestAnimationFrame(loop);
      }
    };

    wakeUpRenderRef.current = wakeUpRender;

    const onControlsStart = () => {
      isOrbitingRef.current = true;
      cameraAnimationRef.current = null;
    };
    const onControlsEnd = () => { isOrbitingRef.current = false; };

    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', wakeUpRender);
    controls.addEventListener('end', onControlsEnd);

    const handleResize = () => {
      const { left, top, width: w, height: h } = container.getBoundingClientRect();
      if (!w || !h) return;
      const previous = boundsRef.current;
      boundsRef.current = { left, top, width: w, height: h };
      if (w !== previous.width || h !== previous.height) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      viewportChanged = true;
      wakeUpRender();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', wakeUpRender);
    const handleContextRestore = () => {
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      wakeUpRender();
    };
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestore);
    wakeUpRender();

    return () => {
      isDisposed = true;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      cameraAnimationRef.current = null;
      dragFrameRef.current = null;
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', wakeUpRender);
      controls.removeEventListener('end', onControlsEnd);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', wakeUpRender);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestore);
      pinInstancesRef.current.forEach((mesh) => mesh.dispose());
      pinInstancesRef.current.length = 0;
      linkMeshesRef.current.forEach(disposeLink);
      linkMeshesRef.current.clear();
      pieceMeshesRef.current.clear();
      dirLight.shadow.dispose();
      controls.dispose();
      trayGeo.dispose();
      trayMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      feltGeo.dispose();
      feltMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      gazeLineGeo.dispose();
      gazeLineMat.dispose();
      arrowHeadGeo.dispose();
      arrowHeadMat.dispose();
      hitSphereGeo.dispose();
      hitSphereMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [updateLabelsPositionDOM]);

  // Sincronizza solo i pezzi modificati e raggruppa gli intarsi in due draw call.
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;
    const currentMeshes = pieceMeshesRef.current;
    const activePieceIds = new Set(pieces.map((piece) => piece.id));
    let transformsChanged = false;

    for (const [id, mesh] of currentMeshes) {
      if (!activePieceIds.has(id)) {
        scene.remove(mesh);
        currentMeshes.delete(id);
        transformsChanged = true;
      }
    }

    for (const piece of pieces) {
      const isSelected = piece.id === selectedPieceId;
      let group = currentMeshes.get(piece.id);
      const previous = group?.userData.piece;
      if (previous === piece && group.userData.isSelected === isSelected) continue;

      if (!group) {
        group = new THREE.Group();
        group.userData.labelPosition = new THREE.Vector3();
        const pivot = new THREE.Group();
        pivot.name = 'tilt-pivot';
        const body = new THREE.Mesh(
          createPieceGeometry(piece.shape, piece.size),
          getPieceMaterial(piece.color, isSelected)
        );
        body.castShadow = true;
        body.receiveShadow = true;
        body.name = 'piece-body';
        body.userData.pieceId = piece.id;
        pivot.add(body);
        group.add(pivot);
        scene.add(group);
        currentMeshes.set(piece.id, group);
      }

      const pivot = group.children[0];
      const body = pivot.children[0];
      const shapeChanged = previous?.shape !== piece.shape || previous?.size !== piece.size || !previous;
      if (shapeChanged) {
        body.geometry = createPieceGeometry(piece.shape, piece.size);
        updateGazePinOnGroup(pivot, piece);
        pivot.getObjectByName('front-dot').visible = false;
      }
      if (previous?.color !== piece.color || group.userData.isSelected !== isSelected) {
        body.material = getPieceMaterial(piece.color, isSelected);
      }

      if (shapeChanged || previous.x !== piece.x || previous.y !== piece.y || previous.z !== piece.z ||
        previous.rotationX !== piece.rotationX || previous.rotationY !== piece.rotationY || previous.rotationZ !== piece.rotationZ) {
        applyPieceTransform3D(group, piece);
        group.updateMatrixWorld(true);
        const { height } = getPieceDimensions(piece);
        group.userData.labelPosition.set(piece.x, (piece.y || 0) + height + 0.42, piece.z);
        transformsChanged = true;
      }
      group.userData.piece = piece;
      group.userData.isSelected = isSelected;
    }

    const gaze = gazeIndicatorRef.current;
    const selectedPiece = currentMeshes.get(selectedPieceId)?.userData.piece;
    gaze.visible = Boolean(selectedPiece);
    if (selectedPiece) {
      gaze.position.set(selectedPiece.x, (selectedPiece.y || 0) + 0.02, selectedPiece.z);
      gaze.rotation.y = selectedPiece.rotationY || 0;
      gaze.updateMatrixWorld(true);
    }

    if (transformsChanged) {
      updatePinInstances(scene, pinInstancesRef.current, currentMeshes);
      renderer.shadowMap.needsUpdate = true;
    }
    wakeUpRenderRef.current();
  }, [pieces, selectedPieceId]);

  useEffect(() => {
    if (showLabels) updateLabelsPositionDOM();
  }, [showLabels, updateLabelsPositionDOM]);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    const currentLinkMeshes = linkMeshesRef.current;
    const piecesById = pieceMeshesRef.current;
    const activeLinkIds = new Set();
    let changed = false;
    for (const link of links) {
      const source = piecesById.get(link.sourceId)?.userData.piece;
      const target = piecesById.get(link.targetId)?.userData.piece;
      if (!source || !target) continue;
      activeLinkIds.add(link.id);

      const signature = `${source.x},${source.y || 0},${source.z}|${target.x},${target.y || 0},${target.z}|${link.type}`;
      const existing = currentLinkMeshes.get(link.id);
      if (existing?.userData.signature === signature) continue;
      if (existing) {
        scene.remove(existing);
        disposeLink(existing);
      }
      const group = buildLinkMeshGroup(link, source, target);
      group.userData.signature = signature;
      scene.add(group);
      currentLinkMeshes.set(link.id, group);
      changed = true;
    }

    for (const [id, group] of currentLinkMeshes) {
      if (!activeLinkIds.has(id)) {
        scene.remove(group);
        disposeLink(group);
        currentLinkMeshes.delete(id);
        changed = true;
      }
    }
    if (changed) {
      renderer.shadowMap.needsUpdate = true;
      wakeUpRenderRef.current();
    }
  }, [links, pieces]);

  // Animazione fluida telecamera
  const animateCamera = useCallback((targetPos, targetLookAt) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(targetPos);
      controls.target.copy(targetLookAt);
      cameraAnimationRef.current = null;
      wakeUpRenderRef.current();
      return;
    }

    const startTime = performance.now();
    cameraAnimationRef.current = (time) => {
      const progress = Math.min((time - startTime) / 360, 1);
      const ease = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLookAt, ease);
      if (progress < 1) wakeUpRenderRef.current();
      else cameraAnimationRef.current = null;
    };
    wakeUpRenderRef.current();
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!cameraView || !camera || !controlsRef.current) return;

    if (cameraView === 'zoom-in' || cameraView === 'zoom-out') {
      const controls = controlsRef.current;
      const target = controls.target.clone();
      const offset = camera.position.clone().sub(target);
      const factor = cameraView === 'zoom-in' ? 0.77 : 1.3;
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      animateCamera(offset.add(target), target);
    } else if (cameraView === 'fit' && pieces.length > 0) {
      const sphere = computePiecesBounds(pieces).getBoundingSphere(new THREE.Sphere());
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const narrowFov = Math.atan(Math.tan(halfFov) * Math.min(camera.aspect, 1));
      const distance = Math.max(6, sphere.radius * 1.15 / Math.sin(narrowFov));
      const offset = new THREE.Vector3(0, 0.68, 0.78).setLength(distance);
      animateCamera(offset.add(sphere.center), sphere.center);
    } else {
      const projection = cameraView === 'fit'
        ? STUDIO_VIEW
        : CAMERA_PROJECTIONS.find((view) => view.id === cameraView);
      if (projection?.position) {
        const target = new THREE.Vector3(...projection.target);
        const offset = new THREE.Vector3(...projection.position).sub(target);
        const aspect = Math.min(camera.aspect, 1);
        if (projection.id === 'top') {
          const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
          offset.setLength((TRAY_RADIUS + 1.3) / (Math.tan(halfFov) * aspect));
        } else {
          offset.multiplyScalar(TRAY_VIEW_SCALE / aspect);
        }
        animateCamera(offset.add(target), target);
      }
    }

    onCameraViewHandled?.();
  }, [cameraView, pieces, animateCamera, onCameraViewHandled]);

  const queuePiecePreview = useCallback((piece, canvas) => {
    const request = { piece, canvas };
    previewRequestRef.current = request;
    wakeUpRenderRef.current();
    return () => {
      if (previewRequestRef.current === request) previewRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    wakeUpRenderRef.current();
  }, [isDark]);

  useEffect(() => {
    if (controlsRef.current && !interactionModeRef.current) {
      controlsRef.current.enabled = !placementPieceId;
    }
  }, [placementPieceId]);

  // ESPORTAZIONE API + ASSI TELECAMERA PER MOVIMENTO TASTIERA (WASD / FRECCE)
  useEffect(() => {
    if (!onRegisterExportApi) return;

    const api = {
      queuePiecePreview,
      // Restituisce i vettori unitari "avanti" e "destra" sul piano orizzontale XZ rispetto alla telecamera attuale
      getCameraHorizontalAxes: () => {
        const cam = cameraRef.current;
        if (!cam) {
          return { forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } };
        }
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 0.001) {
          // Se siamo in vista zenitale perfetta dall'alto, usa l'asse up della camera
          forward.set(0, 0, -1);
        } else {
          forward.normalize();
        }
        const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
        return {
          forward: { x: forward.x, z: forward.z },
          right: { x: right.x, z: right.z }
        };
      },

      renderProjectionDataUrl: ({
        projectionId = 'camera',
        width = 1920,
        height = 1440,
        includeLabels = true,
        includeHeader = true
      }) => {
        wakeUpRenderRef.current();
        const canvas = renderProjectionToCanvas({
          renderer: rendererRef.current,
          scene: sceneRef.current,
          userCamera: cameraRef.current,
          pieces: piecesRef.current,
          links,
          currentPhaseId,
          projectionId,
          width,
          height,
          includeLabels,
          includeHeader,
          gazeIndicator: gazeIndicatorRef.current
        });
        return canvas ? canvas.toDataURL('image/png') : null;
      },

      renderCompositeSheetDataUrl: ({ includeLabels = true, resolutionScale = 1 } = {}) => {
        wakeUpRenderRef.current();
        const canvas = renderMultiProjectionSheet({
          renderer: rendererRef.current,
          scene: sceneRef.current,
          userCamera: cameraRef.current,
          pieces: piecesRef.current,
          links,
          currentPhaseId,
          includeLabels,
          gazeIndicator: gazeIndicatorRef.current,
          resolutionScale
        });
        return canvas ? canvas.toDataURL('image/png') : null;
      },

      downloadProjections: async ({
        projectionIds = ['camera'],
        width = 1920,
        height = 1440,
        includeLabels = true,
        includeHeader = true
      }) => {
        const dateStr = new Date().toISOString().slice(0, 10);
        for (let i = 0; i < projectionIds.length; i++) {
          const pid = projectionIds[i];
          const dataUrl = api.renderProjectionDataUrl({
            projectionId: pid,
            width,
            height,
            includeLabels,
            includeHeader
          });
          if (dataUrl) {
            triggerDownload(dataUrl, `geno3d-${currentPhaseId}-${pid}-${dateStr}.png`);
            if (projectionIds.length > 1) {
              await new Promise((r) => setTimeout(r, 220));
            }
          }
        }
      },

      downloadCompositeSheet: ({ includeLabels = true, resolutionScale = 1 } = {}) => {
        const dateStr = new Date().toISOString().slice(0, 10);
        const dataUrl = api.renderCompositeSheetDataUrl({ includeLabels, resolutionScale });
        if (dataUrl) {
          triggerDownload(dataUrl, `geno3d-${currentPhaseId}-tavola-proiezioni-${dateStr}.png`);
        }
      },

      export3D: ({ format = 'glb', includeTray = true, includeLinks = true } = {}) => {
        return exportScene3D({
          format,
          pieceMeshesMap: pieceMeshesRef.current,
          linkMeshesMap: linkMeshesRef.current,
          trayGroup: trayGroupRef.current,
          pieces: piecesRef.current,
          currentPhaseId,
          includeTray,
          includeLinks
        });
      }
    };

    onRegisterExportApi(api);
  }, [onRegisterExportApi, links, currentPhaseId, queuePiecePreview]);

  // INTERAZIONE MOUSE SENZA LAYOUT THRASHING
  const updateMouseCoords = (e) => {
    const { left, top, width, height } = boundsRef.current;
    if (width === 0 || height === 0) return false;
    mouseRef.current.x = ((e.clientX - left) / width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - top) / height) * 2 + 1;
    return true;
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0 || !e.isPrimary || placementPieceId) return;
    const { left, top } = mountRef.current.getBoundingClientRect();
    Object.assign(boundsRef.current, { left, top });
    if (!updateMouseCoords(e) || !cameraRef.current) return;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    if (selectedPieceIdRef.current && gazeIndicatorRef.current?.visible && gazeHandleMeshRef.current) {
      const gazeHits = raycasterRef.current.intersectObject(gazeHandleMeshRef.current, true);
      if (gazeHits.length > 0) {
        if (onDragStart) onDragStart();
        interactionModeRef.current = 'rotate';
        activePieceIdRef.current = selectedPieceIdRef.current;
        dragPointerRef.current = e.pointerId;
        if (controlsRef.current) controlsRef.current.enabled = false;
        if (mountRef.current) mountRef.current.style.cursor = 'grabbing';
        return;
      }
    }

    const interactiveMeshes = Array.from(pieceMeshesRef.current.values(), (group) => group.children[0].children[0]);

    const intersects = raycasterRef.current.intersectObjects(interactiveMeshes, false);

    if (intersects.length > 0) {
      const clickedPieceId = intersects[0].object.userData.pieceId;

      if (clickedPieceId) {
        if (e.shiftKey && selectedPieceIdRef.current && selectedPieceIdRef.current !== clickedPieceId) {
          const selPiece = piecesRef.current.find((p) => p.id === selectedPieceIdRef.current);
          const targetPiece = piecesRef.current.find((p) => p.id === clickedPieceId);
          if (selPiece && targetPiece) {
            const angle = Math.atan2(targetPiece.x - selPiece.x, targetPiece.z - selPiece.z);
            onUpdatePiece(selPiece.id, { rotationY: Math.round(angle * 100) / 100 });
            return;
          }
        }

        if (onDragStart) onDragStart();
        interactionModeRef.current = e.shiftKey ? 'rotate' : 'move';
        const piece = pieceMeshesRef.current.get(clickedPieceId).userData.piece;
        const hit = raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, groundHitRef.current);
        dragOffsetRef.current.x = hit ? piece.x - hit.x : 0;
        dragOffsetRef.current.z = hit ? piece.z - hit.z : 0;
        activePieceIdRef.current = clickedPieceId;
        dragPointerRef.current = e.pointerId;
        onSelectPiece(clickedPieceId);

        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
        if (mountRef.current) {
          mountRef.current.style.cursor = 'grabbing';
        }
      }
    } else {
      if (e.shiftKey && selectedPieceIdRef.current) {
        const groundHit = groundHitRef.current;
        if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, groundHit)) {
          const selPiece = piecesRef.current.find((p) => p.id === selectedPieceIdRef.current);
          if (selPiece) {
            if (onDragStart) onDragStart();
            interactionModeRef.current = 'rotate';
            activePieceIdRef.current = selPiece.id;
            dragPointerRef.current = e.pointerId;
            if (controlsRef.current) controlsRef.current.enabled = false;
            const angle = Math.atan2(groundHit.x - selPiece.x, groundHit.z - selPiece.z);
            onUpdatePiece(selPiece.id, { rotationY: Math.round(angle * 100) / 100 });
            return;
          }
        }
      }
      onSelectPiece(null);
    }
  };

  const applyPendingDrag = () => {
    const point = pendingDragRef.current;
    const pieceId = activePieceIdRef.current;
    pendingDragRef.current = null;
    if (!point || !pieceId || !updateMouseCoords(point) || !cameraRef.current) return;

    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(mouseRef.current, cameraRef.current);
    const hit = raycaster.ray.intersectPlane(groundPlaneRef.current, groundHitRef.current);
    if (!hit) return;
    const piece = pieceMeshesRef.current.get(pieceId)?.userData.piece;
    if (!piece) return;
    if (interactionModeRef.current === 'rotate') {
      const angle = Math.round(Math.atan2(hit.x - piece.x, hit.z - piece.z) * 100) / 100;
      if (angle !== (piece.rotationY || 0)) onUpdatePiece(pieceId, { rotationY: angle });
    } else {
      const offset = dragOffsetRef.current;
      const position = calculateDragPosition(hit.x + offset.x, hit.z + offset.z, pieceId, piecesRef.current);
      if (position.x !== piece.x || position.y !== (piece.y || 0) || position.z !== piece.z) {
        onUpdatePiece(pieceId, position);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (interactionModeRef.current) {
      if (e.pointerId !== dragPointerRef.current) return;
      pendingDragRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (dragFrameRef.current === null) {
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = null;
          applyPendingDrag();
        });
      }
      return;
    }

    // Se stiamo ruotando la telecamera col mouse, non fare alcun raycasting
    if (placementPieceId || e.buttons !== 0 || isOrbitingRef.current) {
      return;
    }

    // Throttling del cursore hover (max 15 volte al secondo quando il mouse si muove a vuoto)
    const now = performance.now();
    if (now - lastHoverCheckTimeRef.current < 65) return;
    lastHoverCheckTimeRef.current = now;

    if (mountRef.current && updateMouseCoords(e) && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      let isHoveringInteractive = false;

      if (selectedPieceIdRef.current && gazeIndicatorRef.current?.visible && gazeHandleMeshRef.current) {
        if (raycasterRef.current.intersectObject(gazeHandleMeshRef.current, true).length > 0) {
          isHoveringInteractive = true;
        }
      }

      if (!isHoveringInteractive) {
        for (const group of pieceMeshesRef.current.values()) {
          const body = group.getObjectByName('piece-body');
          if (body && raycasterRef.current.intersectObject(body, false).length > 0) {
            isHoveringInteractive = true;
            break;
          }
        }
      }

      const nextCursor = isHoveringInteractive ? 'grab' : 'default';
      if (hoverCursorRef.current !== nextCursor) {
        hoverCursorRef.current = nextCursor;
        mountRef.current.style.cursor = nextCursor;
      }
    }
  };

  const handlePlacement = (event) => {
    const camera = cameraRef.current;
    if (!placementPieceId || !camera) return;
    const rect = mountRef.current.getBoundingClientRect();
    boundsRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    if (!updateMouseCoords(event)) return;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(mouseRef.current, camera);
    const hit = raycaster.ray.intersectPlane(groundPlaneRef.current, groundHitRef.current);
    if (!hit || Math.hypot(hit.x, hit.z) > TRAY_RADIUS) return;
    const position = calculateDragPosition(hit.x, hit.z, placementPieceId, piecesRef.current);
    onPlacePiece(placementPieceId, position);
  };

  const handlePointerUp = (e) => {
    if (interactionModeRef.current && e.pointerId === dragPointerRef.current) {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
        flushSync(applyPendingDrag);
      }
      dragPointerRef.current = null;
      interactionModeRef.current = null;
      activePieceIdRef.current = null;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      if (mountRef.current) {
        mountRef.current.style.cursor = hoverCursorRef.current;
      }
      if (onDragEnd) onDragEnd();
    }
  };

  return (
    <div className="geno-scene" data-placing={Boolean(placementPieceId)}>
      {/* CONTENITORE WEBGL SEPARATO DALLE ETICHETTE */}
      <div
        ref={mountRef}
        onClick={handlePlacement}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        className="geno-webgl"
      />

      {/* OVERLAY ETICHETTE 2D */}
      {showLabels &&
        pieces.map((piece) => {
          const isSelected = piece.id === selectedPieceId;

          return (
            <button
              key={piece.id}
              type="button"
              className="geno-piece-label"
              aria-pressed={isSelected}
              title={piece.role ? `${piece.name || 'Senza nome'} · ${piece.role}` : undefined}
              ref={(el) => {
                if (el) {
                  labelDomMapRef.current.set(piece.id, el);
                } else {
                  labelDomMapRef.current.delete(piece.id);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey && selectedPieceId && selectedPieceId !== piece.id) {
                  const selPiece = pieces.find((p) => p.id === selectedPieceId);
                  if (selPiece) {
                    const angle = Math.atan2(piece.x - selPiece.x, piece.z - selPiece.z);
                    onUpdatePiece(selPiece.id, { rotationY: Math.round(angle * 100) / 100 });
                  }
                  return;
                }
                onSelectPiece(piece.id);
              }}
            >
              <span className="geno-piece-name">{piece.name || 'Senza nome'}</span>
              {isSelected && piece.role && <span className="geno-piece-role">{piece.role}</span>}
            </button>
          );
        })}
    </div>
  );
}
