import { Router } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTheGamesDbClient } = require("../electron/thegamesdb.cjs");

export function createTheGamesDbRouter({ apiKey, fetchImpl = fetch } = {}) {
  const client = createTheGamesDbClient({ apiKey, fetchImpl });
  const router = Router();

  router.get("/search", async (req, res) => {
    try {
      const name = String(req.query.name || "").trim();
      const matches = await client.searchGamesByName({ name });
      res.json({ matches });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Falha ao consultar TheGamesDB.",
      });
    }
  });

  router.get("/games/:gameId/screenshots", async (req, res) => {
    try {
      const gameId = Number(req.params.gameId);
      const result = await client.getGameScreenshots({ gameId });
      res.json(result);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Falha ao buscar screenshots.",
      });
    }
  });

  return router;
}
