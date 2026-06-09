import type { Difficulty } from '../core/difficulty';

/**
 * StartScreen — 난이도 선택 시작 화면(HTML 오버레이, 가로 카드 3장).
 * 흰 배경 + 검은 테두리 미학. 카드 선택 시 onSelect 호출 후 사라진다.
 */

interface ModeCard {
  id: Difficulty;
  name: string;
  desc: string;
}

const MODES: readonly ModeCard[] = [
  { id: 'normal', name: '보통', desc: '룰이 라운드마다\n점진적으로 추가' },
  { id: 'hard', name: '어려움', desc: '룰 1~5 전부로\n시작' },
  { id: 'blind', name: '블라인드', desc: '룰을 화면에\n표시하지 않음' },
];

export class StartScreen {
  private readonly root: HTMLDivElement;

  constructor(mount: HTMLElement, onSelect: (difficulty: Difficulty) => void) {
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
    subtitle.textContent = '다가오는 벽의 빈 칸으로 피하라 · a / d 로 이동';
    subtitle.style.cssText = 'font:400 15px/1 system-ui,sans-serif;color:#888;margin-top:-16px;';
    this.root.appendChild(subtitle);

    const cards = document.createElement('div');
    cards.style.cssText = 'display:flex;gap:20px;';
    for (const mode of MODES) cards.appendChild(this.makeCard(mode, onSelect));
    this.root.appendChild(cards);

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
    this.root.remove();
  }
}
