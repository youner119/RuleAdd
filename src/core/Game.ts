import * as THREE from 'three';
import { checkCollision } from './CollisionSystem';
import { InputController, isTextInput } from './InputController';
import { COLS, cellIndex, colOf, createLaneGroup, rowOf } from './lane';
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

export class Game {
  private status: GameStatus = 'playing';
  private readonly scene: THREE.Scene;
  /** 레인(바닥·경계) — 확장 룰로 cols 가 바뀌면 재구성된다. */
  private laneGroup: THREE.Group;
  private readonly onMenu: () => void;
  /** 그리드 크기(rows·cols) 변경 시 카메라 프레이밍 갱신(main 이 주입). */
  private readonly onGridChange: (rows: number, cols: number) => void;
  /** 2차원 모드(처음부터 4×4). 1차원 모드는 끝까지 한 줄 — 런 중 차원 전환 없음. */
  private readonly grid4x4: boolean;
  /** 현재 세로 줄 수 (1=4×1, 4=4×4). */
  private rows: number;
  /** 현재 가로 칸 수 (확장 룰로 4→5…, Phase 1 에선 항상 COLS). */
  private cols: number = COLS;
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
    onGridChange: (rows: number, cols: number) => void = () => {},
  ) {
    this.scene = scene;
    this.onMenu = onMenu;
    this.onGridChange = onGridChange;
    this.difficulty = difficulty;
    const cfg = difficultyConfig(difficulty, RULES.length);
    this.ruleFloor = cfg.ruleFloor;
    // "그 라운드까지 간 느낌" — 시작 라운드 = ruleFloor. 어려움은 모든 룰(확장 포함)
    // 라운드부터 시작하고 표시·점수(base×round²)도 그 기준. 나머지 모드는 1 → 기존대로.
    this.round = cfg.ruleFloor;
    this.showRulePanel = cfg.showRulePanel;
    this.maxLives = cfg.lives;
    this.lives = cfg.lives;
    this.grid4x4 = cfg.grid4x4;
    this.rows = cfg.grid4x4 ? 4 : 1; // 4×4 모드는 처음부터 4줄

    this.input = new InputController();

    this.laneGroup = createLaneGroup(this.cols);
    scene.add(this.laneGroup);

    this.player = new Player(this.rows, this.cols);
    scene.add(this.player.object);

    this.engine = new RuleEngine(RULES);
    this.spawner = new Spawner(scene, this.engine, cfg.setIntervalSec, this.rows, this.cols);
    this.panel = new RulePanel(this.showRulePanel);
    this.gameOverScreen = new GameOverScreen(
      () => this.reset(),
      () => this.onMenu(),
    );
    this.gameOverScreen.mountSide(this.scoreboard.element);

    this.applyRound(); // 시작 라운드(난이도 ruleFloor)의 룰 활성 + 색 배정 + 패널 + 그리드
    this.onGridChange(this.rows, this.cols); // 시작 카메라 프레이밍(그리드 크기 기준)
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
    // 시작 라운드(ruleFloor) 기준 진행 — 어려움은 7부터, 나머지는 1부터(기존과 동일).
    const target = this.ruleFloor + Math.floor(this.setsPassed / SETS_PER_ROUND);
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

  /** 활성 룰 수 = max(round, ruleFloor) — 어려움은 처음부터 전부(확장 포함). */
  private applyRound(): void {
    this.engine.activateUpTo(Math.max(this.round, this.ruleFloor));
    ensureActiveRuleColors(this.engine.activeRules);
    this.panel.render(this.engine.activeRules);
    this.refreshGridSize();
  }

  /**
   * 활성 룰 → 그리드 크기 전환(+레인·카메라).
   *  - 한 변(side) = 4 + 확장 룰(룰6) 활성 시 +1. (v2: 룰 추가로 최대 10까지 같은 패턴.)
   *  - 세로(rows) = 2차원 모드(grid4x4)면 side, 아니면 1줄 — 런 중 1↔2차원 전환 없음.
   *  - 가로(cols)가 바뀌면 레인(바닥 폭·경계선)도 재구성한다.
   * 이미 날아오던 세트는 자기 스폰 시점 그리드(wall.cols/rows)로 계속 동작.
   */
  private refreshGridSize(): void {
    const side = COLS + (this.engine.isActive(6) ? 1 : 0);
    const rows = this.grid4x4 ? side : 1;
    if (rows === this.rows && side === this.cols) return;
    const colsChanged = side !== this.cols;
    this.rows = rows;
    this.cols = side;
    this.player.setRows(rows);
    this.player.setCols(side);
    this.spawner.setRows(rows);
    this.spawner.setCols(side);
    if (colsChanged) {
      this.scene.remove(this.laneGroup);
      this.laneGroup = createLaneGroup(side);
      this.scene.add(this.laneGroup);
      // 날아오던 세트는 비우지 않고 새 그리드로 재배치(보존) — 옛 칸을 왼쪽 정렬로
      // 재인코딩해 벽·플레이어가 함께 반 칸 이동 → 상대 위치(공정성) 유지,
      // 새 열/행은 빈 칸으로 추가된다.
      this.spawner.regridWalls(rows, side);
    }
    this.onGridChange(rows, side);
  }

  private gameOver(wall: Wall): void {
    this.status = 'gameover';
    const finalScore = this.score.value;
    // 리플레이는 죽인 세트의 스폰 시점 그리드(wall.cols/rows) 기준 — 확장 직후
    // 옛 세트에 죽으면 플레이어 칸(현재 그리드 인덱스)을 그 그리드로 변환(clamp).
    const pCol = Math.min(colOf(this.player.cell, this.cols), wall.cols - 1);
    const pRow = Math.min(rowOf(this.player.cell, this.cols), wall.rows - 1);
    this.gameOverScreen.show(finalScore, this.round, {
      before: wall.before ?? wall.snapshot(),
      after: wall.after ?? wall.before ?? wall.snapshot(),
      playerCell: cellIndex(pCol, pRow, wall.cols),
      cols: wall.cols,
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
    this.round = this.ruleFloor; // 시작 라운드(어려움=모든 룰 라운드)로 복귀
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
