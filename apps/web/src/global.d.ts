export {};

declare global {
  interface Window {
    APP_CONFIG?: {
      livekitUrl?: string;
      /** Base URL of the meeting-server REST API. Defaults to `/api` (same-origin via nginx). */
      apiBase?: string;
    };
  }
}
