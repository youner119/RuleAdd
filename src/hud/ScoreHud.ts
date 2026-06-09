/**
 * ScoreHud — 좌상단 실시간 점수/라운드 + 목숨(하트) 표시(AC4). 룰 패널(우상단)과 대칭.
 * 하트는 박스 안 라운드 줄 밑에: 남은 목숨=빨강 ♥, 잃은 목숨=옅은 ♡(최대치 노출).
 */
export class ScoreHud {
  private readonly root: HTMLDivElement;
  private readonly scoreEl: HTMLDivElement;
  private readonly roundEl: HTMLDivElement;
  private readonly livesFilledEl: HTMLSpanElement;
  private readonly livesEmptyEl: HTMLSpanElement;

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

    const livesEl = document.createElement('div');
    livesEl.style.cssText = 'font-size:18px;line-height:1;margin-top:6px;letter-spacing:2px;';
    this.livesFilledEl = document.createElement('span');
    this.livesFilledEl.style.color = '#e23b3b';
    this.livesEmptyEl = document.createElement('span');
    this.livesEmptyEl.style.color = '#d6d6d6';
    livesEl.append(this.livesFilledEl, this.livesEmptyEl);

    this.root.append(this.scoreEl, this.roundEl, livesEl);
    document.body.appendChild(this.root);
  }

  update(score: number, round: number): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.roundEl.textContent = `ROUND ${round}`;
  }

  /** 목숨 표시 — 남은=♥, 잃은=♡. */
  setLives(remaining: number, max: number): void {
    const filled = Math.max(0, remaining);
    this.livesFilledEl.textContent = '♥'.repeat(filled);
    this.livesEmptyEl.textContent = '♡'.repeat(Math.max(0, max - filled));
  }

  dispose(): void {
    this.root.remove();
  }
}
