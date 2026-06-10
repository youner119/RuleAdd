import * as THREE from 'three';
import { LANE_Y, cellToX } from '../core/lane';
import { PLAYER_RADIUS } from '../core/Player';
import { Wall, type CellSnapshot } from '../core/Wall';

/** 게임오버 시 "왜 죽었나" 표시용 — 죽인 세트의 쉬프트 전/후 + 내 칸. */
export interface DeathInfo {
  before: CellSnapshot[];
  after: CellSnapshot[];
  playerCell: number;
}

/** 미니 3D 리플레이 한 컷 크기(px). */
const REPLAY_W = 200;
const REPLAY_H = 150;

/**
 * GameOverScreen — 게임오버 모달(AC4, AC12). 화면 전체를 덮는 backdrop +
 * 중앙 창(window)으로 감싼다. 최종 점수·라운드 + [다시하기] [메뉴] 버튼.
 * 죽인 세트의 before→after 미니 격자로 "왜 죽었나"를 보여준다.
 * R 키 재시작은 Game 이 처리.
 */
export class GameOverScreen {
  private readonly root: HTMLDivElement;
  private readonly scoreEl: HTMLDivElement;
  private readonly roundEl: HTMLDivElement;
  private readonly deathView: HTMLDivElement;
  // 미니 3D 리플레이 렌더(lazy 생성, dispose 시 정리) — 죽인 세트를 실제 메시로 그린다.
  private renderer?: THREE.WebGLRenderer;
  private replayScene?: THREE.Scene;
  private replayCamera?: THREE.PerspectiveCamera;
  private replaySphere?: THREE.Mesh;

