/* ===========================
   Platanus Hack 25 - v1.10
   Warp Wizard 
   Creado por: Sebastián Hernández (@Medseb23)

   2.5D raycast mini-engine + FX + 10 niveles + báculo procedural
   Música y SFX procedurales (WebAudio)
   =========================== */

/* ======= CONTROLES ARCADE-KEY ======= */
const ARCADE = { P1U:['w'], P1D:['s'], P1L:['a'], P1R:['d'], P1B:['e'], P1X:['q'], P1A:['u'], START1:['1','Enter'] };
const K2A={}; for (const [k,v] of Object.entries(ARCADE)) (v||[]).forEach(x=>K2A[x]=k);

/* ======= CONST ======= */
const W=800,H=600, FOV=Math.PI/3, RAYS=288;
const TILE=32, MAPW=24, MAPH=18;
const SPEED=2.5, ROT=0.045, STRAFE=2.0;
const ENEMY_BASE=6, ENEMY_SPD_BASE=0.8;
const FIRE_CD=160, DMG_CD=400, PORTAL_SIZE=18;
const SPRITE_SLICES = 8;
const SPRITE_EPS    = 32;
const ZBUF_DILATE   = 0;
const WARP_MS = 1200;
const USE_PRO_HUD = true;


/* FX tiempos */
const BEAM_LIFE=120, SPARK_LIFE=160, MUZZLE_LIFE=90;
const PROJECTILE_MS = 320;
const FLASH_MS      = 500;

/* ======= NIVELES (paletas + enemigo + NOMBRE DE ESCENA) ======= */
const LEVELS = [
  {name:"Ice Cave",            sky:0xBFD7FF,floor:0xDDE7F2, enemy:"medusa",    biome:"ice",   fog:0xBFD7FF, fogA:0.10, fx:"snow",   music:{bpm:84,  scale:[220,247,262,294,330,392,440]}},
  {name:"Dimensional Jungle",  sky:0x294B2F,floor:0x152918, enemy:"skeleton",  biome:"forest",fog:0x1b2e1f, fogA:0.08, fx:"leaves", music:{bpm:92,  scale:[196,220,247,294,330,392,440]}},
  {name:"Golden Dunes",        sky:0xE2C58B,floor:0xC8A86A, enemy:"zombie",    biome:"desert",fog:0xE8D5A8, fogA:0.06, fx:"sand",   music:{bpm:96,  scale:[174,196,220,262,294,330,392]}},
  {name:"Neon Necropolis",     sky:0x1A1D26,floor:0x2C2F36, enemy:"imp",       biome:"city",  fog:0x1a1a1a, fogA:0.10, fx:"rain",   music:{bpm:108, scale:[220,247,262,330,349,392,440]}},
  {name:"Mind Realm",          sky:0x0a2030,floor:0x1a2a28, enemy:"ghost",     biome:"cave",  fog:0x0b141a, fogA:0.09, fx:"motes",  music:{bpm:80,  scale:[196,233,262,311,349,392,466]}},
  {name:"Moonlit Moor",        sky:0x19251c,floor:0x2b2f23, enemy:"werewolf",  biome:"moor",  fog:0x132016, fogA:0.08, fx:"motes",  music:{bpm:88,  scale:[196,220,247,294,330,370,392]}},
  {name:"Infernal Rift",       sky:0x1a1f29,floor:0x2a2a2a, enemy:"demon",     biome:"hell",  fog:0x2a1515, fogA:0.08, fx:"embers", music:{bpm:112, scale:[220,262,294,311,349,392,466]}},
  {name:"Ancient Ruins",       sky:0x15202b,floor:0x252116, enemy:"bat",       biome:"ruins", fog:0x1c1b16, fogA:0.07, fx:"dust",   music:{bpm:90,  scale:[174,196,220,247,294,330,392]}},
  {name:"Stone Colossus",      sky:0x0f1d15,floor:0x2b2b28, enemy:"golem",     biome:"stone", fog:0x101612, fogA:0.06, fx:"motes",  music:{bpm:86,  scale:[196,220,247,262,311,349,392]}},
  {name:"Astral Passage",      sky:0x211a2c,floor:0x1f242b, enemy:"eye",       biome:"void",  fog:0x121019, fogA:0.10, fx:"sparks", music:{bpm:98,  scale:[220,233,277,311,349,392,415]}},
];

// ==== UI helpers (rounded rect, sombra, gradiente) ====
function uiRoundedRect(g, x, y, w, h, r){
  g.beginPath();
  g.moveTo(x+r, y);
  g.lineTo(x+w-r, y);
  g.arc(x+w-r, y+r, r, -Math.PI/2, 0);
  g.lineTo(x+w, y+h-r);
  g.arc(x+w-r, y+h-r, r, 0, Math.PI/2);
  g.lineTo(x+r, y+h);
  g.arc(x+r, y+h-r, r, Math.PI/2, Math.PI);
  g.lineTo(x, y+r);
  g.arc(x+r, y+r, r, Math.PI, 1.5*Math.PI);
  g.closePath();
}

function uiShadow(g, x, y, w, h, r, a=0.25){
  g.fillStyle(0x000000, a);
  uiRoundedRect(g, x+2, y+3, w, h, r);
  g.fillPath();
}

function clearPressText(){ if (pressText){ pressText.destroy(); pressText = null; } }
function returnToTitle(){
  gameOver = false;
  hideGameOver();    // por si hay texto residual
  setupTitle();      // mode='title' y resetea timers
}




function uiPanel(g, x, y, w, h, baseCol=0xE9EDF7, stroke=0x1a2233, alpha=0.92){
  // sombra
  uiShadow(g, x, y, w, h, 10, 0.28);
  // cuerpo (vidrio suave)
  const gradSteps = 5;
  for(let i=0;i<gradSteps;i++){
    const t=i/(gradSteps-1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(baseCol),
      Phaser.Display.Color.ValueToColor(0xffffff),
      gradSteps-1, i
    );
    const col = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    const yy = y + i*(h/gradSteps);
    g.fillStyle(col, alpha*(0.90 - 0.12*t));
    uiRoundedRect(g, x, yy, w, (h/gradSteps)+1, 10);
    g.fillPath();
  }
  // borde
  g.lineStyle(2, stroke, 0.45);
  uiRoundedRect(g, x, y, w, h, 10);
  g.strokePath();

  // brillo superior
  g.fillStyle(0xffffff, 0.12);
  uiRoundedRect(g, x+6, y+6, w-12, 18, 8);
  g.fillPath();
}

function uiBadge(g, x, y, txt, col=0x3a475e, bg=0xffffff, alpha=0.95){
  const paddingX=8, paddingY=4;
  const tmp = sceneRef.add.text(0,0,txt,{fontFamily:'monospace', fontSize:'14px'}); 
  const tw = tmp.width; tmp.destroy();
  const bw = tw + paddingX*2, bh = 20 + (paddingY*0.5);
  // sombra leve
  g.fillStyle(0x000000,0.25); uiRoundedRect(g, x+1, y+2, bw, bh, 6); g.fillPath();
  // fondo
  g.fillStyle(bg, alpha);     uiRoundedRect(g, x, y, bw, bh, 6); g.fillPath();
  // borde
  g.lineStyle(1, col, 0.55);  uiRoundedRect(g, x, y, bw, bh, 6); g.strokePath();
  // texto
  const t = sceneRef.add.text(x+paddingX, y+paddingY-2, txt, {fontFamily:'monospace', fontSize:'14px', color:'#1a2233'});
  t.setDepth(999); t.setScrollFactor(0); 
  // devolver ancho para apilar badges
  return {w:bw, h:bh, destroy:()=>t.destroy()};
}

function uiHPBar(g, x, y, w, h, pct){
  pct = Math.max(0, Math.min(1, pct));
  // marco
  g.fillStyle(0x111317,0.75); uiRoundedRect(g, x, y, w, h, 5); g.fillPath();
  // fondo
  g.fillStyle(0x263238,0.85); uiRoundedRect(g, x+2, y+2, w-4, h-4, 4); g.fillPath();
  // relleno (degradado del verde al ámbar/rojo)
  const good = Phaser.Display.Color.ValueToColor(0x2ee05f);
  const mid  = Phaser.Display.Color.ValueToColor(0x9edc3f);
  const bad  = Phaser.Display.Color.ValueToColor(0xe53935);
  const target = (pct>0.5)
      ? Phaser.Display.Color.Interpolate.ColorWithColor(mid, good, 50, (pct-0.5)*50)
      : Phaser.Display.Color.Interpolate.ColorWithColor(bad, mid, 50, pct*50);
  const fillCol = Phaser.Display.Color.GetColor(target.r|0,target.g|0,target.b|0);
  const fw = Math.max(4, (w-4)*pct);
  g.fillStyle(fillCol, 0.95); uiRoundedRect(g, x+2, y+2, fw, h-4, 4); g.fillPath();
  // brillante
  g.fillStyle(0xffffff, 0.12); uiRoundedRect(g, x+4, y+4, fw-6, Math.max(2,(h-8)*0.45), 3); g.fillPath();
}

function fitTextToWidth(txtObj, text, maxWidth){
  txtObj.setText(text);
  if (txtObj.width <= maxWidth) return;
  // Trunca con “…” si se pasa
  let s = text;
  while (s.length > 4 && txtObj.width > maxWidth){
    s = s.slice(0, s.length - 2);
    txtObj.setText(s + '…');
  }
}



/* ======= TITLE SCREEN ======= */
let mode = 'title'; // 'title' | 'play' | 'gameover'
let titleT = 0, titleText = null, pressText = null;
let attract = false;        // ¿estamos en autoplay?
let attractIdleMs = 0;      // tiempo de inactividad en la portada
const ATTRACT_DELAY = 30000; // 30 s

function setHUDVisible(v){
  if (hudText) hudText.setVisible(v);
  if (mapG)    mapG.setVisible(v);
}

function clearPressText(){ if (pressText){ pressText.destroy(); pressText=null; } }


function hideTitle(){
  if (titleText){ titleText.destroy(); titleText = null; }
  clearPressText();
  g.clear(); mapG.clear();
}




