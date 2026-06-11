/**
 * InputController — 키보드 입력을 이동 이벤트/상태로 변환.
 *
 * a/← = 좌, d/→ = 우, w/↑ = 위(행+), s/↓ = 아래(행-). 키를 처음 누르는 순간
 * 단발 이벤트 1회 발생(홀드 반복 없음). consumeMove() 로 소비하면 다음 press
 * 전까지 0 반환. 세로(위/아래)는 4×4(rows>1) 에서만 의미가 있다.
 * Space = 스킵(누르는 동안 벽 진행 빨리감기).
 */
export class InputController {
  private left = false;
  private right = false;
  private up = false;
  private down = false;
  private fast = false;
  private pendingX = 0; // 열 이동 -1/0/+1
  private pendingY = 0; // 행 이동 -1/0/+1 (위=+1)

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /**
   * 이번 프레임의 이동(dx=열, dy=행)을 반환하고 소비(리셋).
   * 키 최초 press 시 1회만 비-0 값을 반환한다.
   */
  consumeMove(): { dx: number; dy: number } {
    const m = { dx: this.pendingX, dy: this.pendingY };
    this.pendingX = 0;
    this.pendingY = 0;
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

  private isUpKey(key: string): boolean {
    return key === 'w' || key === 'W' || key === 'ArrowUp';
  }

  private isDownKey(key: string): boolean {
    return key === 's' || key === 'S' || key === 'ArrowDown';
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTextInput(e.target)) return; // 이름/코멘트 입력 중엔 게임 키 무시(Space·화살표 preventDefault 방지)
    if (this.isLeftKey(e.key) && !this.left) {
      this.left = true;
      this.pendingX = -1;
    } else if (this.isRightKey(e.key) && !this.right) {
      this.right = true;
      this.pendingX = 1;
    } else if (this.isUpKey(e.key) && !this.up) {
      this.up = true;
      this.pendingY = 1;
      e.preventDefault(); // ↑ 페이지 스크롤 방지
    } else if (this.isDownKey(e.key) && !this.down) {
      this.down = true;
      this.pendingY = -1;
      e.preventDefault(); // ↓ 페이지 스크롤 방지
    } else if (e.code === 'Space') {
      this.fast = true;
      e.preventDefault(); // 페이지 스크롤 방지
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (isTextInput(e.target)) return;
    if (this.isLeftKey(e.key)) this.left = false;
    else if (this.isRightKey(e.key)) this.right = false;
    else if (this.isUpKey(e.key)) this.up = false;
    else if (this.isDownKey(e.key)) this.down = false;
    else if (e.code === 'Space') this.fast = false;
  };
}

/** 이벤트 타깃이 텍스트 입력 필드(input/textarea)인지 — 게임 키 가드용. */
export function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
