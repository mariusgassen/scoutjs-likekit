# @scoutkit/livekit

Reusable [Eclipse Scout JS](https://eclipse.dev/scout/) widget for starting and joining
[LiveKit](https://livekit.io/) video meetings.

Scout JS is not React, so this package uses the vanilla `livekit-client` SDK and bridges
LiveKit's media elements into Scout-managed DOM inside a custom `Widget`.

## Install

```bash
npm install @scoutkit/livekit @eclipse-scout/core livekit-client
```

`@eclipse-scout/core` is a **peer dependency** — the consuming app must provide the single
Scout core instance.

## Usage

```ts
import {LiveKitMeeting} from '@scoutkit/livekit';

const meeting = scout.create(LiveKitMeeting, {
  parent: this,
  serverUrl: 'wss://livekit.example.com', // LiveKit signaling URL
  tokenUrl: '/api/token',                  // endpoint returning { token }
  room: 'demo',
  identity: 'alice-1234',                  // unique per participant
  displayName: 'Alice',
  autoConnect: true
});
```

The widget renders a participant video grid, a control bar (mic / camera / screen-share /
leave) and a data-channel text chat. It emits `joined`, `left` and `error` events.

### Token endpoint

`tokenUrl` must return `{ "token": "<jwt>" }` for `GET ?room=&identity=&name=`. The bundled
`services/scoutkit-server` (Eclipse Scout RT, minting the JWT in Java) is a reference
implementation.

### Styling

This package ships its styles as `src/LiveKitMeeting.less`. `@import` it from your app's
theme entry (the package is built with `tsc`, so the `.less` is not bundled by the library):

```less
@import "~@scoutkit/livekit/src/LiveKitMeeting.less";
```
