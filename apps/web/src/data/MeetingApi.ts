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

/** A full-text search hit: a matching message plus enough of its conversation to navigate to it. */
export interface MessageHit {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  conversationType: 'direct' | 'group';
  memberCount: number;
  author: string;
  /** A highlighted excerpt; matching terms are wrapped in `[..]` (PostgreSQL `ts_headline`). */
  snippet: string;
  ts: number;
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

  /** Returns the existing direct conversation with the given contact, or creates one on the fly. */
  ensureDirectConversation(contact: Contact): Promise<Conversation> {
    return this.conversations().then(list => {
      const existing = list.find(c => c.type === 'direct' && c.memberIds.length === 1 && c.memberIds[0] === contact.id);
      if (existing) {
        return existing;
      }
      return this.createConversation({type: 'direct', title: contact.name, memberIds: [contact.id]});
    });
  }

  messages(conversationId: string, after = 0): Promise<Message[]> {
    return this._get(`/conversations/${encodeURIComponent(conversationId)}/messages?after=${after}`);
  }

  postMessage(conversationId: string, author: string, text: string): Promise<Message> {
    return this._send('POST', `/conversations/${encodeURIComponent(conversationId)}/messages`, {author, text});
  }

  /** PostgreSQL full-text search across all messages (`websearch_to_tsquery` syntax). */
  searchMessages(query: string, limit = 30): Promise<MessageHit[]> {
    return this._get(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
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

/** Single shared API client for the whole app. */
export const meetingApi = new MeetingApi();
