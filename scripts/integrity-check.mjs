import fs from "node:fs";
const critical=["README.md", "REARM.md", ".env.example", "docker-compose.yml", "manifest.json", "apps/finance-brain/README.md", "apps/saas-brain/README.md", "apps/commerce-brain/src/index.js", "apps/media-brain/src/index.js", "apps/manager-brain/src/index.js", "apps/ceo-brain/src/index.js", "apps/institutional-brain/src/index.js", "apps/master-ui/src/main.jsx", "packages/inter-brain-protocol/src/index.js"];
let failed=false;
for(const f of critical){
  if(!fs.existsSync(f)){console.error("MISSING",f);failed=true;}
  else console.log("OK",f);
}
if(failed)process.exit(1);
console.log("\nAEGIS integrity check: PASS");
