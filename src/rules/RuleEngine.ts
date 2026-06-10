/**
 * RuleEngine — 데이터 주도 룰 엔진. RuleAdd 의 심장.
 *
 * 룰은 {appliesTo, modify} 데이터 객체. 엔진은 활성 룰을 추가 순서대로
 * fold 해 벽의 행동(WallBehavior)을 만든다 — 뒤(나중에 추가)의 룰이 앞 룰의
 * 결과를 덮으므로 스펙의 "후순위 우선(later-wins)"이 자동으로 나온다.
 *
 * 룰1~5 는 rules.ts 에 데이터로 정의되고, 효과 배선은 T9~T11. v2 룰6~10 도
 * 이 fold 에 끼워넣기만 하면 된다.
 */

/** 룰이 읽는 블록(개별 벽) 속성. 구체 Block 이 이 속성을 갖춘다. */
export interface RuleBlock {
  /** 룰3/4/5 색 (없으면 null). */
  color: string | null;
  /** 룰2 화살표 방향 (-1=좌 / 0=없음 / +1=우). */
  arrowDir: number;
}

/** 룰이 결정하는 블록의 행동. */
export interface BlockBehavior {
  /** 룰4: 특정 색 블록은 구와 충돌하지 않음. */
  collidable: boolean;
  /** 룰2/3: 근접 시 블록 쉬프트 방향 (-1/0/+1). */
  shiftDir: number;
}

/** 데이터 주도 룰 — 블록별로 적용. */
export interface Rule {
  /** 룰 번호(1..) = 추가 순서 = 우선순위(클수록 우선). */
  id: number;
  /** HUD 표시용 라벨(T15). */
  label: string;
  /** 이 룰이 해당 블록에 적용되는가. */
  appliesTo(block: RuleBlock): boolean;
  /** 행동을 변형(이전 결과 위에 덮음). */
  modify(behavior: BlockBehavior, block: RuleBlock): BlockBehavior;
  /** 색 룰의 대상 색(런마다 랜덤). 비색 룰은 undefined. */
  readonly targetColor?: string | null;
  /** 색 룰의 대상 색 설정(null=초기화). 활성화 시점에 배정. */
  setColor?(color: string | null): void;
}

const BASE_BEHAVIOR: BlockBehavior = { collidable: true, shiftDir: 0 };

export class RuleEngine {
  private readonly rules: readonly Rule[]; // 전체 룰 (id 오름차순 = 추가 순서)
  private activeCount = 0; // 앞에서부터 활성 룰 수 (누적)

  constructor(rules: readonly Rule[]) {
    this.rules = [...rules].sort((a, b) => a.id - b.id);
  }

  /** 라운드 진행에 따라 앞에서부터 n개 룰 활성화(누적). T12 가 호출. */
  activateUpTo(n: number): void {
    this.activeCount = Math.max(0, Math.min(n, this.rules.length));
  }

  /** 활성 룰(추가 순서 = 우선순위 오름차순; 뒤가 우선). HUD 는 역순 표시(T15). */
  get activeRules(): readonly Rule[] {
    return this.rules.slice(0, this.activeCount);
  }

  /** 특정 룰 id 가 활성인가 (스폰 시 화살표/색 부여 판단에 사용). */
  isActive(id: number): boolean {
    return this.activeRules.some((r) => r.id === id);
  }

  /** 활성 룰을 순서대로 fold → 후순위 우선. 블록별로 호출. */
  resolveBehavior(block: RuleBlock): BlockBehavior {
    let behavior: BlockBehavior = { ...BASE_BEHAVIOR };
    for (const rule of this.activeRules) {
      if (rule.appliesTo(block)) behavior = rule.modify(behavior, block);
    }
    return behavior;
  }
}
