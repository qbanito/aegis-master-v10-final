import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function loadDotEnv(file){
  if(!fs.existsSync(file))return {};
  const values={};
  for(const raw of fs.readFileSync(file,"utf8").split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith("#"))continue;
    const index=line.indexOf("=");if(index<1)continue;
    const key=line.slice(0,index).trim();let value=line.slice(index+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    values[key]=value;
  }
  return values;
}

const localEnv=loadDotEnv(path.resolve(process.cwd(),".env"));
for(const [key,value] of Object.entries(localEnv))if(process.env[key]===undefined)process.env[key]=value;

const ports = {
  finance: Number(process.env.AEGIS_FINANCE_PORT || 8787),
  saas: Number(process.env.AEGIS_SAAS_PORT || 8790),
  commerce: Number(process.env.AEGIS_COMMERCE_PORT || 8802),
  media: Number(process.env.AEGIS_MEDIA_PORT || 8804),
  services: Number(process.env.AEGIS_SERVICES_PORT || 8808),
  manager: Number(process.env.AEGIS_MANAGER_PORT || 8805),
  ceo: Number(process.env.AEGIS_CEO_PORT || 8806),
  masterUi: Number(process.env.AEGIS_MASTER_UI_PORT || 8810),
  financeUi: Number(process.env.AEGIS_FINANCE_UI_PORT || 8811),
  commerceUi: Number(process.env.AEGIS_COMMERCE_UI_PORT || 8812),
  saasUi: Number(process.env.AEGIS_SAAS_UI_PORT || 8813),
  mediaUi: Number(process.env.AEGIS_MEDIA_UI_PORT || 8814),
  servicesUi: Number(process.env.AEGIS_SERVICES_UI_PORT || 8815),
  institutional: Number(process.env.AEGIS_INSTITUTIONAL_PORT || 8820),
  institutionalUi: Number(process.env.AEGIS_INSTITUTIONAL_UI_PORT || 8821)
};
const urls = {
  finance: `http://localhost:${ports.finance}`,
  saas: `http://localhost:${ports.saas}`,
  commerce: `http://localhost:${ports.commerce}`,
  media: `http://localhost:${ports.media}`,
  services: `http://localhost:${ports.services}`,
  manager: `http://localhost:${ports.manager}`,
  ceo: `http://localhost:${ports.ceo}`,
  institutional: `http://localhost:${ports.institutional}`
};
const apps = [
  {name: "finance", cwd: "apps/finance-brain/server", port: ports.finance, env: {CLIENT_ORIGIN: `http://localhost:${ports.financeUi}`}},
  {name: "commerce", cwd: "apps/commerce-brain", port: ports.commerce},
  {name: "saas", cwd: "apps/saas-brain", port: ports.saas},
  {name: "media", cwd: "apps/media-brain", port: ports.media},
  {name: "services", cwd: "apps/services-brain", port: ports.services, env: {FINANCE_BRAIN_URL: urls.finance, COMMERCE_BRAIN_URL: urls.commerce, SAAS_BRAIN_URL: urls.saas, MEDIA_BRAIN_URL: urls.media, MANAGER_BRAIN_URL: urls.manager, CEO_BRAIN_URL: urls.ceo}},
  {name: "manager", cwd: "apps/manager-brain", port: ports.manager, env: {FINANCE_BRAIN_URL: urls.finance, COMMERCE_BRAIN_URL: urls.commerce, SAAS_BRAIN_URL: urls.saas, MEDIA_BRAIN_URL: urls.media, SERVICES_BRAIN_URL: urls.services}},
  {name: "ceo", cwd: "apps/ceo-brain", port: ports.ceo, env: {MANAGER_BRAIN_URL: urls.manager, FINANCE_BRAIN_URL: urls.finance, COMMERCE_BRAIN_URL: urls.commerce, SAAS_BRAIN_URL: urls.saas, MEDIA_BRAIN_URL: urls.media, SERVICES_BRAIN_URL: urls.services}},
  {name: "institutional", cwd: "apps/institutional-brain", port: ports.institutional},
  {name: "master-ui", cwd: "apps/master-ui", port: ports.masterUi, ui: true, env: {VITE_CEO_BRAIN_URL: urls.ceo, VITE_MANAGER_BRAIN_URL: urls.manager, VITE_INSTITUTIONAL_BRAIN_URL: urls.institutional}},
  {name: "finance-ui", cwd: "apps/brain-ui", port: ports.financeUi, ui: true, kind: "finance", api: urls.finance},
  {name: "commerce-ui", cwd: "apps/brain-ui", port: ports.commerceUi, ui: true, kind: "commerce", api: urls.commerce},
  {name: "saas-ui", cwd: "apps/brain-ui", port: ports.saasUi, ui: true, kind: "saas", api: urls.saas},
  {name: "media-ui", cwd: "apps/brain-ui", port: ports.mediaUi, ui: true, kind: "media", api: urls.media},
  {name: "services-ui", cwd: "apps/brain-ui", port: ports.servicesUi, ui: true, kind: "services", api: urls.services},
  {name: "institutional-ui", cwd: "apps/brain-ui", port: ports.institutionalUi, ui: true, kind: "institutional", api: urls.institutional}
];

for (const app of apps) {
  // Each app may have a local .env. Load it explicitly because the root
  // launcher changes cwd for child processes and dotenv/config must not rely
  // on an inherited working directory.
  const appEnv = loadDotEnv(path.resolve(process.cwd(), app.cwd, ".env"));
  const env = {...process.env, ...appEnv, PORT: String(app.port), ...(app.env || {})};
  if (app.kind) { env.VITE_BRAIN_KIND = app.kind; env.VITE_BRAIN_API_URL = app.api; }
  const args = app.ui ? ["run", "dev", "--", "--port", String(app.port), "--strictPort"] : ["run", "dev"];
  const child = spawn("npm", args, {cwd: app.cwd, env, stdio: "inherit", shell: true});
  child.on("exit", code => console.log(`${app.name} exited`, code));
}