/* ======= STATE ======= */
let sceneRef;
let g, world, player, enemies, level=1, score=0, hi=0, lastShot=0, lastHit=0, portal=null;
let hudText, mapG, keys;
let fxBeams=[], fxSparks=[], fxMuzzle=0;
let lastZBuf=null;
let stageBannerT=0, bannerText=null;
let warpEffectT = 0;

// Anim báculo
let walkT=0, moveMag=0;
let weaponT=0;

// FX nuevos
let fxOrbs=[];
let skyFlash=0;
let damageFlash=0;

// HUD minimalista (reutilizable)
let hudMain = null;   // línea principal (Score, Scene, HS)
let hudSmall = null;  // línea secundaria (controles)

/* ======= AUDIO ======= */
let AC=null, masterGain=null, sfxGain=null, musicGain=null;
let musicOn=false, musicTimer=0;
let BPM = 92;
const STEPS_PER_BAR = 16;
const BARS = 1;
let SEC_PER_STEP = (60/BPM)/4;
let SCALE  = [220.00,261.63,293.66,329.63,392.00,440.00,523.25];
let MELODY = [0,2,3,5, 0,-1,2,-1, 3,5,3,2, 0,-1,-1,-1];
let BASS   = [0,-1,-1,-1, 0,-1,-1,-1, -5,-1,-1,-1, -5,-1,-1,-1].map(i=> i<0?-1:Math.max(0,i));

/* ======= THEME / FX ======= */
let THEME = { fog:0x000000, fogA:0, fx:"motes", biome:"generic" };
let fxParticles = [];

/* ======= UI CONTRASTE ======= */
let HUD_COLOR = '#cfd8dc';
let HUD_STROKE = '#1a2233';
function hexToRGB(hex){ return {r:(hex>>16)&255, g:(hex>>8)&255, b:hex&255}; }
function luminance(hex){
  const {r,g,b}=hexToRGB(hex);
  const sr=r/255, sg=g/255, sb=b/255;
  const lin = v => (v<=0.04045)?(v/12.92):Math.pow((v+0.055)/1.055,2.4);
  const R=lin(sr), G=lin(sg), B=lin(sb);
  return 0.2126*R + 0.7152*G + 0.0722*B;
}
function setHUDContrastFromScene(){
  const pal = LEVELS[(level-1)%LEVELS.length];
  const Lavg = (luminance(pal.sky)+luminance(pal.floor))/2;
  if(Lavg > 0.60){ HUD_COLOR = '#0d1117'; HUD_STROKE = '#e5eefc'; }
  else { HUD_COLOR = '#cfd8dc'; HUD_STROKE = '#1a2233'; }
  if(hudText) hudText.setStyle({ color: HUD_COLOR });
  if(bannerText) bannerText.setStyle({ color: HUD_COLOR, stroke: HUD_STROKE });
}

/* ===== AUDIO CORE ===== */
function initAudio(){
  if (AC) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  AC = new Ctx();
  masterGain = AC.createGain();
  musicGain  = AC.createGain();
  sfxGain    = AC.createGain();
  masterGain.gain.value = 0.9;
  musicGain.gain.value  = 0.30;
  sfxGain.gain.value    = 0.65;
  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(AC.destination);
  musicOn = true;
}

/* Envolventes / ruidos */
function envSimple(freq=440, dur=0.15, type='sine', gain=0.35){
  if (!AC) return;
  const osc = AC.createOscillator();
  const g   = AC.createGain();
  const t   = AC.currentTime;
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t); osc.stop(t+dur+0.02);
}
function noiseBurst(dur=0.04, gain=0.25){
  if (!AC) return;
  const sr  = AC.sampleRate;
  const len = Math.max(1, Math.floor(sr * dur));
  const buf = AC.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i=0;i<len;i++) data[i] = (Math.random()*2-1) * (1 - i/len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const g   = AC.createGain();
  const bp  = AC.createBiquadFilter(); bp.type='highpass'; bp.frequency.value = 1800;
  g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(sfxGain);
  src.start();
}

/* Paleta/FX/música por nivel */
function applySceneTheme(lv){
  const L = LEVELS[(lv-1)%LEVELS.length];
  THEME = { fog:L.fog, fogA:L.fogA, fx:L.fx, biome:L.biome };
  BPM = L.music.bpm;
  SEC_PER_STEP = (60/BPM)/4;
  SCALE = L.music.scale.slice();
  switch (L.biome){
    case "ice":   MELODY = [0,2,4,5, 4,2,0,-1, 5,4,2,0, 0,-1,-1,-1]; break;
    case "forest":MELODY = [0,2,3,5, 3,2,0,-1, 5,3,2,0, 0,-1,-1,-1]; break;
    case "desert":MELODY = [0,1,3,5, 3,1,0,-1, 5,3,1,0, 0,-1,-1,-1]; break;
    case "city":  MELODY = [0,0,2,2, 3,3,5,5, 3,3,2,2, 0,-1,-1,-1]; break;
    case "hell":  MELODY = [0,3,5,6, 5,3,0,-1, 6,5,3,0, 0,-1,-1,-1]; break;
    default:      MELODY = [0,2,3,5, 0,-1,2,-1, 3,5,3,2, 0,-1,-1,-1];
  }
  setHUDContrastFromScene();
}

/* SFX varios */
function sfxShot(){ envSimple(740,0.07,'sawtooth',0.45); envSimple(1240,0.05,'square',0.20); noiseBurst(0.035,0.18); }
function sfxEnemyHit(){ envSimple(220,0.10,'triangle',0.40); envSimple(330,0.08,'triangle',0.25); }
function sfxPlayerHit(){ envSimple(110,0.20,'sine',0.60); noiseBurst(0.08,0.28); }
function sfxPortalSpawn(){
  if(!AC) return;
  const freqs = [SCALE[2]*2, SCALE[4]*2, SCALE[6]*2, SCALE[4]*2, SCALE[2]*2];
  freqs.forEach((f,i)=>{ setTimeout(()=>envSimple(f, 0.18, 'triangle', 0.32), i*70); });
  noiseBurst(0.18, 0.18);
}
function sfxTeleport(){
  if(!AC) return;
  const o=AC.createOscillator(), g=AC.createGain(), t=AC.currentTime;
  o.type='sine'; o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(110, t+0.55);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t+0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.65);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.7);
  noiseBurst(0.5, 0.25);
  try{
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(0.06, t+0.25);
    musicGain.gain.linearRampToValueAtTime(0.25, t+1.0);
  }catch(e){}
}

