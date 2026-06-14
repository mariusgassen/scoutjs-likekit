/** Typed client for the Scout meeting-server REST API. */

export interface Contact {
  id: string;
  name: string;
  email: string;
  status: string;
  color: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  memberIds: string[];
  memberCount: number;
  lastMessage: string | null;
  lastAuthor: string | null;
  lastTs: number;
}

export interface Message {
  id: string;
  conversationId: string;
  author: string;
  text: string;
  ts: number;
}

export interface NewConversation {
  type: 'direct' | 'group';
  title: string;
  memberIds: string[];
}

/**
 * Thin fetch wrapper. Unsafe methods send the `X-Requested-With` header the Scout
 * {@code AntiCsrfContainerFilter} requires.
 */
export class MeetingApi {

  constructor(protected base: string = window.APP_CONFIG?.apiBase || '/api') {
  }

  contacts(): Promise<Contact[]> {
    return this._get('/contacts');
  }

  conversations(): Promise<Conversation[]> {
    return this._get('/conversations');
  }

  createConversation(req: NewConversation): Promise<Conversation> {
    return this._send('POST', '/conversations', req);
  }

  messages(conversationId: string, after = 0): Promise<Message[]> {
    return this._get(`/conversations/${encodeURIComponent(conversationId)}/messages?after=${after}`);
  }

  postMessage(conversationId: string, author: string, text: string): Promise<Message> {
    return this._send('POST', `/conversations/${encodeURIComponent(conversationId)}/messages`, {author, text});
  }

  protected async _get<T>(path: string): Promise<T> {
    const res = await fetch(this.base + path, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
    if (!res.ok) {
      throw new Error(`GET ${path} failed (HTTP ${res.status})`);
    }
    return res.json() as Promise<T>;
  }

  protected async _send<T>(method: string, path: string, body: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(`${method} ${path} failed (HTTP ${res.status})`);
    }
    return res.json() as Promise<T>;
  }
}
