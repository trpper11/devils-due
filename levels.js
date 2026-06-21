/* DEVIL'S DUE — levels.
   Multi-story rage-bait. Every level LOOKS like a calm stroll; traps are invisible and untelegraphed and
   the gauntlet re-arms identically on death, so it is beatable by MEMORY. The big redesign goal: EACH LEVEL
   HAS ITS OWN SIGNATURE so they stop blurring together, and the opening hazard is NOT always at the same
   spot — some levels lull you with a safe walk, others bite on the first step. The world also turns on you:
   floors move, the screen drags you, lava rises, walls close, the sky drops, javelins fly.

   Tile legend (deadly things are drawn IDENTICAL to safe ones, or simply not there yet):
     #  solid   v  vanishing floor (invisible pit)   c  crumbling floor   B  bait block (erupts when stepped)
     ~ < >  conveyor (VISIBLE)   ^  floor spikes   V  ceiling spikes   S  start   E  exit door
   Trap defs (fire by x-threshold `at` in tiles, or `atTime` in s):
     popspike {c,r,at}  drop {c,at,floorR}  doorspike {c,r,at}  risefloor {c,r,at}
     flyspike {r,at,fromRight,speed}   runaway {to:{c,r},at}
   Systems: scroll {at,speed}  rise {at,speed,max}  close {at,speed,x0,x1}  conveyors[] / cannons[] / fakeDoors[]
   `manual` + `jumpCols` give the headless verifier the exact launch columns of the intended route.

   Floor convention: ground = solid row 16 (walk row 15), pit spikes row 17. Second story = solid row 10
   (walk row 9). A staircase climbs ground->upper via 2-row steps at rows 14 and 12. */
