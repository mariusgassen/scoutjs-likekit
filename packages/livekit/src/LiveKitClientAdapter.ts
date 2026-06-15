import {
  ConnectionState,
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track
} from 'livekit-client';

/** Decoded chat message exchanged over the LiveKit data channel. */
export interface ChatMessage {
  name: string;
  text: string;
}

/**
 * Callbacks the {@link LiveKitMeeting} widget registers to react to room events.
 * All DOM work happens in the widget; this adapter only forwards SDK events.
 */
export interface LiveKitAdapterCallbacks {
  onTrackSubscribed?: (track: RemoteTrack, participant: RemoteParticipant) => void;
  onTrackUnsubscribed?: (track: RemoteTrack, participant: RemoteParticipant) => void;
  onLocalTrackPublished?: (publication: LocalTrackPublication) => void;
  onLocalTrackUnpublished?: (publication: LocalTrackPublication) => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  onDataReceived?: (message: ChatMessage, participant?: Participant) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onDisconnected?: () => void;
}

/**
 * Thin wrapper around the vanilla `livekit-client` {@link Room}. Keeps all SDK
 * coupling in one place so the Scout widget stays framework-focused.
 */
export class LiveKitClientAdapter {

  room: Room;
  protected callbacks: LiveKitAdapterCallbacks;
  protected decoder = new TextDecoder();
  protected encoder = new TextEncoder();

  constructor(callbacks: LiveKitAdapterCallbacks = {}) {
    this.callbacks = callbacks;
    this.room = new Room({adaptiveStream: true, dynacast: true});
    this._wireEvents();
  }

  protected _wireEvents(): void {
    this.room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        this.callbacks.onTrackSubscribed?.(track, participant);
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        this.callbacks.onTrackUnsubscribed?.(track, participant);
      })
      .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        this.callbacks.onLocalTrackPublished?.(pub);
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        this.callbacks.onLocalTrackUnpublished?.(pub);
      })
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        this.callbacks.onParticipantConnected?.(participant);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        this.callbacks.onParticipantDisconnected?.(participant);
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        this.callbacks.onConnectionStateChanged?.(state);
      })
      .on(RoomEvent.Disconnected, () => {
        this.callbacks.onDisconnected?.();
      })
      .on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const message = JSON.parse(this.decoder.decode(payload)) as ChatMessage;
          this.callbacks.onDataReceived?.(message, participant);
        } catch {
          // ignore non-JSON data packets
        }
      });
  }

  async connect(serverUrl: string, token: string): Promise<void> {
    await this.room.connect(serverUrl, token);
  }

  async enableCameraAndMicrophone(): Promise<void> {
    await this.room.localParticipant.enableCameraAndMicrophone();
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(enabled);
  }

  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setScreenShareEnabled(enabled);
  }

  isMicrophoneEnabled(): boolean {
    return this.room.localParticipant.isMicrophoneEnabled;
  }

  isCameraEnabled(): boolean {
    return this.room.localParticipant.isCameraEnabled;
  }

  isScreenShareEnabled(): boolean {
    return this.room.localParticipant.isScreenShareEnabled;
  }

  async sendChat(message: ChatMessage): Promise<void> {
    const data = this.encoder.encode(JSON.stringify(message));
    await this.room.localParticipant.publishData(data, {reliable: true});
  }

  /** Returns currently subscribed remote tracks, used to (re-)attach after a widget re-render. */
  forEachSubscribedTrack(fn: (track: RemoteTrack, participant: RemoteParticipant) => void): void {
    this.room.remoteParticipants.forEach(participant => {
      participant.trackPublications.forEach(pub => {
        if (pub.isSubscribed && pub.track) {
          fn(pub.track as RemoteTrack, participant);
        }
      });
    });
  }

  /** Returns the local video/screen-share track publications for (re-)attaching local tiles. */
  localVideoPublications(): LocalTrackPublication[] {
    const result: LocalTrackPublication[] = [];
    this.room.localParticipant.trackPublications.forEach(pub => {
      if (pub.track && pub.track.kind === Track.Kind.Video) {
        result.push(pub);
      }
    });
    return result;
  }

  /** Total participants currently in the room, including the local participant. */
  participantCount(): number {
    return this.room.remoteParticipants.size + 1;
  }

  async disconnect(): Promise<void> {
    await this.room.disconnect();
  }
}
