import {HtmlComponent, InitModelOf, scout, Widget} from '@eclipse-scout/core';
import {LiveKitMeeting} from '@bsi/scout-livekit';
import {Contact, Conversation, MeetingApi, Message} from './MeetingApi';

const NAME_KEY = 'scoutjs-likekit.name';
const ID_KEY = 'scoutjs-likekit.id';
const POLL_MS = 2500;

/**
 * Teams/Slack-like collaboration workspace rendered as a single Scout widget. A left rail lists
 * conversations (DMs + group/meeting chats) and contacts; the main pane shows the selected
 * conversation's server-persisted chat. Starting a video call docks a {@link LiveKitMeeting}
 * above the chat so messaging keeps working during and after the call.
 */
export class ChatWorkspace extends Widget {

  protected api = new MeetingApi();
  protected identity = '';
  protected displayName = '';

  protected contacts: Contact[] = [];
  protected conversations: Conversation[] = [];
  protected active: Conversation | null = null;
  protected lastTs = 0;
  protected pollTimer: number | null = null;
  protected convRefreshTick = 0;
  protected meeting: LiveKitMeeting | null = null;
  protected newPanelOpen = false;

  protected $rail!: JQuery;
  protected $nameInput!: JQuery;
  protected $convList!: JQuery;
  protected $contactList!: JQuery;
  protected $newPanel!: JQuery;

