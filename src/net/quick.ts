// Quick match flow: nickname -> wait in the lobby while playing a bot -> "opponent found" -> online match.
import { Game } from '../game';
import { settings, updateSettings } from '../storage/settings';
import { App } from '../ui/app';
import { button, el, root } from '../ui/dom';
import { toast } from '../ui/hud';
import { Found, Lobby, LobbyError, cleanNick, createLobby, randomNick } from './matchmaking';
import { Online } from './online';

const ERRORS: Record<LobbyError, string> = {
  'auth-off': 'Quick match is not switched on yet (anonymous sign-in is disabled in Firebase).',
  rules: 'Quick match is not set up yet (the database rules are missing).',
  offline: 'Could not reach the quick match server. Check your internet connection.',
};

export class QuickMatch {
  private lobby: Lobby = createLobby();
  private searching = false;
  private chip = el('div', 'mmchip');
  private offer: HTMLElement | null = null;
  private offerTimer = 0;

  constructor(
    private app: App,
    private game: Game,
    private online: Online,
  ) {
    online.quickMenu = () => this.open();
    const cancel = button('✕', 'small ghost', () => {
      this.cancel();
      toast('Stopped searching');
    });
    cancel.setAttribute('aria-label', 'Stop searching');
    this.chip.append(el('span', 'blink', 'Searching for an opponent…'), cancel);
    this.chip.style.display = 'none';
    root().append(this.chip);
    // leaving to the menu also leaves the queue
    const prev = app.onLeaveMatch;
    app.onLeaveMatch = () => {
      this.cancel();
      prev?.();
    };
  }

  open(): void {
    this.online.leave();
    const s = el('div', 'screen clear');
    const p = el('div', 'panel stack');
    const input = el('input', 'code nick', '', { maxlength: '16', 'aria-label': 'Nickname', autocomplete: 'off', spellcheck: 'false' });
    input.value = settings.nick || randomNick();
    input.addEventListener('input', () => (input.value = cleanNick(input.value)));
    const note = el('p', 'hint', 'Your opponent sees this name. You play a bot until someone is found.');
    const go = () => {
      const nick = cleanNick(input.value);
      if (nick.length < 3) {
        note.textContent = 'Pick a name of at least 3 letters or numbers.';
        return;
      }
      updateSettings({ nick });
      this.start(true);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    const row = el('div', 'row');
    row.append(button('Back', 'ghost', () => this.online.menu()), button('Find match', 'primary', go));
    p.append(el('h2', '', 'Quick match'), el('h3', '', 'Your nickname'), input, note, row);
    s.append(p);
    this.app.custom(s);
    input.focus();
    input.select();
  }

  private start(newBotMatch: boolean): void {
    this.searching = true;
    this.online.nick = settings.nick;
    this.chip.style.display = '';
    this.lobby.enter(settings.nick, (f) => this.found(f), (e) => {
      this.cancel();
      toast(ERRORS[e]);
    });
    if (newBotMatch || this.game.config.kind !== 'bot') this.app.startMatch('bot');
  }

  private found(f: Found): void {
    if (!this.searching) return;
    this.closeOffer();
    let left = 10;
    const card = el('div', 'offer');
    const play = button('', 'primary small', () => this.accept(f));
    const label = () => (play.textContent = `Play now (${left})`);
    label();
    const skip = button('Skip', 'ghost small', () => {
      this.closeOffer();
      this.start(false);
    });
    const row = el('div', 'row');
    row.append(skip, play);
    card.append(el('b', '', 'Opponent found: ' + f.nick), row);
    root().append(card);
    this.offer = card;
    this.chip.style.display = 'none';
    this.offerTimer = window.setInterval(() => {
      if (--left <= 0) {
        this.closeOffer();
        this.start(false); // not accepted in time: keep looking
      } else label();
    }, 1000);
  }

  private accept(f: Found): void {
    this.closeOffer();
    this.searching = false;
    this.chip.style.display = 'none';
    this.app.rivalName = f.nick;
    this.app.message('Connecting…', 'Joining ' + f.nick, [['Cancel', 'ghost', () => { this.online.leave(); this.app.menu(); }]]);
    const retry = () => {
      toast('Opponent did not show up. Searching again…');
      this.start(true);
    };
    this.online.nick = settings.nick;
    if (f.host) this.online.hostQuick(f.code, retry);
    else this.online.joinQuick(f.code, retry);
  }

  private closeOffer(): void {
    clearInterval(this.offerTimer);
    this.offer?.remove();
    this.offer = null;
  }

  cancel(): void {
    if (!this.searching && !this.offer) return;
    this.searching = false;
    this.lobby.leave();
    this.closeOffer();
    this.chip.style.display = 'none';
  }
}
