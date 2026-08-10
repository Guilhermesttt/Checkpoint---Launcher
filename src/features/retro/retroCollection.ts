import godOfWarCover from "../../assets/Retro_Capes/PS2/God of War - Box Front.png";

export interface RetroGame {
  id: string;
  title: string;
  subtitle: string;
  year: number;
  console: string;
  publisher: string;
  accent: string;
  coverImage?: string;
}

export interface RetroFilter {
  id: string;
  label: string;
  startYear?: number;
  endYear?: number;
}

export const RETRO_FILTERS: RetroFilter[] = [
  { id: "ALL", label: "TODOS" },
  { id: "1980s", label: "1980s", startYear: 1980, endYear: 1990 },
  { id: "1990s", label: "1990s", startYear: 1990, endYear: 2000 },
  { id: "2000s", label: "2000s", startYear: 2000, endYear: 2010 },
  { id: "2010s", label: "2010s", startYear: 2010, endYear: 2020 },
  { id: "2020s", label: "2020s", startYear: 2020, endYear: 2030 },
];

export const RETRO_COLLECTION: RetroGame[] = [
  {
    id: "gow",
    title: "God of War",
    subtitle: "EDIÇÃO CLÁSSICA PLAYSTATION 2",
    year: 2005,
    console: "PS2",
    publisher: "SONY COMPUTER ENTERTAINMENT",
    accent: "#b52322",
    coverImage: godOfWarCover,
  },
  {
    id: "sotn",
    title: "Castlevania: Symphony of the Night",
    subtitle: "A NOITE RECOMEÇA",
    year: 1997,
    console: "PS1",
    publisher: "KONAMI",
    accent: "#ddd8ca",
  },
  {
    id: "smw",
    title: "Super Mario World",
    subtitle: "SUPER MARIO BROS. 4",
    year: 1990,
    console: "SNES",
    publisher: "NINTENDO",
    accent: "#b52322",
  },
  {
    id: "chrono",
    title: "Chrono Trigger",
    subtitle: "UMA JORNADA ATRAVÉS DO TEMPO",
    year: 1995,
    console: "SNES",
    publisher: "SQUARE",
    accent: "#ddd8ca",
  },
  {
    id: "san-andreas",
    title: "Grand Theft Auto: San Andreas",
    subtitle: "WELCOME TO LOS SANTOS",
    year: 2004,
    console: "PS2",
    publisher: "ROCKSTAR GAMES",
    accent: "#b52322",
  },
  {
    id: "tekken-3",
    title: "Tekken 3",
    subtitle: "THE KING OF IRON FIST TOURNAMENT",
    year: 1998,
    console: "PS1",
    publisher: "NAMCO",
    accent: "#ddd8ca",
  },
  {
    id: "silent-hill-2",
    title: "Silent Hill 2",
    subtitle: "IN MY RESTLESS DREAMS",
    year: 2001,
    console: "PS2",
    publisher: "KONAMI",
    accent: "#8f9390",
  },
  {
    id: "zelda-totk",
    title: "The Legend of Zelda: Tears of the Kingdom",
    subtitle: "THE UPHEAVAL",
    year: 2023,
    console: "SWITCH",
    publisher: "NINTENDO",
    accent: "#ddd8ca",
  },
];

export function filterRetroGames<T extends Pick<RetroGame, "year">>(
  games: T[],
  filterId: string,
): T[] {
  if (filterId === "ALL") return games;

  const filter = RETRO_FILTERS.find((candidate) => candidate.id === filterId);
  if (!filter || filter.startYear === undefined || filter.endYear === undefined) return games;

  return games.filter((game) => game.year >= filter.startYear! && game.year < filter.endYear!);
}

export function getWrappedIndex(index: number, direction: -1 | 1, length: number): number {
  if (length <= 0) return 0;
  return (index + direction + length) % length;
}

export function getSelectionAtFilterChange<T extends Pick<RetroGame, "year">>(
  games: T[],
  filterId: string,
): { games: T[]; selectedIndex: number } {
  return {
    games: filterRetroGames(games, filterId),
    selectedIndex: 0,
  };
}
