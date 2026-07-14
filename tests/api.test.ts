import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../server/index.mjs";

describe("API publica", () => {
  it("responde ao health check com headers de seguranca", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("recusa busca Steam curta sem chamar servicos externos", async () => {
    const response = await request(app).get("/api/steam/search?q=a").expect(400);
    expect(response.body.error).toMatch(/curta/i);
  });

  it("recusa parametros invalidos nas rotas de catalogo", async () => {
    await request(app).get("/api/steam/app-size?appId=abc").expect(400);
    await request(app).get("/api/epic/app-details").expect(400);
  });

  it("nao permite origem CORS desconhecida", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example")
      .expect(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
