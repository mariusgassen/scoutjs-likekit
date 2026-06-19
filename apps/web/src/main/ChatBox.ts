import {HtmlComponent, InitModelOf, scout, Widget, WidgetModel} from '@eclipse-scout/core';
import {LiveKitMeeting} from '@scoutkit/livekit';
import {Conversation, meetingApi, MeetingApi, Message} from '../data/MeetingApi';
import {userIdentity} from '../data/UserIdentity';

const POLL_MS = 2500;

/**
 * Inline SVG glyphs for the chat action buttons (call, send). The Scout font-icon set
 * (`icons.*`) has no phone/paper-plane glyph and this is a plain-HTML surface (not a Scout widget),
 * so small stroke icons are inlined here rather than adding a custom icon font. They inherit the
 * button's `currentColor` and scale with the font size via the `.cb-btn-icon` class.
 */
const CB_ICONS = {
  phone: '<svg class="cb-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  send: '<svg class="cb-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>'
} as const;

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
      .html(CB_ICONS.send + `<span class="cb-btn-label">${this.session.text('scoutkit.Send')}</span>`)
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
    this.$callBtn
      .html(CB_ICONS.phone + `<span class="cb-btn-label">${label}</span>`)
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
