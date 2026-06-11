import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { PLAYER_Z } from './core/lane';
import { Game } from './core/Game';
import { StartScreen } from './hud/StartScreen';

/**
 * main — 렌더 인프라(renderer/camera/scene/lights/loop)만 담당.
 * 게임플레이(레인·구·벽·충돌·상태)는 Game 이 소유한다.
 *
 * 좌표 규약 (전 시스템 기준):
 *   X = 레인 좌우 (4×1: 4칸이 X축에 나열)
 *   Z = 깊이. 벽은 -Z 먼 곳에서 +Z(플레이어/카메라 쪽)로 접근
 *   Y = 높이. 4×4 확장 시 행이 Y축에 쌓임
 */

/** 카메라 렌즈 — 튜닝하기 쉽게 한곳에 모음. 배치는 setCameraForGrid 가 동적 계산. */
const CAMERA = {
  fov: 60,
  near: 0.1,
  far: 200,
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

// --- Game (난이도 선택 후 시작, 메뉴로 복귀 가능) ---
let game: Game | null = null;

/**
 * 그리드 크기(rows×cols)에 맞는 카메라 위치/시선 계산.
 * 4×1(0,4.5,9 / look y 0.6)·4×4(0,7.5,12.5 / look y 2.3) 기존 두 앵커를 행 수로
 * 보간·외삽하고, 열이 기본(4)보다 넓으면 전체 폭이 담기게 뒤로 물러난다.
 */
function gridCamera(rows: number, cols: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const t = rows - 1;
  return {
    pos: new THREE.Vector3(0, 4.5 + t * 1.0, 9 + t * (3.5 / 3) + Math.max(0, cols - 4) * 0.9),
    look: new THREE.Vector3(0, 0.6 + t * (1.7 / 3), PLAYER_Z - 8),
  };
}

// 카메라 글라이드 — 그리드 전환(확장 등) 시 새 프레이밍으로 부드럽게 이동.
// 라운드 전환 텀(1.8s) 안에 끝나도록 1.1s. easeInOutQuad.
const CAM_TWEEN_SEC = 1.1;
const camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const camTo = gridCamera(1, 4);
const camLook = camTo.look.clone(); // 현재 시선(보간 상태)
let camT = 1; // 1 = 보간 완료(정지)

camera.position.copy(camTo.pos);
camera.lookAt(camLook);

/** 그리드 크기 변경 → 카메라 글라이드 시작. Game 이 호출. */
function setCameraForGrid(rows: number, cols: number): void {
  const target = gridCamera(rows, cols);
  if (camera.position.distanceToSquared(target.pos) < 1e-6) return; // 동일 프레이밍 — 무시
  camFrom.pos.copy(camera.position);
  camFrom.look.copy(camLook);
  camTo.pos.copy(target.pos);
  camTo.look.copy(target.look);
  camT = 0;
}

/** 카메라 보간 진행 — 게임 루프 update 에서 매 프레임(전환 텀에도 동작). */
function updateCamera(dt: number): void {
  if (camT >= 1) return;
  camT = Math.min(1, camT + dt / CAM_TWEEN_SEC);
  const e = camT < 0.5 ? 2 * camT * camT : 1 - (2 - 2 * camT) ** 2 / 2; // easeInOutQuad
  camera.position.lerpVectors(camFrom.pos, camTo.pos, e);
  camLook.lerpVectors(camFrom.look, camTo.look, e);
  camera.lookAt(camLook);
}

function showStartScreen(): void {
  new StartScreen(mount as HTMLDivElement, (difficulty) => {
    game = new Game(scene, difficulty, handleMenu, setCameraForGrid);
  });
}
function handleMenu(): void {
  game?.dispose();
  game = null;
  setCameraForGrid(1, 4); // 메뉴 복귀 — 기본(4×1) 시점으로 글라이드
  showStartScreen();
}
showStartScreen();

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
  updateCamera(dt); // 카메라 글라이드는 게임 정지(전환 텀)·메뉴에서도 진행
  game?.update(dt); // 시작 화면 동안엔 game=null
}
function render(): void {
  renderer.render(scene, camera);
}

const loop = new GameLoop(update, render);
loop.start();

console.info(`[RuleAdd] ready — three.js r${THREE.REVISION}`);
