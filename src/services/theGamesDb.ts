export interface TheGamesDbGameMatch {
  id: number;
  title: string;
  releaseDate?: string;
  year?: number;
  description: string;
  publisher: string;
  developer: string;
  platform: string;
  frontImage?: string;
  backImage?: string;
  images: string[];
}

export async function searchTheGamesDbGames(name: string): Promise<TheGamesDbGameMatch[]> {
  if (!window.electronAPI?.searchTheGamesDb) {
    throw new Error("A busca do TheGamesDB está disponível no aplicativo desktop.");
  }
  return window.electronAPI.searchTheGamesDb({ name });
}
