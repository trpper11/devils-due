/* DEVIL'S DUE — scrolling rage-bait engine.
   A sequel to Devil's Lie. Bigger maps, a camera that follows you, and a trap vocabulary deep enough
   for hundreds of combinations. The rule never changes: it LOOKS easy, every trap is INVISIBLE and
   UNTELEGRAPHED, you cannot dodge it the first time, and the whole gauntlet re-arms identically on
   death so you can beat it by MEMORY. The world itself also turns on you — floors move, the screen
   drags you forward, lava rises, walls close in. The surprises never stop, and they only escalate.

   Reads window.LEVELS (see levels.js). No external deps. ~120Hz fixed step + render interpolation. */
(function () {
  const TILE = 40, VIEW_C = 28, VIEW_R = 12, VW = VIEW_C * TILE, VH = VIEW_R * TILE; // zoomed out: more scene ahead
  const GRAVITY = 2400, MOVE = 250, JUMP = 700, ACCEL = 3300, AIR = 2400, FRICTION = 2600, MAX_FALL = 980;
  const COYOTE = 0.10, JBUF = 0.12, DT = 1 / 120, PW = 24, PH = 26;

  let canvas, ctx, renderScale = 1;
  let LV, grid, WC, WR, start, exitCell, li = 0, deaths = 0;
  let player, particles = [], shake = 0, animTime = 0, levelTime = 0, hitStop = 0, flash = 0;
  let camX = 0, camY = 0, gdir = 1;
  let state = "play", winT = 0;
  const keys = { left: false, right: false, jump: false };
  let acc = 0, last = 0;

  // dynamic level state
  let traps = [], vanished = new Set(), crumbling = {}, baited = {}, conveyors = [], cannons = [], flyers = [], fakeDoors = [];
  let sysScroll = null, sysRise = null, sysClose = null;   // the three "world turns on you" systems
  let camForcedX = 0;

  // ---------- audio ----------
  let actx = null;
  const A = () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; };
  function beep(f, d, type = "square", v = 0.06, to = 0) {
    const a = A(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const sJump = () => beep(470, 0.12, "square", 0.05, 720);
  const sDie = () => { beep(200, 0.2, "sawtooth", 0.09, 60); beep(120, 0.3, "sawtooth", 0.07, 50, 0.04); };
  const sWin = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.07), i * 70));
  const sStep = () => beep(900, 0.04, "square", 0.02, 300);
  const sBoom = () => { beep(90, 0.18, "sawtooth", 0.13, 40); beep(150, 0.1, "square", 0.08, 60); };
  const sFire = () => beep(330, 0.08, "square", 0.05, 110);

  // ---------- canvas ----------
  function resize() {
    const availW = innerWidth, availH = innerHeight, scale = Math.min(availW / VW, availH / VH);
    const cssW = Math.max(1, Math.floor(VW * scale)), cssH = Math.max(1, Math.floor(VH * scale));
    canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
    const dpr = Math.min(2, devicePixelRatio || 1);
    let cw = Math.floor(cssW * dpr), ch = Math.floor(cssH * dpr), MAX = 2300000;
    if (cw * ch > MAX) { const k = Math.sqrt(MAX / (cw * ch)); cw = Math.floor(cw * k); ch = Math.floor(ch * k); }
    canvas.width = cw; canvas.height = ch; renderScale = cw / VW;
  }

  // ---------- level load ----------
  function loadLevel(i) {
    li = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
    LV = LEVELS[li];
    const w = Math.max(...LV.grid.map(r => r.length));
    grid = LV.grid.map(r => r.padEnd(w, " ").split(""));
    WR = grid.length; WC = w;
    start = { c: 1, r: WR - 2 }; exitCell = null;
    for (let r = 0; r < WR; r++) for (let c = 0; c < WC; c++) {
      const ch = grid[r][c];
      if (ch === "S") start = { c, r };
      if (ch === "E") exitCell = { c, r };
    }
    armLevel();
    spawn();
    setHud();
  }
  function armLevel() {
    // clone trap defs (so we can re-arm), reset all dynamic state
    traps = (LV.traps || []).map(t => ({ ...t, on: false, t: 0, gx: t.to ? { ...t.to } : null }));
    vanished = new Set(); crumbling = {}; baited = {};
    conveyors = (LV.conveyors || []).map(z => ({ ...z, on: !z.at, t: 0 }));
    cannons = (LV.cannons || []).map(z => ({ ...z, t: z.phase || 0, shots: [] }));
    fakeDoors = (LV.fakeDoors || []).map(d => ({ ...d }));
    flyers = [];
    gdir = 1;
    sysScroll = LV.scroll ? { ...LV.scroll, on: false, x: 0 } : null;
    sysRise = LV.rise ? { ...LV.rise, on: false, h: 0 } : null;
    sysClose = LV.close ? { ...LV.close, on: false, l: 0, r: 0 } : null;
    camForcedX = 0;
    // restore runaway door home if it moved last run
    if (LV._homeExit) exitCell = { ...LV._homeExit };
  }
  function spawn() {
    if (!LV._homeExit && exitCell) LV._homeExit = { ...exitCell };
    player = { x: start.c * TILE + (TILE - PW) / 2, y: start.r * TILE + (TILE - PH), prevX: 0, prevY: 0,
      vx: 0, vy: 0, onGround: false, coyote: 0, jumpBuf: 0, dead: false, deathT: 0, facing: 1, run: 0 };
    player.prevX = player.x; player.prevY = player.y;
    // reset dynamic state but keep deaths count
    vanished = new Set(); crumbling = {}; baited = {};
    for (const t of traps) { t.on = false; t.t = 0; }
    for (const z of conveyors) { z.on = !z.at; z.t = 0; }
    for (const z of cannons) { z.t = z.phase || 0; z.shots = []; }
    flyers = []; gdir = 1;
    if (sysScroll) { sysScroll.on = false; sysScroll.x = 0; }
    if (sysRise) { sysRise.on = false; sysRise.h = 0; }
    if (sysClose) { sysClose.on = false; sysClose.l = 0; sysClose.r = 0; }
    if (LV._homeExit) exitCell = { ...LV._homeExit };
    camForcedX = 0;
    camX = clamp(player.x + PW / 2 - VW / 2, 0, Math.max(0, WC * TILE - VW));
    camY = clamp(player.y + PH / 2 - VH / 2, 0, Math.max(0, WR * TILE - VH));
    particles = []; levelTime = 0; state = "play";
  }
  function die() {
    if (player.dead) return; player.dead = true; player.deathT = 0; deaths++;
    setHud(); shake = 16; hitStop = 0.05; flash = 0.5; sDie();
    const cx = player.x + PW / 2, cy = player.y + PH / 2;
    for (let i = 0; i < 28; i++) { const a = i / 28 * 6.28, s = 140 + rnd() * 280;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.6 + rnd() * 0.5, r: 2 + rnd() * 4,
        c: rnd() < 0.6 ? "#ff3b54" : (rnd() < 0.5 ? "#ffcf5c" : "#ff7a18") }); }
  }
  function nextLevel() {
    if (li + 1 < LEVELS.length) { li++; sWin(); loadLevel(li); }
    else { state = "win"; winT = 0; sWin(); }
  }
  function setHud() {
    const L = document.getElementById("hud-l"), D = document.getElementById("hud-d"), N = document.getElementById("hud-name");
    if (L) L.textContent = "LEVEL " + (li + 1) + "/" + LEVELS.length;
    if (D) D.textContent = "DEATHS " + deaths;
    if (N && LV) N.textContent = LV.name || "DEVIL'S DUE";
  }

  // ---------- helpers ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let _seed = 1234567; const rnd = () => { _seed = (_seed * 16807 + 12345) % 2147483647; return _seed / 2147483647; };

  function tileAt(c, r) { return (r >= 0 && r < WR && c >= 0 && c < WC) ? grid[r][c] : " "; }
  function tileSolid(c, r) {
    if (c < 0 || c >= WC) return true;
    if (r < 0 || r >= WR) return false;
    const ch = grid[r][c];
    if (ch === "v") return !vanished.has(c + "," + r);
    if (ch === "c") return !(crumbling[c + "," + r] >= 0.30);   // crumbles a beat after you step
    if (ch === "B") return true;
    if (ch === "#" || ch === "=" || ch === "<" || ch === ">" || ch === "~") return true;
    return false;
  }
  function isGridHazard(ch) { return ch === "^" || ch === "V"; }  // ^ floor spikes, V ceiling spikes (both visible decor)

  // ---------- step ----------
  function step(dt) {
    if (state !== "play") return;
    animTime += dt;
    player.prevX = player.x; player.prevY = player.y;
    if (player.dead) { player.deathT += dt; if (player.deathT > 0.5) spawn(); return; }
    levelTime += dt;

    updateSystems(dt);
    updateTraps(dt);
    updateCannons(dt);

    if (state !== "play" || player.dead) return;

    let want = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (want !== 0) player.facing = want;
    const a = player.onGround ? ACCEL : AIR;
    if (want !== 0) { player.vx += want * a * dt; player.vx = clamp(player.vx, -MOVE, MOVE); }
    else { const f = FRICTION * dt; if (player.vx > f) player.vx -= f; else if (player.vx < -f) player.vx += f; else player.vx = 0; }

    if (player.jumpBuf > 0) player.jumpBuf -= dt;
    if (player.onGround) player.coyote = COYOTE; else player.coyote -= dt;
    if (player.jumpBuf > 0 && player.coyote > 0) { player.vy = -JUMP * gdir; player.onGround = false; player.coyote = 0; player.jumpBuf = 0; sJump(); }
    if (!keys.jump && player.vy * gdir < 0) player.vy += GRAVITY * gdir * dt * 0.9;
    player.vy += GRAVITY * gdir * dt; player.vy = clamp(player.vy, -MAX_FALL, MAX_FALL);

    player.onGround = false;
    let landCh = null, landCR = null;
    moveAxis(player.vx * dt, 0);
    const before = player.y;
    moveAxis(0, player.vy * dt);
    // mover collisions (closing walls / moving platforms exposed via movers())
    const ms = movers();
    let carry = 0;
    for (const m of ms) {
      if (player.x < m.x + m.w && player.x + PW > m.x && player.y < m.y + m.h && player.y + PH > m.y) {
        if (m.kill) return die();
        const pen = [(m.x + m.w) - player.x, (player.x + PW) - m.x, (m.y + m.h) - player.y, (player.y + PH) - m.y];
        const mn = Math.min(pen[0], pen[1], pen[2], pen[3]);
        if (mn === pen[2]) { player.y = m.y + m.h; if (player.vy < 0) player.vy = 0; }
        else if (mn === pen[3]) { player.y = m.y - PH; player.vy = 0; player.onGround = true; carry = m.vx || 0; }
        else if (mn === pen[0]) { player.x = m.x + m.w; player.vx = 0; }
        else { player.x = m.x - PW; player.vx = 0; }
      }
    }
    if (carry) player.x += carry * dt;

    // ground-stick
    if (!player.onGround && player.vy * gdir >= 0) {
      const fr = gdir > 0 ? Math.floor((player.y + PH) / TILE) : Math.floor((player.y - 1) / TILE);
      const cL = Math.floor((player.x + 2) / TILE), cR = Math.floor((player.x + PW - 2) / TILE);
      if (tileSolid(cL, fr) || tileSolid(cR, fr)) { player.y = gdir > 0 ? fr * TILE - PH : (fr + 1) * TILE; player.vy = 0; player.onGround = true; }
    }

    // on-ground tile effects: conveyors, crumble timers, bait, vanish
    if (player.onGround) onStandTiles(dt);
    player.run += Math.abs(player.vx) * dt * 0.05;   // (footstep blip removed — it buzzed)

    // forced-scroll wall: can't fall behind the left edge
    if (sysScroll && sysScroll.on) {
      const wall = camForcedX + 2;
      if (player.x < wall) { player.x = wall; if (player.vx < 0) player.vx = 0; }
      if (player.x + PW < camForcedX) return die();         // shoved off the left → crushed
    }

    updateCamera(dt);

    // ---- hazards ----
    const hb = { x: player.x + 3, y: player.y + 4, w: PW - 6, h: PH - 6 };
    const cc = Math.floor((player.x + PW / 2) / TILE), rr = Math.floor((player.y + PH / 2) / TILE);
    if (isGridHazard(tileAt(cc, rr))) return die();
    for (const z of hazardRects()) if (hb.x < z.x + z.w && hb.x + hb.w > z.x && hb.y < z.y + z.h && hb.y + hb.h > z.y) return die();
    // fall out / rise into ceiling
    if (player.y > WR * TILE + 80 || player.y < -160) return die();

    // ---- reach exit ----
    if (exitCell) {
      const ex = exitCell.c * TILE, ey = exitCell.r * TILE;
      if (player.x + PW > ex + 6 && player.x < ex + TILE - 6 && player.y + PH > ey + 6 && player.y < ey + TILE) winLevel();
    }
  }

  function moveAxis(dx, dy) {
    player.x += dx; player.y += dy;
    const c0 = Math.floor(player.x / TILE), c1 = Math.floor((player.x + PW - 1) / TILE);
    const r0 = Math.floor(player.y / TILE), r1 = Math.floor((player.y + PH - 1) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!tileSolid(c, r)) continue;
      const bx = c * TILE, by = r * TILE;
      if (dx > 0) player.x = bx - PW; else if (dx < 0) player.x = bx + TILE;
      if (dy > 0) { player.y = by - PH; player.vy = 0; player.onGround = true; }
      else if (dy < 0) { player.y = by + TILE; player.vy = 0; }
    }
  }

  function onStandTiles(dt) {
    const fr = gdir > 0 ? Math.floor((player.y + PH) / TILE) : Math.floor((player.y - 1) / TILE);
    const cL = Math.floor((player.x + 3) / TILE), cR = Math.floor((player.x + PW - 3) / TILE);
    let conv = null;
    for (let c = cL; c <= cR; c++) {
      const ch = tileAt(c, fr), key = c + "," + fr;
      if (ch === "v" && !vanished.has(key)) { vanished.add(key); shake = Math.max(shake, 10); sBoom(); }
      else if (ch === "c") { if (!(key in crumbling)) { crumbling[key] = 0.0001; shake = Math.max(shake, 6); } }
      else if (ch === "B" && !(key in baited)) { baited[key] = 0.0001; shake = Math.max(shake, 12); sBoom(); }
      else if (ch === "~" || ch === ">" || ch === "<") {           // conveyor strip
        const z = conveyors.find(z => z.c0 <= c && c <= z.c1 && z.r === fr);
        if (z && z.on) conv = z || conv;
      }
    }
    if (conv) player.x += (conv.dir || 1) * (conv.speed || 140) * dt;  // apply once per tick, not per straddled tile
  }

  // crumble timers continue even after you leave the tile
  function tickCrumble(dt) { for (const k in crumbling) crumbling[k] += dt; for (const k in baited) baited[k] += dt; }

  // ---------- traps ----------
  function px() { return (player.x + PW / 2) / TILE; }
  function fire(t) { t.on = true; t.t = 0; shake = Math.max(shake, t.do === "runaway" ? 9 : 13); sBoom();
    if (t.do === "runaway" && exitCell && t.to) { exitCell = { c: t.to.c, r: t.to.r }; }
    if (t.do === "flyspike") flyers.push({ x: (t.fromRight ? camX + VW + 20 : camX - 20 - TILE), y: t.r * TILE + 6,
      vx: (t.fromRight ? -1 : 1) * (t.speed || 560), w: TILE, h: TILE - 12, life: 3 });
  }
  function updateTraps(dt) {
    tickCrumble(dt);
    const p = px();
    for (const t of traps) {
      if (t.on) { t.t += dt; continue; }
      const ready = (t.at != null && p >= t.at) || (t.atTime != null && levelTime >= t.atTime);
      if (ready) fire(t);
    }
    // advance flyers
    for (const f of flyers) { f.x += f.vx * dt; f.life -= dt; }
    flyers = flyers.filter(f => f.life > 0 && f.x > camX - 120 && f.x < camX + VW + 120);
  }

  // ---------- cannons ----------
  function updateCannons(dt) {
    for (const z of cannons) {
      z.t += dt; const period = z.period || 1.6;
      if (z.t >= period) { z.t -= period; sFire();
        const dir = z.dir || -1, sp = z.speed || 320;
        z.shots.push({ x: z.c * TILE + TILE / 2 + dir * 18, y: z.r * TILE + TILE / 2, vx: dir * sp, vy: 0, life: z.life || 1.6, r: 7 }); }
      for (const s of z.shots) { s.x += s.vx * dt; s.life -= dt; }
      z.shots = z.shots.filter(s => s.life > 0);
    }
  }

  // ---------- world systems ----------
  function updateSystems(dt) {
    const p = px();
    if (sysScroll) { if (!sysScroll.on && p >= (sysScroll.at || 0)) sysScroll.on = true;
      if (sysScroll.on) camForcedX = Math.min(WC * TILE - VW, camForcedX + (sysScroll.speed || 70) * dt); }
    if (sysRise) { if (!sysRise.on && (p >= (sysRise.at || 0) || levelTime >= (sysRise.atTime ?? 1e9))) sysRise.on = true;
      if (sysRise.on) sysRise.h = Math.min((sysRise.max || WR) * TILE, sysRise.h + (sysRise.speed || 26) * dt); }
    if (sysClose) { if (!sysClose.on && p >= (sysClose.at || 0)) sysClose.on = true;
      if (sysClose.on) { sysClose.l += (sysClose.speed || 60) * dt; sysClose.r += (sysClose.speed || 60) * dt; } }
    for (const z of conveyors) { if (!z.on && p >= (z.at || 0)) z.on = true; }
  }

  // movers exposed to collision: closing walls (solid + lethal inner faces) and any moving platforms
  function movers() {
    const out = [];
    if (sysClose && sysClose.on) {
      const lx = (sysClose.x0 || camX) + sysClose.l, rx = (sysClose.x1 || camX + VW) - sysClose.r;
      out.push({ x: lx - TILE, y: 0, w: TILE, h: WR * TILE, vx: 0, kill: false, wall: "L", face: lx });
      out.push({ x: rx, y: 0, w: TILE, h: WR * TILE, vx: 0, kill: false, wall: "R", face: rx });
    }
    return out;
  }

  // every lethal rectangle (world coords) the player can touch
  function hazardRects() {
    const h = [];
    for (const k in baited) if (baited[k] > 0.05) { const [c, r] = k.split(",").map(Number); h.push({ x: c * TILE + 2, y: r * TILE - 13, w: TILE - 4, h: 17 }); }
    for (const t of traps) {
      if (!t.on) continue;
      if (t.do === "popspike" || t.do === "doorspike" || t.do === "risefloor") {
        const g = Math.min(1, t.t / 0.05); h.push({ x: t.c * TILE + 3, y: t.r * TILE + 5 + (1 - g) * TILE, w: TILE - 6, h: TILE - 5 });
      } else if (t.do === "drop") { const y = dropY(t); h.push({ x: t.c * TILE + 5, y: y, w: TILE - 10, h: 38 }); }
    }
    for (const f of flyers) h.push({ x: f.x + 5, y: f.y + 4, w: f.w - 10, h: f.h - 8 });
    for (const d of fakeDoors) h.push({ x: d.c * TILE + 9, y: d.r * TILE + 5, w: TILE - 18, h: TILE - 6 });
    for (const z of cannons) for (const s of z.shots) h.push({ x: s.x - s.r + 2, y: s.y - s.r + 2, w: s.r * 2 - 4, h: s.r * 2 - 4 });
    if (sysRise && sysRise.on) h.push({ x: camX - 40, y: WR * TILE - sysRise.h, w: VW + 80, h: sysRise.h + 40 });
    if (sysClose && sysClose.on) { for (const m of movers()) { if (m.wall === "L") h.push({ x: m.x + TILE - 6, y: 0, w: 8, h: WR * TILE });
      else h.push({ x: m.x - 2, y: 0, w: 8, h: WR * TILE }); } }
    return h;
  }
  const dropY = (t) => Math.min((t.floorR != null ? t.floorR : 9) * TILE, t.r * TILE + 1700 * t.t);

  // ---------- camera ----------
  function updateCamera(dt) {
    let tx, ty;
    if (sysScroll && sysScroll.on) tx = camForcedX;
    else tx = clamp(player.x + PW / 2 - VW / 2, 0, Math.max(0, WC * TILE - VW));
    ty = clamp(player.y + PH / 2 - VH / 2, 0, Math.max(0, WR * TILE - VH));
    const k = 1 - Math.pow(0.0001, dt);
    camX += (tx - camX) * (sysScroll && sysScroll.on ? 1 : k);
    camY += (ty - camY) * k;
  }
  function winLevel() { state = "won-anim"; setTimeout(nextLevel, 60); }

  // ---------- render ----------
  function render() {
    const al = clamp(acc / DT, 0, 1);
    const rx = player.prevX + (player.x - player.prevX) * al, ry = player.prevY + (player.y - player.prevY) * al;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    let ox = 0, oy = 0; if (shake > 0) { ox = (rnd() - .5) * shake; oy = (rnd() - .5) * shake; }
    // background (parallax)
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, LV.bg ? LV.bg[0] : "#0c0810"); g.addColorStop(1, LV.bg ? LV.bg[1] : "#05070a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    drawParallax();
    ctx.save(); ctx.translate(-Math.round(camX) + ox, -Math.round(camY) + oy);

    // tiles (only visible)
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1), c1 = Math.min(WC - 1, Math.floor((camX + VW) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1), r1 = Math.min(WR - 1, Math.floor((camY + VH) / TILE) + 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) drawTile(grid[r][c], c, r);

    drawCannons(); drawTrapsLive(); drawFlyers();
    for (const d of fakeDoors) drawDoor(d.c * TILE, d.r * TILE);
    if (exitCell) drawDoor(exitCell.c * TILE, exitCell.r * TILE);
    drawSystems();
    if (!player.dead && state === "play") drawPlayer(rx, ry);
    for (const p of particles) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.restore();

    // vignette + flash
    const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VH * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
    if (flash > 0) { ctx.fillStyle = "rgba(255,40,60," + (flash * 0.5) + ")"; ctx.fillRect(0, 0, VW, VH); }
    if (state === "win") {
      ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = "#ffcf5c"; ctx.font = "bold 40px system-ui"; ctx.textAlign = "center"; ctx.fillText("PAID IN FULL 😈", VW / 2, VH / 2 - 8);
      ctx.fillStyle = "#cdd3df"; ctx.font = "18px system-ui"; ctx.fillText(deaths + " deaths · press R to run it back", VW / 2, VH / 2 + 28); ctx.textAlign = "left";
    }
  }

  function drawParallax() {
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 137 - camX * 0.3) % (VW + 80) + VW + 80) % (VW + 80) - 40;
      const sy = (i * 71) % VH; ctx.fillStyle = i % 3 ? "rgba(255,120,90,0.06)" : "rgba(160,120,255,0.05)";
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();
  }

  function drawTile(ch, c, r) {
    const x = c * TILE, y = r * TILE;
    if (ch === "#" || ch === "=") drawBlock(x, y);
    else if (ch === "<" || ch === ">" || ch === "~") drawConveyor(x, y, c, r, ch);
    else if (ch === "v") { if (!vanished.has(c + "," + r)) drawBlock(x, y); }
    else if (ch === "c") { const t = crumbling[c + "," + r] || 0; if (t < 0.30) { drawBlock(x, y); if (t > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#000"; ctx.beginPath(); ctx.moveTo(x + 6, y + 8); ctx.lineTo(x + 18, y + 26); ctx.lineTo(x + 30, y + 10); ctx.stroke(); ctx.restore(); } } }
    else if (ch === "B") { drawBlock(x, y); if (baited[c + "," + r] > 0.04) spikes(x, y - TILE, TILE, "up"); }
    else if (ch === "^") spikes(x, y, TILE, "up");
    else if (ch === "V") spikes(x, y, TILE, "down");
  }
  function drawBlock(x, y) {
    ctx.fillStyle = LV.block || "#3a2350"; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x, y, TILE, 4);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x, y + TILE - 4, TILE, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1);
  }
  function drawConveyor(x, y, c, r, ch) {
    drawBlock(x, y);
    const z = conveyors.find(z => z.c0 <= c && c <= z.c1 && z.r === r);
    if (z && z.on) { const dir = z.dir || (ch === "<" ? -1 : 1); ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = "#ffcf5c";
      const off = (animTime * (z.speed || 140) * 0.5) % TILE;
      for (let i = -1; i < 2; i++) { const ax = x + ((i * 18 + dir * off) % TILE + TILE) % TILE;
        ctx.beginPath(); ctx.moveTo(ax, y + 6); ctx.lineTo(ax + dir * 8, y + 11); ctx.lineTo(ax, y + 16); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
  }
  function spikes(x, yTop, w, dir) {
    const n = Math.max(2, Math.round(w / 13)); ctx.fillStyle = "#eef2f8";
    for (let i = 0; i < n; i++) { const sx = x + (i + .5) * (w / n);
      ctx.beginPath();
      if (dir === "down") { ctx.moveTo(sx - w / n / 2, yTop); ctx.lineTo(sx, yTop + 26); ctx.lineTo(sx + w / n / 2, yTop); }
      else { ctx.moveTo(sx - w / n / 2, yTop + TILE); ctx.lineTo(sx, yTop + 4); ctx.lineTo(sx + w / n / 2, yTop + TILE); }
      ctx.closePath(); ctx.fill(); }
  }
  function drawTrapsLive() {
    for (const t of traps) {
      if (!t.on) continue;
      if (t.do === "popspike" || t.do === "doorspike" || t.do === "risefloor") { const g = Math.min(1, t.t / 0.05); spikes(t.c * TILE, t.r * TILE + (1 - g) * TILE, TILE, "up"); }
      else if (t.do === "drop") { const y = dropY(t); if (y < ((t.floorR != null ? t.floorR : 9) * TILE) - 1) spikes(t.c * TILE, y - TILE + 26, TILE, "down"); else spikes(t.c * TILE, (t.floorR != null ? t.floorR : 9) * TILE, TILE, "up"); }
    }
  }
  function drawFlyers() { for (const f of flyers) { ctx.save(); ctx.translate(f.x + f.w / 2, f.y + f.h / 2); const d = f.vx < 0 ? 1 : -1;
    ctx.fillStyle = "#eef2f8"; ctx.beginPath(); ctx.moveTo(d * f.w / 2, 0); ctx.lineTo(-d * f.w / 2, -f.h / 2); ctx.lineTo(-d * f.w / 2, f.h / 2); ctx.closePath(); ctx.fill(); ctx.restore(); } }
  function drawCannons() {
    for (const z of cannons) { const x = z.c * TILE, y = z.r * TILE;
      ctx.fillStyle = "#241526"; ctx.fillRect(x + 6, y + 8, TILE - 12, TILE - 16);
      ctx.fillStyle = "#3a2350"; ctx.fillRect(x + (z.dir < 0 ? 0 : TILE - 10), y + 12, 10, TILE - 24);
      for (const s of z.shots) { ctx.fillStyle = "#ff7a18"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,200,80,.5)"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 3, 0, 7); ctx.fill(); } }
  }
  function drawSystems() {
    if (sysRise && sysRise.on) { const top = WR * TILE - sysRise.h;
      const g = ctx.createLinearGradient(0, top, 0, top + 60); g.addColorStop(0, "#ff6a2c"); g.addColorStop(1, "#b01010");
      ctx.fillStyle = g; ctx.fillRect(camX - 40, top, VW + 80, sysRise.h + 40);
      ctx.fillStyle = "rgba(255,220,120,.5)"; for (let i = 0; i < 10; i++) { const bx = camX + ((i * 97 + animTime * 30) % VW); ctx.beginPath(); ctx.arc(bx, top + 6 + Math.sin(animTime * 3 + i) * 4, 3, 0, 7); ctx.fill(); } }
    if (sysClose && sysClose.on) { for (const m of movers()) {
      ctx.fillStyle = "#241526"; ctx.fillRect(m.x, 0, m.w, WR * TILE);
      // spiked inner face
      const fx = m.wall === "L" ? m.x + m.w : m.x; const dir = m.wall === "L" ? "right" : "left";
      ctx.fillStyle = "#eef2f8"; for (let yy = 0; yy < WR * TILE; yy += 18) { ctx.beginPath();
        if (dir === "right") { ctx.moveTo(fx, yy); ctx.lineTo(fx + 12, yy + 9); ctx.lineTo(fx, yy + 18); }
        else { ctx.moveTo(fx, yy); ctx.lineTo(fx - 12, yy + 9); ctx.lineTo(fx, yy + 18); }
        ctx.closePath(); ctx.fill(); } } }
  }
  function drawDoor(x, y) {
    ctx.fillStyle = "#1b1320"; ctx.fillRect(x + 6, y + 2, TILE - 12, TILE - 2);
    const g = ctx.createLinearGradient(x, y, x, y + TILE); g.addColorStop(0, "#ffe79a"); g.addColorStop(1, "#ff9e2c");
    ctx.fillStyle = g; ctx.fillRect(x + 9, y + 5, TILE - 18, TILE - 5);
    ctx.fillStyle = "#1b1320"; ctx.beginPath(); ctx.arc(x + TILE - 14, y + TILE / 2 + 2, 2, 0, 7); ctx.fill();
    const gl = 0.4 + 0.3 * Math.sin(animTime * 3); ctx.save(); ctx.globalAlpha = gl; ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,180,80,0.5)"; ctx.beginPath(); ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE * 0.7, TILE * 0.7, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawPlayer(x, y) {
    const cx = x + PW / 2, cy = y + PH / 2, R = 12, dir = player.facing;
    ctx.save(); ctx.translate(cx, cy); if (gdir < 0) ctx.scale(1, -1);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, R + 2, R, 3, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(animTime * 4);
    const gg = ctx.createRadialGradient(0, R, 1, 0, R, 22); gg.addColorStop(0, "rgba(255,90,60,0.6)"); gg.addColorStop(1, "transparent");
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, R, 20, 7, 0, 0, 7); ctx.fill(); ctx.restore();
    const sw = Math.sin(player.run) * 3;
    ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.ellipse(-5 + sw, R, 5, 2.4, 0, 0, 7); ctx.ellipse(5 - sw, R, 5, 2.4, 0, 0, 7); ctx.fill();
    const bg = ctx.createRadialGradient(-R * .3, -R * .4, 1, 0, 0, R * 1.2); bg.addColorStop(0, "#ff8aa0"); bg.addColorStop(.5, "#ff3b54"); bg.addColorStop(1, "#c01030");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    const ex = 4.5; ctx.strokeStyle = "#160018"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-ex - 3, -6.5); ctx.lineTo(-ex + 2.5, -4); ctx.moveTo(ex + 3, -6.5); ctx.lineTo(ex - 2.5, -4); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(-ex, -1.5, 3, 2.6, 0, 0, 7); ctx.ellipse(ex, -1.5, 3, 2.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#160018"; ctx.beginPath(); ctx.arc(-ex + dir, -1, 1.5, 0, 7); ctx.arc(ex + dir, -1, 1.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- loop ----------
  function frame(now) {
    if (!last) last = now; let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
    if (hitStop > 0) { hitStop -= dt; dt *= 0.15; }
    acc += dt; let n = 0; while (acc >= DT && n++ < 8) { step(DT); acc -= DT; }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; } particles = particles.filter(p => p.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    render(); requestAnimationFrame(frame);
  }

  // ---------- input ----------
  addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.blur();
    if (k === "tab" || k === "enter") { e.preventDefault(); return; }
    if (k === "arrowleft" || k === "a") { keys.left = true; e.preventDefault(); }
    else if (k === "arrowright" || k === "d") { keys.right = true; e.preventDefault(); }
    else if (k === "arrowup" || k === "w" || k === " ") { if (state === "play" && !player.dead && !e.repeat) { player.jumpBuf = JBUF; keys.jump = true; } e.preventDefault(); }
    else if (k === "r") { deaths = 0; setHud(); loadLevel(state === "win" ? 0 : li); }
  });
  addEventListener("keyup", e => { const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") keys.left = false; else if (k === "arrowright" || k === "d") keys.right = false;
    else if (k === "arrowup" || k === "w" || k === " ") keys.jump = false; });
  addEventListener("blur", () => { keys.left = keys.right = keys.jump = false; });
  addEventListener("resize", resize);

  // touch controls (optional buttons in DOM)
  function bindTouch(id, on) { const el = document.getElementById(id); if (!el) return;
    const set = v => e => { e.preventDefault(); on(v); };
    el.addEventListener("touchstart", set(true), { passive: false }); el.addEventListener("touchend", set(false), { passive: false });
    el.addEventListener("mousedown", set(true)); el.addEventListener("mouseup", set(false)); el.addEventListener("mouseleave", set(false)); }

  const Due = {
    TILE, PW, PH,
    init() {
      canvas = document.getElementById("game"); ctx = canvas.getContext("2d");
      resize(); loadLevel(0);
      addEventListener("pointerdown", () => A() && A().resume && A().resume());
      bindTouch("t-l", v => keys.left = v); bindTouch("t-r", v => keys.right = v);
      bindTouch("t-j", v => { if (v && state === "play" && !player.dead) { player.jumpBuf = JBUF; keys.jump = true; } else keys.jump = false; });
      requestAnimationFrame(frame);
    },
    get player() { return player; }, get state() { return state; }, get level() { return li; }, get deaths() { return deaths; },
    get time() { return levelTime; }, get cam() { return { x: camX, y: camY }; },
    exitPx() { return exitCell ? { x: exitCell.c * TILE, y: exitCell.r * TILE } : null; },
    worldPx() { return { w: WC * TILE, h: WR * TILE }; },
    projectiles() { const a = []; for (const f of flyers) a.push({ x: f.x, y: f.y, w: f.w, h: f.h, vx: f.vx });
      for (const z of cannons) for (const s of z.shots) a.push({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2, vx: s.vx }); return a; },
    goto(i) { deaths = 0; loadLevel(i); },
    press(k, v) { if (k === "left") keys.left = v; else if (k === "right") keys.right = v; else if (k === "jump") { if (v) { player.jumpBuf = JBUF; keys.jump = true; } else keys.jump = false; } },
  };
  window.Due = Due;
})();
