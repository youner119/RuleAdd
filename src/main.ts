import * as THREE from 'three';

// T1 스캐폴딩 stub — 툴체인(Vite + TypeScript + three.js) 동작 확인용.
// 실제 씬(흰 배경 + 카메라 + 렌더 루프)은 T2에서 이 stub을 대체한다.

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app mount point not found');
}

console.info(`[RuleAdd] toolchain ready — three.js r${THREE.REVISION}`);

const banner = document.createElement('div');
banner.style.cssText =
  'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
  'font:600 14px/1.5 system-ui,sans-serif;color:#bdbdbd;text-align:center;user-select:none;';
banner.textContent = `RuleAdd — scaffolding OK (three.js r${THREE.REVISION})`;
app.appendChild(banner);