(function () {
  const T = 40, H = 20;
  function G(w) { return Array.from({ length: H }, () => Array(w).fill(" ")); }
  function put(g, r, c, ch) { if (g[r] && c >= 0 && c < g[r].length) g[r][c] = ch; }
  function fill(g, r, c0, c1, ch) { for (let c = c0; c <= c1; c++) put(g, r, c, ch); }
  function S(g) { return g.map(a => a.join("")); }
  function ground(g, W) { fill(g, 16, 0, W - 1, "#"); fill(g, 17, 0, W - 1, "^"); }
  function pit(g, c0, c1) { fill(g, 16, c0, c1, " "); fill(g, 17, c0, c1, "^"); }   // a real ground gap (forces the climb)
  function stair(g, sc) { fill(g, 14, sc + 1, sc + 4, "#"); fill(g, 12, sc + 5, sc + 8, "#");
    return { launch: [sc, sc + 4, sc + 8], up: sc + 9 }; }
  function tunnel(g, c0, c1) { fill(g, 12, c0, c1, "#"); fill(g, 13, c0, c1, "V"); }
  function climb(g, x0, rowBottom, steps) { const launch = [];
    for (let i = 0; i < steps; i++) { const r = rowBottom - i * 2, c = x0 + i * 4; fill(g, r, c, c + 3, "#"); launch.push(c + 3); }
    return launch; }

  // ---------- L1 — THE LONG WALK ----------
  // SIGNATURE: the gentle teacher on UNEVEN ground — drop down a tier, climb back up — with the invisible-pit
  // lie woven through each level. No flat hallway. OPENER: SAFE — first death is the pit at col 9.
  function L1() {
    const W = 44, g = G(W);
    fill(g, 16, 0, 14, "#"); fill(g, 17, 0, 14, "^"); put(g, 15, 2, "S");   // upper-left tier
    put(g, 16, 9, "v");                                                     // the first lie
    fill(g, 18, 15, 28, "#"); fill(g, 19, 15, 28, "^");                     // step DOWN to a lower tier
    put(g, 18, 22, "v");                                                    // another lie down here
    fill(g, 16, 29, W - 1, "#"); fill(g, 17, 29, W - 1, "^");               // climb back UP to the last tier
    put(g, 15, W - 2, "E");
    return {
      name: "THE LONG WALK", bg: ["#0c0710", "#05040a"], block: "#3a2350", manual: true,
      grid: S(g),
      jumpCols: [8, 21, 28],
      traps: [
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ],
    };
  }

  // ---------- L2 — THE FLOOR MOVES ----------
  // SIGNATURE: the floor itself is the trap (visible conveyors). OPENER: the gimmick — a belt shoves you into a pit.
  function L2() {
    const W = 48, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    fill(g, 16, 6, 12, "~");                            // conveyor → shoves you RIGHT toward...
    put(g, 16, 14, "v");                               // ...an invisible pit
    const st = stair(g, 17);
    pit(g, 26, 47);
    fill(g, 10, 26, 46, "#");
    fill(g, 10, 31, 37, "<");                           // upper conveyor → drags you back toward the drop
    put(g, 9, 44, "E");
    return {
      name: "THE FLOOR MOVES", bg: ["#0a0f10", "#04060a"], block: "#234a3e", manual: true,
      grid: S(g),
      jumpCols: [13, ...st.launch],
      conveyors: [
        { c0: 6, c1: 12, r: 16, dir: 1, speed: 165, at: 4.0 },
        { c0: 31, c1: 37, r: 10, dir: -1, speed: 145, at: 26.0 },
      ],
      traps: [
        { do: "popspike", c: 30, r: 9, at: 29.0 },       // erupts just after you crest the stair onto the deck
      ],
    };
  }

  // ---------- L3 — THE SCREEN MOVES ----------
  // SIGNATURE: a kill-wall drags the camera forward; no stopping, cross a bridge over a trench.
  // OPENER: SAFE for a beat, then the wall engages and an invisible pit yawns at col 12.
  function L3() {
    const W = 60, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 12, "v"); fill(g, 16, 22, 24, "c");
    pit(g, 31, 39);
    fill(g, 14, 30, 40, "#");                           // a bridge 2 rows up
    fill(g, 16, 48, 50, "c"); put(g, 16, 52, "v");
    put(g, 15, W - 2, "E");
    return {
      name: "THE SCREEN MOVES", bg: ["#0c0a16", "#05040a"], block: "#2f2a55", manual: true,
      grid: S(g),
      scroll: { at: 3.5, speed: 150 },
      jumpCols: [11, 29, 51],
      traps: [
        { do: "popspike", c: 45, r: 15, at: 44.0 },        // a late sting between the bridge and the door
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ],
    };
  }

  // ---------- L4 — THE PIT CLOSES ----------
  // SIGNATURE: vertical lava shaft — race UP a staircase while a lake climbs from below. Two stones are lies.
  function L4() {
    const W = 28, HH = 16, g = Array.from({ length: HH }, () => Array(W).fill(" "));
    fill(g, 15, 0, W - 1, "#");
    for (let r = 0; r < HH; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); }
    fill(g, 14, 1, 4, "#"); put(g, 13, 2, "S");
    fill(g, 12, 5, 8, "#"); fill(g, 10, 9, 12, "#"); fill(g, 8, 13, 16, "#");
    fill(g, 6, 17, 21, "#"); put(g, 5, 19, "E");
    fill(g, 12, 13, 14, "v"); fill(g, 8, 9, 10, "B");
    return {
      name: "THE PIT CLOSES", bg: ["#140709", "#05040a"], block: "#4a1f1f", manual: true,
      grid: S(g),
      rise: { at: 99, atTime: 0.8, speed: 27, max: 15 },
      jumpCols: [4, 8, 12, 16],
      traps: [],
    };
  }

  // ---------- L5 — DEAD MAN'S SWITCH ----------
  // SIGNATURE: a screaming circular SAW patrols the corridor. There's a big red BUTTON earlier on the floor —
  // slap it and the blade dies. Miss it and the blade doesn't. OPENER: an invisible pit at col 9.
  function L5() {
    const W = 48, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");
    put(g, 15, W - 2, "E");
    return {
      name: "DEAD MAN'S SWITCH", bg: ["#0c0a10", "#05040a"], block: "#5a2a2a", manual: true,
      grid: S(g),
      jumpCols: [8],
      buttons: [{ c: 18, r: 15, group: "saw" }],                        // hit this to kill the blade
      saws: [{ c0: 26, c1: 38, r: 15, speed: 210, group: "saw" }],     // ...or it carves you on the way to the door
      traps: [
        { do: "popspike", c: 14, r: 15, at: 13 },
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ],
    };
  }

  // ===================== L6–L20 — the cruelty curve, each with its own face =====================

  // L6 — THE SKY FALLS: ceiling spikes RAIN down at you, ground and deck. SIGNATURE: death from above.
  // OPENER: SAFE — first drop is at col 13, after a clean run-up.
  function L6() {
    const W = 48, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");
    const st = stair(g, 16); pit(g, 25, 31); fill(g, 10, 25, 40, "#");
    put(g, 10, 37, "v");
    put(g, 15, W - 2, "E");
    return { name: "THE SKY FALLS", bg: ["#0a0a14", "#04040a"], block: "#2b2b50", manual: true, grid: S(g),
      jumpCols: [8, ...st.launch, 36],
      traps: [
        { do: "drop", c: 13, r: 11, at: 11, floorR: 15 },   // the rain begins
        { do: "drop", c: 20, r: 11, at: 18, floorR: 15 },
        { do: "drop", c: 30, r: 6, at: 28, floorR: 9 },     // it follows you up onto the deck
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L7 — THE LIFT: the ground ends at a spike chasm. A tower of metal rises and falls in the gap — step on
  // when it's down, RIDE it up, step off onto the high ledge. SIGNATURE: a moving lift (the floor carries you).
  function L7() {
    const W = 28, g = G(W);
    fill(g, 16, 0, 13, "#"); fill(g, 17, 0, 13, "^"); put(g, 15, 2, "S");   // ground up to the chasm
    put(g, 16, 9, "v");                                                     // opener lie
    fill(g, 17, 14, W - 1, "^");                                            // a spike chasm — fall and die
    fill(g, 8, 17, W - 1, "#"); put(g, 7, 23, "E");                         // the high exit ledge (lift level)
    return { name: "THE LIFT", bg: ["#0a0f12", "#04060a"], block: "#2f5060", manual: true, grid: S(g),
      jumpCols: [8],
      // a vertical platform: bottom sits level with the ground floor, top reaches the ledge. phase 1 = starts down;
      // dwell pauses it at each end long enough to board / step off.
      platforms: [{ c: 14, r: 8, w: 3, axis: "y", dist: 8, speed: 85, phase: 1, dwell: 1.6 }],
      traps: [] };
  }

  // L8 — THE RISERS: the flat ground you just cleared ERUPTS in waves behind/under you. SIGNATURE: rising spikes.
  // OPENER: SAFE — first riser at col 13.
  function L8() {
    const W = 50, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");
    const st = stair(g, 16); pit(g, 25, 31); fill(g, 10, 25, 40, "#");
    put(g, 15, W - 2, "E");
    return { name: "THE RISERS", bg: ["#0e0710", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      jumpCols: [8, ...st.launch],
      traps: [
        { do: "risefloor", c: 13, r: 15, at: 12 },        // a wave on the ground
        { do: "risefloor", c: 31, r: 9, at: 30 },         // two more up on the deck (clear of the stair)
        { do: "risefloor", c: 36, r: 9, at: 35 },
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L9 — CONVEYOR HELL (HARDENED): the belts are visible — but now INVISIBLE spikes wait exactly where the
  // floor carries you, and a javelin crosses the open. SIGNATURE: the moving floor sets you up for a hidden kill.
  function L9() {
    const W = 52, g = G(W); ground(g, W); put(g, 15, 2, "S");
    fill(g, 16, 5, 11, ">"); put(g, 16, 13, "v");
    const st = stair(g, 17); pit(g, 26, 47); fill(g, 10, 26, 50, "#");
    fill(g, 10, 30, 35, "<"); put(g, 10, 39, "v"); fill(g, 10, 42, 47, ">");
    put(g, 9, W - 2, "E");
    return { name: "CONVEYOR HELL", bg: ["#0a0f10", "#04060a"], block: "#1f5240", manual: true, grid: S(g),
      jumpCols: [12, ...st.launch, 38],
      conveyors: [
        { c0: 5, c1: 11, r: 16, dir: 1, speed: 195, at: 3 },    // faster shove
        { c0: 30, c1: 35, r: 10, dir: -1, speed: 175, at: 26 }, // harder backward drag toward the pit
        { c0: 42, c1: 47, r: 10, dir: 1, speed: 190, at: 26 },  // flung toward the doorstep
      ],
      traps: [
        { do: "flyspike", r: 15, at: 3, fromRight: true, speed: 450 },  // a spear in the open, before the belt
        { do: "doorspike", c: W - 3, r: 9, at: W - 5 },                 // the belt flings you onto a hidden doorstep spike
      ] };
  }

  // L10 — THE FLOOD II: a taller lava shaft, faster lava, more lies. SIGNATURE: the hardest pure climb.
  function L10() {
    const W = 30, g = G(W);
    for (let r = 0; r < 20; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); }
    fill(g, 18, 0, W - 1, "#"); fill(g, 17, 1, 4, "#"); put(g, 16, 2, "S");
    const launch = climb(g, 5, 15, 6);
    put(g, 4, 26, "E");
    put(g, 13, 13, "v"); put(g, 7, 13, "B");
    return { name: "THE FLOOD II", bg: ["#140709", "#05040a"], block: "#6a2418", manual: true, grid: S(g),
      rise: { at: 99, atTime: 0.7, speed: 33, max: 18 },
      jumpCols: [4, ...launch.slice(0, 5)],
      traps: [] };
  }

  // L11 — SAW GAUNTLET: two screaming blades patrol the corridor. The first has a kill-switch on the floor;
  // the second does NOT — you jump it. SIGNATURE: switches and blades. OPENER: an invisible pit at col 9.
  function L11() {
    const W = 50, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");
    put(g, 15, W - 2, "E");
    return { name: "SAW GAUNTLET", bg: ["#0c0710", "#05040a"], block: "#5a2a2a", manual: true, grid: S(g),
      jumpCols: [8],
      buttons: [{ c: 14, r: 15, group: "a" }],                       // kills the first blade
      saws: [
        { c0: 18, c1: 27, r: 15, speed: 210, group: "a" },          // switchable
        { c0: 36, c1: 42, r: 15, speed: 150 },                      // NO switch — jump it or be sliced
      ],
      traps: [
        { do: "popspike", c: 12, r: 15, at: 11 },
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L12 — THE SQUEEZE: a wall of grinding spikes chases from behind and KILLS on contact. It looms right on
  // your heels the whole way — keep running and time the three jumps clean, and you live; hesitate and it eats you.
  function L12() {
    const W = 56, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 14, "v"); put(g, 16, 28, "v"); put(g, 16, 42, "v");  // three pits to clear WITHOUT breaking stride
    put(g, 15, W - 2, "E");
    return { name: "THE SQUEEZE", bg: ["#100610", "#05040a"], block: "#3a2350", manual: true, grid: S(g),
      close: { at: 4, speed: 210, x0: 0, x1: 99999 },    // lethal + fast enough to stay on your heels (outrun it, don't dawdle)
      jumpCols: [13, 27, 41],
      traps: [
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L13 — THE VICE: a sealed room where the walls, ceiling AND floor all grind inward at once. SIGNATURE: the
  // play area shrinks from every side — climb the staircase to the exit before the box becomes a coffin.
  function L13() {
    const W = 24, g = G(W);
    for (let r = 0; r < H; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); }   // sealed side walls
    fill(g, 17, 0, W - 1, "#"); fill(g, 16, 1, 4, "#"); put(g, 15, 2, "S");      // floor + start ledge
    const launch = climb(g, 5, 14, 4);                                          // ledges rows 14,12,10,8
    put(g, 7, 18, "E");                                                         // exit atop the highest ledge
    return { name: "THE VICE", bg: ["#0c0610", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      close: { at: 1.5, speed: 74, x0: 0, x1: W * 40, arena: true },            // close from ALL sides
      jumpCols: [4, ...launch],
      traps: [] };
  }

  // L14 — MINEFIELD: a single flat field where some tiles VANISH and others ERUPT — all invisible, all lethal,
  // every few steps. SIGNATURE: pure memory, no stairs, no decks — just a floor that hates you.
  // OPENER: a genuine first-step gamble — the first hole is close (col 8) to set the tone.
  function L14() {
    const W = 52, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 8, "v"); put(g, 16, 14, "B"); put(g, 16, 21, "v");
    put(g, 16, 27, "B"); put(g, 16, 34, "v"); put(g, 16, 41, "B");
    put(g, 15, W - 2, "E");
    return { name: "MINEFIELD", bg: ["#0c0c08", "#05050a"], block: "#4a4520", manual: true, grid: S(g),
      jumpCols: [7, 13, 20, 26, 33, 40],
      traps: [
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L15 — OUTRUN: the screen drags you forward AND javelins cross your path. SIGNATURE: speed + crossfire combined.
  // OPENER: SAFE — the wall engages, the first pit is at col 11.
  function L15() {
    const W = 64, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 11, "v"); put(g, 16, 24, "v");
    pit(g, 33, 41); fill(g, 14, 32, 42, "#");
    put(g, 16, 52, "v");
    put(g, 15, W - 2, "E");
    return { name: "OUTRUN", bg: ["#0c0a16", "#05040a"], block: "#2a2f6a", manual: true, grid: S(g),
      scroll: { at: 3, speed: 150 },
      jumpCols: [10, 23, 31, 51],
      traps: [
        { do: "flyspike", r: 15, at: 18, fromRight: true, speed: 520 },  // a spear mid-run
        { do: "flyspike", r: 15, at: 46, fromRight: true, speed: 520 },  // another after the bridge
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L16 — PISTON ALLEY: a single corridor where the CEILING drops and the FLOOR erupts in alternation.
  // SIGNATURE: top-and-bottom hazards trading blows — no two consecutive hits the same. OPENER: a sky-spike at col 10.
  // L16 — STEPPING STONES: a wide spike pit too far to jump. A metal slab ferries back and forth across it —
  // board it, ride, step off before it carries you back. SIGNATURE: ride the moving box or fall.
  function L16() {
    const W = 30, g = G(W);
    fill(g, 16, 0, 10, "#"); fill(g, 17, 0, 10, "^"); put(g, 15, 2, "S");
    put(g, 16, 7, "v");                                  // opener lie
    fill(g, 17, 11, 23, "^");                            // the chasm — no jumping it
    fill(g, 16, 24, W - 1, "#"); fill(g, 17, 24, W - 1, "^");
    put(g, 15, W - 2, "E");
    return { name: "STEPPING STONES", bg: ["#0a0c12", "#04060a"], block: "#2f3a60", manual: true, grid: S(g),
      jumpCols: [6],
      platforms: [{ c: 11, r: 16, w: 4, axis: "x", dist: 9, speed: 95, phase: 0, dwell: 1.5 }],
      traps: [] };
  }

  // L17 — MEAT GRINDER: a long, dense ground gauntlet with a no-jump tunnel. SIGNATURE: relentless, no breathers.
  // OPENER: SAFE-ish — first pit at col 9 (not a spike at your toes).
  function L17() {
    const W = 58, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v"); put(g, 16, 17, "v"); tunnel(g, 22, 27);
    put(g, 16, 35, "v"); put(g, 16, 43, "v");
    put(g, 15, W - 2, "E");
    return { name: "MEAT GRINDER", bg: ["#100606", "#05040a"], block: "#4a1f1f", manual: true, grid: S(g),
      jumpCols: [8, 16, 34, 42],
      traps: [
        { do: "popspike", c: 13, r: 15, at: 12 },
        { do: "popspike", c: 31, r: 15, at: 30 },
        { do: "popspike", c: 39, r: 15, at: 38 },
        { do: "popspike", c: 47, r: 15, at: 46 }, { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L18 — DOUBLE CROSS: the door bolts twice, through a tunnel and the guns. SIGNATURE: the exit that runs away.
  // OPENER: SAFE — first pit at col 10.
  function L18() {
    const W = 58, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 10, "v"); fill(g, 16, 15, 17, "c");
    tunnel(g, 22, 27);
    const st = stair(g, 31); pit(g, 40, 56); fill(g, 10, 40, 56, "#");
    put(g, 9, 50, "E");
    return { name: "DOUBLE CROSS", bg: ["#0c0710", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      jumpCols: [9, ...st.launch],
      cannons: [{ c: 47, r: 9, dir: -1, period: 2.2, speed: 270, phase: 0.0, life: 1.4 }],
      traps: [
        { do: "runaway", to: { c: 55, r: 9 }, at: 49 }, // bolts further right — chase it through the fire
        { do: "doorspike", c: 54, r: 9, at: 53 },
      ] };
  }

  // L19 — MELTDOWN: the lava shaft, but a CANNON rakes the climb. SIGNATURE: the only vertical with crossfire.
  function L19() {
    const W = 30, g = G(W);
    for (let r = 0; r < 20; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); }
    fill(g, 18, 0, W - 1, "#"); fill(g, 17, 1, 4, "#"); put(g, 16, 2, "S");
    const launch = climb(g, 5, 15, 6);
    put(g, 4, 26, "E");
    put(g, 13, 13, "v"); put(g, 7, 13, "B"); put(g, 9, 13, "v"); // three lies, off the safe climb line
    return { name: "MELTDOWN", bg: ["#150709", "#05040a"], block: "#5a1818", manual: true, grid: S(g),
      rise: { at: 99, atTime: 0.6, speed: 33, max: 18 },
      cannons: [{ c: 28, r: 5, dir: -1, period: 2.4, speed: 210, phase: 0.6, life: 1.8 }], // guards the top ledge to the exit
      jumpCols: [4, ...launch.slice(0, 5)],
      traps: [] };
  }

  // L20 — THE RECKONING: the finale puts the new toys together — kill a saw with a switch, ride a lift over a
  // chasm, dash a guarded ledge to the door. SIGNATURE: everything you learned, back to bite you.
  function L20() {
    const W = 46, g = G(W);
    fill(g, 16, 0, 17, "#"); fill(g, 17, 0, 17, "^"); put(g, 15, 2, "S");    // leg 1 — ground
    put(g, 16, 7, "v");                                                      // opener lie
    fill(g, 17, 18, 25, "^");                                                // the chasm
    fill(g, 8, 21, W - 1, "#"); put(g, 7, 38, "E");                          // leg 3 — the exit ledge (lift level)
    return { name: "THE RECKONING", bg: ["#0c0608", "#05040a"], block: "#5a1530", manual: true, grid: S(g),
      jumpCols: [6, 36],
      buttons: [{ c: 9, r: 15, group: "s" }],                                // kill the blade...
      saws: [{ c0: 11, c1: 16, r: 15, speed: 200, group: "s" }],            // ...or it carves leg 1
      platforms: [{ c: 18, r: 8, w: 3, axis: "y", dist: 8, speed: 85, phase: 1, dwell: 1.6 }], // the lift over the chasm
      traps: [{ do: "doorspike", c: 37, r: 7, at: 36 }],                     // a final sting at the door
    };
  }

  window.LEVELS = [L1(), L2(), L3(), L4(), L5(), L6(), L7(), L8(), L9(), L10(),
    L11(), L12(), L13(), L14(), L15(), L16(), L17(), L18(), L19(), L20()];
})();
