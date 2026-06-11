import * as THREE from 'three';
import { checkCollision } from './CollisionSystem';
import { InputController, isTextInput } from './InputController';
import { createLaneGroup } from './lane';
import { Player } from './Player';
import { Spawner } from './Spawner';
import type { Wall } from './Wall';
import { ScoreSystem } from './ScoreSystem';
import { RuleEngine } from '../rules/RuleEngine';
import { RULES, ensureActiveRuleColors, resetRuleColors } from '../rules/rules';
import { type Difficulty, difficultyConfig } from './difficulty';
import { RulePanel } from '../hud/RulePanel';
import { RoundBanner } from '../hud/RoundBanner';
import { ScoreHud } from '../hud/ScoreHud';
import { ControlsHud } from '../hud/ControlsHud';
import { GameOverScreen } from '../hud/GameOverScreen';
import { ScoreboardPanel } from '../hud/ScoreboardPanel';
import { NameEntryModal } from '../hud/NameEntryModal';
import { submitLocal } from '../leaderboard/localBoard';
import { fetchGlobalTop, isGlobalEnabled, qualifies, submitGlobal } from '../leaderboard/globalBoard';
import type { GlobalEntry } from '../leaderboard/types';
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
/** ruleFloor 가 강제할 수 있는 최대 룰 = 룰1~5. 룰6(4×4 확장)은 라운드6 또는 4×4 모드로만 켜진다. */
const STANDARD_RULES = 5;

export class Game {
  private status: GameStatus = 'playing';
  private readonly scene: THREE.Scene;
  private readonly laneGroup: THREE.Group;
  private readonly onMenu: () => void;
  /** 그리드 줄 수 변경 시 카메라 프레이밍 갱신(main 이 주입). */
  private readonly onGridRows: (rows: number) => void;
  /** 4×4 모드(처음부터 4×4). 4×1 모드는 라운드6 룰6 활성 시 4×4 로 확장. */
  private readonly grid4x4: boolean;
  /** 현재 세로 줄 수 (1=4×1, 4=4×4). */
  private rows: number;
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
  /** 현재 모드 — 리더보드 키(개인 top5 / 전체 top10). */
  private readonly difficulty: Difficulty;
  private readonly scoreboard = new ScoreboardPanel();
  private readonly nameModal = new NameEntryModal();
  private round = 1;
  private setsPassed = 0;
  private transitionTimer = 0; // >0 이면 라운드 전환 텀(게임 정지)

  constructor(
    scene: THREE.Scene,
    difficulty: Difficulty = 'normal',
    onMenu: () => void = () => {},
    onGridRows: (rows: number) => void = () => {},
  ) {
    this.scene = scene;
    this.onMenu = onMenu;
    this.onGridRows = onGridRows;
    this.difficulty = difficulty;
    const cfg = difficultyConfig(difficulty, STANDARD_RULES);
    this.ruleFloor = cfg.ruleFloor;
    this.showRulePanel = cfg.showRulePanel;
    this.maxLives = cfg.lives;
    this.lives = cfg.lives;
    this.grid4x4 = cfg.grid4x4;
    this.rows = cfg.grid4x4 ? 4 : 1; // 4×4 모드는 처음부터 4줄

    this.input = new InputController();

    this.laneGroup = createLaneGroup();
    scene.add(this.laneGroup);

    this.player = new Player(this.rows);
    scene.add(this.player.object);

    this.engine = new RuleEngine(RULES);
    this.spawner = new Spawner(scene, this.engine, cfg.setIntervalSec, this.rows);
    this.panel = new RulePanel(this.showRulePanel);
    this.gameOverScreen = new GameOverScreen(
      () => this.reset(),
      () => this.onMenu(),
    );
    this.gameOverScreen.mountSide(this.scoreboard.element);

    this.applyRound(); // 시작 라운드(난이도 ruleFloor)의 룰 활성 + 색 배정 + 패널 + 그리드
    this.onGridRows(this.rows); // 시작 카메라 프레이밍(4×4 모드면 4줄 시점)
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

    const mv = this.input.consumeMove();
    if (mv.dx !== 0 || mv.dy !== 0) this.player.tryMove(mv.dx, mv.dy);
    this.player.update(dt);

    const speedMul = this.input.fastForward ? FAST_FORWARD_MULT : 1;
    const passed = this.spawner.update(dt, speedMul);
    if (passed > 0) this.addPassedSets(passed);
    if (this.transitionTimer > 0) return; // 막 텀 시작 → 이번 프레임 충돌 스킵

    const hitWall = checkCollision(this.player, this.spawner.activeWalls, this.engine);
    this.player.setHit(hitWall !== null); // 겹치는 동안 빨강 피드백
    if (hitWall && !hitWall.lifeTaken) {
      hitWall.lifeTaken = true; // 이 세트는 1회만 차감
      this.loseLife(hitWall);
    }
  }

