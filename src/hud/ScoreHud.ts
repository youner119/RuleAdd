/**
 * ScoreHud — 좌상단 실시간 점수/라운드 표시(AC4). 룰 패널(우상단)과 대칭.
 */
export class ScoreHud {
  private readonly root: HTMLDivElement;
  private readonly scoreEl: HTMLDivElement;
  private readonly roundEl: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'top:16px',
      'left:16px',
      'min-width:140px',
      'padding:10px 14px',
      'border:2px solid #222',
      'border-radius:10px',
      'background:rgba(255,255,255,0.9)',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'user-select:none',
      'z-index:5',
    ].join(';');

    this.scoreEl = document.createElement('div');
    this.scoreEl.style.cssText = 'font:800 26px/1.1 system-ui,sans-serif;';
    this.roundEl = document.createElement('div');
    this.roundEl.style.cssText = 'font:600 13px/1 system-ui,sans-serif;color:#888;margin-top:4px;';

    this.root.append(this.scoreEl, this.roundEl);
    document.body.appendChild(this.root);
  }

  update(score: number, round: number): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.roundEl.textContent = `ROUND ${round}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
