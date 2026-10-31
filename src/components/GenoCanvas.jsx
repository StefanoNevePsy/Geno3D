import React, { useEffect, useRef, useCallback } from 'react';
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
import { CAMERA_PROJECTIONS } from '../constants';
import {
  renderProjectionToCanvas,
  renderMultiProjectionSheet,
  exportScene3D,
  triggerDownload
} from '../utils/exportUtils';

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
  onRegisterExportApi
}) {
  const wrapperRef = useRef(null);
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
  const isOrbitingRef = useRef(false);
  const lastHoverCheckTimeRef = useRef(0);
  const hoverCursorRef = useRef('default');
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

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
    const tempVec = new THREE.Vector3();

    for (const p of currentPieces) {
      const domEl = labelDomMapRef.current.get(p.id);
      if (!domEl) continue;

      const dims = getPieceDimensions(p);
      tempVec.set(p.x, (p.y || 0) + dims.height + 0.42, p.z);
      tempVec.project(camera);

      if (tempVec.z > 1 || tempVec.z < -1) {
        if (domEl._lastVis !== false) {
          domEl._lastVis = false;
          domEl.style.opacity = '0';
          domEl.style.pointerEvents = 'none';
        }
      } else {
        const tx = Math.round(((tempVec.x + 1) * width) * 5) / 10;
        const ty = Math.round(((-tempVec.y + 1) * height) * 5) / 10;

        if (domEl._lastVis !== true) {
          domEl._lastVis = true;
          domEl.style.opacity = '1';
          domEl.style.pointerEvents = 'auto';
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
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 13.5, 15.5);
    camera.lookAt(0, 0.5, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    cameraRef.current = camera;

    // RENDERER OTTIMIZZATO (senza preserveDrawingBuffer per doppio buffering nativo veloce su macOS/Retina)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
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
    controls.maxDistance = 36;
    controls.target.set(0, 0.5, 0);
    controls.update();
    controlsRef.current = controls;

    // ILLUMINAZIONE SCANDINAVA DA STUDIO
    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#D6CEC0', 0.98);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#FFF8EC', 1.38);
    dirLight.position.set(11, 21, 13);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 4;
    dirLight.shadow.camera.far = 38;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    const d = 10.5;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight('#E2EAF2', 0.48);
    fillLight.position.set(-13, 11, -9);
    scene.add(fillLight);

    // TAVOLO IN LEGNO DI FRASSINO (Vassoio scandinavo tornito)
    const trayGroup = new THREE.Group();
    trayGroup.name = 'TrayGroup';
    const trayRadius = 9.5;
    const trayHeight = 0.38;

    const trayGeo = new THREE.CylinderGeometry(trayRadius, trayRadius * 0.98, trayHeight, 64);
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
    const rimGeo = new THREE.LatheGeometry(rimPoints, 64);
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

    // Ricollega eventuali mesh già presenti nelle mappe
    pieceMeshesRef.current.forEach((mesh) => {
      if (mesh.parent !== scene) scene.add(mesh);
    });
    linkMeshesRef.current.forEach((mesh) => {
      if (mesh.parent !== scene) scene.add(mesh);
    });

    // CICLO DI RENDERING AD EFFICIENZA ENERGETICA (Fluido a 60fps in movimento, 0% a riposo)
    let isDisposed = false;
    let animFrameId = null;
    let keepAliveUntil = performance.now() + 500;

    const loop = (now) => {
      animFrameId = null;
      if (isDisposed) return;

      if (!document.hidden) {
        controls.update();
        renderer.render(scene, camera);
        updateLabelsPositionDOM();
      }

      if ((now < keepAliveUntil || isOrbitingRef.current) && !document.hidden) {
        animFrameId = requestAnimationFrame(loop);
      }
    };

    const wakeUpRender = (durationMs = 450) => {
      if (isDisposed) return;
      keepAliveUntil = Math.max(keepAliveUntil, performance.now() + durationMs);
      if (animFrameId === null && !document.hidden) {
        animFrameId = requestAnimationFrame(loop);
      }
    };

    wakeUpRenderRef.current = wakeUpRender;

    const onControlsStart = () => {
      isOrbitingRef.current = true;
      wakeUpRender(450);
    };
    const onControlsChange = () => {
      wakeUpRender(450);
    };
    const onControlsEnd = () => {
      isOrbitingRef.current = false;
      wakeUpRender(450);
    };

    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);
    controls.addEventListener('end', onControlsEnd);

    const handleResize = () => {
      if (!container || isDisposed) return;
      const r = container.getBoundingClientRect();
      const w = r.width || window.innerWidth;
      const h = r.height || window.innerHeight;
      if (w === 0 || h === 0) return;
      boundsRef.current = { left: r.left, top: r.top, width: w, height: h };
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
      updateLabelsPositionDOM();
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => handleResize())
      : null;
    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) wakeUpRender(400);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    renderer.render(scene, camera);
    updateLabelsPositionDOM();
    wakeUpRender(500);

    return () => {
      isDisposed = true;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      controls.removeEventListener('end', onControlsEnd);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // SINCRONIZZAZIONE PEZZI 3D (con supporto per rotazione 3D completa: rotationY, rotationX, rotationZ)
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!scene) return;

    const currentMeshes = pieceMeshesRef.current;
    const activePieceIds = new Set(pieces.map((p) => p.id));

    for (const [id, mesh] of currentMeshes.entries()) {
      if (!activePieceIds.has(id)) {
        scene.remove(mesh);
        currentMeshes.delete(id);
      }
    }

    pieces.forEach((piece) => {
      const isSelected = piece.id === selectedPieceId;
      let meshGroup = currentMeshes.get(piece.id);

      if (!meshGroup) {
        meshGroup = new THREE.Group();
        meshGroup.userData = {
          pieceId: piece.id,
          shape: piece.shape,
          size: piece.size,
          color: piece.color
        };

        const tiltPivot = new THREE.Group();
        tiltPivot.name = 'tilt-pivot';

        const geo = createPieceGeometry(piece.shape, piece.size);
        const mat = getPieceMaterial(piece.color, isSelected);
        const mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        mainMesh.name = 'piece-body';
        mainMesh.userData = { pieceId: piece.id };
        tiltPivot.add(mainMesh);

        updateGazePinOnGroup(tiltPivot, piece);
        meshGroup.add(tiltPivot);

        scene.add(meshGroup);
        currentMeshes.set(piece.id, meshGroup);
      } else {
        if (meshGroup.parent !== scene) {
          scene.add(meshGroup);
        }
        const tiltPivot = meshGroup.getObjectByName('tilt-pivot') || meshGroup;
        const mainMesh = tiltPivot.getObjectByName('piece-body');
        if (mainMesh) {
          if (
            meshGroup.userData.shape !== piece.shape ||
            meshGroup.userData.size !== piece.size
          ) {
            mainMesh.geometry = createPieceGeometry(piece.shape, piece.size);
            meshGroup.userData.shape = piece.shape;
            meshGroup.userData.size = piece.size;
            updateGazePinOnGroup(tiltPivot, piece);
          }

          mainMesh.material = getPieceMaterial(piece.color, isSelected);
          meshGroup.userData.color = piece.color;
        }
      }

      applyPieceTransform3D(meshGroup, piece);
    });

    const gaze = gazeIndicatorRef.current;
    if (gaze) {
      const selectedPiece = pieces.find((p) => p.id === selectedPieceId);
      if (selectedPiece) {
        gaze.visible = true;
        gaze.position.set(selectedPiece.x, (selectedPiece.y || 0) + 0.02, selectedPiece.z);
        gaze.rotation.y = selectedPiece.rotationY || 0;
      } else {
        gaze.visible = false;
      }
    }

    if (renderer && camera) {
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
    }
    updateLabelsPositionDOM();
  }, [pieces, selectedPieceId, updateLabelsPositionDOM]);

  // Quando cambia showLabels, aggiorna immediatamente le posizioni DOM
  useEffect(() => {
    updateLabelsPositionDOM();
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [showLabels, updateLabelsPositionDOM]);

  // SINCRONIZZAZIONE FILI RELAZIONALI
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!scene) return;

    const currentLinkMeshes = linkMeshesRef.current;
    const activeLinkIds = new Set(links.map((l) => l.id));

    const disposeGroupResources = (grp) => {
      grp.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    };

    for (const [id, mesh] of currentLinkMeshes.entries()) {
      if (!activeLinkIds.has(id)) {
        scene.remove(mesh);
        disposeGroupResources(mesh);
        currentLinkMeshes.delete(id);
      }
    }

    let anyLinkChanged = false;

    links.forEach((link) => {
      const sourcePiece = pieces.find((p) => p.id === link.sourceId);
      const targetPiece = pieces.find((p) => p.id === link.targetId);
      if (!sourcePiece || !targetPiece) return;

      const signature = `${sourcePiece.x},${sourcePiece.y || 0},${sourcePiece.z}|${targetPiece.x},${targetPiece.y || 0},${targetPiece.z}|${link.type}`;
      const existingGroup = currentLinkMeshes.get(link.id);

      if (existingGroup && existingGroup.userData.signature === signature) {
        if (existingGroup.parent !== scene) {
          scene.add(existingGroup);
          anyLinkChanged = true;
        }
        return;
      }

      if (existingGroup) {
        scene.remove(existingGroup);
        disposeGroupResources(existingGroup);
      }

      const newLinkGroup = buildLinkMeshGroup(link, sourcePiece, targetPiece);
      newLinkGroup.userData = { linkId: link.id, signature };
      scene.add(newLinkGroup);
      currentLinkMeshes.set(link.id, newLinkGroup);
      anyLinkChanged = true;
    });

    if (anyLinkChanged && renderer && camera) {
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
    }
  }, [links, pieces]);

  // Animazione fluida telecamera
  const animateCamera = useCallback((targetPos, targetLookAt) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 500;
    const startTime = performance.now();
    wakeUpRenderRef.current(duration + 350);

    const updateAnim = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLookAt, ease);
      controls.update();

      if (progress < 1) {
        requestAnimationFrame(updateAnim);
      }
    };
    requestAnimationFrame(updateAnim);
  }, []);

  // GESTIONE VISTE CAMERA
  useEffect(() => {
    if (!cameraView || !cameraRef.current || !controlsRef.current) return;

    if (cameraView === 'fit') {
      if (pieces.length === 0) {
        animateCamera(new THREE.Vector3(0, 13.5, 15.5), new THREE.Vector3(0, 0.5, 0));
      } else {
        const box = new THREE.Box3();
        pieces.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y || 0, p.z)));
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z, 6.5);
        const targetPos = new THREE.Vector3(center.x, maxDim * 1.45, center.z + maxDim * 1.38);
        animateCamera(targetPos, new THREE.Vector3(center.x, 0.6, center.z));
      }
    } else {
      const proj = CAMERA_PROJECTIONS.find((p) => p.id === cameraView);
      if (proj && proj.position) {
        animateCamera(
          new THREE.Vector3(...proj.position),
          new THREE.Vector3(...(proj.target || [0, 0.5, 0]))
        );
      }
    }

    if (onCameraViewHandled) onCameraViewHandled();
  }, [cameraView, pieces, animateCamera, onCameraViewHandled]);

  // ESPORTAZIONE API + ASSI TELECAMERA PER MOVIMENTO TASTIERA (WASD / FRECCE)
  useEffect(() => {
    if (!onRegisterExportApi) return;

    const api = {
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
        const canvas = renderProjectionToCanvas({
          renderer: rendererRef.current,
          scene: sceneRef.current,
          userCamera: cameraRef.current,
          userControls: controlsRef.current,
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
        wakeUpRenderRef.current(200);
        return canvas ? canvas.toDataURL('image/png') : null;
      },

      renderCompositeSheetDataUrl: ({ includeLabels = true, resolutionScale = 1 } = {}) => {
        const canvas = renderMultiProjectionSheet({
          renderer: rendererRef.current,
          scene: sceneRef.current,
          userCamera: cameraRef.current,
          userControls: controlsRef.current,
          pieces: piecesRef.current,
          links,
          currentPhaseId,
          includeLabels,
          gazeIndicator: gazeIndicatorRef.current,
          resolutionScale
        });
        wakeUpRenderRef.current(200);
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
  }, [onRegisterExportApi, links, currentPhaseId]);

  // INTERAZIONE MOUSE SENZA LAYOUT THRASHING
  const updateMouseCoords = (e) => {
    const { left, top, width, height } = boundsRef.current;
    if (width === 0 || height === 0) return false;
    mouseRef.current.x = ((e.clientX - left) / width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - top) / height) * 2 + 1;
    return true;
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    if (!updateMouseCoords(e) || !cameraRef.current) return;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    if (selectedPieceIdRef.current && gazeIndicatorRef.current?.visible && gazeHandleMeshRef.current) {
      const gazeHits = raycasterRef.current.intersectObject(gazeHandleMeshRef.current, true);
      if (gazeHits.length > 0) {
        if (onDragStart) onDragStart();
        interactionModeRef.current = 'rotate';
        activePieceIdRef.current = selectedPieceIdRef.current;
        if (controlsRef.current) controlsRef.current.enabled = false;
        if (mountRef.current) mountRef.current.style.cursor = 'grabbing';
        return;
      }
    }

    const interactiveMeshes = [];
    pieceMeshesRef.current.forEach((group) => {
      group.traverse((child) => {
        if (child.isMesh && child.name === 'piece-body') {
          interactiveMeshes.push(child);
        }
      });
    });

    const intersects = raycasterRef.current.intersectObjects(interactiveMeshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const clickedPieceId =
        hitMesh.userData?.pieceId ||
        hitMesh.parent?.userData?.pieceId ||
        hitMesh.parent?.parent?.userData?.pieceId;

      if (clickedPieceId) {
        if (e.shiftKey && selectedPieceIdRef.current && selectedPieceIdRef.current !== clickedPieceId) {
          const selPiece = piecesRef.current.find((p) => p.id === selectedPieceIdRef.current);
          const targetPiece = piecesRef.current.find((p) => p.id === clickedPieceId);
          if (selPiece && targetPiece) {
            if (onDragStart) onDragStart();
            const angle = Math.atan2(targetPiece.x - selPiece.x, targetPiece.z - selPiece.z);
            onUpdatePiece(selPiece.id, { rotationY: Math.round(angle * 100) / 100 });
            if (onDragEnd) onDragEnd();
            return;
          }
        }

        if (onDragStart) onDragStart();
        interactionModeRef.current = e.shiftKey ? 'rotate' : 'move';
        activePieceIdRef.current = clickedPieceId;
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
        const groundHit = new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, groundHit)) {
          const selPiece = piecesRef.current.find((p) => p.id === selectedPieceIdRef.current);
          if (selPiece) {
            if (onDragStart) onDragStart();
            interactionModeRef.current = 'rotate';
            activePieceIdRef.current = selPiece.id;
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

  const handlePointerMove = (e) => {
    if (interactionModeRef.current && activePieceIdRef.current) {
      if (!updateMouseCoords(e) || !cameraRef.current) return;
      const pieceId = activePieceIdRef.current;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const groundHit = new THREE.Vector3();

      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, groundHit)) {
        if (interactionModeRef.current === 'rotate') {
          const selPiece = piecesRef.current.find((p) => p.id === pieceId);
          if (selPiece) {
            const angle = Math.atan2(groundHit.x - selPiece.x, groundHit.z - selPiece.z);
            onUpdatePiece(pieceId, { rotationY: Math.round(angle * 100) / 100 });
          }
        } else {
          const newPos = calculateDragPosition(groundHit.x, groundHit.z, pieceId, piecesRef.current);
          onUpdatePiece(pieceId, newPos);
        }
      }
      return;
    }

    // Se stiamo ruotando la telecamera col mouse, non fare alcun raycasting
    if (e.buttons !== 0 || isOrbitingRef.current) {
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

  const handlePointerUp = () => {
    if (interactionModeRef.current) {
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
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* CONTENITORE WEBGL SEPARATO DALLE ETICHETTE */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={() => wakeUpRenderRef.current(550)}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          touchAction: 'none'
        }}
      />

      {/* OVERLAY ETICHETTE 2D */}
      {showLabels &&
        pieces.map((piece) => {
          const isSelected = piece.id === selectedPieceId;

          return (
            <div
              key={piece.id}
              ref={(el) => {
                if (el) {
                  labelDomMapRef.current.set(piece.id, el);
                  updateLabelsPositionDOM();
                } else {
                  labelDomMapRef.current.delete(piece.id);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey && selectedPieceId && selectedPieceId !== piece.id) {
                  const selPiece = pieces.find((p) => p.id === selectedPieceId);
                  if (selPiece) {
                    if (onDragStart) onDragStart();
                    const angle = Math.atan2(piece.x - selPiece.x, piece.z - selPiece.z);
                    onUpdatePiece(selPiece.id, { rotationY: Math.round(angle * 100) / 100 });
                    if (onDragEnd) onDragEnd();
                  }
                  return;
                }
                onSelectPiece(piece.id);
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: 0,
                willChange: 'transform',
                pointerEvents: 'none',
                cursor: 'pointer',
                zIndex: isSelected ? 30 : 20
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: isSelected
                    ? 'var(--accent-pine)'
                    : 'rgba(255, 255, 255, 0.96)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                  padding: '4px 11px',
                  borderRadius: '14px',
                  border: `1px solid ${
                    isSelected ? 'var(--accent-pine)' : 'rgba(205, 195, 180, 0.85)'
                  }`,
                  boxShadow: isSelected
                    ? '0 6px 16px rgba(46, 71, 59, 0.24)'
                    : '0 2px 8px rgba(29, 36, 33, 0.08)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : 500,
                    letterSpacing: '-0.01em'
                  }}
                >
                  {piece.name || 'Senza nome'}
                </span>
                {piece.role && (
                  <span
                    style={{
                      fontSize: '10px',
                      opacity: isSelected ? 0.88 : 0.68,
                      fontWeight: 400
                    }}
                  >
                    {piece.role}
                  </span>
                )}
              </div>

              <div
                style={{
                  width: 0,
                  height: 0,
                  margin: '0 auto',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: `4px solid ${
                    isSelected ? 'var(--accent-pine)' : 'rgba(205, 195, 180, 0.85)'
                  }`
                }}
              />
            </div>
          );
        })}
    </div>
  );
}
