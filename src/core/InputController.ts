/**
 * InputController — 키보드 입력을 좌우 이동 방향(-1/0/+1)으로 변환.
 *
 * a/← = 좌, d/→ = 우. 누르고 있는 동안 유지(자유 연속 이동).
 * Space = 스킵(누르는 동안 벽 진행 빨리감기).
 * Player 와 분리해, 이후 룰(예: 조작 반전)이 이 방향을 가공할 수 있게 한다.
 */
export class InputController {
  private left = false;
  private right = false;
  private fast = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** -1(좌) / 0 / +1(우). 양쪽 동시에 누르면 0. */
  get direction(): number {
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }

  /** 스킵 키(Space)를 누르고 있는지 — 벽 진행 빨리감기. */
  get fastForward(): boolean {
    return this.fast;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private isLeftKey(key: string): boolean {
    return key === 'a' || key === 'A' || key === 'ArrowLeft';
  }

  private isRightKey(key: string): boolean {
    return key === 'd' || key === 'D' || key === 'ArrowRight';
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.isLeftKey(e.key)) this.left = true;
    else if (this.isRightKey(e.key)) this.right = true;
    else if (e.code === 'Space') {
      this.fast = true;
      e.preventDefault(); // 페이지 스크롤 방지
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.isLeftKey(e.key)) this.left = false;
    else if (this.isRightKey(e.key)) this.right = false;
    else if (e.code === 'Space') this.fast = false;
  };
}
