export {};

declare global {
  interface Window {
    APP_CONFIG?: {
      livekitUrl?: string;
    };
  }
}
