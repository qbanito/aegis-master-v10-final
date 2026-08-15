const sharedNegative="blurry, low resolution, warped anatomy, duplicate subjects, bad lip sync, unreadable text, watermark, logo artifacts, oversaturated colors, compression artifacts";

export const PROMPT_LIBRARY={
  image:[
    {id:"editorial-portrait",label:"Editorial Portrait",prompt:"cinematic editorial portrait, confident expression, refined wardrobe, soft key light, controlled rim light, natural skin texture, premium magazine composition"},
    {id:"product-launch",label:"Product Launch",prompt:"premium product hero shot, clean studio set, precise reflections, tactile materials, controlled shadows, commercial advertising composition"},
    {id:"futuristic-brand",label:"Futuristic Brand",prompt:"futuristic brand world, architectural geometry, luminous interfaces, deep navy atmosphere, cyan and violet accents, premium technology campaign"},
    {id:"social-cover",label:"Social Cover",prompt:"high-impact social media cover, clear focal subject, strong silhouette, intentional negative space for headline, bold color hierarchy, polished campaign art"},
    {id:"cinematic-world",label:"Cinematic World",prompt:"immersive cinematic environment, layered foreground and background depth, atmospheric perspective, motivated practical lights, film-grade color science"}
  ],
  video:[
    {id:"brand-reveal",label:"Brand Reveal",prompt:"short cinematic brand reveal, elegant camera push-in, controlled parallax, particles resolving into a precise logo-safe composition, premium motion design"},
    {id:"product-motion",label:"Product Motion",prompt:"commercial product motion sequence, smooth orbit camera, realistic material response, subtle environmental movement, clean hero framing"},
    {id:"social-loop",label:"Social Loop",prompt:"seamless vertical social loop, immediate visual hook, rhythmic camera motion, readable subject silhouette, satisfying final frame that matches the opening"},
    {id:"talking-avatar",label:"Talking Avatar",prompt:"natural presenter performance, stable head and shoulders framing, expressive eyes, subtle breathing and gestures, accurate mouth movement, clean studio background"}
  ],
  audio:[
    {id:"brand-sonic",label:"Brand Sonic",prompt:"short premium sonic identity, modern electronic texture, memorable three-note motif, clean transient design, confident resolution, suitable for a technology brand"},
    {id:"cinematic-score",label:"Cinematic Score",prompt:"cinematic underscore with restrained tension, evolving pads, precise pulse, emotional lift, clean ending for editorial video"},
    {id:"social-bed",label:"Social Bed",prompt:"energetic but polished social media music bed, clear rhythm, modern production, space for voiceover, loop-friendly arrangement"},
    {id:"voiceover",label:"Voiceover",prompt:"clear natural Spanish voiceover, warm confident delivery, precise diction, controlled pacing, broadcast-ready tone"}
  ],
  lipsync:[
    {id:"executive-briefing",label:"Executive Briefing",prompt:"professional executive delivery, calm authority, direct eye contact, subtle natural facial expression, accurate phoneme timing, minimal head movement"},
    {id:"creator-announcement",label:"Creator Announcement",prompt:"energetic creator delivery, friendly expression, natural emphasis, expressive eyebrows, accurate lip articulation, confident camera presence"},
    {id:"news-anchor",label:"News Anchor",prompt:"composed news presenter delivery, neutral professional expression, steady gaze, precise lip articulation, controlled facial movement"}
  ]
};

export const NEGATIVE_PROMPT=sharedNegative;

export function buildMediaPrompt({kind,prompt,preset,variables={}}={}){
  const family=kind==='lipsync'?'lipsync':kind==='audio'?'audio':kind==='video'?'video':'image';
  const presetPrompt=PROMPT_LIBRARY[family]?.find(item=>item.id===preset)?.prompt||'';
  const values=Object.entries(variables).filter(([,value])=>value!==undefined&&value!==null&&String(value).trim()).map(([key,value])=>`${key}: ${value}`).join(', ');
  return [prompt,presetPrompt,values,`AEGIS Media ${family} direction`,"high production value", "consistent subject identity"].filter(Boolean).join(", ");
}

export function listPromptPresets(){return Object.fromEntries(Object.entries(PROMPT_LIBRARY).map(([kind,items])=>[kind,items.map(item=>({...item,negativePrompt:NEGATIVE_PROMPT}))]));}
