import * as THREE from 'three';
import { checkCollision } from './CollisionSystem';
import { InputController } from './InputController';
import { createLaneGroup } from './lane';
import { Player } from './Player';
import { Spawner } from './Spawner';
import { RuleEngine } from '../rules/RuleEngine';
import { RULES, randomizeRuleColors } from '../rules/rules';

/**
 * Game — 게임플레이 상태머신 + 시스템 오케스트레이션.
 *
 * main.ts 는 렌더 인프라(renderer/camera/scene/loop)만, 게임 내용물
 * (레인·구·벽·충돌·상태)은 Game 이 소유한다. 이후 T12(라운드/세트)·
 * T13(점수)·T14(난이도)·T16(UI)이 이 위에 쌓인다.
 */
export type GameStatus = 'playing' | 'gameover';

export class Game {
  private status: GameStatus = 'playing';
  private readonly input: InputController;
  private readonly player: Player;
  private readonly spawner: Spawner;
  private readonly engine: RuleEngine;

  constructor(scene: THREE.Scene) {
    this.input = new InputController();

    scene.add(createLaneGroup());

    this.player = new Player();
    scene.add(this.player.object);

    this.engine = new RuleEngine(RULES);
    randomizeRuleColors(); // 룰3/4/5 색을 풀에서 무작위 배정(런 시작)
    // 룰 구현 단계: 정의된 룰을 모두 활성화해 각 룰을 바로 확인.
    // T12 에서 라운드 기반 누적 활성(activateUpTo(round))으로 대체.
    this.engine.activateUpTo(RULES.length);

    this.spawner = new Spawner(scene, this.engine);

    window.addEventListener('keydown', this.onKeyDown);
  }

  update(dt: number): void {
    if (this.status !== 'playing') return;

    this.player.update(dt, this.input.direction);
    this.spawner.update(dt);

    if (checkCollision(this.player, this.spawner.activeWalls, this.engine)) {
      this.gameOver();
    }
  }

  private gameOver(): void {
    this.status = 'gameover';
    // T13(최종 점수) / T16(게임오버 UI 오버레이) 에서 표시 보강.
    console.info('[RuleAdd] GAME OVER — press R or Space to restart');
  }

  reset(): void {
    randomizeRuleColors(); // 재시작마다 룰 색 새로 뽑음
    this.spawner.reset();
    this.player.reset();
    this.status = 'playing';
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.status !== 'gameover') return;
    if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
      this.reset();
    }
  };
}