/* Música stepper */
function tickMusic(dt){
  if(!AC || !musicOn || gameOver) return;
  musicTimer += dt/1000;
  while(musicTimer >= SEC_PER_STEP){
    musicTimer -= SEC_PER_STEP;
    const t = AC.currentTime;
    kick(t, 0.0); if((Math.random()<0.35)) hat(t, 0.0);
    const stepIdx = (Math.floor((t/SEC_PER_STEP)) % (STEPS_PER_BAR*BARS));
    const mIdx = MELODY[stepIdx % MELODY.length];
    const bIdx = BASS[stepIdx % BASS.length];
    if(mIdx>=0) note(SCALE[mIdx]*2, 0.12, 'sine', 0.18);
    if(bIdx>=0 && stepIdx%4===0) note(SCALE[bIdx], 0.20, 'triangle', 0.18);
  }
}
function note(freq, dur, type, gain){
  const osc=AC.createOscillator(); osc.type=type; osc.frequency.value=freq;
  const g=AC.createGain(); const t=AC.currentTime;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.linearRampToValueAtTime(gain, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  osc.connect(g); g.connect(musicGain); osc.start(t); osc.stop(t+dur+0.02);
}
function kick(t, off){
  const osc=AC.createOscillator(), g=AC.createGain();
  osc.type='sine'; osc.frequency.setValueAtTime(140, t+off);
  osc.frequency.exponentialRampToValueAtTime(50, t+off+0.12);
  g.gain.setValueAtTime(0.0001, t+off);
  g.gain.linearRampToValueAtTime(0.35, t+off+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+off+0.14);
  osc.connect(g); g.connect(musicGain); osc.start(t+off); osc.stop(t+off+0.18);
}
function hat(t, off){
  if(!AC) return;
  const sr=AC.sampleRate, len=sr*0.05, buf=AC.createBuffer(1,len,sr);
  const data=buf.getChannelData(0);
  for(let i=0;i<len;i++) data[i]=(Math.random()*2-1);
  const bp=AC.createBiquadFilter(); bp.type='highpass'; bp.frequency.value=7000;
  const src=AC.createBufferSource(); src.buffer=buf;
  const g=AC.createGain(); g.gain.setValueAtTime(0.18, t+off);
  g.gain.exponentialRampToValueAtTime(0.0001, t+off+0.05);
  src.connect(bp); bp.connect(g); g.connect(musicGain);
  src.start(t+off);
}

/* ======= UTILS ======= */
const rand=(a,b)=>a+Math.random()*(b-a);
const d2=(x1,y1,x2,y2)=> (x1-x2)**2+(y1-y2)**2;
const OCC_EPS = 8;
const MIN_SPRITE_PX = 6;

/* NEW: mínimo z en rango de columnas */
function minZInRange(zbuf, c0, c1){
  if(c1 < c0) return Infinity;
  let m = Infinity;
  for(let c=c0; c<=c1; c++) if (zbuf[c] < m) m = zbuf[c];
  return m;
}
function sliceIsVisible(zb, c0, c1, depth, eps=SPRITE_EPS){
  c0 = Math.max(0, c0)|0; 
  c1 = Math.min(RAYS-1, c1)|0;
  for (let c=c0; c<=c1; c++){
    if (depth <= zb[c] + eps) return true;
  }
  return false;
}
// ---- VISIBILIDAD: contar slices visibles de un sprite en el z-buffer ----
function countVisibleSlices(sx, w, depth, colW, zbuf, slices = SPRITE_SLICES, eps = SPRITE_EPS) {
  let visible = 0;
  for (let k = 0; k < slices; k++) {
    const fx0 = k / slices;
    const fx1 = (k + 1) / slices;
    const segX0 = sx + w * fx0;
    const segX1 = sx + w * fx1;

    let c0 = Math.floor(segX0 / colW);
    let c1 = Math.floor(segX1 / colW);

    // clamp a rango válido
    c0 = Math.max(0, Math.min(RAYS - 1, c0));
    c1 = Math.max(0, Math.min(RAYS - 1, c1));
    if (c1 < c0) { const t = c0; c0 = c1; c1 = t; }

    if (sliceIsVisible(zbuf, c0, c1, Math.max(0.0001, depth), eps)) visible++;
  }
  return visible;
}

function anySliceVisible(s, colW, zbuf){
  const depth = Math.max(0.0001, s.dist);
  for (let k=0; k<SPRITE_SLICES; k++){
    const fx0 = k / SPRITE_SLICES;
    const fx1 = (k+1) / SPRITE_SLICES;
    const sx0 = s.sx + s.w * fx0;
    const sw  = s.w  * (fx1 - fx0);
    const c0  = Math.floor(sx0 / colW);
    const c1  = Math.floor((sx0 + sw) / colW);
    if (sliceIsVisible(zbuf, c0, c1, depth, SPRITE_EPS)) return true;
  }
  return false;
}

/* NEW: línea de visión (LOS) */
function hasLOS(px,py, tx,ty){
  const dx = tx-px, dy = ty-py;
  const baseAng = Math.atan2(dy,dx);
  const offs = [0, +0.015, -0.015];
  for (const dAng of offs){
    const ang = baseAng + dAng;
    const dirX=Math.cos(ang), dirY=Math.sin(ang);
    let mapX=(px/TILE)|0, mapY=(py/TILE)|0;
    const deltaX=Math.abs(1/(dirX||1e-9)), deltaY=Math.abs(1/(dirY||1e-9));
    let stepX,stepY,sideX,sideY;
    if(dirX<0){ stepX=-1; sideX=(px/TILE-mapX)*deltaX; } else { stepX=1; sideX=(mapX+1-(px/TILE))*deltaX; }
    if(dirY<0){ stepY=-1; sideY=(py/TILE-mapY)*deltaY; } else { stepY=1; sideY=(mapY+1-(py/TILE))*deltaY; }
    let i=0, traveled=0;
    const goal=Math.hypot(dx,dy)-8;
    while(i++<1024){
      if(sideX<sideY){ sideX+=deltaX; mapX+=stepX; traveled=(sideX-deltaX)*TILE; }
      else            { sideY+=deltaY; mapY+=stepY; traveled=(sideY-deltaY)*TILE; }
      if(cellAt(mapX,mapY)===1) break;
      if(traveled>goal) return true;
    }
  }
  return false;
}

/* ======= MAPA ======= */
function genMap(lv){
  const m=Array.from({length:MAPH},(_,y)=>Array.from({length:MAPW},(_,x)=> (x===0||y===0||x===MAPW-1||y===MAPH-1)?1:0));
  const density=0.10+Math.min(0.20, lv*0.015);
  for(let y=1;y<MAPH-1;y++) for(let x=1;x<MAPW-1;x++) if(Math.random()<density) m[y][x]=1;
  for(let y=-1;y<=1;y++) for(let x=-1;x<=1;x++) m[(MAPH>>1)+y][(MAPW>>1)+x]=0;
  return m;
}
function isWall(x,y){ const gx=(x/TILE)|0, gy=(y/TILE)|0; return gy<0||gy>=MAPH||gx<0||gx>=MAPW ? true : world.map[gy][gx]===1; }
function cellAt(gx,gy){ return (gy<0||gy>=MAPH||gx<0||gx>=MAPW)?1:world.map[gy][gx]; }

/* ======= RAYCAST (DDA) ======= */
function castRay(px,py,ang){
  const dirX=Math.cos(ang), dirY=Math.sin(ang);
  let mapX=(px/TILE)|0, mapY=(py/TILE)|0;
  const deltaX=Math.abs(1/(dirX||1e-9)), deltaY=Math.abs(1/(dirY||1e-9));
  let stepX,stepY,sideX,sideY;

  if(dirX<0){ stepX=-1; sideX=(px/TILE-mapX)*deltaX; } else { stepX=1; sideX=(mapX+1-(px/TILE))*deltaX; }
  if(dirY<0){ stepY=-1; sideY=(py/TILE-mapY)*deltaY; } else { stepY=1; sideY=(mapY+1-(py/TILE))*deltaY; }

  let hit=false, side=0, i=0;
  while(i++<1024){
    if(sideX<sideY){ sideX+=deltaX; mapX+=stepX; side=0; }
    else{ sideY+=deltaY; mapY+=stepY; side=1; }
    if(cellAt(mapX,mapY)===1){ hit=true; break; }
  }
  let perpDist=hit? ((side===0?sideX-deltaX:sideY-deltaY)*TILE) : 1000;
  return {dist:perpDist, side, hit};
}

/* ======= ENTIDADES ======= */
function spawnPlayer(){ player={x:(MAPW>>1)*TILE+TILE*0.5, y:(MAPH>>1)*TILE+TILE*0.5, ang:0, hp:100}; }

function spawnEnemies(lv){
  const arr=[], n=ENEMY_BASE + Math.floor(lv*1.2);
  const type = LEVELS[(lv-1)%LEVELS.length].enemy;
  for(let i=0;i<n;i++){
    let tries=0, ex=0, ey=0;
    do{ ex=(Math.floor(rand(1,MAPW-1))*TILE)+TILE*0.5; ey=(Math.floor(rand(1,MAPH-1))*TILE)+TILE*0.5; tries++; }
    while((isWall(ex,ey)||d2(ex,ey,player.x,player.y)<(TILE*6)**2) && tries<120);
    arr.push({x:ex,y:ey,hp:3, maxhp:3, spd:ENEMY_SPD_BASE+lv*0.08, t:Math.random()*1000, type, hitFlash:0});
  }
  const mTypes=['snake','spider','skull'];
  const mCount = 4 + Math.floor(lv*0.7);
  for(let i=0;i<mCount;i++){
    let tries=0, ex=0, ey=0;
    do{ ex=(Math.floor(rand(1,MAPW-1))*TILE)+TILE*0.5; ey=(Math.floor(rand(1,MAPH-1))*TILE)+TILE*0.5; tries++; }
    while((isWall(ex,ey)||d2(ex,ey,player.x,player.y)<(TILE*7)**2) && tries<120);
    const mt = mTypes[(i+mCount)%mTypes.length];
    const base = (mt==='spider')? {hp:1,spd:1.15} : (mt==='snake'? {hp:1,spd:1.0}:{hp:2,spd:0.95});
    arr.push({x:ex,y:ey,hp:base.hp, maxhp:base.hp, spd:(ENEMY_SPD_BASE+lv*0.06)*base.spd, t:Math.random()*1000, type:mt, hitFlash:0});
  }
  return arr;
}

/* ======= PORTAL ======= */
function maybeSpawnPortal(){
  if(enemies.length>0||portal) return;
  let tries=0,zx=0,zy=0;
  do{ zx=(Math.floor(rand(1,MAPW-1))*TILE)+TILE*0.5; zy=(Math.floor(rand(1,MAPH-1))*TILE)+TILE*0.5; tries++; }
  while((isWall(zx,zy)||d2(zx,zy,player.x,player.y)<(TILE*8)**2) && tries<200);
  portal={x:zx,y:zy,t:0};
  if(!AC) initAudio();
  if(AC) sfxPortalSpawn();
}

/* ======= GAME OVER ======= */
let gameOver = false, gameOverText=null, gameOverSub=null, defeatTimer=0;
function showGameOver(){
  mode='gameover';
  gameOver = true;
  if(!AC) initAudio();
  if(AC){ musicOn = false; sfxDefeatTheme(); }
  const big = sceneRef.add.text(W/2, H*0.40, 'GAME OVER', {
    fontFamily:'monospace', fontSize:'64px', color: HUD_COLOR, stroke: HUD_STROKE, strokeThickness: 6
  }).setOrigin(0.5);
  const sub = sceneRef.add.text(W/2, H*0.56, 'Press Enter to Restart', {
    fontFamily:'monospace', fontSize:'22px', color: HUD_COLOR, stroke: HUD_STROKE, strokeThickness: 3
  }).setOrigin(0.5);
  gameOverText = big; gameOverSub = sub;
}
function hideGameOver(){
  if(gameOverText){ gameOverText.destroy(); gameOverText=null; }
  if(gameOverSub){ gameOverSub.destroy(); gameOverSub=null; }
  gameOver=false; defeatTimer=0; musicOn = true; mode='play';
}
function sfxDefeatTheme(){
  if(!AC) return;
  const root = SCALE[0];
  const seq = [root*2, root*1.5, root*1.333, root];
  seq.forEach((f,i)=> setTimeout(()=>envSimple(f, 0.25, 'sine', 0.45), i*220));
  setTimeout(()=>noiseBurst(0.28, 0.18), 110);
}

/* ======= PHASER ======= */
const config={ type:Phaser.AUTO, width:W, height:H, backgroundColor:'#0b0e1a', scene:{ create, update } };
new Phaser.Game(config);

function create(){
  sceneRef=this;
  g=this.add.graphics();
  mapG=this.add.graphics();
  // HUD textual reutilizable (no se recrea por frame)
hudMain = this.add.text(0, 0, '', {
  fontFamily:'monospace', fontSize:'16px', color:'#1a2233'
}).setDepth(1000).setScrollFactor(0);

hudSmall = this.add.text(0, 0, '', {
  fontFamily:'monospace', fontSize:'12px', color:'#4b5563'
}).setDepth(1000).setScrollFactor(0);



  keys=this.input.keyboard.addKeys({
    W:Phaser.Input.Keyboard.KeyCodes.W, S:Phaser.Input.Keyboard.KeyCodes.S,
    A:Phaser.Input.Keyboard.KeyCodes.A, D:Phaser.Input.Keyboard.KeyCodes.D,
    Q:Phaser.Input.Keyboard.KeyCodes.Q, E:Phaser.Input.Keyboard.KeyCodes.E,
    U:Phaser.Input.Keyboard.KeyCodes.U, ENTER:Phaser.Input.Keyboard.KeyCodes.ENTER,
    ONE:Phaser.Input.Keyboard.KeyCodes.ONE, M:Phaser.Input.Keyboard.KeyCodes.M
  });

  this.input.on('pointerdown', ()=> { if(mode==='title' && !attract) attractIdleMs = 0; });
this.input.keyboard.on('keydown', ()=> { if(mode==='title' && !attract) attractIdleMs = 0; });


  // Audio unlock / toggle / visibilidad pestaña
  this.input.once('pointerdown', async () => { initAudio(); try{ await AC.resume(); }catch{} });
  this.input.keyboard.once('keydown', async () => { initAudio(); try{ await AC.resume(); }catch{} });
  this.input.keyboard.on('keydown-M', ()=>{ musicOn = !musicOn; });
  document.addEventListener('visibilitychange', async ()=>{ if (!AC) return; try{ if (document.hidden) await AC.suspend(); else await AC.resume(); }catch{} });

  // Entradas “START” según modo
  this.input.keyboard.on('keydown', (ev)=>{
    if(!AC) initAudio();
    const code=K2A[ev.key]||ev.key;

    // Title -> Play
if (mode==='title' && code==='START1'){ 
  clearPressText();        // <-- NUEVO
  startGame(); 
  return; 
}

// Attract -> Play real
if (mode==='attract' && code==='START1'){ 
  clearPressText();        // <-- NUEVO
  stopAttractAndPlay(); 
  return; 
}



    // Game Over -> Restart
    if(gameOver){
      if(code==='START1'){ hideGameOver(); bootstrapLevel(1); }
      return;
    }

    // Disparo in-game
    if(mode==='play' && (code==='P1A'||code==='START1')) tryFire();
  });

  // Arranca en portada
  setupTitle();
  attract = false;
attractIdleMs = 0;

}

/* ======= TITLE SCREEN ======= */
function setupTitle(){
  mode='title';
  titleT = 0;
  g.clear(); mapG.clear();
  if(titleText) titleText.destroy();
  titleText = sceneRef.add.text(W/2, H*0.18, 'WARP\nWIZARD', {
    fontFamily:'serif', fontStyle:'bold', fontSize: Math.round(H*0.12)+'px',
    align:'center', color:'#f6e29a', stroke:'#4a2b0f', strokeThickness:6
  }).setOrigin(0.5);
  if(pressText) pressText.destroy();
  pressText = sceneRef.add.text(W/2, H*0.82, 'Press Start to Play', {
    fontFamily:'monospace', fontSize:'24px', color:'#f6e29a', stroke:'#1a1a1a', strokeThickness:3
  }).setOrigin(0.5);
  initAudio(); musicOn = true;
}
function hideTitle(){
  if(titleText){ titleText.destroy(); titleText=null; }
  if(pressText){ pressText.destroy(); pressText=null; }
  g.clear(); mapG.clear();
}

function startAttract(){
  hideTitle();          // <- elimina “WARP WIZARD” y el press start
  attract = true;
  mode    = 'attract';

  // nivel aleatorio
  const lv = 1 + Math.floor(Math.random() * LEVELS.length);
  bootstrapLevel(lv);

  score = 0;
  setHUDVisible(false); // <- HUD y minimapa ocultos en demo
}


function startGame(){
  hideTitle();
  attract = false;
  mode    = 'play';
  setHUDVisible(true);
  bootstrapLevel(1);
}


function stopAttractAndPlay(){
  attract = false;
  setHUDVisible(true);
  startGame();
}


function drawTitleScreen(t){
  g.clear();
  // Fondo
  const skyTop = 0x324a7d, skyBot = 0x9bbcff, floor=0xe9eef7;
  for(let y=0; y<H*0.55; y+=4){
    const mix = y/(H*0.55);
    const r = ((skyTop>>16)&255)*(1-mix) + ((skyBot>>16)&255)*mix;
    const gC= ((skyTop>>8 )&255)*(1-mix) + ((skyBot>>8 )&255)*mix;
    const b = ((skyTop    )&255)*(1-mix) + ((skyBot    )&255)*mix;
    const col = Phaser.Display.Color.GetColor(r|0,gC|0,b|0);
    g.fillStyle(col,1); g.fillRect(0,y,W,4);
  }
  g.fillStyle(floor,1); g.fillRect(0,H*0.55,W,H*0.45);

  // Montañitas
  g.fillStyle(0x3a3f6a,0.8);
  for(let i=0;i<6;i++){
    const bx = (i/5)*W + (Math.sin(i*1.7)*40);
    const by = H*0.55;
    const h  = 60 + (i%2?40:80);
    g.beginPath(); g.moveTo(bx-80,by); g.lineTo(bx,by-h); g.lineTo(bx+80,by); g.closePath(); g.fillPath();
  }



  // Portal y báculo
  const pw = W*0.22, ph = H*0.55, psx = W*0.50 - pw/2, psy = H*0.55 - ph*0.70;
  drawPortalArch(psx, psy, pw, ph*0.88, t);
  const S=2.8, baseX=W*0.86, topY=H*0.30, baseY=H*0.95;
  g.fillStyle(0x1e2538,1); g.fillRect(baseX-6*S/2, topY, 6*S, baseY-topY);
  for(let i=0;i<5;i++){ const yy=baseY-14*S-i*(15*S); g.fillStyle(0x9e7a34,1); g.fillRect(baseX-10*S,yy,20*S,6*S); }
  const glow = 0.5 + 0.5*Math.sin(t*0.004);
  g.fillStyle(0xfff1b8,0.55+0.35*glow); g.fillCircle(baseX, topY-10, 26);
  g.fillStyle(0xffffff,0.9); g.fillCircle(baseX, topY-10, 10);

  // Siluetas simples
  drawSkeletonSilhouette(W*0.22, H*0.58, 0.9);
  drawSkeletonSilhouette(W*0.30, H*0.60, 1.1);
  drawSpiderSilhouette(W*0.16, H*0.66, 1.2);
  drawGhostSilhouette (W*0.70, H*0.36, 0.9);

  // Sello Hack
  const stamp = 'Game created for the Platanus Hack 25 Game Challenge';
  const tmp = sceneRef.add.text(0,0,stamp,{fontFamily:'monospace',fontSize:'14px'}); const tw=tmp.width; tmp.destroy();
  g.fillStyle(0x000000,0.28); g.fillRect(10,H-28, tw+14, 22);
  const t2 = sceneRef.add.text(16,H-25, stamp, {fontFamily:'monospace', fontSize:'14px', color:'#e7e7e7'}); t2.destroy();
}
function drawSkeletonSilhouette(cx, cy, s){
  g.fillStyle(0x1a2033,0.95);
  g.fillRect(cx-10*s, cy-38*s, 20*s, 18*s);
  g.fillRect(cx-5*s, cy-20*s, 10*s, 28*s);
  g.fillRect(cx-18*s, cy-16*s, 36*s, 6*s);
  g.fillRect(cx-8*s,  cy+6*s,  6*s, 18*s);
  g.fillRect(cx+2*s,  cy+6*s,  6*s, 18*s);
}
function drawSpiderSilhouette(cx, cy, s){
  g.fillStyle(0x1a2033,0.95);
  g.fillCircle(cx, cy, 12*s);
  for(let i=0;i<4;i++){
    g.fillRect(cx-20*s+i*6*s, cy+8*s, 16*s, 3*s);
    g.fillRect(cx-20*s+i*6*s, cy-8*s, 16*s, 3*s);
  }
}
function drawGhostSilhouette(cx, cy, s){
  g.fillStyle(0x1a2033,0.7);
  g.fillRect(cx-16*s, cy-20*s, 32*s, 32*s);
}

/* ======= BOOTSTRAP ======= */
function showStageBanner(){
  if(bannerText) { bannerText.destroy(); bannerText=null; }
  const sceneName = LEVELS[(level-1)%LEVELS.length].name || `Stage ${level}`;
  bannerText = sceneRef.add.text(W/2, H*0.18, `Scene ${level}: ${sceneName}`, {
    fontFamily:'monospace', fontSize:'46px', color: HUD_COLOR, stroke: HUD_STROKE, strokeThickness:4
  }).setOrigin(0.5).setAlpha(1);
  stageBannerT=1800;
}
function bootstrapLevel(lv){
  level=lv; world={map:genMap(level)}; spawnPlayer(); enemies=spawnEnemies(level);
  portal=null; lastHit=0; lastShot=0; fxBeams.length=0; fxSparks.length=0; fxMuzzle=0;
  weaponT=0; walkT=0; skyFlash=0; damageFlash=0; fxOrbs.length=0;
  applySceneTheme(level);
  showStageBanner();
}

// --- OVERLAY ATTRACT (simple y liviano) ---
function drawAttractOverlay(t){
  // Banda translúcida superior para diferenciar "demo"
  g.fillStyle(0x000000, 0.22);
  g.fillRect(0, 0, W, 36);
  // Si quieres un pequeño pulso:
  const a = 0.05 + 0.05 * Math.sin(t * 0.006);
  g.fillStyle(0xffffff, a);
  g.fillRect(0, 36, W, 2);
}


/* ======= LOOP ======= */
function update(_t, dt=16){
  // Title screen
  if (mode==='title'){
  titleT += dt;
  drawTitleScreen(titleT);
  if (pressText) pressText.setAlpha(0.55 + 0.45*Math.sin(titleT*0.006));

  attractIdleMs += dt;
  if (attractIdleMs >= 30000){ // 30 s
    attractIdleMs = 0;
    startAttract();
  }
  return;
}

  // Attract autoplay (demo)
  if (mode==='attract'){
  if (!pressText){
    pressText = sceneRef.add.text(W/2, H*0.82, 'Press Start to Play', {
      fontFamily:'monospace', fontSize:'24px', color:'#f6e29a',
      stroke:'#1a1a1a', strokeThickness:3
    }).setOrigin(0.5).setDepth(2000);
  }
  pressText.setAlpha(0.55 + 0.45*Math.sin(performance.now()*0.004));

  aiTick(dt);
    tickEnemies(dt);
    tickFX(dt);
    tickMusic(dt);
    maybeSpawnPortal();
    if(portal) portal.t+=dt;
    if (warpEffectT>0) warpEffectT = Math.max(0, warpEffectT - dt);
    if(stageBannerT>0){
      stageBannerT=Math.max(0, stageBannerT-dt);
      if(bannerText){
        const a = (stageBannerT>300)?1:stageBannerT/300;
        bannerText.setAlpha(a);
        if(stageBannerT===0){ bannerText.destroy(); bannerText=null; }
      }
    }
    // IMPORTANTE: en attract no toques hi-score real
   draw3D();

if (mode !== 'attract'){
  drawHUD();
} else {
  drawAttractOverlay(titleT);
}
  }

  // Game Over
  if(gameOver){
    defeatTimer += dt;
    drawGameOverOverlay(defeatTimer);
    return;
  }

  // Modo normal de juego
  handleMovement(dt);
  tickEnemies(dt);
  tickFX(dt);
  tickMusic(dt);
  maybeSpawnPortal();
  if(portal) portal.t+=dt;
  if (warpEffectT>0) warpEffectT = Math.max(0, warpEffectT - dt);
  if(stageBannerT>0){
    stageBannerT=Math.max(0, stageBannerT-dt);
    if(bannerText){
      const a = (stageBannerT>300)?1:stageBannerT/300;
      bannerText.setAlpha(a);
      if(stageBannerT===0){ bannerText.destroy(); bannerText=null; }
    }
  }
  draw3D();
  drawHUD();
}

function drawGameOverOverlay(t){
  g.clear();
  g.fillStyle(0x000000,0.65); g.fillRect(0,0,W,H);
  const a = 0.18 + 0.10*Math.sin(t*0.004);
  g.fillStyle(0x3b4058,a); g.fillRect(0,0,W,H);
}

/* ======= MOVIMIENTO / DISPARO ======= */
function handleMovement(dt){
  let f=0,s=0,r=0;
  if(keys.W.isDown) f+=1; if(keys.S.isDown) f-=1;
  if(keys.Q.isDown) s-=1; if(keys.E.isDown) s+=1;
  if(keys.A.isDown) r-=1; if(keys.D.isDown) r+=1;

  player.ang+=r*ROT*dt*0.06;
  const ca=Math.cos(player.ang), sa=Math.sin(player.ang);
  const vx=(ca*f + (-sa)*s), vy=(sa*f + ca*s);
  const spd=(f?SPEED:STRAFE);

  const nx=player.x+vx*spd*dt*0.06; if(!isWall(nx,player.y)) player.x=nx;
  const ny=player.y+vy*spd*dt*0.06; if(!isWall(player.x,ny)) player.y=ny;

  moveMag = Math.min(1, Math.hypot(vx,vy));
  if(moveMag>0.01) walkT += dt*0.008; else walkT+=dt*0.003;
  weaponT = Math.max(0, weaponT - dt/180);

  if((keys.U.isDown||keys.ENTER.isDown||keys.ONE.isDown) && performance.now()-lastShot>FIRE_CD) tryFire();
}
function tryFire(){
  const now=performance.now(); if(now-lastShot<FIRE_CD) return; lastShot=now;
  const ray=castRay(player.x,player.y,player.ang);

  let best=-1,bestD=1e9;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i], dx=e.x-player.x, dy=e.y-player.y;
    const along=dx*Math.cos(player.ang)+dy*Math.sin(player.ang);
    if(along<0 || along>ray.dist+8) continue;
    const perp=Math.abs(-Math.sin(player.ang)*dx + Math.cos(player.ang)*dy);
    if(perp<12 && along<bestD){ bestD=along; best=i; }
  }
  if(best>=0){
    const e=enemies[best]; e.hp--; e.hitFlash = FLASH_MS;
    if(AC) sfxEnemyHit();
    if(e.hp<=0){ enemies.splice(best,1); score+=10; }
  }

  fxMuzzle=MUZZLE_LIFE;
  fxBeams.push({t:0, life:BEAM_LIFE, dist:ray.dist});
  fxSparks.push({t:0, life:SPARK_LIFE, dist:best>=0?bestD:ray.dist});
  weaponT = 1;
  fxOrbs.push({t:0, life:PROJECTILE_MS, dist: ray.dist});
  skyFlash = FLASH_MS;
  if(AC) sfxShot();
}

