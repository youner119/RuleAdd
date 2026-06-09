import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { PLAYER_Z } from './core/lane';
import { Game } from './core/Game';

/**
 * main — 렌더 인프라(renderer/camera/scene/lights/loop)만 담당.
 * 게임플레이(레인·구·벽·충돌·상태)는 Game 이 소유한다.
 *
 * 좌표 규약 (전 시스템 기준):
 *   X = 레인 좌우 (4×1: 4칸이 X축에 나열)
 *   Z = 깊이. 벽은 -Z 먼 곳에서 +Z(플레이어/카메라 쪽)로 접근
 *   Y = 높이. 4×4 확장 시 행이 Y축에 쌓임
 */

/** 카메라 배치 — 튜닝하기 쉽게 한곳에 모음. */
const CAMERA = {
  fov: 60,
  near: 0.1,
  far: 200,
  position: new THREE.Vector3(0, 4.5, 9), // 플레이어 뒤(+Z) + 위(+Y)
  lookAt: new THREE.Vector3(0, 0.6, PLAYER_Z - 8), // 플레이어 너머 깊이 응시
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
renderer.shadowMap.enabled = true; // contact shadow → 흰색-on-흰색 깊이감
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
const hemi = new THREE.HemisphereLight(0xffffff, 0xeeeeee, 1.3);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.5);
dir.position.set(4, 8, 6);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 40;
dir.shadow.camera.left = -12;
dir.shadow.camera.right = 12;
dir.shadow.camera.top = 12;
dir.shadow.camera.bottom = -12;
dir.shadow.bias = -0.0005;
scene.add(dir);

// --- Game (게임플레이: 레인·구·벽·충돌·상태) ---
const game = new Game(scene);

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
function update(dt: number): void {
  game.update(dt);
}
function render(): void {
  renderer.render(scene, camera);
}

const loop = new GameLoop(update, render);
loop.start();

console.info(`[RuleAdd] T13 ready — score (base x round^2), three.js r${THREE.REVISION}`);
