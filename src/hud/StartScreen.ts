import type { Difficulty } from '../core/difficulty';
import { ScoreboardScreen } from './ScoreboardScreen';

/**
 * StartScreen — 모드 선택 시작 화면(HTML 오버레이, 가로 카드 5장).
 * 쉬움/보통/어려움/블라인드/4×4 중 하나를 고른다. 4×4 는 처음부터
 * 위아래(wasd)로도 피하는 모드. 흰 배경 + 검은 테두리 미학.
 * 카드 선택 시 onSelect(모드) 호출 후 사라진다.
 * 카드 아래 "🏆 점수판" 버튼으로 전체 랭킹 화면(ScoreboardScreen)을 연다.
 */

interface ModeCard {
  id: Difficulty;
  name: string;
  desc: string;
}

const MODES: readonly ModeCard[] = [
  { id: 'easy', name: '쉬움', desc: '느린 속도 · 목숨 5\n룰 점진 추가' },
  { id: 'normal', name: '보통', desc: '기본 속도 · 목숨 3\n룰 점진 추가' },
  { id: 'hard', name: '어려움', desc: '빠른 속도 · 목숨 3\n룰을 가지고 시작' },
  { id: 'blind', name: '블라인드', desc: '목숨 3 · 룰 숨김\n전환 때만 공개' },
  { id: '4x4', name: '4×4', desc: '처음부터 4×4 · 목숨 5\n위아래(wasd)도 피함' },
];

export class StartScreen {
  private readonly root: HTMLDivElement;
  private readonly scoreboard: ScoreboardScreen;

  constructor(mount: HTMLElement, onSelect: (difficulty: Difficulty) => void) {
    this.scoreboard = new ScoreboardScreen(mount);

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:32px',
      'background:rgba(255,255,255,0.92)',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'user-select:none',
      'z-index:10',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'RuleAdd';
    title.style.cssText = 'font:700 56px/1 system-ui,sans-serif;letter-spacing:2px;';
    this.root.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = '다가오는 벽을 피하라';
    subtitle.style.cssText = 'font:400 15px/1 system-ui,sans-serif;color:#888;margin-top:-16px;';
    this.root.appendChild(subtitle);

    const cards = document.createElement('div');
    cards.style.cssText =
      'display:grid;grid-template-columns:repeat(3,150px);gap:20px;justify-content:center;';
    for (const mode of MODES) cards.appendChild(this.makeCard(mode, onSelect));
    this.root.appendChild(cards);

    const scoreboardBtn = document.createElement('button');
    scoreboardBtn.textContent = '🏆 점수판';
    scoreboardBtn.style.cssText = [
      'width:320px',
      'padding:14px 0',
      'border:2px solid #222',
      'border-radius:10px',
      'background:#fff',
      'font:700 17px/1 system-ui,sans-serif',
      'color:#222',
      'cursor:pointer',
      'transition:background 0.12s',
    ].join(';');
    scoreboardBtn.addEventListener('mouseenter', () => (scoreboardBtn.style.background = '#f0f0f0'));
    scoreboardBtn.addEventListener('mouseleave', () => (scoreboardBtn.style.background = '#fff'));
    scoreboardBtn.addEventListener('click', () => this.scoreboard.open());
    this.root.appendChild(scoreboardBtn);

    mount.appendChild(this.root);
  }

  private makeCard(mode: ModeCard, onSelect: (d: Difficulty) => void): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = [
      'width:150px',
      'padding:24px 16px',
      'border:2px solid #222',
      'border-radius:10px',
      'background:#fff',
      'text-align:center',
      'cursor:pointer',
      'transition:background 0.12s,transform 0.12s',
    ].join(';');

    const name = document.createElement('div');
    name.textContent = mode.name;
    name.style.cssText = 'font:700 22px/1 system-ui,sans-serif;margin-bottom:10px;';
    const desc = document.createElement('div');
    desc.textContent = mode.desc;
    desc.style.cssText = 'font:400 13px/1.5 system-ui,sans-serif;color:#777;white-space:pre-line;';
    card.append(name, desc);

    card.addEventListener('mouseenter', () => {
      card.style.background = '#f0f0f0';
      card.style.transform = 'translateY(-4px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = '#fff';
      card.style.transform = 'none';
    });
    card.addEventListener('click', () => {
      this.hide();
      onSelect(mode.id);
    });
    return card;
  }

  hide(): void {
    this.scoreboard.dispose();
    this.root.remove();
  }
}
