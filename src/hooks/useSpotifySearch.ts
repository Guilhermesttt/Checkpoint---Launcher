import * as React from "react";
import type { SpotifyTrack } from "../services/spotify";

export const useSpotifySearch = (
  search: (query: string) => Promise<SpotifyTrack[]>,
) => {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SpotifyTrack[]>([]);
  const [status, setStatus] = React.useState<"idle" | "searching" | "error">("idle");
  const [error, setError] = React.useState("");
  const generationRef = React.useRef(0);

  React.useEffect(() => {
    const normalized = query.trim();
    const generation = ++generationRef.current;
    if (normalized.length < 2) {
      setResults([]);
      setStatus("idle");
      setError("");
      return;
    }

    const timer = window.setTimeout(() => {
      setStatus("searching");
      setError("");
      void search(normalized).then(
        (tracks) => {
          if (generation !== generationRef.current) return;
          setResults(tracks);
          setStatus("idle");
        },
        (reason) => {
          if (generation !== generationRef.current) return;
          setStatus("error");
          setError(reason instanceof Error ? reason.message : String(reason));
        },
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  return { query, setQuery, results, status, error };
};
