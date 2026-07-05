process.on("uncaughtException", (error) => {
  console.error("[server bootstrap] uncaughtException", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[server bootstrap] unhandledRejection", reason);
  process.exit(1);
});

(async () => {
  await import("./index.mjs");
})().catch((error) => {
  console.error("[server bootstrap] failed to import server/index.mjs", error);
  process.exit(1);
});
