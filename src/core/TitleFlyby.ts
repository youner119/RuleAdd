import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { SPAWN_Z } from './lane';

/**
 * TitleFlyby — 모드 시작(첫 세트 도착 전 공백) 때 "RULE ADD" 3D 글자가
 * 레인 위쪽에 떠서 벽과 같은 속도로 레인 흐름에 실려 함께 흘러온다 —
 * 첫 세트보다 한 간격 앞서 오는 유령 세트 같은 느낌.
 * 흰 글자 + 검은 EdgesGeometry 테두리 — 벽 블록과 같은 미학.
 * Game 이 소유: update(dt) 가 true 를 반환하면 다 지나간 것(제거 시점).
 */

const TITLE = 'RULE ADD';
const SIZE = 1.1; // 글자 높이(월드 단위)
const DEPTH = 0.35; // 압출 두께 — 3D 입체감
/** 다 지나간 판정 Z — 카메라(최대 z≈15)를 충분히 지나친 위치. */
const EXIT_Z = 18;

// 폰트는 모듈 로드 시 1회 파싱(three 내장 helvetiker bold).
const FONT: Font = new FontLoader().parse(fontData);

export class TitleFlyby {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  private readonly geometry: TextGeometry;
  private readonly edges: THREE.EdgesGeometry;
  private readonly speed: number;

  /**
   * @param y 글자 중심 높이 — 그리드 위(1차원 ≈3, 2차원 ≈6.5).
   * @param speed +Z 진행 속도(월드 단위/초) — 벽 속도와 동일(레인과 같이 흘러감).
   * @param startZ 시작 Z — 첫 벽보다 한 간격(WALL_SPACING) 앞.
   */
  constructor(y: number, speed: number, startZ: number = SPAWN_Z) {
    this.speed = speed;

    this.geometry = new TextGeometry(TITLE, {
      font: FONT,
      size: SIZE,
      depth: DEPTH,
      curveSegments: 6,
    });
    this.geometry.computeBoundingBox();
    const bb = this.geometry.boundingBox as THREE.Box3;
    // 가로·세로 중앙 정렬(원점 = 글자 중심) — x=0 에 두면 레인 가운데 위.
    this.geometry.translate(
      -(bb.min.x + bb.max.x) / 2,
      -(bb.min.y + bb.max.y) / 2,
      -(bb.min.z + bb.max.z) / 2,
    );

    const body = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.6,
        metalness: 0,
      }),
    );
    body.castShadow = true;

    this.edges = new THREE.EdgesGeometry(this.geometry, 12); // 테두리(완만한 면 경계는 생략)
    const outline = new THREE.LineSegments(
      this.edges,
      new THREE.LineBasicMaterial({ color: 0x222222 }),
    );

    this.object = new THREE.Group();
    this.object.add(body, outline);
    this.object.position.set(0, y, startZ);
  }

  /** 한 프레임 진행 — 다 지나갔으면 true(호출측이 씬에서 제거·dispose). */
  update(dt: number): boolean {
    this.object.position.z += this.speed * dt;
    return this.object.position.z > EXIT_Z;
  }

  dispose(): void {
    this.geometry.dispose();
    this.edges.dispose();
  }
}
