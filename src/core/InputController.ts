/**
 * InputController — 키보드 입력을 이동 이벤트/상태로 변환.
 *
 * a/← = 좌, d/→ = 우. 키를 처음 누르는 순간 단발 이벤트 1회 발생(홀드 반복 없음).
 * consumeMove() 로 소비하면 다음 press 전까지 0 반환.
 * Space = 스킵(누르는 동안 벽 진행 빨리감기).
 */
export class InputController {
  private left = false;
  private right = false;
  private fast = false;
  private pendingMove = 0;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /**
   * 이번 프레임의 이동 방향(-1/0/+1)을 반환하고 소비(리셋).
   * 키 최초 press 시 1회만 비-0 값을 반환한다.
   */
  consumeMove(): number {
    const m = this.pendingMove;
    this.pendingMove = 0;
    return m;
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
    if (this.isLeftKey(e.key) && !this.left) {
      this.left = true;
      this.pendingMove = -1;
    } else if (this.isRightKey(e.key) && !this.right) {
      this.right = true;
      this.pendingMove = 1;
    } else if (e.code === 'Space') {
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
