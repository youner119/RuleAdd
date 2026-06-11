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
 * 그리드 크기(rows×cols)에 맞춰 카메라를 그리드 중앙에 동적 프레이밍. Game 이 호출.
 * 4×1(0,4.5,9 / look y 0.6)·4×4(0,7.5,12.5 / look y 2.3) 기존 두 앵커를 행 수로
 * 보간·외삽하고, 열이 기본(4)보다 넓으면 전체 폭이 담기게 뒤로 물러난다.
 */
function setCameraForGrid(rows: number, cols: number): void {
  const t = rows - 1;
  camera.position.set(0, 4.5 + t * 1.0, 9 + t * (3.5 / 3) + Math.max(0, cols - 4) * 0.9);
  camera.lookAt(0, 0.6 + t * (1.7 / 3), PLAYER_Z - 8);
}
setCameraForGrid(1, 4); // 시작 화면 동안 기본(4×1) 시점

function showStartScreen(): void {
  new StartScreen(mount as HTMLDivElement, (difficulty) => {
    game = new Game(scene, difficulty, handleMenu, setCameraForGrid);
  });
}
function handleMenu(): void {
  game?.dispose();
  game = null;
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
  game?.update(dt); // 시작 화면 동안엔 game=null
}
function render(): void {
  renderer.render(scene, camera);
}

const loop = new GameLoop(update, render);
loop.start();

console.info(`[RuleAdd] ready — three.js r${THREE.REVISION}`);
