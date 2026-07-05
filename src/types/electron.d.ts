export {};

declare global {
  interface Window {
    electronAPI?: {
      launchExecutable: (executablePath: string) => Promise<void>;
      startGoogleBrowserAuth: () => Promise<{ state: string }>;
      openExternalUrl: (url: string) => Promise<void>;
      scanLocalGames: () => Promise<Array<{ name: string; path: string }>>;
    };
  }
}
