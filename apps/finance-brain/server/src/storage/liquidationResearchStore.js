import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const file=path.resolve(here,'../../data/liquidation-research.json');
function read(){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return{updatedAt:null,snapshots:[],summary:{}};}}
let db=read();
export const liquidationResearchStore={
  record(snapshot){db.snapshots.unshift(snapshot);db.snapshots=db.snapshots.slice(0,500);db.updatedAt=new Date().toISOString();db.summary=snapshot;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(db,null,2));return db.summary;},
  snapshot(){return db;}
};