/* ======= ENEMIGOS ======= */
function tickEnemies(dt){
  const px=player.x, py=player.y, now=performance.now();
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; e.t+=dt;
    if(e.hitFlash>0) e.hitFlash=Math.max(0,e.hitFlash-dt);

    const bob= Math.sin(e.t*0.004)*0.2;
    const ang=Math.atan2(py-e.y, px-e.x);
    const vx=Math.cos(ang)*(e.spd+bob)*dt*0.04, vy=Math.sin(ang)*(e.spd+bob)*dt*0.04;
    if(!isWall(e.x+vx,e.y)) e.x+=vx; if(!isWall(e.x,e.y+vy)) e.y+=vy;

    if(d2(e.x,e.y,px,py)<(TILE*0.6)**2 && (now-lastHit>DMG_CD)){
      lastHit=now; player.hp=Math.max(0,player.hp-10);
      damageFlash = FLASH_MS;
      if(AC) sfxPlayerHit();
      if (player.hp <= 0){
  hi = Math.max(hi, score);
  score = 0;

  if (mode === 'attract'){
    // Demo: no quedamos en GAME OVER; regresamos a portada
    attract = false;
    setHUDVisible(false);  // por si acaso
    returnToTitle();
    return;
  } else {
    showGameOver();
    return;
  }
}


}

  }
  if(portal && Math.hypot(player.x-portal.x,player.y-portal.y)<PORTAL_SIZE){
    hi=Math.max(hi,score); score+=25;
    if(!AC) initAudio();
    if(AC) sfxTeleport();
    warpEffectT = WARP_MS;
    bootstrapLevel(level+1);
    return;
  }
}

