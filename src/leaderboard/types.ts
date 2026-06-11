import type { Difficulty } from '../core/difficulty';

/**
 * 리더보드 엔트리 타입 + 모드 라벨.
 *  - LocalEntry  : 브라우저(localStorage) 개인 top5. 점수+시각만(이름/코멘트 없음).
 *  - GlobalEntry : Firestore 전체 top10. 진입 시 입력한 이름+코멘트 포함.
 */

/** 개인 기록 1건 — 점수와 달성 시각(epoch ms). */
export interface LocalEntry {
  score: number;
  at: number;
}

/** 전체(글로벌) 기록 1건 — Firestore 문서 1개에 대응. */
export interface GlobalEntry {
  score: number;
  name: string;
  comment: string;
  /** 서버 시각(epoch ms). 막 쓰여 아직 확정 안 된 동안 null 일 수 있다. */
  at: number | null;
}

/** 모드(난이도) → 화면 표시 라벨. 기록판/모달 헤더에 사용. id '4x4' 의 표시명은 "2차원"(저장 키는 호환 위해 유지). */
export const MODE_LABELS: Record<Difficulty, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
  blind: '블라인드',
  '4x4': '2차원',
};
