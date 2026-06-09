import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';

/**
 * T2 — 기본 three.js 무대: 흰 배경, 3인칭 뒤+위 perspective 카메라,
 * 조명, delta-time 렌더 루프. (AC1 토대)
 *
 * 좌표 규약 (이후 전 시스템의 기준):
 *   X = 레인 좌우 (4×1: 4칸이 X축에 나열)
 *   Z = 깊이. 벽은 -Z 먼 곳에서 +Z(플레이어/카메라 쪽)로 접근
 *   Y = 높이. 4×4 확장 시 행이 Y축에 쌓임
 *
 * 4×1 레인 + 흰 구 배치는 T3. 여기는 빈 무대 + (DEBUG) 참조 헬퍼만.
 */

/** 임시 시각화 헬퍼(그리드/축). T3에서 false 로 끈다. */
const DEBUG_HELPERS = true;

/** 카메라 배치 — 튜닝하기 쉽게 한곳에 모음. */
const CAMERA = {
  fov: 60,
  near: 0.1,
  far: 200,
  position: new THREE.Vector3(0, 5, 9), // 플레이어 뒤(+Z) + 위(+Y)
  lookAt: new THREE.Vector3(0, 0, -6), // 깊이(-Z) 방향 응시
} as const;

const mount = document.querySelector<HTMLDivElement>('#app');
if (!mount) {
  throw new Error('#app mount point not found');
}

// 이전 T1 stub 잔재 제거 (HMR 재실행 대비).
mount.replaceChildren();

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xffffff, 1); // 흰 배경 (미니멀리즘)
mount.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  CAMERA.fov,
  window.innerWidth / window.innerHeight,
  CAMERA.near,
  CAMERA.far,
);
camera.position.copy(CAMERA.position);
camera.lookAt(CAMERA.lookAt);

// --- Lights (흰 오브젝트가 입체로 보이도록 부드러운 라이팅) ---
const hemi = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(4, 8, 6);
scene.add(dir);

// --- Debug helpers (임시, T3에서 제거) ---
if (DEBUG_HELPERS) {
  // 레인 평면(XZ) 가늠용 그리드 + 축. 흰 배경이라 옅은 회색.
  const grid = new THREE.GridHelper(20, 20, 0xbbbbbb, 0xe2e2e2);
  scene.add(grid);
  scene.add(new THREE.AxesHelper(2));
}

// --- Resize ---
function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// --- Game loop ---
function update(_dt: number): void {
  // T3+ 에서 시스템 update 가 여기 연결된다.
}
function render(): void {
  renderer.render(scene, camera);
}

const loop = new GameLoop(update, render);
loop.start();

console.info(`[RuleAdd] T2 stage ready — three.js r${THREE.REVISION}`);
