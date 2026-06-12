import {HtmlComponent, InitModelOf, Widget} from '@eclipse-scout/core';
import {LocalTrackPublication, Participant, RemoteParticipant, RemoteTrack, Track} from 'livekit-client';
import {LiveKitMeetingModel} from './LiveKitMeetingModel.js';
import {ChatMessage, LiveKitClientAdapter} from './LiveKitClientAdapter.js';
import {HttpTokenProvider, TokenProvider} from './TokenProvider.js';

/**
 * Reusable Scout JS widget that starts/joins a LiveKit meeting.
 *
 * Lifecycle:
 *  - `_render()` builds the Scout-managed DOM (video grid, control bar, chat) and,
 *    when `autoConnect` is set, connects to the room.
 *  - LiveKit `track.attach()` returns raw `<video>/<audio>` nodes which are appended
 *    *into* Scout-created container divs. Scout never re-renders those children.
 *  - `_remove()` disconnects and detaches all media so the camera/mic are released.
 */
export class LiveKitMeeting extends Widget {
  declare model: LiveKitMeetingModel;

  serverUrl = '';
  tokenUrl = '/api/token';
  room = '';
  identity = '';
  displayName = '';
  autoConnect = false;
  connected = false;

  tokenProvider!: TokenProvider;
  protected adapter: LiveKitClientAdapter | null = null;

  /** Maps a tile key (participant.sid + source) to the tile container element. */
  protected tiles = new Map<string, JQuery>();

  protected $grid!: JQuery;
  protected $controls!: JQuery;
  protected $audioSink!: JQuery;
  protected $status!: JQuery;
  protected $chat!: JQuery;
  protected $chatMessages!: JQuery;
  protected $chatInput!: JQuery;
  protected $micBtn!: JQuery;
  protected $camBtn!: JQuery;
  protected $screenBtn!: JQuery;

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    this.tokenProvider = this.tokenProvider || new HttpTokenProvider(this.tokenUrl);
  }

  protected override _render(): void {
    this.$container = this.$parent.appendDiv('livekit-meeting');
    this.htmlComp = HtmlComponent.install(this.$container, this.session);

    this.$status = this.$container.appendDiv('lk-status');
    this.$grid = this.$container.appendDiv('lk-grid');
    this.$audioSink = this.$container.appendDiv('lk-audio-sink'); // hidden audio elements live here

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
    this.$controls.appendElement('<button>', 'lk-btn lk-leave')
      .text('Leave')
      .on('click', this._onLeave.bind(this));

    this._renderChat();

    if (this.autoConnect) {
      this.connect();
    }
  }

  protected _renderChat(): void {
    this.$chat = this.$container.appendDiv('lk-chat');
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
        onParticipantDisconnected: participant => this._removeParticipantTiles(participant),
        onDataReceived: (message, participant) => this._onChatReceived(message, participant),
        onDisconnected: () => this._onRoomDisconnected()
      });

      await this.adapter.connect(this.serverUrl, token);
      await this.adapter.enableCameraAndMicrophone();

      this.connected = true;
      this._setStatus(`Connected to "${this.room}" as ${this.displayName || this.identity}`);
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
    if (this.$audioSink) {
      this.$audioSink.empty();
    }
    this.connected = false;
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
    this._renderVideoTile(this._tileKey(participant.sid, track.source), track, participant.name || participant.identity, false);
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
    const sid = this.adapter.room.localParticipant.sid;
    const mirror = pub.source === Track.Source.Camera;
    this._renderVideoTile(this._tileKey(sid, pub.source), pub.track as unknown as RemoteTrack, 'You', mirror);
  }

  protected _onLocalTrackUnpublished(pub: LocalTrackPublication): void {
    if (!this.adapter) {
      return;
    }
    if (pub.track) {
      pub.track.detach();
    }
    const sid = this.adapter.room.localParticipant.sid;
    this._removeTile(this._tileKey(sid, pub.source));
  }

  protected _renderVideoTile(key: string, track: RemoteTrack, label: string, mirror: boolean): void {
    if (!this.rendered) {
      return;
    }
    this._removeTile(key); // replace any stale element for this key
    const $tile = this.$grid.appendDiv('lk-tile');
    if (mirror) {
      $tile.addClass('lk-mirror');
    }
    const videoEl = track.attach();
    $tile[0].appendChild(videoEl);
    $tile.appendDiv('lk-tile-label').text(label);
    this.tiles.set(key, $tile);
  }

  protected _removeTile(key: string): void {
    const $tile = this.tiles.get(key);
    if ($tile) {
      $tile.remove();
      this.tiles.delete(key);
    }
  }

  protected _removeParticipantTiles(participant: Participant): void {
    this.tiles.forEach(($tile, key) => {
      if (key.startsWith(`${participant.sid}:`)) {
        $tile.remove();
        this.tiles.delete(key);
      }
    });
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

  // --- chat -----------------------------------------------------------------

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
  }

  protected _appendChatMessage(message: ChatMessage, own: boolean): void {
    if (!this.$chatMessages) {
      return;
    }
    const $msg = this.$chatMessages.appendDiv('lk-msg');
    $msg.toggleClass('lk-msg-own', own);
    $msg.appendElement('<span>', 'lk-msg-name').text(message.name);
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