  constructor(onRestart: () => void, onMenu: () => void) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(255,255,255,0.7)',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'z-index:20',
    ].join(';');

    const win = document.createElement('div');
    win.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:14px',
      'padding:36px 48px',
      'border:2px solid #222',
      'border-radius:16px',
      'background:#fff',
      'box-shadow:0 8px 40px rgba(0,0,0,0.12)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'GAME OVER';
    title.style.cssText = 'font:800 40px/1 system-ui,sans-serif;letter-spacing:2px;';

    this.scoreEl = document.createElement('div');
    this.scoreEl.style.cssText = 'font:800 32px/1 system-ui,sans-serif;';
    const scoreLabel = document.createElement('div');
    scoreLabel.textContent = '최종 점수';
    scoreLabel.style.cssText = 'font:600 13px/1 system-ui,sans-serif;color:#888;margin-bottom:-8px;';

    this.roundEl = document.createElement('div');
    this.roundEl.style.cssText = 'font:600 15px/1 system-ui,sans-serif;color:#888;';

    this.deathView = document.createElement('div');
    this.deathView.style.cssText =
      'display:none;flex-direction:column;align-items:center;gap:8px;margin-top:4px;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
    buttons.append(
      this.makeButton('다시하기', onRestart),
      this.makeButton('메뉴', onMenu),
    );

    const hint = document.createElement('div');
    hint.textContent = 'R 키로 다시하기';
    hint.style.cssText = 'font:400 12px/1 system-ui,sans-serif;color:#aaa;';

    win.append(title, scoreLabel, this.scoreEl, this.roundEl, this.deathView, buttons, hint);
    this.root.appendChild(win);
    document.body.appendChild(this.root);
    this.hide();
  }

  private makeButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = [
      'padding:10px 22px',
      'border:2px solid #222',
      'border-radius:8px',
      'background:#fff',
      'font:700 16px/1 system-ui,sans-serif',
      'color:#222',
      'cursor:pointer',
      'transition:background 0.12s',
    ].join(';');
    btn.addEventListener('mouseenter', () => (btn.style.background = '#f0f0f0'));
    btn.addEventListener('mouseleave', () => (btn.style.background = '#fff'));
    btn.addEventListener('click', onClick);
    return btn;
  }

  show(score: number, round: number, death?: DeathInfo): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.roundEl.textContent = `ROUND ${round}`;
    if (death) this.renderDeath(death);
    else this.deathView.style.display = 'none';
    this.root.style.display = 'flex';
  }

  /** "왜 죽었나" — 죽인 세트의 before→after 를 실제 3D 메시로 그려 보여준다. */
  private renderDeath(d: DeathInfo): void {
    this.deathView.replaceChildren();

    const heading = document.createElement('div');
    heading.textContent = '왜 죽었나?';
    heading.style.cssText = 'font:700 13px/1 system-ui,sans-serif;color:#888;letter-spacing:1px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';

    const arrow = document.createElement('div');
    arrow.textContent = '→';
    arrow.style.cssText = 'align-self:center;font:700 22px/1 system-ui,sans-serif;color:#888;';

    const died = d.after[d.playerCell]?.blocked ?? false;
    row.append(
      this.makeReplay('BEFORE', d.before, d.playerCell, false, false),
      arrow,
      this.makeReplay('AFTER', d.after, d.playerCell, died, true),
    );

    this.deathView.append(heading, row);
    this.deathView.style.display = 'flex';
  }

  /** 한 시점(전/후)의 3D 그림 — 라벨 + 실제 메시 렌더 이미지 (+막힘 표시). */
  private makeReplay(
    label: string,
    cells: CellSnapshot[],
    playerCell: number,
    danger: boolean,
    showPlayer: boolean,
  ): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;';

    const cap = document.createElement('div');
    cap.textContent = label;
    cap.style.cssText = 'font:700 10px/1 system-ui,sans-serif;color:#aaa;letter-spacing:1px;';

    const img = document.createElement('img');
    img.width = REPLAY_W;
    img.height = REPLAY_H;
    img.src = this.renderState(cells, playerCell, danger, showPlayer);
    img.style.cssText = `width:${REPLAY_W}px;height:${REPLAY_H}px;border:1.5px solid #eee;border-radius:8px;`;

    wrap.append(cap, img);

    if (danger) {
      const tag = document.createElement('div');
      tag.textContent = '여기서 막힘!';
      tag.style.cssText = 'font:700 11px/1 system-ui,sans-serif;color:#e23b3b;';
      wrap.appendChild(tag);
    }
    return wrap;
  }

  /** 스냅샷을 실제 Wall 메시로 그려 dataURL 로 반환(정면 약간 위 시점). */
  private renderState(
    cells: CellSnapshot[],
    playerCell: number,
    danger: boolean,
    showPlayer: boolean,
  ): string {
    const { renderer, scene, camera, sphere } = this.ensureRenderer();

    const wall = this.buildWall(cells);
    scene.add(wall.object);

    if (showPlayer) {
      sphere.position.x = cellToX(playerCell);
      (sphere.material as THREE.MeshStandardMaterial).color.set(danger ? 0xe23b3b : 0x3b6fe2);
      scene.add(sphere);
    }

    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL();

    scene.remove(wall.object, sphere); // 다음 컷을 위해 비움(메시는 공유 리소스라 dispose 불필요)
    return url;
  }

  /** 스냅샷으로 실제 Wall 메시 재구성 — 게임과 동일한 색/화살표/확장 마커. */
  private buildWall(cells: CellSnapshot[]): Wall {
    const wall = new Wall(cells.map((c) => c.blocked));
    for (const block of wall.blocks) {
      const c = cells[block.cell];
      if (!c) continue;
      if (c.color) wall.setColor(block, c.color);
      if (c.expandDirs.length > 0) wall.showExpansion(block, c.expandDirs);
      else if (c.arrowDir !== 0) wall.showArrow(block, c.arrowDir);
    }
    return wall;
  }

  /** 모달 전용 미니 렌더러/씬/카메라/구를 lazy 생성. */
  private ensureRenderer(): {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sphere: THREE.Mesh;
  } {
    if (!this.renderer) {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true, // toDataURL 안정 캡처
      });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(REPLAY_W, REPLAY_H);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xdfdfdf, 1.3));
      const dir = new THREE.DirectionalLight(0xffffff, 1.5);
      dir.position.set(3, 6, 5);
      scene.add(dir);
      this.replayScene = scene;

      const camera = new THREE.PerspectiveCamera(38, REPLAY_W / REPLAY_H, 0.1, 100);
      camera.position.set(0, 2.0, 5.6); // 정면 약간 위
      camera.lookAt(0, 0.9, 0);
      this.replayCamera = camera;

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(PLAYER_RADIUS, 32, 24),
        new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      );
      sphere.position.set(0, LANE_Y + PLAYER_RADIUS, 1.2); // 벽 앞(플레이어 쪽)
      this.replaySphere = sphere;
    }
    return {
      renderer: this.renderer,
      scene: this.replayScene as THREE.Scene,
      camera: this.replayCamera as THREE.PerspectiveCamera,
      sphere: this.replaySphere as THREE.Mesh,
    };
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
    this.replaySphere?.geometry.dispose();
    (this.replaySphere?.material as THREE.Material | undefined)?.dispose();
    this.renderer?.dispose();
  }
}
