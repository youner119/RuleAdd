/**
 * ScoreSystem — 점수. 세트 통과마다 `BASE × 라운드²` 가산(AC6).
 * 후반 고라운드 보상이 제곱으로 급증 → 룰 누적 도전 장려.
 * 화면 표시는 T16(HUD).
 */
const BASE = 100; // 세트 통과 기본점

export class ScoreSystem {
  private score = 0;

  get value(): number {
    return this.score;
  }

  /** 세트 1개 통과 점수 가산 — BASE × round². */
  addSet(round: number): void {
    this.score += BASE * round * round;
  }

  reset(): void {
    this.score = 0;
  }
}