/* ======= FX TEMPORALES ======= */
function tickFX(dt){
  for(let i=fxBeams.length-1;i>=0;i--){ fxBeams[i].t+=dt; if(fxBeams[i].t>fxBeams[i].life) fxBeams.splice(i,1); }
  for(let i=fxSparks.length-1;i>=0;i--){ fxSparks[i].t+=dt; if(fxSparks[i].t>fxSparks[i].life) fxSparks.splice(i,1); }
  if(fxMuzzle>0) fxMuzzle-=dt;
  for(let i=fxOrbs.length-1;i>=0;i--){ fxOrbs[i].t+=dt; if(fxOrbs[i].t>fxOrbs[i].life) fxOrbs.splice(i,1); }
  if(skyFlash>0)    skyFlash   = Math.max(0, skyFlash-dt);
  if(damageFlash>0) damageFlash= Math.max(0, damageFlash-dt);
}

/* --- helper: HP bar universal (minions con barra pequeña) --- */
function drawHPBar(sx, sy, w, h, hp, maxhp, isMinion=false){
  const bw = w * (isMinion?0.55:0.70);
  const bh = Math.max(2, h * (isMinion?0.025:0.04));
  const bx = sx + (w-bw)/2;
  const by = sy - bh - (isMinion?2:4);
  const pct = Math.max(0, Math.min(1, hp/Math.max(1,maxhp)));
  g.fillStyle(0x000000,0.6); g.fillRect(bx-2,by-2,bw+4,bh+4);
  g.fillStyle(0x7b1e1e,1);   g.fillRect(bx,by,bw,bh);
  g.fillStyle(0x2ee05f,1);   g.fillRect(bx,by,bw*pct,bh);
}
function aiTick(dt){
  if (!player) return;

  // Objetivo: portal si existe; si no, enemigo más cercano; si no, un “rumbo” aleatorio
  let tx = player.x + Math.cos(player.ang)*200;
  let ty = player.y + Math.sin(player.ang)*200;

  if (portal){ tx = portal.x; ty = portal.y; }
  else if (enemies && enemies.length){
    let best=null, bd=1e9;
    for(const e of enemies){
      const d=d2(player.x,player.y,e.x,e.y);
      if(d<bd){ bd=d; best=e; }
    }
    if(best){ tx=best.x; ty=best.y; }
  }

  // Girar hacia el objetivo
  const angTo = Math.atan2(ty - player.y, tx - player.x);
  let diff = angTo - player.ang;
  while(diff >  Math.PI) diff -= 2*Math.PI;
  while(diff < -Math.PI) diff += 2*Math.PI;

  const turn = Math.sign(diff) * Math.min(Math.abs(diff), ROT*1.6); // gira un poco más rápido
  player.ang += turn;

  // Avanzar + strafe aleatorio suave
  const ca=Math.cos(player.ang), sa=Math.sin(player.ang);
  const fwd = SPEED*0.9, str = (Math.sin(performance.now()*0.0018)>0?1:-1)*0.6;
  const vx=(ca*1 + (-sa)*str), vy=(sa*1 + ca*str);

  const nx=player.x+vx*fwd*dt*0.06; if(!isWall(nx,player.y)) player.x=nx;
  const ny=player.y+vy*fwd*dt*0.06; if(!isWall(player.x,ny)) player.y=ny;

  // Disparar si alineado (~cono pequeño) y cooldown listo
  const aligned = Math.abs(diff) < (FOV*0.12);
  if (aligned && performance.now()-lastShot>FIRE_CD*0.8) tryFire();
}


