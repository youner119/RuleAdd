/**
 * ControlsHud — 좌상단(점수 밑) 사용법 안내(테두리 없는 검은 텍스트).
 * 이동 조작(wasd/ik)은 제외하고, 메타 조작만 표시한다.
 */
const LINES: readonly string[] = ['R: 재시작', 'M: 메인 메뉴', '스페이스: 빨리감기'];

export class ControlsHud {
  private readonly root: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'left:16px',
      'top:108px', // 점수 HUD(좌상단) 아래
      'display:flex',
      'flex-direction:column',
      'align-items:flex-start',
      'gap:4px',
      'font:600 13px/1.4 system-ui,sans-serif',
      'color:#222',
      'user-select:none',
      'pointer-events:none',
      'z-index:5',
    ].join(';');

    for (const line of LINES) {
      const el = document.createElement('div');
      el.textContent = line;
      this.root.appendChild(el);
    }

    document.body.appendChild(this.root);
  }

  dispose(): void {
    this.root.remove();
  }
}
