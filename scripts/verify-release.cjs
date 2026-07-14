#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const fail = (message) => {
  console.error(`[release:verify] ${message}`);
  process.exit(1);
};

if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(packageJson.version)) {
  fail(`Versao invalida no package.json: ${packageJson.version}`);
}
if (packageJson.build?.publish?.provider !== "github") fail("Provider de update precisa ser github.");
if (!packageJson.build?.appId || !packageJson.build?.productName) fail("appId/productName ausentes.");
if (packageJson.build?.win?.target?.includes("nsis") !== true) fail("Target NSIS ausente.");

const latestPath = path.join(releaseDir, "latest.yml");
if (!fs.existsSync(latestPath)) fail("release/latest.yml nao encontrado; gere o instalador NSIS primeiro.");
const latest = fs.readFileSync(latestPath, "utf8");
const version = latest.match(/^version:\s*(.+)$/m)?.[1]?.trim();
const artifactName = latest.match(/^path:\s*(.+)$/m)?.[1]?.trim();
const expectedSha512 = latest.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
if (version !== packageJson.version) fail(`latest.yml (${version}) diverge do package.json (${packageJson.version}).`);
if (!artifactName || !expectedSha512) fail("latest.yml nao possui path/sha512.");

const artifactPath = path.join(releaseDir, artifactName);
if (!fs.existsSync(artifactPath)) fail(`Artefato referenciado nao existe: ${artifactName}`);
const blockmapPath = `${artifactPath}.blockmap`;
if (!fs.existsSync(blockmapPath) || fs.statSync(blockmapPath).size === 0) {
  fail(`Blockmap do auto-update ausente ou vazio: ${path.basename(blockmapPath)}`);
}
const actualSha512 = crypto.createHash("sha512").update(fs.readFileSync(artifactPath)).digest("base64");
if (actualSha512 !== expectedSha512) fail("SHA-512 do instalador diverge do latest.yml.");

const unpackedUpdateConfig = path.join(releaseDir, "win-unpacked", "resources", "app-update.yml");
if (fs.existsSync(unpackedUpdateConfig)) {
  const updateConfig = fs.readFileSync(unpackedUpdateConfig, "utf8");
  if (!updateConfig.includes(`owner: ${packageJson.build.publish.owner}`)) fail("Owner do app-update.yml diverge.");
  if (!updateConfig.includes(`repo: ${packageJson.build.publish.repo}`)) fail("Repo do app-update.yml diverge.");
  if (!updateConfig.includes("provider: github")) fail("Provider invalido no app-update.yml.");
}

console.log(`[release:verify] ${artifactName} v${version}: metadados e SHA-512 validos.`);