/* ======= DIBUJO 2.5D ======= */
function draw3D(){
  g.clear();
  const pal = LEVELS[(level-1)%LEVELS.length];

  const horizonY = (H >> 1) | 0;
  g.fillStyle(pal.sky, 1);   g.fillRect(0, 0, W, horizonY);
  g.fillStyle(pal.floor, 1); g.fillRect(0, horizonY, W, H - horizonY);
  if (skyFlash > 0){
    const a = 0.28 * (skyFlash/FLASH_MS);
    g.fillStyle(0xdfe9ff, a);
    g.fillRect(0, 0, W, horizonY);
  }
  g.fillStyle(0x000000, 0.06);
  g.fillRect(0, horizonY - 1, W, 2);

  const start = player.ang - FOV/2;
  const step  = FOV / RAYS;
  const colW  = W / RAYS;
  const zbuf  = new Array(RAYS);

  // Paredes
  for (let i=0; i<RAYS; i++){
    const ang = start + i*step;
    const ray = castRay(player.x, player.y, ang);
    let dist = ray.dist * Math.cos(ang - player.ang);
    dist = Math.max(0.0001, dist) - 0.10;
    dist = Math.max(0.0001, dist);
    zbuf[i] = dist;

    const h = Math.min(H, (TILE*180)/dist);
    const x = (i * colW) | 0;
    const k = 1/(1 + dist*0.01);
    const shade = Phaser.Display.Color.GetColor(30+(140*k)|0, 28+(90*k)|0, 70+(120*k)|0);
    g.fillStyle(shade, 1);
    g.fillRect(x, (H - h)/2, Math.ceil(colW)+1, h);
  }

  // Anti-filo (opcional)
  if (ZBUF_DILATE > 0){
    for (let pass=0; pass<ZBUF_DILATE; pass++){
      for (let i=1; i<RAYS-2; i++){
        const d = Math.min(zbuf[i], zbuf[i-1] + OCC_EPS*0.5, zbuf[i+1] + OCC_EPS*0.5);
        zbuf[i] = d;
      }
    }
  }
  lastZBuf = zbuf;

  // Sprites
  const sprites = [];
  for (const e of enemies){
    const dx = e.x - player.x, dy = e.y - player.y;
    let angTo = Math.atan2(dy, dx) - player.ang;
    while (angTo >  Math.PI) angTo -= 2*Math.PI;
    while (angTo < -Math.PI) angTo += 2*Math.PI;

    const dist = Math.hypot(dx, dy);
    if (Math.abs(angTo) > FOV*1.18 || dist < 4) continue;

    const depth = Math.max(0.0001, dist * Math.cos(angTo));
    const h = Math.max(MIN_SPRITE_PX, Math.min(H, (TILE*220)/dist));
    const w = Math.max(MIN_SPRITE_PX, h * 0.7);
    const sx = W/2 + Math.tan(angTo) * (W/2/Math.tan(FOV/2)) - w/2;
    const sy = H/2 - h*0.55;

    if (sx + w < 0 || sx > W) continue;

    const slicesPass = countVisibleSlices(sx, w, depth, colW, zbuf, SPRITE_SLICES, SPRITE_EPS);
    const central    = Math.abs(angTo) < (FOV * 0.25);
    const veryClose  = dist < TILE*1.8;
    const losPass    = (central || veryClose) && hasLOS(player.x, player.y, e.x, e.y);

    if (slicesPass >= 2 || losPass){
      sprites.push({ sx, sy, w, h, t: e.t, dist, depth, type: e.type, hp: e.hp, maxhp: e.maxhp, hitFlash: e.hitFlash });
    }
  }

  // Pintado de lejos a cerca + HP bar universal
  sprites.sort((a,b)=> b.dist - a.dist);
  for (const s of sprites){
    drawEnemyBillboard(s.type, s.sx, s.sy, s.w, s.h, s.t, s.dist);

    if (s.hitFlash > 0){
      const a = 0.45 * (s.hitFlash / FLASH_MS);
      g.fillStyle(0xff3355, a);
      g.fillRect(s.sx, s.sy, s.w, s.h);
    }
    

    // Todos con barra; minion si es snake/spider/skull/bat/swarm
    const isMinion = ['snake','spider','skull','bat','swarm'].includes(s.type);
    drawHPBar(s.sx, s.sy, s.w, s.h, s.hp, s.maxhp, isMinion);
  }

  // BEAM central (ocluido por zbuf)
  for (const b of fxBeams){
    const alpha = 1 - (b.t/b.life);
    const dist  = b.dist, colIdx = (RAYS/2)|0;
    if (dist <= zbuf[colIdx] - 1){
      const x = W/2, y = H/2;
      const h = Math.min(H, (TILE*220)/Math.max(0.0001, dist));
      const reach = Math.max(30, h*0.9);
      g.lineStyle(3, 0x9bd4ff, 0.9*alpha);
      g.beginPath(); g.moveTo(x, y+6); g.lineTo(x, y-reach); g.strokePath();
      g.lineStyle(1, 0xffffff, 0.6*alpha);
      g.beginPath(); g.moveTo(x, y+6); g.lineTo(x, y-reach); g.strokePath();
    }
  }

  // Orbe viajero
  for (const o of fxOrbs){
    const maxH  = Math.min(H, (TILE*220)/Math.max(0.0001, o.dist));
    const reach = Math.max(30, maxH*0.95);
    const p = o.t / o.life;
    const y = H/2 - reach * Math.min(1, p);
    const x = W/2;
    g.fillStyle(0xb9d6ff, 0.30); g.fillRect(x-8, y-8, 16, 16);
    g.fillStyle(0x96c0ff, 0.55); g.fillRect(x-5, y-5, 10, 10);
    g.fillStyle(0xffffff, 0.95); g.fillRect(x-2, y-2, 4, 4);
  }

  // HUD báculo
  drawStaffHUD();

  // ===== Portal pórtico (visibilidad robusta como sprites) =====
if (portal){
  const dx = portal.x - player.x, dy = portal.y - player.y;
  let ang = Math.atan2(dy, dx) - player.ang;
  while (ang >  Math.PI) ang -= 2*Math.PI;
  while (ang < -Math.PI) ang += 2*Math.PI;

  const dist = Math.hypot(dx, dy);
  // Si está muy fuera de FOV, no lo intentes proyectar (opcional)
  if (Math.abs(ang) < FOV*1.05){
    const depth = Math.max(0.0001, dist * Math.cos(ang));
    const h = Math.min(H, (TILE*260)/dist), w = h*0.55;
    const sx = W/2 + Math.tan(ang)*(W/2/Math.tan(FOV/2)) - w/2;
    const sy = H/2 - h*0.55;

    if (!(sx + w < 0 || sx > W)) {
      // Visibilidad por rebanadas + LOS como fallback
      const epsPortal = SPRITE_EPS + 6;     // un poco más permisivo
      const slices    = Math.max(4, SPRITE_SLICES >> 1);
      const colW      = W / RAYS;

      let visSlices = 0;
      for (let k=0; k<slices; k++){
        const f0 = k / slices, f1 = (k+1) / slices;
        const x0 = sx + w*f0,   x1 = sx + w*f1;
        let c0 = Math.floor(x0 / colW), c1 = Math.floor(x1 / colW);
        c0 = Math.max(0, Math.min(RAYS-1, c0));
        c1 = Math.max(0, Math.min(RAYS-1, c1));
        if (c1 < c0){ const t=c0; c0=c1; c1=t; }
        if (sliceIsVisible(lastZBuf, c0, c1, depth, epsPortal)) visSlices++;
      }

      const losOK = hasLOS(player.x, player.y, portal.x, portal.y);
      if (visSlices >= 1 || losOK){
        drawPortalArch(sx, sy, w, h, portal.t||0);
      }
    }
  }
}


  // Overlays
  if (damageFlash > 0){
    const a = 0.45 * (damageFlash/FLASH_MS);
    g.fillStyle(0xff1133, a);
    g.fillRect(0, 0, W, H);
  }
  if (warpEffectT > 0) drawWarpOverlay();

  // Crosshair
  g.fillStyle(0xffffff, 1);
  g.fillRect(W/2 - 1, H/2 - 1, 2, 2);
}

/* ======= BÁCULO (HUD) ======= */
function drawStaffHUD(){
  const S = 3.3;
  const bob  = Math.sin(walkT*6)*6*moveMag * S*0.25;
  const sway = Math.sin(walkT*3.2)*5*moveMag * S*0.25;
  const push = weaponT*30 * S*0.55;

  const baseX  = W*(0.82) + sway;
  const topY   = H*(0.42) - push;
  const baseY  = H*(0.98) + bob - push*0.1;

  const shaftW = 6*S;
  const ringH  = 6*S*0.8;
  const ringW  = (shaftW+4*S*0.6);
  const crownW1= 36*S, crownW2=28*S, crownW3=20*S;
  const gem    = 6*S;

  g.fillStyle(0x2d3e66,1);
  g.fillRect(baseX - shaftW/2, topY, shaftW, baseY - topY);

  g.fillStyle(0xb68c3a,1);
  for(let i=0;i<5;i++){
    const yy = baseY - (12*S) - i*(13*S);
    g.fillRect(baseX - ringW/2, yy, ringW, ringH);
  }

  const crownY = topY - (9*S);
  g.fillStyle(0x9fb7ff,1);
  g.fillRect(baseX - crownW1/2, crownY + 4*S, crownW1, 3*S);
  g.fillRect(baseX - crownW2/2, crownY,       crownW2, 3*S);
  g.fillRect(baseX - crownW3/2, crownY - 4*S, crownW3, 3*S);

  g.fillStyle(0xffef9a,1);
  g.fillRect(baseX - gem/2, crownY - gem/2 + 2*S, gem, gem);

  if (weaponT > 0){
    const a = weaponT;
    g.fillStyle(0xbfe1ff,0.7*a); g.fillRect(baseX - (2*S)/2, topY - 10*S, 2*S, 10*S);
    g.fillStyle(0xffffff,0.9*a); g.fillRect(baseX - (1*S)/2, topY - 14*S, 1*S,  6*S);
  }
}
function drawWarpOverlay(){
  const k = 1 - (warpEffectT / WARP_MS);
  const a = 0.6 * (1 - k*k);
  g.fillStyle(0x9bd4ff, 0.25*a); g.fillRect(0,0,W,H);
  for(let y=0; y<H; y+=4){
    const off = Math.sin((y*0.08) + k*20) * 12 * (1-k);
    g.fillStyle(0xbfe1ff, 0.08*a);
    g.fillRect(off, y, W - off*2, 2);
  }
  const rings = 8, base = Math.max(W,H)*0.06;
  for(let i=0;i<rings;i++){
    const r = base + (i + k*rings) * (Math.max(W,H)*0.06);
    const alpha = Math.max(0, 0.22 * (1 - i/rings) * (1 - k*0.7));
    g.lineStyle(Math.max(2, 10*(1-k)), 0x7fb6ff, alpha);
    g.strokeCircle(W/2, H/2, r);
  }
  g.fillStyle(0xffffff, 0.12*a);
  g.fillRect(W/2-40*(1-k), H/2-40*(1-k), 80*(1-k), 80*(1-k));
}

