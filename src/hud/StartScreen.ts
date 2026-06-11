import type { Difficulty } from '../core/difficulty';
import { getLang, modeLabel, setLang, t, type Lang, type MsgKey } from '../i18n';
import { ScoreboardScreen } from './ScoreboardScreen';

/**
 * StartScreen — 모드 선택 시작 화면(HTML 오버레이, 가로 카드 5장).
 * 쉬움/보통/어려움/블라인드/2차원 중 하나를 고른다. 2차원(id '4x4')은
 * 처음부터 4×4 에서 위아래(wasd)로도 피하는 모드. 흰 배경 + 검은 테두리 미학.
 * 카드 선택 시 onSelect(모드) 호출 후 사라진다.
 * 카드 아래 "🏆 점수판" 버튼(ScoreboardScreen) + 한/EN 언어 토글 —
 * 언어를 바꾸면 화면을 다시 그리고 점수판도 새 언어로 재생성한다.
 */

const MODES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'blind', '4x4'];

/** 모드 → 설명 문자열 키. */
function descKey(mode: Difficulty): MsgKey {
  return (mode === '4x4' ? 'modeDesc_2d' : `modeDesc_${mode}`) as MsgKey;
}

export class StartScreen {
  private readonly root: HTMLDivElement;
  private readonly mount: HTMLElement;
  private readonly onSelect: (difficulty: Difficulty) => void;
  private scoreboard: ScoreboardScreen;

  constructor(mount: HTMLElement, onSelect: (difficulty: Difficulty) => void) {
    this.mount = mount;
    this.onSelect = onSelect;
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
    mount.appendChild(this.root);

    this.render();
  }

  /** 현재 언어로 화면 전체를 (다시) 그린다 — 언어 토글 시 재호출. */
  private render(): void {
    this.root.replaceChildren();

    const title = document.createElement('div');
    title.textContent = 'RuleAdd';
    title.style.cssText = 'font:700 56px/1 system-ui,sans-serif;letter-spacing:2px;';
    this.root.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = t('subtitle');
    subtitle.style.cssText = 'font:400 15px/1 system-ui,sans-serif;color:#888;margin-top:-16px;';
    this.root.appendChild(subtitle);

    const cards = document.createElement('div');
    cards.style.cssText =
      'display:grid;grid-template-columns:repeat(3,150px);gap:20px;justify-content:center;';
    for (const mode of MODES) cards.appendChild(this.makeCard(mode));
    this.root.appendChild(cards);

    // 하단 줄 — [🏆 점수판] [한|EN]
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display:flex;gap:10px;width:320px;';
    bottomRow.append(this.makeScoreboardButton(), this.makeLangToggle());
    this.root.appendChild(bottomRow);
  }

  private makeCard(mode: Difficulty): HTMLDivElement {
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
    name.textContent = modeLabel(mode);
    name.style.cssText = 'font:700 22px/1 system-ui,sans-serif;margin-bottom:10px;';
    const desc = document.createElement('div');
    desc.textContent = t(descKey(mode));
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
      this.onSelect(mode);
    });
    return card;
  }

  private makeScoreboardButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = t('scoreboardBtn');
    btn.style.cssText = [
      'flex:1',
      'padding:14px 0',
      'border:2px solid #222',
      'border-radius:10px',
      'background:#fff',
      'font:700 17px/1 system-ui,sans-serif',
      'color:#222',
      'cursor:pointer',
      'transition:background 0.12s',
    ].join(';');
    btn.addEventListener('mouseenter', () => (btn.style.background = '#f0f0f0'));
    btn.addEventListener('mouseleave', () => (btn.style.background = '#fff'));
    btn.addEventListener('click', () => this.scoreboard.open());
    return btn;
  }

  /** 한/EN 언어 토글(세그먼트) — 활성 언어는 검정 배경. */
  private makeLangToggle(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'display:flex',
      'border:2px solid #222',
      'border-radius:10px',
      'overflow:hidden',
      'background:#fff',
    ].join(';');

    const seg = (label: string, lang: Lang): HTMLButtonElement => {
      const active = getLang() === lang;
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = [
        'padding:0 14px',
        'border:none',
        active ? 'background:#222' : 'background:#fff',
        active ? 'color:#fff' : 'color:#222',
        'font:700 14px/1 system-ui,sans-serif',
        'cursor:pointer',
      ].join(';');
      btn.addEventListener('click', () => this.setLanguage(lang));
      return btn;
    };

    wrap.append(seg('한', 'ko'), seg('EN', 'en'));
    return wrap;
  }

  private setLanguage(lang: Lang): void {
    if (getLang() === lang) return;
    setLang(lang);
    // 점수판은 생성 시점 언어로 문구를 만들었으므로 새 언어로 재생성.
    this.scoreboard.dispose();
    this.scoreboard = new ScoreboardScreen(this.mount);
    this.render();
  }

  hide(): void {
    this.scoreboard.dispose();
    this.root.remove();
  }
}
