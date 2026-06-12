/** Request payload used to mint a LiveKit join token. */
export interface TokenRequest {
  room: string;
  identity: string;
  name?: string;
}

/** Strategy for obtaining a LiveKit access token. Swap this out to integrate with custom auth. */
export interface TokenProvider {
  fetchToken(req: TokenRequest): Promise<string>;
}

/**
 * Default {@link TokenProvider} that fetches a token from an HTTP endpoint
 * returning `{ token: string }` (e.g. the bundled token-server).
 */
export class HttpTokenProvider implements TokenProvider {

  constructor(protected tokenUrl: string) {
  }

  async fetchToken({room, identity, name}: TokenRequest): Promise<string> {
    const url = new URL(this.tokenUrl, window.location.origin);
    url.searchParams.set('room', room);
    url.searchParams.set('identity', identity);
    if (name) {
      url.searchParams.set('name', name);
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch LiveKit token (HTTP ${res.status})`);
    }
    const body = await res.json();
    if (!body || typeof body.token !== 'string') {
      throw new Error('Token endpoint did not return a token');
    }
    return body.token;
  }
}
