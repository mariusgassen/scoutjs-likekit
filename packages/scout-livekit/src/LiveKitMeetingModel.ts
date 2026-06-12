import {WidgetModel} from '@eclipse-scout/core';

/**
 * Configuration model for {@link LiveKitMeeting}.
 */
export interface LiveKitMeetingModel extends WidgetModel {
  /** wss/ws URL of the LiveKit server, e.g. `wss://livekit.example.com`. */
  serverUrl?: string;
  /** Endpoint that mints a join token. Receives `room`, `identity` and `name` as query params. Default `/api/token`. */
  tokenUrl?: string;
  /** Name of the room to start/join. */
  room?: string;
  /** Unique participant identity within the room. */
  identity?: string;
  /** Human-readable display name shown to other participants. */
  displayName?: string;
  /** Connect automatically once the widget is rendered. Default `false`. */
  autoConnect?: boolean;
}
