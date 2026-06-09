/**
 * GameLoop — requestAnimationFrame 기반 delta-time 루프.
 *
 * update(dt) / render() 를 분리해, 이후 시스템(Spawner·CollisionSystem·
 * ScoreSystem 등)이 update 안에 끼어들 수 있는 단일 진입점을 제공한다.
 * dt 는 초 단위. 탭 비활성화 후 복귀 시 거대한 dt 점프를 막기 위해 clamp 한다.
 */
export type UpdateFn = (dtSeconds: number) => void;
export type RenderFn = () => void;

/** 한 프레임 dt 상한 (초). 탭 복귀 등으로 인한 물리 폭주 방지. */
const MAX_DT = 0.1;

export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private running = false;

  constructor(
    private readonly update: UpdateFn,
    private readonly render: RenderFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning(): boolean {
    return this.running;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;

    // 첫 프레임은 dt=0 로 시작 (lastTime 미설정 시).
    const dt = this.lastTime === 0 ? 0 : Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.tick);
  };
}
