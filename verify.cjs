/* Headless verification for Devil's Due.
   Serves the folder, then for each flat level runs two bots:
     - NAIVE  (hold right, never jump): must DIE and fail to reach the door  -> proves rage bait.
     - MEMORY (knows every trap column): must clear the level                -> proves beatable.
   L4 (vertical) is driven by a bespoke scripted climb. */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("/root/.npm/_npx/705bc6b22212b352/node_modules/playwright");

const ROOT = __dirname, PORT = 8731;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/play.html";
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "text/plain" }); res.end(d); });
});

const BOT = `
window.__naive = function(level){ return new Promise(resolve=>{
  Due.goto(level); const T=Due.TILE,PW=Due.PW; Due.press('right',true);
  let ticks=0; const iv=setInterval(()=>{ const p=Due.player; ticks++;
    if(Due.level!==level||Due.state==='win'){ clearInterval(iv); Due.press('right',false); resolve({reached:true,deaths:Due.deaths}); return; }
    if(ticks>250){ clearInterval(iv); Due.press('right',false); resolve({reached:false,deaths:Due.deaths,x:Math.round(p.x/T)}); }
  },16);
});};
window.__memory = function(level){ return new Promise(resolve=>{
  Due.goto(level); const T=Due.TILE,PW=Due.PW,PH=Due.PH,lv=LEVELS[level];
  let prow=-1; lv.grid.forEach((row,r)=>{ if(row.includes('S')) prow=r; }); const frow=prow+1;
  const jset=new Set(), add=c=>jset.add(c-1);
  const fr=lv.grid[frow]||"";
  for(let c=0;c<fr.length;c++){ const ch=fr[c];
    if(ch==='v'||ch==='B') add(c);                          // jump fully over vanish/bait tiles
    if(ch===' '&&fr[c-1]&&fr[c-1]!==' '&&fr[c-1]!=='S') add(c); // jump real gaps
    // crumble 'c' runs: do NOT jump — a moving player crosses each tile before it breaks
  }
  (lv.traps||[]).forEach(t=>{ if(['popspike','doorspike','risefloor','drop'].includes(t.do)) add(t.c); });
  (lv.fakeDoors||[]).forEach(d=>add(d.c));                   // jump over the lethal decoy doors
  (lv.jumpCols||[]).forEach(c=>jset.add(c));                 // explicit launch points (e.g. staircase climbs)
  const hold=()=>{ Due.press('jump',true); setTimeout(()=>Due.press('jump',false),200); }; // full-height jump
  const stop=()=>{ Due.press('right',false); Due.press('left',false); };
  let ticks=0,lastX=-1,stuck=0,jcool=0,lastDeaths=0,dcols=[],maxc=0;
  const iv=setInterval(()=>{ const p=Due.player; if(!p) return; ticks++;
    const pc=Math.floor((p.x+PW/2)/T); if(pc>maxc) maxc=pc;
    if(Due.deaths>lastDeaths){ lastDeaths=Due.deaths; dcols.push(pc); }
    if(Due.level!==level||Due.state==='win'){ clearInterval(iv); stop(); resolve({ok:true,deaths:Due.deaths,jset:[...jset].sort((a,b)=>a-b)}); return; }
    if(ticks>2200){ clearInterval(iv); stop(); resolve({ok:false,deaths:Due.deaths,maxc,deathCols:dcols.slice(-12),jset:[...jset].sort((a,b)=>a-b),reason:'timeout'}); return; }
    if(jcool>0) jcool--;
    // chase the door (it can run away behind you)
    const ex=Due.exitPx(); const dir = !ex?1 : (ex.x>p.x+4?1 : (ex.x<p.x-4?-1:0));
    Due.press('right',dir>0); Due.press('left',dir<0);
    // jump the memorized static traps (on the rightward leg)
    if(dir>=0 && jset.has(pc)&&p.onGround&&jcool===0){ hold(); jcool=16; }
    // dodge any incoming projectile (flyspikes, cannonballs) at body height
    const pcx=p.x+PW/2, pcy=p.y+PH/2;
    for(const q of (Due.projectiles?Due.projectiles():[])){ const qx=q.x+q.w/2, dx=qx-pcx;
      const inc=(q.vx<0&&dx>0&&dx<140)||(q.vx>0&&dx<0&&dx>-140);
      if(inc && Math.abs((q.y+q.h/2)-pcy)<46 && p.onGround && jcool===0){ hold(); jcool=14; break; } }
    if(Math.abs(p.x-lastX)<0.6) stuck++; else stuck=0; lastX=p.x;
    if(stuck>26&&p.onGround){ hold(); stuck=0; }
  },16);
});};
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
  const flat = only || [0, 1, 2, 4];
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
