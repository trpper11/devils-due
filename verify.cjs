/* Headless verification for Devil's Due.
   Serves the folder, then for each flat level runs two bots:
     - NAIVE  (hold right, never jump): must DIE and fail to reach the door  -> proves rage bait.
     - MEMORY (knows every trap column): must clear the level                -> proves beatable.
   L4 (vertical) is driven by a bespoke scripted climb. */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("/root/.npm/_npx/705bc6b22212b352/node_modules/playwright");

const ROOT = __dirname, PORT = Number(process.env.PORT || 8731);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/play.html";
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "text/plain" }); res.end(d); });
});

const BOT = `
// DETERMINISTIC verifier: drives physics synchronously via Due.tick() (no real-time timers / render),
// so results are reproducible and fast regardless of headless render load. 1 iter = Due.tick(2) = 1/60s.
window.__resetKeys = function(){ Due.press('left',false); Due.press('right',false); Due.press('jump',false); };
window.__naive = function(level){
  Due.setHeadless(true); __resetKeys(); Due.goto(level); const T=Due.TILE,PW=Due.PW; Due.press('right',true);
  for(let it=0; it<1000; it++){
    if(Due.level!==level||Due.state==='won-anim'||Due.state==='win'){ Due.press('right',false); return {reached:true,deaths:Due.deaths}; }
    Due.tick(2);
  }
  const p=Due.player; Due.press('right',false);
  return {reached:false,deaths:Due.deaths,x:Math.round((p.x+PW/2)/T)};
};
window.__memory = function(level){
  Due.setHeadless(true); __resetKeys(); Due.goto(level);
  const T=Due.TILE,PW=Due.PW,PH=Due.PH,lv=LEVELS[level];
  let prow=-1; lv.grid.forEach((row,r)=>{ if(row.includes('S')) prow=r; }); const frow=prow+1;
  const jset=new Set(), add=c=>jset.add(c-1);
  if(!lv.manual){ const fr=lv.grid[frow]||"";
    for(let c=0;c<fr.length;c++){ const ch=fr[c];
      if(ch==='v'||ch==='B') add(c);
      if(ch===' '&&fr[c-1]&&fr[c-1]!==' '&&fr[c-1]!=='S') add(c); } }
  (lv.traps||[]).forEach(t=>{ if(['popspike','doorspike','risefloor','drop'].includes(t.do)) add(t.c); });
  (lv.fakeDoors||[]).forEach(d=>add(d.c));
  (lv.jumpCols||[]).forEach(c=>jset.add(c));
  let jhold=0, jcool=0, lastX=-1, stuck=0, lastDeaths=0, dcols=[], maxc=0;
  for(let it=0; it<6000; it++){
    const p=Due.player; if(!p) break;
    const pc=Math.floor((p.x+PW/2)/T); if(pc>maxc) maxc=pc;
    if(Due.deaths>lastDeaths){ lastDeaths=Due.deaths; dcols.push(pc); }
    if(Due.level!==level||Due.state==='won-anim'||Due.state==='win'){ return {ok:true,deaths:Due.deaths,jset:[...jset].sort((a,b)=>a-b)}; }
    const ex=Due.exitPx(); const dir = !ex?1 : (ex.x>p.x+4?1 : (ex.x<p.x-4?-1:0));
    // --- platform / pit-edge awareness (ride moving boxes & lifts; wait at edges; don't walk into voids) ---
    const plats = Due.platforms?Due.platforms():[]; const footY=p.y+PH, fr0=Math.round(footY/T);
    const solidGrid=(c,r)=>{ const ch=((lv.grid[r]||"")[c])||' '; return '#=<>~Jc'.indexOf(ch)>=0; };   // c=crumble is walkable; v/B are jumped via jumpCols
    const onPlat = plats.find(pl=> p.x < pl.x+pl.w-2 && p.x+PW > pl.x+2 && Math.abs(pl.y-footY)<12);
    const aheadC = pc + (dir||1);
    const platAhead = plats.find(pl=> pl.x < (aheadC+1)*T && pl.x+pl.w > aheadC*T && pl.y>footY-14 && pl.y<footY+52);
    const supportedAhead = solidGrid(aheadC,fr0)||solidGrid(aheadC,fr0+1)||!!platAhead;
    // is walking off the edge a SAFE drop (solid ground below before any spikes) or a deadly void?
    let safeDrop=false; for(let r=fr0+1;r<lv.grid.length && r<fr0+13;r++){ const ch=((lv.grid[r]||"")[aheadC])||' ';
      if(ch==='^'||ch==='B'){break;} if('#=<>~Jc'.indexOf(ch)>=0){ safeDrop=true; break; } }   // land on ground/crumble = safe; spikes/bait = not
    let hold=false;
    if(p.onGround && dir!==0 && !jset.has(pc) && !safeDrop){   // safe drops (deck->ground) are fine; only wait over deadly voids
      if(onPlat){ const farCol = Math.floor((dir>0 ? onPlat.x+onPlat.w+2 : onPlat.x-2)/T);
        const groundPastFar = solidGrid(farCol,fr0) || solidGrid(farCol,fr0+1);
        if(!groundPastFar) hold=true; }                    // ride the box centered; only walk off when real ground is past its leading edge
      else if(!supportedAhead) hold=true;                  // at a pit edge, no platform yet: wait to board
    }
    Due.press('right',dir>0 && !hold); Due.press('left',dir<0 && !hold);
    if(jcool>0) jcool--;
    if(p.onGround && jcool===0 && !hold){
      let want = jset.has(pc);
      const pcx=p.x+PW/2, pcy=p.y+PH/2;
      for(const q of (Due.projectiles?Due.projectiles():[])){ const qx=q.x+q.w/2, dx=qx-pcx;   // shots, javelins AND saws
        if(((q.vx<0&&dx>0&&dx<160)||(q.vx>0&&dx<0&&dx>-160)||Math.abs(dx)<74) && Math.abs((q.y+q.h/2)-pcy)<52){ want=true; break; } }
      if(Math.abs(p.x-lastX)<0.4) stuck++; else stuck=0;
      if(stuck>26){ want=true; stuck=0; }
      if(want){ jhold=12; jcool=18; }   // ~200ms full-height jump
    }
    if(hold) stuck=0;                    // waiting for a platform is not "stuck"
    lastX=p.x;
    if(jhold>0){ Due.press('jump',true); jhold--; } else Due.press('jump',false);
    Due.tick(2);
  }
  return {ok:false,deaths:Due.deaths,maxc,deathCols:dcols.slice(-12),jset:[...jset].sort((a,b)=>a-b),reason:'timeout'};
};
`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
  await page.addInitScript(BOT);
  await page.goto("http://localhost:" + PORT + "/play.html");
  await page.waitForFunction("window.Due && window.LEVELS");
  const nLevels = await page.evaluate("LEVELS.length");
  console.log("levels:", nLevels, "| names:", await page.evaluate("LEVELS.map(l=>l.name)"));

  const only = process.argv[2] != null ? [Number(process.argv[2])] : null;
  const flat = only || Array.from({ length: 20 }, (_, i) => i);
  for (const lv of flat) {
    const name = await page.evaluate("LEVELS[" + lv + "].name");
    const naive = await page.evaluate("__naive(" + lv + ")");
    const mem = await page.evaluate("__memory(" + lv + ")");
    const ragePass = !naive.reached && naive.deaths > 0;
    console.log(`L${lv + 1} ${name}`);
    console.log(`   rage : naive ${naive.reached ? "REACHED (BAD)" : "died @col " + naive.x}, deaths=${naive.deaths}  -> ${ragePass ? "OK" : "FAIL"}`);
    console.log(`   beat : memory ${mem.ok ? "CLEARED" : "STUCK maxcol " + mem.maxc + " deathCols=[" + (mem.deathCols||[]).join(",") + "]"}, deaths=${mem.deaths}  -> ${mem.ok ? "OK" : "FAIL"}`);
    console.log(`   jset(jump@cols): [${mem.jset.join(",")}]`);
  }

  console.log("console errors:", errors.length ? errors : "none");
  await browser.close(); server.close();
})();