/* ======= PORTAL PÓRTICO ======= */
function drawPortalArch(sx,sy,w,h,t){
  const colBands = 6;
  const innerW = w*0.55;
  const shimmer = (Math.sin(t*0.006)+1)*0.5;
  g.fillStyle(0x6aa0ff,1); g.fillRect(sx, sy, w*0.08, h);
  g.fillStyle(0x6aa0ff,1); g.fillRect(sx+w*0.92, sy, w*0.08, h);
  for(let i=0;i<colBands;i++){
    const bw = innerW + i*(w-innerW)/colBands;
    const y  = sy + h*0.05 + i*(h*0.10/colBands);
    const a  = 0.5 + 0.5*Math.sin(t*0.01 + i*1.3);
    const col = Phaser.Display.Color.GetColor((80+120*a)|0, (40+60*shimmer)|0, (160+60*a)|0);
    g.fillStyle(col,0.85);
    g.fillRect(sx+(w-bw)/2, y, bw, 6);
  }
  for(let y=0;y<h*0.78;y+=6){
    const a = 0.35 + 0.35*Math.sin((t*0.02)+(y*0.12));
    const col = Phaser.Display.Color.GetColor(120,170,255);
    const lineW = innerW*(0.9+0.1*Math.sin(t*0.007+y*0.03));
    g.fillStyle(col,a);
    g.fillRect(sx+(w-lineW)/2, sy+h*0.12+y, lineW, 4);
  }
}

/* ======= ENEMIGOS (procedurales) ======= */
function drawEnemyBillboard(type,sx,sy,w,h,t=0,dist=50){
  if(type==="medusa") return drawMedusaBillboard(sx,sy,w,h,t,8,dist);
  if(type==="skeleton") return drawSkeletonBillboard(sx,sy,w,h,t);
  if(type==="zombie")   return drawZombieBillboard(sx,sy,w,h,t);
  if(type==="golem")    return drawGolemBillboard(sx,sy,w,h,t);
  if(type==="werewolf") return drawWerewolfBillboard(sx,sy,w,h,t);
  if(type==="ghost")    return drawGhostBillboard(sx,sy,w,h,t);
  if(type==="demon")    return drawDemonBillboard(sx,sy,w,h,t);
  if(type==="bat")      return drawBatBillboard(sx,sy,w,h,t);
  if(type==="eye")      return drawEyeBillboard(sx,sy,w,h,t);
  if(type==="snake")    return drawSnakeMinion(sx,sy,w,h,t);
  if(type==="spider")   return drawSpiderMinion(sx,sy,w,h,t);
  if(type==="skull")    return drawSkullMinion(sx,sy,w,h,t);

  const Y=sy+h*0.35, ew=w*0.6, x=sx+w*0.2;
  switch(type){
    case "imp":   g.fillStyle(0x7d2730,1);    g.fillRect(x,Y-h*0.45,ew,h*0.9); g.fillStyle(0x000000,1); g.fillRect(x+ew*0.2,Y-h*0.3,ew*0.6,3); break;
    case "ghost": g.fillStyle(0xcfe6ff,0.75); g.fillRect(x+ew*0.1,Y-h*0.3,ew*0.8,h*0.6); break;
    default: g.fillStyle(0x6c5b3d,1); g.fillRect(x,Y-h*0.45,ew,h*0.9); break;
  }
}
// ===== HUMANOIDE GENÉRICO (piernas/brazos) =====
function drawHumanoidBillboard(sx, sy, w, h, t=0, opts={}){
  const {
    bodyCol=0x6c5b3d, outline=0x000000,
    headScale=0.22, torsoScale=0.42, limbW=0.10,
    walkSpeed=0.018, attack=0, // attack: 0..1
    extra = null                  // callback(g, parts)
  } = opts;

  const cx = sx + w*0.5;
  const headH  = h*headScale;
  const torsoH = h*torsoScale;
  const legH   = h - headH - torsoH;
  const limbThickness = Math.max(2, w*limbW);

  // ciclo de caminata
  const walk = Math.sin(t*walkSpeed);
  const step = walk * 0.55;           // -0.55..0.55

  // Brazos: swing + “ataque” (levanta el derecho, baja el izq)
  const armSwingR = (step*0.6) + (attack*0.9);
  const armSwingL = (-step*0.6) - (attack*0.4);

  // Piernas: paso contrario a brazos
  const legSwingR = (-step);
  const legSwingL = ( step);

  // Torso
  const torsoTop = sy + headH;
  const torsoW = w*0.36;
  g.fillStyle(bodyCol, 1); g.fillRect(cx - torsoW/2, torsoTop, torsoW, torsoH);

  // Cabeza (elipse rectangular)
  const headW = w*0.30;
  g.fillStyle(bodyCol, 1); g.fillRect(cx - headW/2, sy, headW, headH*0.85);
  // ojos sencillos (zombie/demonio tunean colores en extra)
  g.fillStyle(0x000000, 1); g.fillRect(cx - headW*0.22, sy+headH*0.35, headW*0.14, 3);
  g.fillRect(cx + headW*0.08, sy+headH*0.35, headW*0.14, 3);

  // Brazos (anclados a la parte superior del torso)
  const armLen = h*0.36, shoulderY = torsoTop + h*0.06;
  drawLimb(cx - torsoW*0.55, shoulderY, limbThickness, armLen, armSwingL, bodyCol); // izq
  drawLimb(cx + torsoW*0.55, shoulderY, limbThickness, armLen, armSwingR, bodyCol); // der

  // Piernas (desde base del torso)
  const hipY = torsoTop + torsoH;
  const legLen = legH*0.98;
  drawLimb(cx - torsoW*0.24, hipY, limbThickness, legLen, legSwingL, bodyCol);
  drawLimb(cx + torsoW*0.24, hipY, limbThickness, legLen, legSwingR, bodyCol);

  // “Sombra” bajo pies para anclar
  g.fillStyle(0x000000, 0.12);
  g.fillRect(cx - w*0.25, sy + h - 4, w*0.5, 4);

  // Personalización por tipo
  if (typeof extra === 'function') extra(g, {cx, sy, w, h, headH, torsoTop, torsoW, bodyCol});
}

function drawLimb(x, y, thick, len, swing, col){
  // segmento simple “articulado”: dos tramos
  const mid = y + len*0.55;
  const off = swing * (len*0.22);
  g.fillStyle(col, 1);
  // tramo superior
  g.fillRect(x + off*0.5 - thick/2, y, thick, len*0.55);
  // tramo inferior
  g.fillRect(x + off - thick/2, mid, thick, len*0.45);
}


/* ======= MEDUSA (pelo serpiente verde) ======= */
function drawMedusaBillboard(sx, sy, w, h, t=0, snakes=8, dist=50) {
  const SKIN = 0xf2d5bd, OUT = 0x2f3b4a, LIP = 0x9e2a4d, EYE = 0xffffff;
  const HAIR = 0x2e7d32, SCALE = 0xa5d6a7, TONGUE = 0xff6a6a;
  for (let i=0;i<22;i++){
    const p=i/21, ww=w*(0.68-0.18*Math.cos(p*Math.PI)), x=sx+(w-ww)/2, y=sy+h*0.12+p*h*0.66, hh=h*0.66/22+1;
    g.fillStyle(SKIN,1); g.fillRect(x,y,ww,hh);
  }
  g.fillStyle(OUT,1); g.fillRect(sx+w*0.16, sy+h*0.12, w*0.68, 2); g.fillRect(sx+w*0.16, sy+h*0.78, 2+w*0.68, 2);

  const blink = 0.5 + 0.5*Math.sin(t*0.006);
  const ey=sy+h*0.36, eh=h*(0.045+0.012*blink), ew=w*0.11, ex1=sx+w*0.30, ex2=sx+w*0.59;
  g.fillRect(ex1-2, ey-10, ew+4, 2); g.fillRect(ex2-2, ey-10, 2+ew, 2);
  g.fillStyle(EYE,1); g.fillRect(ex1,ey,ew,eh); g.fillRect(ex2,ey,ew,eh);

  const open = dist<60 ? (1 - dist/60) : 0;
  const my= sy + h*(0.56), mw= w*0.24, mh= h*(0.06+0.06*open);
  g.fillStyle(LIP,1); g.fillRect(sx+w*0.38, my, mw, mh);
  g.fillStyle(0xffffff,1); g.fillRect(sx+w*0.47, my-3, 3, 6); g.fillRect(sx+w*0.60, my-3, 3, 6);

  for (let i=snakes-1;i>=0;i--){
    const ph=t*0.004+i*0.8, baseX=sx+w*(0.26+0.56*(i/(snakes-1))), baseY=sy+h*(0.16+0.03*Math.sin(ph));
    const len=h*(0.24+0.05*Math.sin(ph*1.3+i)), segs=7;
    for (let s=0;s<segs;s++){
      const p=s/segs, ox=Math.sin(ph+p*3.1)*w*0.05, oy=baseY+p*len;
      g.fillStyle(HAIR,1);  g.fillRect(baseX+ox, oy, 10, 9);
      g.fillStyle(SCALE,1); g.fillRect(baseX+ox+3, oy+2, 4, 4);
    }
    const hx=baseX+Math.sin(ph+3.1)*w*0.05, hy=baseY+len;
    g.fillStyle(HAIR,1);  g.fillRect(hx, hy, 14, 12);
    g.fillStyle(TONGUE,1); g.fillRect(hx+10, hy+6, 3, 3);
    g.fillStyle(0xffffff,1); g.fillRect(hx+9, hy+4, 2, 2);
  }
  g.fillStyle(0x000000,0.14); g.fillRect(sx+w*0.18, sy+h*0.55, w*0.64, h*0.23);
}

