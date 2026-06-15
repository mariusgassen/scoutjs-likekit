/**
 * Process-wide identity of the current (anonymous) user.
 *
 * The app has no login; a stable random {@link identity} is generated once per browser and the
 * human-readable {@link displayName} can be edited from the desktop header. Both are persisted in
 * {@code localStorage} so they survive reloads. Pages, forms and the LiveKit call all read the same
 * singleton, and {@link onChange} lets widgets react when the name is edited.
 */
export class UserIdentity {

  protected static _ID_KEY = 'scoutkit.id';
  protected static _NAME_KEY = 'scoutkit.name';

  readonly identity: string;
  protected _displayName: string;
  protected _listeners: ((displayName: string) => void)[] = [];

  constructor() {
    this.identity = this._read(UserIdentity._ID_KEY) || `u-${Math.random().toString(36).slice(2, 10)}`;
    this._store(UserIdentity._ID_KEY, this.identity);
    this._displayName = this._read(UserIdentity._NAME_KEY) || `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  get displayName(): string {
    return this._displayName;
  }

  setDisplayName(name: string): void {
    const trimmed = (name || '').trim();
    if (!trimmed || trimmed === this._displayName) {
      return;
    }
    this._displayName = trimmed;
    this._store(UserIdentity._NAME_KEY, trimmed);
    this._listeners.forEach(cb => cb(trimmed));
  }

  onChange(cb: (displayName: string) => void): void {
    this._listeners.push(cb);
  }

  offChange(cb: (displayName: string) => void): void {
    this._listeners = this._listeners.filter(l => l !== cb);
  }

  protected _read(key: string): string | null {
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
}

/** Shared identity instance used across the whole app. */
export const userIdentity = new UserIdentity();
