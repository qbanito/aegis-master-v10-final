const targets=[
 ["finance",process.env.FINANCE_BRAIN_URL||"http://localhost:8787"],
 ["commerce",process.env.COMMERCE_BRAIN_URL||"http://localhost:8802"],
 ["saas",process.env.SAAS_BRAIN_URL||"http://localhost:8790"],
 ["media",process.env.MEDIA_BRAIN_URL||"http://localhost:8804"],
 ["services",process.env.SERVICES_BRAIN_URL||"http://localhost:8808"],
 ["manager",process.env.MANAGER_BRAIN_URL||"http://localhost:8805"],
 ["ceo",process.env.CEO_BRAIN_URL||"http://localhost:8806"]
];
let bad=0;
for(const [name,url] of targets){
 try{const r=await fetch(url+"/health");console.log(name,r.status,await r.text());if(!r.ok)bad++}
 catch(e){console.error(name,"OFFLINE",e.message);bad++}
}
process.exitCode=bad?1:0;