  /** 충돌 1회 → 목숨 -1, 0 이면 게임오버(죽인 세트 전달). */
  private loseLife(wall: Wall): void {
    this.lives -= 1;
    this.scoreHud.setLives(this.lives, this.maxLives);
    if (this.lives <= 0) this.gameOver(wall);
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
    this.refreshGridRows();
  }

  /** 룰6(4×4 확장) 활성 또는 4×4 모드면 4줄, 아니면 1줄로 그리드 전환(+카메라). */
  private refreshGridRows(): void {
    const want = this.grid4x4 || this.engine.isActive(6) ? 4 : 1;
    if (want === this.rows) return;
    this.rows = want;
    this.player.setRows(want);
    this.spawner.setRows(want);
    this.onGridRows(want);
  }

  private gameOver(wall: Wall): void {
    this.status = 'gameover';
    const finalScore = this.score.value;
    this.gameOverScreen.show(finalScore, this.round, {
      before: wall.before ?? wall.snapshot(),
      after: wall.after ?? wall.before ?? wall.snapshot(),
      playerCell: this.player.cell,
    });
    this.presentScoreboards(finalScore);
  }

  /**
   * 게임오버 기록판 채우기 — 개인 top5(로컬·동기) 즉시 + 전체 top10(글로벌·비동기).
   * 글로벌 진입 자격이면 이름·코멘트 모달을 띄우고 제출 후 보드를 새로고침한다.
   */
  private presentScoreboards(finalScore: number): void {
    const mode = this.difficulty;
    this.scoreboard.setMode(mode);

    // 개인 top5 — localStorage 즉시 갱신. 이번 기록(at)을 강조.
    const at = Date.now();
    const localTop = submitLocal(mode, finalScore, at);
    this.scoreboard.showLocal(localTop, finalScore > 0 ? at : -1);

    // 전체 top10 — config 없으면 오프라인.
    if (!isGlobalEnabled) {
      this.scoreboard.setGlobalOffline();
      return;
    }
    this.scoreboard.setGlobalLoading();
    void this.loadGlobal(mode, finalScore);
  }

  /** 글로벌 top10 조회 → 진입 자격이면 이름 모달, 아니면 보드만 표시. */
  private async loadGlobal(mode: Difficulty, finalScore: number): Promise<void> {
    let board: GlobalEntry[];
    try {
      board = await fetchGlobalTop(mode);
    } catch {
      this.scoreboard.setGlobalError();
      return;
    }
    if (this.status !== 'gameover') return; // 그새 재시작/메뉴 → 중단.

    this.scoreboard.showGlobal(board);
    if (!qualifies(finalScore, board)) return;

    const rank = board.filter((e) => e.score >= finalScore).length + 1;
    this.nameModal.show(
      rank,
      (name, comment) => void this.submitGlobalAndRefresh(mode, finalScore, name, comment),
      () => {}, // 건너뛰기 — 현재 보드 유지.
    );
  }

  /** 글로벌 제출 후 보드 재조회 + 새 기록 강조. */
  private async submitGlobalAndRefresh(
    mode: Difficulty,
    finalScore: number,
    name: string,
    comment: string,
  ): Promise<void> {
    try {
      await submitGlobal(mode, finalScore, name, comment);
      const board = await fetchGlobalTop(mode);
      if (this.status !== 'gameover') return;
      const idx = board.findIndex((e) => e.name === name && e.score === finalScore);
      this.scoreboard.showGlobal(board, idx);
    } catch {
      this.scoreboard.setGlobalError();
    }
  }

  reset(): void {
    resetRuleColors(); // 색 초기화 → 라운드 진행으로 다시 배정
    this.score.reset();
    this.lives = this.maxLives;
    this.round = 1;
    this.setsPassed = 0;
    this.transitionTimer = 0;
    this.banner.hide();
    this.nameModal.hide();
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
    this.nameModal.dispose();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTextInput(e.target)) return; // 이름/코멘트 입력 중엔 R/M 단축키 무시.
    // R 은 언제든 재시작.
    if (e.key === 'r' || e.key === 'R') {
      this.reset();
    } else if (e.key === 'm' || e.key === 'M') {
      // M 은 언제든 메인 메뉴 복귀(R 재시작처럼 확인 없음).
      this.onMenu();
    }
  };
}
