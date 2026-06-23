import {HtmlComponent, InitModelOf, scout, Widget, WidgetModel} from '@eclipse-scout/core';
import {LiveKitMeeting} from '@scoutkit/livekit';
import {Conversation, meetingApi, MeetingApi, Message} from '../data/MeetingApi';
import {userIdentity} from '../data/UserIdentity';
import {IconChars} from './Icons';

const POLL_MS = 2500;

/**
 * Render a custom `scoutkit-icons` glyph as inline HTML for the chat action buttons (call, send).
 * This is a plain-HTML surface (not a Scout widget), so Scout's `iconId` machinery isn't available;
 * the `font-scoutkit-icons` class resolves the font-family (theme/scoutkit.less) and the glyph then
 * inherits the button's `currentColor` and scales with the font size via the `.cb-btn-icon` class.
 */
function cbIcon(glyph: string): string {
  return `<span class="cb-btn-icon font-scoutkit-icons" aria-hidden="true">${glyph}</span>`;
}

export interface ChatBoxModel extends WidgetModel {
  /** The conversation this chat box is bound to. Required. */
  conversation?: Conversation;
}

/**
 * The chat surface for a single {@link Conversation}: a scrolling, server-persisted message
 * stream, a composer, and a docked {@link LiveKitMeeting} video call. It is embedded in the
 * {@link ChatForm} detail form of a conversation page. Listing, navigation and creation of
 * conversations is handled by the outline pages — this widget only renders one conversation.
 */
export class ChatBox extends Widget {
  declare model: ChatBoxModel;

  conversation!: Conversation;
  protected api: MeetingApi = meetingApi;
  protected lastTs = 0;
  protected pollTimer: number | null = null;
  protected meeting: LiveKitMeeting | null = null;

