import {HtmlComponent, InitModelOf, Widget} from '@eclipse-scout/core';
import {LocalTrackPublication, Participant, RemoteParticipant, RemoteTrack, Track} from 'livekit-client';
import {LiveKitMeetingModel} from './LiveKitMeetingModel.js';
import {ChatMessage, LiveKitClientAdapter} from './LiveKitClientAdapter.js';
import {HttpTokenProvider, TokenProvider} from './TokenProvider.js';

/**
 * Reusable Scout JS widget that starts/joins a LiveKit meeting.
 *
 * Layout:
 *  - a header bar with the room name, live participant count and (optionally) a
 *    "copy invite link" button,
 *  - a stage holding the remote-participant video grid with the local camera
 *    shown as a floating self-view (picture-in-picture),
 *  - a collapsible side chat panel with an unread badge, and
 *  - a bottom control bar (mic, camera, screen share, chat toggle, leave).
 *
 * LiveKit `track.attach()` returns raw `<video>/<audio>` nodes which are appended
 * *into* Scout-created container divs; Scout never re-renders those children.
 * `_remove()` disconnects and detaches all media so the camera/mic are released.
 */
export class LiveKitMeeting extends Widget {
  declare model: LiveKitMeetingModel;

  serverUrl = '';
  tokenUrl = '/api/token';
  room = '';
  identity = '';
  displayName = '';
  autoConnect = false;
  chatEnabled = true;
  inviteUrl = '';
  connected = false;

  /** Whether the chat side panel is expanded. */
  chatVisible = false;
  /** Chat messages received while the panel is collapsed. */
  protected unreadCount = 0;

  tokenProvider!: TokenProvider;
  protected adapter: LiveKitClientAdapter | null = null;

  /** Maps a grid tile key (participant.sid + source) to its container element. */
  protected tiles = new Map<string, JQuery>();

