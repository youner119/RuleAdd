import type { Difficulty } from './core/difficulty';

/**
 * i18n — 한국어/영어 UI 문자열. 기본값은 한국어(처음 방문), 선택은
 * localStorage 에 저장. 언어 전환은 시작 화면의 한/EN 토글에서만 일어나고
 * StartScreen 이 자신을 다시 그린다 — 게임 내 컴포넌트는 생성 시점 언어를
 * 쓰되, 룰 라벨은 getter 로 t() 를 호출해 항상 현재 언어를 따른다.
 */

export type Lang = 'ko' | 'en';

const STORAGE_KEY = 'ruleadd.lang';

let lang: Lang = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko';
  } catch {
    return 'ko';
  }
})();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 저장 실패 무시 — 세션 내에서는 유지된다.
  }
}

const DICT = {
  ko: {
    // 시작 화면
    subtitle: '다가오는 벽을 피하라',
    mode_easy: '쉬움',
    mode_normal: '보통',
    mode_hard: '어려움',
    mode_blind: '블라인드',
    mode_2d: '2차원',
    modeDesc_easy: '느린 속도 · 목숨 5\n룰 점진 추가',
    modeDesc_normal: '기본 속도 · 목숨 3\n룰 점진 추가',
    modeDesc_hard: '빠른 속도 · 목숨 3\n모든 룰 · 5칸 시작',
    modeDesc_blind: '목숨 3 · 룰 숨김\n전환 때만 공개',
    modeDesc_2d: '4×4 에서 시작 · 목숨 5\n위아래(wasd)도 피함',
    scoreboardBtn: '🏆 점수판',
    // 점수판 화면 / 기록판
    scoreboardTitle: '점수판',
    back: '← 뒤로',
    globalTop10: '전체 TOP 10',
    myTop5: '내 기록 TOP 5',
    modeRecords: '{mode} 기록',
    loading: '불러오는 중…',
    offline: '오프라인 — 전체 랭킹 비활성',
    loadFailed: '불러오기 실패',
    loadFailedRetry: '불러오기 실패 — 잠시 후 다시 시도하세요.',
    noRecordsGlobal: '아직 기록 없음 — 1등이 되세요!',
    noRecords: '기록 없음',
    colName: '이름',
    colScore: '점수',
    colComment: '코멘트',
    // 이름 입력 모달
    nameEntryTitle: '🏆 전체 랭킹 진입!',
    nameEntryRank: '전체 {rank}위에 올랐습니다 — 이름을 남기세요',
    namePlaceholder: '이름 (최대 {max}자)',
    commentPlaceholder: '코멘트 (선택, 최대 {max}자)',
    submit: '등록',
    skip: '건너뛰기',
    anon: '익명',
    // 게임오버
    finalScore: '최종 점수',
    retry: '다시하기',
    menu: '메뉴',
    retryHint: 'R 키로 다시하기',
    whyDied: '왜 죽었나?',
    blockedHere: '여기서 막힘!',
    // HUD
    ctrlRestart: 'R: 재시작',
    ctrlMenu: 'M: 메인 메뉴',
    ctrlFastForward: '스페이스: 빨리감기',
    ruleTag: '룰 {id}.',
    // 룰 라벨
    rule_die: '벽에 닿으면 죽는다 · a/d 이동',
    rule_arrow: '화살표 방향으로 벽이 움직인다',
    rule_stop: '이 색은 움직이지 않는다',
    rule_pass: '이 색은 통과할 수 있다',
    rule_opposite: '이 색은 화살표 반대로 이동',
    rule_growWall: 'ⓧ 표시 벽은 칠해진 방향으로 늘어난다',
    rule_expand: '맵이 커진다 (한 변 +1)',
    rule_speed: '벽이 5% 빨라진다',
  },
  en: {
    subtitle: 'Dodge the oncoming walls',
    mode_easy: 'Easy',
    mode_normal: 'Normal',
    mode_hard: 'Hard',
    mode_blind: 'Blind',
    mode_2d: '2D',
    modeDesc_easy: 'Slow speed · 5 lives\nRules added gradually',
    modeDesc_normal: 'Normal speed · 3 lives\nRules added gradually',
    modeDesc_hard: 'Fast speed · 3 lives\nAll rules · 5 lanes',
    modeDesc_blind: '3 lives · Rules hidden\nRevealed on transitions',
    modeDesc_2d: 'Starts at 4×4 · 5 lives\nDodge up/down (wasd)',
    scoreboardBtn: '🏆 Scoreboard',
    scoreboardTitle: 'Scoreboard',
    back: '← Back',
    globalTop10: 'GLOBAL TOP 10',
    myTop5: 'MY TOP 5',
    modeRecords: '{mode} Records',
    loading: 'Loading…',
    offline: 'Offline — global ranking disabled',
    loadFailed: 'Failed to load',
    loadFailedRetry: 'Failed to load — try again later.',
    noRecordsGlobal: 'No records yet — be the first!',
    noRecords: 'No records',
    colName: 'Name',
    colScore: 'Score',
    colComment: 'Comment',
    nameEntryTitle: '🏆 Global Top 10!',
    nameEntryRank: 'You ranked #{rank} — leave your name',
    namePlaceholder: 'Name (max {max})',
    commentPlaceholder: 'Comment (optional, max {max})',
    submit: 'Submit',
    skip: 'Skip',
    anon: 'Anon',
    finalScore: 'FINAL SCORE',
    retry: 'Retry',
    menu: 'Menu',
    retryHint: 'Press R to retry',
    whyDied: 'Why did you die?',
    blockedHere: 'Blocked here!',
    ctrlRestart: 'R: Restart',
    ctrlMenu: 'M: Main menu',
    ctrlFastForward: 'Space: Fast-forward',
    ruleTag: 'Rule {id}.',
    rule_die: 'Touch a wall and you die · move with a/d',
    rule_arrow: 'Walls shift in their arrow direction',
    rule_stop: 'This color never moves',
    rule_pass: 'This color can be passed through',
    rule_opposite: 'This color moves opposite to its arrow',
    rule_growWall: 'ⓧ walls grow toward the painted part',
    rule_expand: 'The map grows (side +1)',
    rule_speed: 'Walls get 5% faster',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type MsgKey = keyof (typeof DICT)['ko'];

/** 현재 언어의 문자열. {name} 자리표시자는 params 로 치환. */
export function t(key: MsgKey, params?: Record<string, string | number>): string {
  let s: string = DICT[lang][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  }
  return s;
}

/** 모드(난이도) 표시 라벨 — id '4x4' 의 표시명은 "2차원"/"2D"(저장 키는 '4x4' 유지). */
export function modeLabel(mode: Difficulty): string {
  return t(mode === '4x4' ? 'mode_2d' : (`mode_${mode}` as MsgKey));
}