  protected $callBtn!: JQuery;
  protected $callDock!: JQuery;
  protected $messages!: JQuery;
  protected $composerInput!: JQuery;

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    scout.assertParameter('conversation', this.conversation);
  }

  protected override _render(): void {
    this.$container = this.$parent.appendDiv('chat-box');
    this.htmlComp = HtmlComponent.install(this.$container, this.session);

    const $header = this.$container.appendDiv('cb-header');
    const direct = this.conversation.type === 'direct';
    $header.appendDiv('cb-avatar ' + (direct ? 'cb-avatar-direct' : 'cb-avatar-group'));
    const $headerText = $header.appendDiv('cb-header-text');
    $headerText.appendDiv('cb-title').text(this.conversation.title || this.conversation.id);
    $headerText.appendDiv('cb-sub').text(direct
      ? this.session.text('scoutkit.DirectMessage')
      : this.session.text(
        this.conversation.memberCount === 1 ? 'scoutkit.MembersMeetingRoomOne' : 'scoutkit.MembersMeetingRoomMany',
        String(this.conversation.memberCount)));
    $header.appendDiv('cb-spacer');
    this.$callBtn = $header.appendElement('<button>', 'cb-btn cb-call-btn')
      .on('click', () => this._onToggleCall());
    this._renderCallButton(false);

    this.$callDock = this.$container.appendDiv('cb-call-dock');
    this.$callDock.setVisible(false);

    this.$messages = this.$container.appendDiv('cb-messages');

    const $composer = this.$container.appendDiv('cb-composer');
    this.$composerInput = $composer.appendElement('<input>', 'cb-composer-input')
      .attr('type', 'text')
      .attr('placeholder', this.session.text('scoutkit.MessagePlaceholder'))
      .on('keydown', (e: JQuery.KeyDownEvent) => {
        if (e.which === 13) {
          this._onSend();
        }
      });
    $composer.appendElement('<button>', 'cb-btn cb-send-btn')
      .html(cbIcon(IconChars.PAPER_PLANE) + `<span class="cb-btn-label">${this.session.text('scoutkit.Send')}</span>`)
      .on('click', () => this._onSend());

    this._loadMessages();
  }

  protected override _remove(): void {
    this._stopPolling();
    this._endCall();
    super._remove();
  }

  // --- messages -------------------------------------------------------------

  protected _loadMessages(): void {
    this.$messages.empty();
    this.$messages.appendDiv('cb-placeholder').text(this.session.text('scoutkit.Loading'));
    this.api.messages(this.conversation.id, 0)
      .then(messages => {
        if (!this.rendered) {
          return;
        }
        this.$messages.empty();
        if (messages.length === 0) {
          this.$messages.appendDiv('cb-placeholder').text(this.session.text('scoutkit.NoMessagesYetGreeting'));
        }
        messages.forEach(m => this._appendMessage(m));
        this.lastTs = messages.reduce((max, m) => Math.max(max, m.ts), 0);
        this._startPolling();
      })
      .catch(err => this._showError(err));
  }

  protected _appendMessage(message: Message): void {
    const own = message.author === userIdentity.displayName;
    const $msg = this.$messages.appendDiv('cb-msg');
    $msg.toggleClass('cb-msg-own', own);
    const $head = $msg.appendDiv('cb-msg-head');
    $head.appendElement('<span>', 'cb-msg-author').text(message.author);
    $head.appendElement('<span>', 'cb-msg-time').text(this._time(message.ts));
    $msg.appendDiv('cb-msg-text').text(message.text);
    this.$messages[0].scrollTop = this.$messages[0].scrollHeight;
  }

  protected _onSend(): void {
    const text = String(this.$composerInput.val() || '').trim();
    if (!text) {
      return;
    }
    this.$composerInput.val('');
    this.api.postMessage(this.conversation.id, userIdentity.displayName, text)
      .then(msg => {
        if (this.rendered) {
          this._appendMessage(msg);
          this.lastTs = Math.max(this.lastTs, msg.ts);
        }
      })
      .catch(err => this._showError(err));
  }

  // --- polling --------------------------------------------------------------

  protected _startPolling(): void {
    this._stopPolling();
    this.pollTimer = window.setInterval(() => this._poll(), POLL_MS);
  }

  protected _stopPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  protected _poll(): void {
    this.api.messages(this.conversation.id, this.lastTs)
      .then(messages => {
        if (!this.rendered || messages.length === 0) {
          return;
        }
        this.$messages.children('.cb-placeholder').remove();
        messages.forEach(m => this._appendMessage(m));
        this.lastTs = messages.reduce((max, m) => Math.max(max, m.ts), this.lastTs);
      })
      .catch(() => { /* transient; next tick retries */ });
  }

  // --- video call -----------------------------------------------------------

  protected _onToggleCall(): void {
    if (this.meeting) {
      this._endCall();
    } else {
      this._startCall();
    }
  }

  protected _startCall(): void {
    const apiBase = window.APP_CONFIG?.apiBase || '/api';
    this.meeting = scout.create(LiveKitMeeting, {
      parent: this,
      serverUrl: window.APP_CONFIG?.livekitUrl || 'ws://localhost:7880',
      tokenUrl: `${apiBase}/token`,
      room: this.conversation.id,
      identity: `${userIdentity.identity}-${this.conversation.id}`,
      displayName: userIdentity.displayName,
      inviteUrl: this._inviteUrl(),
      chatEnabled: false,
      autoConnect: true
    });
    this.meeting.on('left', () => this._endCall());
    this.$callDock.setVisible(true);
    this.meeting.render(this.$callDock);
    this._renderCallButton(true);
  }

  protected _endCall(): void {
    if (this.meeting) {
      this.meeting.destroy();
      this.meeting = null;
    }
    if (this.$callDock) {
      this.$callDock.setVisible(false);
    }
    if (this.$callBtn) {
      this._renderCallButton(false);
    }
  }

  /** Render the call button's icon + label for the current call state (start vs. active/end). */
  protected _renderCallButton(active: boolean): void {
    const label = this.session.text(active ? 'scoutkit.EndCall' : 'scoutkit.StartCall');
    const glyph = active ? IconChars.VIDEO_SLASH : IconChars.VIDEO;
    this.$callBtn
      .html(cbIcon(glyph) + `<span class="cb-btn-label">${label}</span>`)
      .toggleClass('cb-call-active', active);
  }

  // --- helpers --------------------------------------------------------------

  protected _inviteUrl(): string {
    return `${window.location.origin}${window.location.pathname}?c=${encodeURIComponent(this.conversation.id)}`;
  }

  protected _time(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  protected _showError(err: unknown): void {
    const text = err instanceof Error ? err.message : String(err);
    if (this.$messages) {
      this.$messages.appendDiv('cb-error').text(this.session.text('scoutkit.ErrorX', text));
    }
  }
}
