/**
 * GameOverScreen — 게임오버 모달(AC4, AC12). 화면 전체를 덮는 backdrop +
 * 중앙 창(window)으로 감싼다. 최종 점수·라운드 + [다시하기] [메뉴] 버튼.
 * R 키 재시작은 Game 이 처리.
 */
export class GameOverScreen {
  private readonly root: HTMLDivElement;
  private readonly scoreEl: HTMLDivElement;
  private readonly roundEl: HTMLDivElement;

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

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
    buttons.append(
      this.makeButton('다시하기', onRestart),
      this.makeButton('메뉴', onMenu),
    );

    const hint = document.createElement('div');
    hint.textContent = 'R 키로 다시하기';
    hint.style.cssText = 'font:400 12px/1 system-ui,sans-serif;color:#aaa;';

    win.append(title, scoreLabel, this.scoreEl, this.roundEl, buttons, hint);
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

  show(score: number, round: number): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.roundEl.textContent = `ROUND ${round}`;
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
