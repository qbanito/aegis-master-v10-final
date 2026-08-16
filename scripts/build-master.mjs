import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brainUiRoot = join(root, "apps", "brain-ui");
const brainOutputRoot = join(root, "apps", "master-ui", "public", "brain-ui");
const buildsRoot = join(brainUiRoot, ".build");
const brains = {
  finance: "https://aegis-finance-brain.onrender.com",
  commerce: "https://aegis-commerce-brain.onrender.com",
  saas: "https://aegis-saas-brain.onrender.com",
  media: "https://aegis-media-brain.onrender.com",
  services: "https://aegis-services-brain.onrender.com",
};

rmSync(brainOutputRoot, { recursive: true, force: true });
rmSync(buildsRoot, { recursive: true, force: true });
mkdirSync(brainOutputRoot, { recursive: true });

for (const [brain, api] of Object.entries(brains)) {
  const outDir = join(buildsRoot, brain);
  execFileSync(
    "npm",
    [
      "--prefix",
      "apps/brain-ui",
      "run",
      "build",
      "--",
      "--base",
      `/brain-ui/${brain}/`,
      "--outDir",
      `.build/${brain}`,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        VITE_BRAIN_KIND: brain,
        VITE_BRAIN_API_URL: api,
        VITE_VOICE_API_URL: "https://aegis-ceo-brain.onrender.com",
        VITE_MEDIA_BRAIN_URL: "https://aegis-media-brain.onrender.com",
      },
      stdio: "inherit",
    },
  );
  cpSync(outDir, join(brainOutputRoot, brain), { recursive: true });
}

execFileSync("npm", ["--prefix", "apps/master-ui", "run", "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
