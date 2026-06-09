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
import { RulePanel } from '../hud/RulePanel';
import { RoundBanner } from '../hud/RoundBanner';
import { ScoreHud } from '../hud/ScoreHud';
import { ControlsHud } from '../hud/ControlsHud';
import { GameOverScreen } from '../hud/GameOverScreen';
import type { Rule } from '../rules/RuleEngine';

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
/** 라운드 전환 시 멈춤(텀) 길이(초). 중앙에 새 룰 표시. */
const ROUND_TRANSITION_SEC = 1.8;
/** 스킵(Space) 시 벽 진행 속도 배율. 충돌 판정은 유지 — 위험 감수 빨리감기. */
const FAST_FORWARD_MULT = 4;

export class Game {
  private status: GameStatus = 'playing';
  private readonly scene: THREE.Scene;
  private readonly laneGroup: THREE.Group;
  private readonly onMenu: () => void;
  private readonly input: InputController;
  private readonly player: Player;
  private readonly spawner: Spawner;
  private readonly engine: RuleEngine;
  private readonly score = new ScoreSystem();
  private readonly ruleFloor: number;
  private readonly maxLives: number;
  private lives: number;
  /** 우측 룰 패널 표시 여부(블라인드=false). */
  readonly showRulePanel: boolean;
  private readonly panel: RulePanel;
  private readonly banner = new RoundBanner();
  private readonly scoreHud = new ScoreHud();
  private readonly controlsHud = new ControlsHud();
  private readonly gameOverScreen: GameOverScreen;
  private round = 1;
  private setsPassed = 0;
  private transitionTimer = 0; // >0 이면 라운드 전환 텀(게임 정지)

  constructor(scene: THREE.Scene, difficulty: Difficulty = 'normal', onMenu: () => void = () => {}) {
    this.scene = scene;
    this.onMenu = onMenu;
    const cfg = difficultyConfig(difficulty, RULES.length);
    this.ruleFloor = cfg.ruleFloor;
    this.showRulePanel = cfg.showRulePanel;
    this.maxLives = cfg.lives;
    this.lives = cfg.lives;

    this.input = new InputController();

    this.laneGroup = createLaneGroup();
    scene.add(this.laneGroup);

    this.player = new Player();
    scene.add(this.player.object);

    this.engine = new RuleEngine(RULES);
    this.spawner = new Spawner(scene, this.engine, cfg.setIntervalSec);
    this.panel = new RulePanel(this.showRulePanel);
    this.gameOverScreen = new GameOverScreen(
      () => this.reset(),
      () => this.onMenu(),
    );

    this.applyRound(); // 시작 라운드(난이도 ruleFloor)의 룰 활성 + 색 배정 + 패널
    this.scoreHud.update(this.score.value, this.round);
    this.scoreHud.setLives(this.lives, this.maxLives);

    window.addEventListener('keydown', this.onKeyDown);
  }

  update(dt: number): void {
    if (this.status !== 'playing') return;

    // 라운드 전환 텀 — 게임 정지, 중앙 배너 표시.
    if (this.transitionTimer > 0) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.transitionTimer = 0;
        this.banner.hide();
      }
      return;
    }

    this.player.update(dt, this.input.direction);

    const speedMul = this.input.fastForward ? FAST_FORWARD_MULT : 1;
    const passed = this.spawner.update(dt, speedMul);
    if (passed > 0) this.addPassedSets(passed);
    if (this.transitionTimer > 0) return; // 막 텀 시작 → 이번 프레임 충돌 스킵

    const hitWall = checkCollision(this.player, this.spawner.activeWalls, this.engine);
    this.player.setHit(hitWall !== null); // 겹치는 동안 빨강 피드백
    if (hitWall && !hitWall.lifeTaken) {
      hitWall.lifeTaken = true; // 이 세트는 1회만 차감
      this.loseLife();
    }
  }

  /** 충돌 1회 → 목숨 -1, 0 이면 게임오버. */
  private loseLife(): void {
    this.lives -= 1;
    this.scoreHud.setLives(this.lives, this.maxLives);
    if (this.lives <= 0) this.gameOver();
  }

  /** 세트 통과 누적 → 점수 가산 + 라운드 진행. */
  private addPassedSets(n: number): void {
    for (let i = 0; i < n; i++) this.score.addSet(this.round); // 통과 시점 라운드로 가산
    this.setsPassed += n;
    const target = 1 + Math.floor(this.setsPassed / SETS_PER_ROUND);
    if (target > this.round) {
      const prevActive = this.engine.activeRules.length;
      this.round = target;
      this.applyRound();
      const added = this.engine.activeRules.slice(prevActive);
      this.beginRoundTransition(added);
    }
    this.scoreHud.update(this.score.value, this.round);
  }

  /**
   * 라운드 전환 — 텀 시작 + 중앙 배너(새 룰).
   * 블라인드 모드는 우측 룰 패널만 끄고, 이 전환 배너에서는 룰을 공개한다.
   */
  private beginRoundTransition(added: readonly Rule[]): void {
    this.transitionTimer = ROUND_TRANSITION_SEC;
    const newRule = added.length > 0 ? (added[added.length - 1] as Rule) : null;
    this.banner.show(this.round, newRule);
  }

  /** 현재 점수(HUD T16 용). */
  get scoreValue(): number {
    return this.score.value;
  }

  /** 활성 룰 수 = min(maxRules, max(round, ruleFloor)) — 어려움은 처음부터 전부. */
  private applyRound(): void {
    this.engine.activateUpTo(Math.max(this.round, this.ruleFloor));
    ensureActiveRuleColors(this.engine.activeRules);
    this.panel.render(this.engine.activeRules);
  }

  private gameOver(): void {
    this.status = 'gameover';
    this.gameOverScreen.show(this.score.value, this.round);
  }

  reset(): void {
    resetRuleColors(); // 색 초기화 → 라운드 진행으로 다시 배정
    this.score.reset();
    this.lives = this.maxLives;
    this.round = 1;
    this.setsPassed = 0;
    this.transitionTimer = 0;
    this.banner.hide();
    this.gameOverScreen.hide();
    this.applyRound();
    this.spawner.reset();
    this.player.reset();
    this.scoreHud.update(this.score.value, this.round);
    this.scoreHud.setLives(this.lives, this.maxLives);
    this.status = 'playing';
  }

  /** 메뉴 복귀 시 정리 — HUD/리스너/씬 오브젝트 제거. */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.input.dispose();
    this.spawner.reset(); // 벽 제거
    this.scene.remove(this.laneGroup, this.player.object);
    this.panel.dispose();
    this.banner.dispose();
    this.scoreHud.dispose();
    this.controlsHud.dispose();
    this.gameOverScreen.dispose();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // R 은 언제든 재시작.
    if (e.key === 'r' || e.key === 'R') {
      this.reset();
    } else if (e.key === 'm' || e.key === 'M') {
      // M 은 언제든 메인 메뉴 복귀(R 재시작처럼 확인 없음).
      this.onMenu();
    }
  };
}