  protected $main!: JQuery;
  protected $mainTitle!: JQuery;
  protected $mainSub!: JQuery;
  protected $callBtn!: JQuery;
  protected $callDock!: JQuery;
  protected $chat!: JQuery;
  protected $messages!: JQuery;
  protected $composerInput!: JQuery;
  protected $placeholder!: JQuery;

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    this.identity = this._readStored(ID_KEY) || `u-${Math.random().toString(36).slice(2, 10)}`;
    this._store(ID_KEY, this.identity);
    this.displayName = this._readStored(NAME_KEY) || `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  protected override _render(): void {
    this.$container = this.$parent.appendDiv('chat-workspace');
    this.htmlComp = HtmlComponent.install(this.$container, this.session);
    this._renderRail();
    this._renderMain();
    this._loadData();
  }

  protected override _remove(): void {
    this._stopPolling();
    if (this.meeting) {
      this.meeting.destroy();
      this.meeting = null;
    }
    super._remove();
  }

  // --- rail -----------------------------------------------------------------

  protected _renderRail(): void {
    this.$rail = this.$container.appendDiv('cw-rail');

    const $brand = this.$rail.appendDiv('cw-brand');
    $brand.appendDiv('cw-brand-mark').text('◆');
    $brand.appendDiv('cw-brand-name').text('Scout Meet');

    const $identity = this.$rail.appendDiv('cw-identity');
    $identity.appendDiv('cw-identity-label').text('You');
    this.$nameInput = $identity.appendElement('<input>', 'cw-identity-input')
      .attr('type', 'text')
      .attr('maxlength', '40')
      .val(this.displayName)
      .on('change blur', () => this._onNameChanged());

    const $convHead = this.$rail.appendDiv('cw-section-head');
    $convHead.appendElement('<span>', 'cw-section-title').text('Conversations');
    $convHead.appendElement('<button>', 'cw-section-action')
      .text('+ New')
      .on('click', () => this._toggleNewPanel());

    this.$newPanel = this.$rail.appendDiv('cw-new-panel');
    this.$newPanel.setVisible(false);

    this.$convList = this.$rail.appendDiv('cw-list cw-conv-list');

    this.$rail.appendDiv('cw-section-head')
      .appendElement('<span>', 'cw-section-title').text('Contacts');
    this.$contactList = this.$rail.appendDiv('cw-list cw-contact-list');
  }

  protected _onNameChanged(): void {
    const name = String(this.$nameInput.val() || '').trim();
    if (!name) {
      this.$nameInput.val(this.displayName);
      return;
    }
    this.displayName = name;
    this._store(NAME_KEY, name);
  }

  // --- main pane ------------------------------------------------------------

  protected _renderMain(): void {
    this.$main = this.$container.appendDiv('cw-main');

    const $header = this.$main.appendDiv('cw-main-header');
    const $titles = $header.appendDiv('cw-main-titles');
    this.$mainTitle = $titles.appendDiv('cw-main-title').text('Select a conversation');
    this.$mainSub = $titles.appendDiv('cw-main-sub');
    $header.appendDiv('cw-main-spacer');
    this.$callBtn = $header.appendElement('<button>', 'cw-btn cw-call-btn')
      .text('Start call')
      .on('click', () => this._onToggleCall());
    this.$callBtn.setVisible(false);

    this.$callDock = this.$main.appendDiv('cw-call-dock');
    this.$callDock.setVisible(false);

    this.$chat = this.$main.appendDiv('cw-chat');
    this.$messages = this.$chat.appendDiv('cw-messages');
    this.$placeholder = this.$messages.appendDiv('cw-placeholder')
      .text('Pick a conversation or a contact to start chatting.');

    const $composer = this.$chat.appendDiv('cw-composer');
    this.$composerInput = $composer.appendElement('<input>', 'cw-composer-input')
      .attr('type', 'text')
      .attr('placeholder', 'Message…')
      .attr('disabled', 'disabled')
      .on('keydown', (e: JQuery.KeyDownEvent) => {
        if (e.which === 13) {
          this._onSend();
        }
      });
    $composer.appendElement('<button>', 'cw-btn cw-send-btn')
      .text('Send')
      .on('click', () => this._onSend());
  }

  // --- data loading ---------------------------------------------------------

  protected _loadData(): void {
    Promise.all([this.api.contacts(), this.api.conversations()])
      .then(([contacts, conversations]) => {
        this.contacts = contacts;
        this.conversations = conversations;
        this._renderContacts();
        this._renderConversations();
        this._selectFromUrl();
      })
      .catch(err => this._showError(err));
  }

  protected _reloadConversations(): Promise<void> {
    return this.api.conversations().then(list => {
      this.conversations = list;
      this._renderConversations();
    });
  }

  protected _renderContacts(): void {
    this.$contactList.empty();
    this.contacts.forEach(contact => {
      const $row = this.$contactList.appendDiv('cw-contact');
      const $avatar = $row.appendDiv('cw-avatar').text(this._initials(contact.name));
      $avatar[0].style.background = contact.color || '#888';
      const $meta = $row.appendDiv('cw-contact-meta');
      $meta.appendDiv('cw-contact-name').text(contact.name);
      $meta.appendDiv(`cw-contact-status cw-status-${contact.status}`).text(contact.status);
      $row.on('click', () => this._openDirect(contact));
    });
  }

  protected _renderConversations(): void {
    this.$convList.empty();
    this.conversations.forEach(conv => {
      const $row = this.$convList.appendDiv('cw-conv');
      if (this.active && this.active.id === conv.id) {
        $row.addClass('cw-active');
      }
      $row.appendDiv('cw-conv-icon').text(conv.type === 'direct' ? '@' : '#');
      const $meta = $row.appendDiv('cw-conv-meta');
      $meta.appendDiv('cw-conv-title').text(conv.title || conv.id);
      const preview = conv.lastMessage
        ? `${conv.lastAuthor ? conv.lastAuthor.split(' ')[0] + ': ' : ''}${conv.lastMessage}`
        : 'No messages yet';
      $meta.appendDiv('cw-conv-preview').text(preview);
      $row.on('click', () => this._selectConversation(conv));
    });
  }

  // --- conversation selection / chat ---------------------------------------

  protected _openDirect(contact: Contact): void {
    const existing = this.conversations.find(c => c.type === 'direct' && c.memberIds.length === 1 && c.memberIds[0] === contact.id);
    if (existing) {
      this._selectConversation(existing);
      return;
    }
    this.api.createConversation({type: 'direct', title: contact.name, memberIds: [contact.id]})
      .then(conv => this._reloadConversations().then(() => this._selectConversation(conv)))
      .catch(err => this._showError(err));
  }

  protected _selectConversation(conv: Conversation): void {
    if (this.meeting && this.active && this.active.id !== conv.id) {
      this._endCall();
    }
    this.active = conv;
    this.lastTs = 0;
    this._renderConversations();
    this._updateUrl(conv.id);

    this.$mainTitle.text(conv.title || conv.id);
    this.$mainSub.text(conv.type === 'direct' ? 'Direct message' : `${conv.memberCount} member${conv.memberCount === 1 ? '' : 's'} · meeting room`);
    this.$callBtn.setVisible(true).text('Start call');
    this.$composerInput.removeAttr('disabled');
    this.$messages.empty();
    this.$placeholder = this.$messages.appendDiv('cw-placeholder').text('Loading…');

    this.api.messages(conv.id, 0)
      .then(messages => {
        if (this.active !== conv) {
          return; // switched away while loading
        }
        this.$messages.empty();
        if (messages.length === 0) {
          this.$messages.appendDiv('cw-placeholder').text('No messages yet — say hello!');
        }
        messages.forEach(m => this._appendMessage(m));
        this.lastTs = messages.reduce((max, m) => Math.max(max, m.ts), 0);
        this._startPolling();
      })
      .catch(err => this._showError(err));
  }

  protected _appendMessage(message: Message): void {
    const own = message.author === this.displayName;
    const $msg = this.$messages.appendDiv('cw-msg');
    $msg.toggleClass('cw-msg-own', own);
    const $head = $msg.appendDiv('cw-msg-head');
    $head.appendElement('<span>', 'cw-msg-author').text(message.author);
    $head.appendElement('<span>', 'cw-msg-time').text(this._time(message.ts));
    $msg.appendDiv('cw-msg-text').text(message.text);
    this.$messages[0].scrollTop = this.$messages[0].scrollHeight;
  }

  protected _onSend(): void {
    if (!this.active) {
      return;
    }
    const text = String(this.$composerInput.val() || '').trim();
    if (!text) {
      return;
    }
    const conv = this.active;
    this.$composerInput.val('');
    this.api.postMessage(conv.id, this.displayName, text)
      .then(msg => {
        if (this.active === conv) {
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
    if (!this.active) {
      return;
    }
    const conv = this.active;
    this.api.messages(conv.id, this.lastTs)
      .then(messages => {
        if (this.active !== conv || messages.length === 0) {
          return;
        }
        const placeholder = this.$messages.children('.cw-placeholder');
        if (placeholder.length) {
          placeholder.remove();
        }
        messages.forEach(m => this._appendMessage(m));
        this.lastTs = messages.reduce((max, m) => Math.max(max, m.ts), this.lastTs);
      })
      .catch(() => { /* transient; next tick retries */ });

    // Refresh the conversation list previews periodically (cheap, keeps the rail live).
    if (++this.convRefreshTick % 4 === 0) {
      this._reloadConversations().catch(() => { /* ignore */ });
    }
  }

  // --- video call -----------------------------------------------------------

  protected _onToggleCall(): void {
    if (this.meeting) {
      this._endCall();
    }
    else {
      this._startCall();
    }
  }

  protected _startCall(): void {
    if (!this.active) {
      return;
    }
    const conv = this.active;
    const apiBase = window.APP_CONFIG?.apiBase || '/api';
    this.meeting = scout.create(LiveKitMeeting, {
      parent: this,
      serverUrl: window.APP_CONFIG?.livekitUrl || 'ws://localhost:7880',
      tokenUrl: `${apiBase}/token`,
      room: conv.id,
      identity: `${this.identity}-${conv.id}`,
      displayName: this.displayName,
      inviteUrl: this._inviteUrl(conv.id),
      chatEnabled: false,
      autoConnect: true
    });
    this.meeting.on('left', () => this._endCall());
    this.$callDock.setVisible(true);
    this.meeting.render(this.$callDock);
    this.$callBtn.text('End call').addClass('cw-call-active');
  }

  protected _endCall(): void {
    if (this.meeting) {
      this.meeting.destroy();
      this.meeting = null;
    }
    this.$callDock.setVisible(false);
    this.$callBtn.text('Start call').removeClass('cw-call-active');
  }

  // --- new group panel ------------------------------------------------------

  protected _toggleNewPanel(): void {
    this.newPanelOpen = !this.newPanelOpen;
    this.$newPanel.setVisible(this.newPanelOpen);
    if (!this.newPanelOpen) {
      return;
    }
    this.$newPanel.empty();
    const $titleInput = this.$newPanel.appendElement('<input>', 'cw-new-title')
      .attr('type', 'text')
      .attr('placeholder', 'Meeting / group name');
    const $members = this.$newPanel.appendDiv('cw-new-members');
    const checked = new Set<string>();
    this.contacts.forEach(contact => {
      const $opt = $members.appendDiv('cw-new-member');
      $opt.appendDiv('cw-avatar cw-avatar-sm').text(this._initials(contact.name))[0].style.background = contact.color;
      $opt.appendElement('<span>', 'cw-new-member-name').text(contact.name);
      $opt.on('click', () => {
        if (checked.has(contact.id)) {
          checked.delete(contact.id);
          $opt.removeClass('cw-checked');
        }
        else {
          checked.add(contact.id);
          $opt.addClass('cw-checked');
        }
      });
    });
    this.$newPanel.appendElement('<button>', 'cw-btn cw-new-create')
      .text('Create')
      .on('click', () => {
        const title = String($titleInput.val() || '').trim() || 'New meeting';
        this.api.createConversation({type: 'group', title, memberIds: Array.from(checked)})
          .then(conv => {
            this.newPanelOpen = false;
            this.$newPanel.setVisible(false);
            return this._reloadConversations().then(() => this._selectConversation(conv));
          })
          .catch(err => this._showError(err));
      });
  }

  // --- helpers --------------------------------------------------------------

  protected _selectFromUrl(): void {
    const id = new URLSearchParams(window.location.search).get('c');
    const conv = id ? this.conversations.find(c => c.id === id) : null;
    if (conv) {
      this._selectConversation(conv);
    }
  }

  protected _updateUrl(conversationId: string): void {
    window.history.replaceState({}, '', this._inviteUrl(conversationId));
  }

  protected _inviteUrl(conversationId: string): string {
    return `${window.location.origin}${window.location.pathname}?c=${encodeURIComponent(conversationId)}`;
  }

  protected _initials(name: string): string {
    return name.split(/\s+/).map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  protected _time(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  protected _readStored(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  protected _store(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch { /* ignore */ }
  }

  protected _showError(err: unknown): void {
    const text = err instanceof Error ? err.message : String(err);
    if (this.$messages) {
      this.$messages.appendDiv('cw-error').text(`Error: ${text}`);
    }
  }
}