/* ======= ESQUELETO ======= */
function drawSkeletonBillboard(sx,sy,w,h,t=0){
  const cx=sx+w*0.5, top=sy+h*0.20;
  g.fillStyle(0xffffff,1); g.fillRect(cx-w*0.18, top, w*0.36, h*0.18);
  g.fillStyle(0x000000,1); g.fillRect(cx-w*0.09, top+h*0.05, w*0.06, h*0.05); g.fillRect(cx+w*0.03, top+h*0.05, w*0.06, h*0.05);
  g.fillRect(cx-w*0.04, top+h*0.12, w*0.08, 3);
  const bones=6; for(let i=0;i<bones;i++){ g.fillStyle(0xffffff,1); g.fillRect(cx-w*0.04, top+h*(0.20+i*0.08), w*0.08, h*0.05); }
  g.fillRect(cx-w*0.25, top+h*0.28, w*0.2, 4); g.fillRect(cx+w*0.05, top+h*0.28, w*0.2, 4);
}

/* ======= BOSS / ENEMIES EXTRAS ======= */
function drawZombieBillboard(sx,sy,w,h,t){
  drawHumanoidBillboard(sx,sy,w,h,t,{
    bodyCol:0x6b8e5e, walkSpeed:0.014,
    extra:(g,p)=>{
      // boca “sangre”
      g.fillStyle(0xb92e2e,1);
      g.fillRect(p.cx - w*0.05, p.torsoTop - h*0.06, w*0.10, 4);
    }
  });
}
function drawGolemBillboard(sx,sy,w,h,t){
  g.fillStyle(0x565646,1);
  for(let i=0;i<10;i++){ g.fillRect(sx+(i*13)%w, sy+h*0.1+((i*7)%10), 12, h*0.82-((i*5)%20)); }
}
function drawWerewolfBillboard(sx,sy,w,h,t){
  drawHumanoidBillboard(sx,sy,w,h,t,{
    bodyCol:0x4a3b2a, walkSpeed:0.022,
    extra:(g,p)=>{
      // hocico y orejas
      g.fillStyle(0xfff59d,1);
      g.fillRect(p.cx - w*0.04, sy + h*0.12, w*0.08, 4);
      g.fillRect(p.cx - w*0.10, sy + h*0.02, w*0.06, 6);
      g.fillRect(p.cx + w*0.04, sy + h*0.02, w*0.06, 6);
    }
  });
}
function drawGhostBillboard(sx,sy,w,h,t){
  const a=0.55+0.2*Math.sin(t*0.008);
  g.fillStyle(0xbfd9ff,a); g.fillRect(sx+w*0.2, sy+h*0.2, w*0.6, h*0.6);
}
function drawDemonBillboard(sx,sy,w,h,t){
  // Si está muy cerca, sube “attack” para levantar brazo derecho
  const near = Math.max(0, 1 - Math.min(1, Math.hypot(player.x - (sx+w/2), player.y - (sy+h/2)) / 90));
  drawHumanoidBillboard(sx,sy,w,h,t,{
    bodyCol:0x7a1d1d, walkSpeed:0.019, attack:near,
    extra:(g,p)=>{
      // cuernos y ojo/brasas
      g.fillStyle(0xffd54f,1);
      g.fillRect(p.cx - w*0.12, sy + h*0.17, w*0.08, 3);
      g.fillRect(p.cx + w*0.04, sy + h*0.17, w*0.08, 3);
      g.fillRect(p.cx - 2, sy + h*0.30, 4, 4);
    }
  });
}
function drawBatBillboard(sx,sy,w,h,t){
  const flap = 0.3+0.2*Math.sin(t*0.02);
  g.fillStyle(0x1a1a1a,1);
  g.fillRect(sx+w*(0.5-flap), sy+h*0.35, w*flap, h*0.08);
  g.fillRect(sx+w*0.5,         sy+h*0.35, w*flap, h*0.08);
  g.fillRect(sx+w*0.48, sy+h*0.28, w*0.04, h*0.12);
}
function drawEyeBillboard(sx,sy,w,h,t){
  g.fillStyle(0xffffff,1); g.fillRect(sx+w*0.32, sy+h*0.32, w*0.36, h*0.36);
  g.fillStyle(0x3f51b5,1); g.fillRect(sx+w*0.44, sy+h*0.44, w*0.12, h*0.12);
  g.fillStyle(0x000000,1); g.fillRect(sx+w*0.49, sy+h*0.49, w*0.04, h*0.04);
}

/* ======= MINIONS ======= */
function drawSnakeMinion(sx,sy,w,h,t){
  const segs=6, ww=w*0.4;
  for(let i=0;i<segs;i++){
    const y=sy+h*(0.2+i*(0.6/segs)), x=sx+w*0.3 + Math.sin(t*0.02+i*0.6)*w*0.15;
    g.fillStyle(0x2e7d32,1); g.fillRect(x, y, ww, h*0.08);
  }
}
function drawSpiderMinion(sx,sy,w,h,t){
  g.fillStyle(0x2f2f2f,1); g.fillRect(sx+w*0.4, sy+h*0.45, w*0.2, h*0.18);
  for(let i=0;i<4;i++){
    const yy=sy+h*0.45+i*5;
    g.fillRect(sx+w*0.35-i*2, yy, w*0.1, 3);
    g.fillRect(sx+w*0.55+i*2, yy, w*0.1, 3);
  }
}
function drawSkullMinion(sx,sy,w,h,t){
  g.fillStyle(0xeeeeee,1); g.fillRect(sx+w*0.35, sy+h*0.35, w*0.3, h*0.22);
  g.fillStyle(0x000000,1); g.fillRect(sx+w*0.39, sy+h*0.41, w*0.06, h*0.06);
  g.fillRect(sx+w*0.55, sy+h*0.41, w*0.06, h*0.06);
  g.fillRect(sx+w*0.46, sy+h*0.53, w*0.08, 3);
}

/* ======= HUD / MINIMAPA ======= */
function drawHUD(){
  const L = LEVELS[(level-1)%LEVELS.length];

  // Panel superior minimalista
  const P = { x: 12, y: 10, w: W - 24, h: 56 };

  // Panel (tonalidad adaptativa por escena)
  const baseCol = (luminance(LEVELS[(level-1)%LEVELS.length].floor) > 0.55) ? 0xF2F5FE : 0xE3E7F1;
  uiPanel(g, P.x, P.y, P.w, P.h, baseCol, 0x1a2233, 0.90);

  // Barra de HP a la derecha (no se superpone)
  const HPW = 240, HPH = 14;
  const HPX = P.x + P.w - HPW - 14;         // margen derecho fijo
  const HPY = P.y + (P.h - HPH)/2;
  uiHPBar(g, HPX, HPY, HPW, HPH, player.hp/100);

  // Texto principal (reutilizable)
  const leftPad = P.x + 14;
  const rightStop = HPX - 12;               // zona segura antes de la barra
  const maxMainW = Math.max(60, rightStop - leftPad);

  const mainLine = `Score: ${score}   Scene ${level}: ${L.name}   HS: ${hi}`;
  hudMain.setStyle({ color: '#1a2233' });
  hudMain.setPosition(leftPad, P.y + 12);
  fitTextToWidth(hudMain, mainLine, maxMainW);

  // Controles (segunda línea, tono suave)
  const smallLine = `W/S mover  A/D girar  Q/E strafe  U disparo  M música`;
  hudSmall.setStyle({ color: '#4b5563' });
  hudSmall.setPosition(leftPad, P.y + 32);
  fitTextToWidth(hudSmall, smallLine, maxMainW);

  // === Minimap con marco consistente ===
  mapG.clear();
  const mmW=180, mmH=126, ox=14, oy=H-mmH-14, sX=mmW/(MAPW*TILE), sY=mmH/(MAPH*TILE);
  uiPanel(mapG, ox-6, oy-6, mmW+12, mmH+12, baseCol, 0x1a2233, 0.86);

  mapG.fillStyle(0x6a6f78,1);
  for(let y=0;y<MAPH;y++) for(let x=0;x<MAPW;x++){
    if(world.map[y][x]===1)
      mapG.fillRect(ox+x*TILE*sX, oy+y*TILE*sY, Math.max(1,TILE*sX-1), Math.max(1,TILE*sY-1));
  }

  // jugador + orientación
  const px = ox + player.x*sX, py = oy + player.y*sY;
  mapG.fillStyle(0x7be1ff,1); mapG.fillRect(px-2, py-2, 4,4);
  const len = 16, hx = px + Math.cos(player.ang)*len, hy = py + Math.sin(player.ang)*len;
  mapG.lineStyle(2, 0x7be1ff, 1); mapG.beginPath(); mapG.moveTo(px,py); mapG.lineTo(hx,hy); mapG.strokePath();
  const side = 6;
  const leftX  = hx + Math.cos(player.ang + Math.PI*0.75)*side;
  const leftY  = hy + Math.sin(player.ang + Math.PI*0.75)*side;
  const rightX = hx + Math.cos(player.ang - Math.PI*0.75)*side;
  const rightY = hy + Math.sin(player.ang - Math.PI*0.75)*side;
  mapG.fillStyle(0x7be1ff,1);
  mapG.beginPath(); mapG.moveTo(hx,hy); mapG.lineTo(leftX,leftY); mapG.lineTo(rightX,rightY); mapG.closePath(); mapG.fillPath();

  // enemigos y portal
  mapG.fillStyle(0xff5555,1); enemies.forEach(e=> mapG.fillRect(ox+e.x*sX-2, oy+e.y*sY-2, 4,4));
  if(portal){ mapG.fillStyle(0x8ab4ff,1); mapG.fillRect(ox+portal.x*sX-2, oy+portal.y*sY-2, 4,4); }
}
