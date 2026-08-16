import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {aegisData} from "../packages/aegis-data/src/index.js";

try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env")); } catch {}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); } catch { return null; }
};

const snapshots = {
  finance: readJson("apps/finance-brain/server/data/state.json"),
  commerce: readJson("apps/commerce-brain/data/commerce.json"),
  services: readJson("apps/services-brain/data/services.json"),
  media: {
    content: readJson("apps/media-brain/data/content.json") || [],
    avatars: readJson("apps/media-brain/data/avatars.json") || []
  }
};

if (!aegisData.configured()) {
  console.error("DATABASE_URL is not configured; no migration was performed.");
  process.exitCode = 1;
} else {
  for (const [service, payload] of Object.entries(snapshots)) {
    if (payload && typeof payload === "object") {
      const result = await aegisData.writeState(service, payload);
      console.log(`${service}: ${result.ok ? "migrated" : result.reason || result.error || "failed"}`);
    }
  }
}