  protected $header!: JQuery;
  protected $roomTitle!: JQuery;
  protected $status!: JQuery;
  protected $inviteBtn!: JQuery;
  protected $body!: JQuery;
  protected $stage!: JQuery;
  protected $grid!: JQuery;
  protected $empty!: JQuery;
  protected $selfView!: JQuery;
  protected $audioSink!: JQuery;
  protected $controls!: JQuery;
  protected $chat!: JQuery;
  protected $chatMessages!: JQuery;
  protected $chatInput!: JQuery;
  protected $micBtn!: JQuery;
  protected $camBtn!: JQuery;
  protected $screenBtn!: JQuery;
  protected $chatBtn!: JQuery;
  protected $chatBadge!: JQuery;

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    this.tokenProvider = this.tokenProvider || new HttpTokenProvider(this.tokenUrl);
  }

  protected override _render(): void {
    this.$container = this.$parent.appendDiv('livekit-meeting');
    this.htmlComp = HtmlComponent.install(this.$container, this.session);

    this._renderHeader();
    this._renderBody();

    this.$audioSink = this.$container.appendDiv('lk-audio-sink'); // hidden audio elements live here
    this._renderControls();

    this.$container.toggleClass('lk-chat-open', this.chatVisible);

    if (this.autoConnect) {
      this.connect();
    }
  }

  protected _renderHeader(): void {
    this.$header = this.$container.appendDiv('lk-header');
    const $info = this.$header.appendDiv('lk-header-info');
    this.$roomTitle = $info.appendDiv('lk-room-title').text(this.room || 'Meeting');
    this.$status = $info.appendDiv('lk-status').text('Not connected');

    const $actions = this.$header.appendDiv('lk-header-actions');
    this.$inviteBtn = $actions.appendElement('<button>', 'lk-btn lk-invite')
      .text('Copy invite link')
      .on('click', this._onCopyInvite.bind(this));
    this.$inviteBtn.setVisible(!!this.inviteUrl);
  }

  protected _renderBody(): void {
    this.$body = this.$container.appendDiv('lk-body');

    this.$stage = this.$body.appendDiv('lk-stage');
    this.$grid = this.$stage.appendDiv('lk-grid');
    this.$empty = this.$grid.appendDiv('lk-empty')
      .text('Waiting for others to join…');

    // Floating self-view (picture-in-picture). Starts as a "camera off" placeholder.
    this.$selfView = this.$stage.appendDiv('lk-selfview');
    this._clearSelfView();

    if (this.chatEnabled) {
      this._renderChat();
    }
  }

  protected _renderChat(): void {
    this.$chat = this.$body.appendDiv('lk-chat');
    const $chatHeader = this.$chat.appendDiv('lk-chat-header');
    $chatHeader.appendElement('<span>', 'lk-chat-title').text('Chat');
    $chatHeader.appendElement('<button>', 'lk-chat-close')
      .text('×')
      .on('click', () => this.setChatVisible(false));

    this.$chatMessages = this.$chat.appendDiv('lk-chat-messages');
    const $row = this.$chat.appendDiv('lk-chat-row');
    this.$chatInput = $row.appendElement('<input>', 'lk-chat-input')
      .attr('type', 'text')
      .attr('placeholder', 'Type a message…')
      .on('keydown', (event: JQuery.KeyDownEvent) => {
        if (event.which === 13) { // Enter
          this._onSendChat();
        }
      });
    $row.appendElement('<button>', 'lk-btn lk-chat-send')
      .text('Send')
      .on('click', this._onSendChat.bind(this));
  }

  protected _renderControls(): void {
    this.$controls = this.$container.appendDiv('lk-controls');
    this.$micBtn = this.$controls.appendElement('<button>', 'lk-btn lk-mic')
      .text('Mute mic')
      .on('click', this._onToggleMic.bind(this));
    this.$camBtn = this.$controls.appendElement('<button>', 'lk-btn lk-cam')
      .text('Stop camera')
      .on('click', this._onToggleCamera.bind(this));
    this.$screenBtn = this.$controls.appendElement('<button>', 'lk-btn lk-screen')
      .text('Share screen')
      .on('click', this._onToggleScreenShare.bind(this));

    this.$controls.appendDiv('lk-controls-spacer');

    if (this.chatEnabled) {
      this.$chatBtn = this.$controls.appendElement('<button>', 'lk-btn lk-chat-toggle')
        .on('click', () => this.setChatVisible(!this.chatVisible));
      this.$chatBtn.appendElement('<span>', 'lk-chat-toggle-label').text('Chat');
      this.$chatBadge = this.$chatBtn.appendElement('<span>', 'lk-chat-badge');
      this._updateChatToggle();
    }

    this.$controls.appendElement('<button>', 'lk-btn lk-leave')
      .text('Leave')
      .on('click', this._onLeave.bind(this));
  }

  protected override _remove(): void {
    this.disconnect();
    super._remove();
  }

  // --- connection lifecycle -------------------------------------------------

  async connect(): Promise<void> {
    if (this.connected || !this.room || !this.identity) {
      return;
    }
    this._setStatus(`Connecting to "${this.room}"…`);
    try {
      const token = await this.tokenProvider.fetchToken({
        room: this.room,
        identity: this.identity,
        name: this.displayName || this.identity
      });

      this.adapter = new LiveKitClientAdapter({
        onTrackSubscribed: (track, participant) => this._onTrackSubscribed(track, participant),
        onTrackUnsubscribed: (track, participant) => this._onTrackUnsubscribed(track, participant),
        onLocalTrackPublished: pub => this._onLocalTrackPublished(pub),
        onLocalTrackUnpublished: pub => this._onLocalTrackUnpublished(pub),
        onParticipantConnected: () => this._updateParticipantCount(),
        onParticipantDisconnected: participant => this._onParticipantDisconnected(participant),
        onDataReceived: (message, participant) => this._onChatReceived(message, participant),
        onDisconnected: () => this._onRoomDisconnected()
      });

      await this.adapter.connect(this.serverUrl, token);
      await this.adapter.enableCameraAndMicrophone();

      this.connected = true;
      this._updateParticipantCount();
      this.trigger('joined');
    } catch (error) {
      this._setStatus(`Failed to connect: ${error instanceof Error ? error.message : error}`);
      this.trigger('error', {error});
    }
  }

  disconnect(): void {
    if (this.adapter) {
      this.adapter.disconnect();
      this.adapter = null;
    }
    this.tiles.forEach($tile => $tile.remove());
    this.tiles.clear();
    if (this.$selfView) {
      this._clearSelfView();
    }
    if (this.$audioSink) {
      this.$audioSink.empty();
    }
    this.connected = false;
    this._updateEmptyState();
  }

  protected _onRoomDisconnected(): void {
    this.connected = false;
    this._setStatus('Disconnected');
  }

  // --- track <-> DOM bridge -------------------------------------------------

  protected _tileKey(sid: string, source: Track.Source | string): string {
    return `${sid}:${source}`;
  }

  protected _onTrackSubscribed(track: RemoteTrack, participant: RemoteParticipant): void {
    if (track.kind === Track.Kind.Audio) {
      const audioEl = track.attach();
      this.$audioSink[0].appendChild(audioEl);
      return;
    }
    const label = participant.name || participant.identity;
    const screen = track.source === Track.Source.ScreenShare;
    this._renderGridTile(this._tileKey(participant.sid, track.source), track, label, {screen});
  }

  protected _onTrackUnsubscribed(track: RemoteTrack, participant: RemoteParticipant): void {
    track.detach(); // removes media element from DOM
    if (track.kind === Track.Kind.Video) {
      this._removeTile(this._tileKey(participant.sid, track.source));
    }
  }

  protected _onLocalTrackPublished(pub: LocalTrackPublication): void {
    if (!this.adapter || !pub.track || pub.track.kind !== Track.Kind.Video) {
      return;
    }
    if (pub.source === Track.Source.Camera) {
      this._renderSelfView(pub.track as unknown as RemoteTrack);
      return;
    }
    const sid = this.adapter.room.localParticipant.sid;
    this._renderGridTile(this._tileKey(sid, pub.source), pub.track as unknown as RemoteTrack, 'You · screen', {screen: true});
  }

  protected _onLocalTrackUnpublished(pub: LocalTrackPublication): void {
    if (!this.adapter) {
      return;
    }
    if (pub.track) {
      pub.track.detach();
    }
    if (pub.source === Track.Source.Camera) {
      this._clearSelfView();
      return;
    }
    const sid = this.adapter.room.localParticipant.sid;
    this._removeTile(this._tileKey(sid, pub.source));
  }

  /** Renders a remote participant or screen-share tile into the main grid. */
  protected _renderGridTile(key: string, track: RemoteTrack, label: string, opts: {screen?: boolean} = {}): void {
    if (!this.rendered) {
      return;
    }
    this._removeTile(key); // replace any stale element for this key
    const $tile = this.$grid.appendDiv('lk-tile');
    if (opts.screen) {
      $tile.addClass('lk-tile-screen');
    }
    const videoEl = track.attach();
    $tile[0].appendChild(videoEl);
    $tile.appendDiv('lk-tile-label').text(label);
    this.tiles.set(key, $tile);
    this._updateEmptyState();
  }

  /** Renders the local camera as the floating self-view. */
  protected _renderSelfView(track: RemoteTrack): void {
    if (!this.rendered) {
      return;
    }
    this.$selfView.empty().removeClass('lk-selfview-off').addClass('lk-mirror');
    const videoEl = track.attach();
    this.$selfView[0].appendChild(videoEl);
    this.$selfView.appendDiv('lk-tile-label').text('You');
  }

  /** Resets the self-view to a "camera off" placeholder. */
  protected _clearSelfView(): void {
    this.$selfView.empty().removeClass('lk-mirror').addClass('lk-selfview-off');
    this.$selfView.appendDiv('lk-selfview-avatar').text('You');
    this.$selfView.appendDiv('lk-tile-label').text('Camera off');
  }

  protected _removeTile(key: string): void {
    const $tile = this.tiles.get(key);
    if ($tile) {
      $tile.remove();
      this.tiles.delete(key);
      this._updateEmptyState();
    }
  }

  protected _onParticipantDisconnected(participant: Participant): void {
    this.tiles.forEach(($tile, key) => {
      if (key.startsWith(`${participant.sid}:`)) {
        $tile.remove();
        this.tiles.delete(key);
      }
    });
    this._updateEmptyState();
    this._updateParticipantCount();
  }

  /** Shows the "waiting for others" placeholder when no remote/screen tiles are present. */
  protected _updateEmptyState(): void {
    if (!this.$empty) {
      return;
    }
    this.$empty.setVisible(this.tiles.size === 0);
  }

  protected _updateParticipantCount(): void {
    if (!this.connected || !this.adapter) {
      return;
    }
    const count = this.adapter.participantCount();
    const who = count === 1 ? '1 participant' : `${count} participants`;
    this._setStatus(`Connected · ${who}`);
  }

  // --- control handlers -----------------------------------------------------

  protected _onToggleMic(): void {
    if (!this.adapter) {
      return;
    }
    const enabled = !this.adapter.isMicrophoneEnabled();
    this.adapter.setMicrophoneEnabled(enabled);
    this.$micBtn.toggleClass('lk-off', !enabled).text(enabled ? 'Mute mic' : 'Unmute mic');
  }

  protected _onToggleCamera(): void {
    if (!this.adapter) {
      return;
    }
    const enabled = !this.adapter.isCameraEnabled();
    this.adapter.setCameraEnabled(enabled);
    this.$camBtn.toggleClass('lk-off', !enabled).text(enabled ? 'Stop camera' : 'Start camera');
  }

  protected _onToggleScreenShare(): void {
    if (!this.adapter) {
      return;
    }
    const enabled = !this.adapter.isScreenShareEnabled();
    this.adapter.setScreenShareEnabled(enabled)
      .then(() => this.$screenBtn.toggleClass('lk-on', enabled).text(enabled ? 'Stop sharing' : 'Share screen'))
      .catch(() => { /* user cancelled the picker */ });
  }

  protected _onLeave(): void {
    this.disconnect();
    this.trigger('left');
  }

  protected _onCopyInvite(): void {
    if (!this.inviteUrl) {
      return;
    }
    const done = () => {
      const original = 'Copy invite link';
      this.$inviteBtn.text('Copied!').addClass('lk-on');
      setTimeout(() => {
        if (this.$inviteBtn) {
          this.$inviteBtn.text(original).removeClass('lk-on');
        }
      }, 1500);
    };
    const clipboard = navigator.clipboard;
    if (clipboard && clipboard.writeText) {
      clipboard.writeText(this.inviteUrl).then(done).catch(() => this._fallbackCopy(done));
    } else {
      this._fallbackCopy(done);
    }
  }

  protected _fallbackCopy(done: () => void): void {
    const input = document.createElement('input');
    input.value = this.inviteUrl;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      done();
    } finally {
      document.body.removeChild(input);
    }
  }

  // --- chat -----------------------------------------------------------------

  setChatVisible(visible: boolean): void {
    this.chatVisible = visible;
    if (visible) {
      this.unreadCount = 0;
    }
    if (this.rendered) {
      this.$container.toggleClass('lk-chat-open', visible);
      this._updateChatToggle();
      if (visible && this.$chatInput) {
        this.$chatInput.focus();
        this.$chatMessages[0].scrollTop = this.$chatMessages[0].scrollHeight;
      }
    }
  }

  protected _updateChatToggle(): void {
    if (!this.$chatBtn) {
      return;
    }
    this.$chatBtn.toggleClass('lk-on', this.chatVisible);
    const hasUnread = this.unreadCount > 0;
    this.$chatBadge.setVisible(hasUnread);
    if (hasUnread) {
      this.$chatBadge.text(this.unreadCount > 9 ? '9+' : String(this.unreadCount));
    }
  }

  protected _onSendChat(): void {
    if (!this.adapter || !this.connected) {
      return;
    }
    const text = String(this.$chatInput.val() || '').trim();
    if (!text) {
      return;
    }
    const message: ChatMessage = {name: this.displayName || this.identity, text};
    this.adapter.sendChat(message);
    this._appendChatMessage(message, true);
    this.$chatInput.val('');
  }

  protected _onChatReceived(message: ChatMessage, _participant?: Participant): void {
    this._appendChatMessage(message, false);
    if (!this.chatVisible) {
      this.unreadCount++;
      this._updateChatToggle();
    }
  }

  protected _appendChatMessage(message: ChatMessage, own: boolean): void {
    if (!this.$chatMessages) {
      return;
    }
    const $msg = this.$chatMessages.appendDiv('lk-msg');
    $msg.toggleClass('lk-msg-own', own);
    $msg.appendElement('<span>', 'lk-msg-name').text(own ? 'You' : message.name);
    $msg.appendElement('<span>', 'lk-msg-text').text(message.text);
    this.$chatMessages[0].scrollTop = this.$chatMessages[0].scrollHeight;
  }

  // --- misc -----------------------------------------------------------------

  protected _setStatus(text: string): void {
    if (this.$status) {
      this.$status.text(text);
    }
  }
}
