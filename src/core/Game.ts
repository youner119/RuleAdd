import * as THREE from 'three';
import { checkCollision } from './CollisionSystem';
import { InputController } from './InputController';
import { createLaneGroup } from './lane';
import { Player } from './Player';
import { Spawner } from './Spawner';
import { RuleEngine } from '../rules/RuleEngine';
import { RULES } from '../rules/rules';

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

    this.spawner = new Spawner(scene);

    this.engine = new RuleEngine(RULES);
    this.engine.activateUpTo(1); // 라운드1 = 룰1. T12 가 라운드에 따라 누적 활성.

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
