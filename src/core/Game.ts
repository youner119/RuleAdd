import * as THREE from 'three';
import { checkCollision } from './CollisionSystem';
import { InputController } from './InputController';
import { createLaneGroup } from './lane';
import { Player } from './Player';
import { Spawner } from './Spawner';
import { ScoreSystem } from './ScoreSystem';
import { RuleEngine } from '../rules/RuleEngine';
import { RULES, ensureActiveRuleColors, resetRuleColors } from '../rules/rules';
import { type Difficulty, difficultyConfig } from './difficulty';

/**
 * Game — 게임플레이 상태머신 + 시스템 오케스트레이션 + 진행(라운드/세트).
 *
 * 세트(벽)를 SETS_PER_ROUND 개 통과할 때마다 라운드 +1, 라운드마다 룰이
 * 1→5 순서로 하나씩 누적 활성화된다(activateUpTo). 새로 활성화되는 색 룰은
 * 그 시점에 풀에서 색을 배정받는다.
 */
export type GameStatus = 'playing' | 'gameover';

/** 라운드당 세트 수(N). 하드코딩 5 금지 — 이 상수로 조정. */
const SETS_PER_ROUND = 10;
/** 테스트용: 충돌 시 게임오버 대신 구를 빨갛게만 표시(계속 진행). 정상=false. */
const DEBUG_COLLISION_MARK = true;

export class Game {
  private status: GameStatus = 'playing';
  private readonly input: InputController;
  private readonly player: Player;
  private readonly spawner: Spawner;
  private readonly engine: RuleEngine;
  private readonly score = new ScoreSystem();
  private readonly ruleFloor: number;
  /** 우측 룰 패널 표시 여부(블라인드=false). T15 가 읽음. */
  readonly showRulePanel: boolean;
  private round = 1;
  private setsPassed = 0;

  constructor(scene: THREE.Scene, difficulty: Difficulty = 'normal') {
    const cfg = difficultyConfig(difficulty, RULES.length);
    this.ruleFloor = cfg.ruleFloor;
    this.showRulePanel = cfg.showRulePanel;

    this.input = new InputController();

    scene.add(createLaneGroup());

    this.player = new Player();
    scene.add(this.player.object);

    this.engine = new RuleEngine(RULES);
    this.spawner = new Spawner(scene, this.engine);

    this.applyRound(); // 시작 라운드(난이도 ruleFloor)의 룰 활성 + 색 배정

    window.addEventListener('keydown', this.onKeyDown);
  }

  update(dt: number): void {
    if (this.status !== 'playing') return;

    this.player.update(dt, this.input.direction);

    const passed = this.spawner.update(dt);
    if (passed > 0) this.addPassedSets(passed);

    const hit = checkCollision(this.player, this.spawner.activeWalls, this.engine);
    if (DEBUG_COLLISION_MARK) {
      this.player.setHit(hit); // 게임오버 대신 빨강 표시(계속 진행)
    } else if (hit) {
      this.gameOver();
    }
  }

  /** 세트 통과 누적 → 점수 가산 + 라운드 진행. */
  private addPassedSets(n: number): void {
    for (let i = 0; i < n; i++) this.score.addSet(this.round); // 통과 시점 라운드로 가산
    this.setsPassed += n;
    const target = 1 + Math.floor(this.setsPassed / SETS_PER_ROUND);
    if (target > this.round) {
      this.round = target;
      this.applyRound();
      console.info(
        `[RuleAdd] Round ${this.round} — 룰 ${Math.min(this.round, RULES.length)} 활성 · 점수 ${this.score.value}`,
      );
    }
  }

  /** 현재 점수(HUD T16 용). */
  get scoreValue(): number {
    return this.score.value;
  }

  /** 활성 룰 수 = min(maxRules, max(round, ruleFloor)) — 어려움은 처음부터 전부. */
  private applyRound(): void {
    this.engine.activateUpTo(Math.max(this.round, this.ruleFloor));
    ensureActiveRuleColors(this.engine.activeRules);
  }

  private gameOver(): void {
    this.status = 'gameover';
    // 화면 오버레이는 T16. 여기선 최종 점수 로그.
    console.info(`[RuleAdd] GAME OVER — 최종 점수 ${this.score.value} — press R to restart`);
  }

  reset(): void {
    resetRuleColors(); // 색 초기화 → 라운드 진행으로 다시 배정
    this.score.reset();
    this.round = 1;
    this.setsPassed = 0;
    this.applyRound();
    this.spawner.reset();
    this.player.reset();
    this.status = 'playing';
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // R 은 언제든 재시작.
    if (e.key === 'r' || e.key === 'R') {
      this.reset();
    }
  };
}
