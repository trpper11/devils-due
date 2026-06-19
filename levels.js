/* DEVIL'S DUE — levels.
   Now MULTI-STORY. Every level stacks floors connected by staircases, bridges, drops and tunnels — you
   climb up, run across, fall back down. The ground floor is BLOCKED (a pit the upper route spans), so the
   second story isn't optional. It still LOOKS like a calm stroll; traps are invisible and untelegraphed,
   and the gauntlet re-arms identically on death so it is beatable by MEMORY.

   Tile legend (deadly things are drawn IDENTICAL to safe ones, or simply not there yet):
     #  solid   v  vanishing floor   c  crumbling floor   B  bait block (erupts on landing)
     ~ < >  conveyor   ^  floor spikes   V  ceiling spikes   S  start   E  exit door
   Trap defs (fire by x-threshold `at` in tiles, or `atTime` in s):
     popspike {c,r,at}  drop {c,at,floorR}  doorspike {c,r,at}  risefloor {c,r,at}
     flyspike {r,at,fromRight,speed}   runaway {to:{c,r},at}
   Systems: scroll {at,speed}  rise {at,speed,max}   conveyors[] / cannons[] / fakeDoors[]
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
  // staircase ground(16) -> second story(10), starting at column sc.
  function stair(g, sc) { fill(g, 14, sc + 1, sc + 4, "#"); fill(g, 12, sc + 5, sc + 8, "#");
    return { launch: [sc, sc + 4, sc + 8], up: sc + 9 }; }
  // a low spiked ceiling over a ground stretch: walk it, NEVER jump (a hop into the ceiling kills you).
  function tunnel(g, c0, c1) { fill(g, 12, c0, c1, "#"); fill(g, 13, c0, c1, "V"); }
  // a vertical staircase for lava-shaft climbs (4-wide ledges, 2 rows apart). returns launch cols.
  function climb(g, x0, rowBottom, steps) { const launch = [];
    for (let i = 0; i < steps; i++) { const r = rowBottom - i * 2, c = x0 + i * 4; fill(g, r, c, c + 3, "#"); launch.push(c + 3); }
    return launch; }

  // ---------- L1 — THE LONG WALK ----------
  // Stroll the ground floor; a pit blocks the way, so climb the staircase to the upper deck (a fake exit
  // glows up there), cross over the pit, and drop to the real door. Cheap deaths on both floors.
  function L1() {
    const W = 44, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");                                 // invisible ground pit
    pit(g, 25, 31);                                     // a real chasm — only the deck crosses it
    const st = stair(g, 16);                            // launches 16,20,24 ; deck from col 25
    fill(g, 10, st.up, 36, "#");                        // the upper deck, spanning the chasm
    put(g, 15, W - 2, "E");                             // real door, on the ground, past the chasm
    return {
      name: "THE LONG WALK", bg: ["#0c0710", "#05040a"], block: "#3a2350", manual: true,
      grid: S(g),
      jumpCols: [8, ...st.launch],
      fakeDoors: [{ c: 33, r: 9 }],                      // the lie sits up on the deck
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4.0 },
        { do: "drop", c: 12, r: 11, at: 10.0, floorR: 15 }, // drops from under the deck, plants as a floor spike
        { do: "popspike", c: 28, r: 9, at: 26.0 },       // a sting up on the deck
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 }, // and the doorstep after you drop down
      ],
    };
  }

  // ---------- L2 — THE FLOOR MOVES ----------
  // A ground conveyor shoves you into a pit; the ground then drops away entirely. Climb to the upper deck,
  // where ANOTHER conveyor drags you backward toward the edge as you fight to the door at the far end.
  function L2() {
    const W = 48, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    fill(g, 16, 6, 12, "~");                            // conveyor → shoves you RIGHT toward...
    put(g, 16, 14, "v");                               // ...an invisible pit
    const st = stair(g, 17);                            // launches 17,21,25 ; deck from col 26
    pit(g, 26, 47);                                     // ground ends — the deck is the only way on
    fill(g, 10, 26, 46, "#");                           // upper deck
    fill(g, 10, 31, 37, "<");                           // upper conveyor → drags you back toward the drop
    put(g, 9, 44, "E");                                 // door, up on the deck, far right
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
  // The camera drags you forward into a kill-wall — no stopping. A trench splits the floor; the only way
  // across is up onto a bridge and back down, all while the wall chases and invisible spikes wait.
  function L3() {
    const W = 60, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 12, "v"); fill(g, 16, 22, 24, "c");      // ground hazards
    pit(g, 31, 39);                                     // a trench too wide to jump flat
    fill(g, 14, 30, 40, "#");                           // a bridge 2 rows up: hop on, cross, drop off
    fill(g, 16, 48, 50, "c"); put(g, 16, 52, "v");      // more ground hazards after you land
    put(g, 15, W - 2, "E");
    return {
      name: "THE SCREEN MOVES", bg: ["#0c0a16", "#05040a"], block: "#2f2a55", manual: true,
      grid: S(g),
      scroll: { at: 3.5, speed: 150 },                   // brisk — the kill-wall makes you actually run
      jumpCols: [11, 29, 51],                            // v, hop onto the bridge, last v (then walk off the bridge)
      traps: [
        { do: "popspike", c: 8, r: 15, at: 7.0 },
        { do: "popspike", c: 45, r: 15, at: 44.0 },
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ],
    };
  }

  // ---------- L4 — THE PIT CLOSES ----------
  // A vertical shaft: a lake of lava climbs from below while you race UP a staircase to a high exit. Two of
  // the tempting stones are lies. (The original vertical level — multi-story by nature.)
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

  // ---------- L5 — TWO DOORS ----------
  // The obvious door glows on the ground floor — and it's lethal. The real exit is UPSTAIRS, and it bolts
  // the instant you reach for it. Climb through a cannon's line of fire and chase it down the deck.
  function L5() {
    const W = 52, g = G(W);
    ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 14, "v"); fill(g, 16, 20, 22, "c");
    const st = stair(g, 29);                            // launches 29,33,37 ; deck from col 38
    pit(g, 38, 51);                                     // ground ends — the only way on is the deck
    fill(g, 10, 38, 50, "#");                           // upper deck holds the real door
    put(g, 9, 48, "E");                                 // real exit, upstairs at the far right
    return {
      name: "TWO DOORS", bg: ["#0c0710", "#05040a"], block: "#45236a", manual: true,
      grid: S(g),
      jumpCols: [13, ...st.launch],
      fakeDoors: [{ c: 25, r: 15 }],                     // the obvious ground-floor door — a lie
      cannons: [{ c: 46, r: 9, dir: -1, period: 2.2, speed: 265, phase: 0.0, life: 1.4 }], // rakes the deck
      traps: [
        { do: "popspike", c: 6, r: 15, at: 5.0 },
        { do: "drop", c: 18, r: 11, at: 16.0, floorR: 15 },
        { do: "runaway", to: { c: 41, r: 9 }, at: 46.0 },// reach the upstairs door and it bolts back along the deck
        { do: "doorspike", c: 40, r: 9, at: 41.5 },
      ],
    };
  }

  // ===================== L6–L20 — the cruelty curve =====================

  // L6 — THE GAUNTLET: denser two-story, fake exit up on the deck.
  function L6() {
    const W = 48, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");
    const st = stair(g, 16); pit(g, 25, 31); fill(g, 10, 25, 40, "#");
    put(g, 10, 37, "v");
    put(g, 15, W - 2, "E");
    return { name: "THE GAUNTLET", bg: ["#0c0710", "#05040a"], block: "#3a2350", manual: true, grid: S(g),
      jumpCols: [8, ...st.launch, 36],
      fakeDoors: [{ c: 32, r: 9 }],
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 }, { do: "drop", c: 13, r: 11, at: 11, floorR: 15 },
        { do: "popspike", c: 31, r: 9, at: 30 }, { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L7 — FLY TRAP: a spike screams in sideways while you cross the open ground.
  function L7() {
    const W = 50, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 10, "v"); fill(g, 16, 14, 16, "c");
    const st = stair(g, 19); pit(g, 28, 34); fill(g, 10, 28, 40, "#");   // deck ends clear of the door
    put(g, 15, W - 2, "E");
    return { name: "FLY TRAP", bg: ["#0c0a10", "#05040a"], block: "#3a2350", manual: true, grid: S(g),
      jumpCols: [9, ...st.launch],
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 },
        { do: "flyspike", r: 15, at: 6.5, fromRight: true, speed: 460 },   // javelin across the open ground
        { do: "popspike", c: 34, r: 9, at: 33 },                          // on the deck, clear of the stair-crest
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L8 — RISERS: spikes erupt from flat ground you just cleared.
  function L8() {
    const W = 50, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v");
    const st = stair(g, 16); pit(g, 25, 31); fill(g, 10, 25, 40, "#");
    put(g, 15, W - 2, "E");
    return { name: "THE RISERS", bg: ["#0e0710", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      jumpCols: [8, ...st.launch],
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 }, { do: "risefloor", c: 13, r: 15, at: 12 },
        { do: "risefloor", c: 30, r: 9, at: 29 }, { do: "risefloor", c: 35, r: 9, at: 34 },
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L9 — CONVEYOR HELL: moving floors on both storeys, into pits.
  function L9() {
    const W = 52, g = G(W); ground(g, W); put(g, 15, 2, "S");
    fill(g, 16, 5, 11, ">"); put(g, 16, 13, "v");
    const st = stair(g, 17); pit(g, 26, 47); fill(g, 10, 26, 50, "#");
    fill(g, 10, 30, 35, "<"); put(g, 10, 39, "v"); fill(g, 10, 42, 47, ">");
    put(g, 9, W - 2, "E");
    return { name: "CONVEYOR HELL", bg: ["#0a0f10", "#04060a"], block: "#234a3e", manual: true, grid: S(g),
      jumpCols: [12, ...st.launch, 38],
      conveyors: [
        { c0: 5, c1: 11, r: 16, dir: 1, speed: 175, at: 3 },
        { c0: 30, c1: 35, r: 10, dir: -1, speed: 150, at: 26 },
        { c0: 42, c1: 47, r: 10, dir: 1, speed: 165, at: 26 },
      ],
      traps: [] };
  }

  // L10 — THE FLOOD II: a taller lava shaft, faster lava, more lies.
  function L10() {
    const W = 30, g = G(W);
    for (let r = 0; r < 20; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); }
    fill(g, 18, 0, W - 1, "#"); fill(g, 17, 1, 4, "#"); put(g, 16, 2, "S");
    const launch = climb(g, 5, 15, 6);                 // ledges rows 15,13,11,9,7,5 ; right edges
    put(g, 4, 26, "E");                                // exit on the top ledge (cols 25-28)
    put(g, 13, 13, "v"); put(g, 7, 13, "B");           // two lies, off the safe climb line
    return { name: "THE FLOOD II", bg: ["#140709", "#05040a"], block: "#4a1f1f", manual: true, grid: S(g),
      rise: { at: 99, atTime: 0.7, speed: 33, max: 18 },
      jumpCols: [4, ...launch.slice(0, 5)],
      traps: [] };
  }

  // L11 — LIARS' ROW: three doors, two are lies, the real one runs into the guns.
  function L11() {
    const W = 54, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 12, "v"); fill(g, 16, 18, 20, "c");
    const st = stair(g, 28); pit(g, 37, 53); fill(g, 10, 37, 52, "#");
    put(g, 9, 51, "E");                                // real door at the far right of the deck
    return { name: "LIARS' ROW", bg: ["#0c0710", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      jumpCols: [11, ...st.launch],
      fakeDoors: [{ c: 24, r: 15 }],                    // the obvious ground-floor lie
      cannons: [{ c: 44, r: 9, dir: -1, period: 2.2, speed: 270, phase: 0.0, life: 1.4 }], // rakes the deck approach
      traps: [
        { do: "popspike", c: 6, r: 15, at: 5 }, { do: "drop", c: 16, r: 11, at: 14, floorR: 15 },
      ] };
  }

  // L12 — THE SQUEEZE: a wall of spikes grinds in from behind. Run or be paste.
  function L12() {
    const W = 56, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 12, "v"); put(g, 16, 30, "v"); put(g, 16, 42, "v");
    put(g, 15, W - 2, "E");
    return { name: "THE SQUEEZE", bg: ["#100610", "#05040a"], block: "#3a2350", manual: true, grid: S(g),
      close: { at: 4, speed: 95, x0: 0, x1: 99999 },     // only the LEFT wall advances (right is off-world)
      jumpCols: [11, 29, 41],
      traps: [
        { do: "popspike", c: 7, r: 15, at: 6 }, { do: "popspike", c: 24, r: 15, at: 23 },
        { do: "popspike", c: 37, r: 15, at: 36 }, { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L13 — FREEFALL: you start UP on a deck, drop to the ground (one tile is a GHOST that drops you early),
  // cross, then climb a staircase back up to the exit.
  function L13() {
    const W = 46, g = G(W); ground(g, W);
    fill(g, 10, 0, 15, "#"); put(g, 9, 2, "S");        // upper start deck (left)
    put(g, 10, 9, "v");                                // a vanishing deck tile — drops you early
    // deck ends at col 15 → fall to the ground; ground gauntlet 17..26
    put(g, 16, 20, "v"); fill(g, 16, 24, 26, "c");
    const st = stair(g, 30); pit(g, 39, 45); fill(g, 10, 39, 44, "#"); put(g, 9, 42, "E");
    return { name: "FREEFALL", bg: ["#0a0a14", "#04040a"], block: "#2f2a55", manual: true, grid: S(g),
      jumpCols: [8, 19, ...st.launch],                  // ghost on the deck, ghost on the ground, then the climb
      traps: [
        { do: "popspike", c: 5, r: 9, at: 4 }, { do: "popspike", c: 28, r: 15, at: 27 },
        { do: "popspike", c: 36, r: 15, at: 35 },
      ] };
  }

  // L14 — CROSSFIRE: guns down on the deck, a javelin across the ground.
  function L14() {
    const W = 52, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v"); fill(g, 16, 14, 16, "c");
    const st = stair(g, 19); pit(g, 28, 47); fill(g, 10, 28, 50, "#");
    put(g, 10, 37, "v");
    put(g, 9, W - 2, "E");
    return { name: "CROSSFIRE", bg: ["#0c0710", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      jumpCols: [8, ...st.launch, 36],
      cannons: [{ c: 44, r: 9, dir: -1, period: 2.2, speed: 270, phase: 0.0, life: 1.4 }],
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 },
        { do: "flyspike", r: 15, at: 6.5, fromRight: true, speed: 470 },
      ] };
  }

  // L15 — OUTRUN: auto-scroll, faster, with a bridge over a trench.
  function L15() {
    const W = 64, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 11, "v"); put(g, 16, 24, "v");
    pit(g, 33, 41); fill(g, 14, 32, 42, "#");        // bridge over the trench
    put(g, 16, 52, "v");
    put(g, 15, W - 2, "E");
    return { name: "OUTRUN", bg: ["#0c0a16", "#05040a"], block: "#2f2a55", manual: true, grid: S(g),
      scroll: { at: 3, speed: 150 },
      jumpCols: [10, 23, 31, 51],
      traps: [
        { do: "popspike", c: 7, r: 15, at: 6 }, { do: "popspike", c: 48, r: 15, at: 47 },
        { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L16 — THE WORKS: conveyor + drop + ghost + fake door + riser, two storeys.
  function L16() {
    const W = 54, g = G(W); ground(g, W); put(g, 15, 2, "S");
    fill(g, 16, 6, 11, ">"); put(g, 16, 14, "v");
    const st = stair(g, 18); pit(g, 27, 33); fill(g, 10, 27, 46, "#");
    fill(g, 10, 36, 41, "<");
    put(g, 15, W - 2, "E");
    return { name: "THE WORKS", bg: ["#0a0f10", "#04060a"], block: "#234a3e", manual: true, grid: S(g),
      jumpCols: [13, ...st.launch],
      conveyors: [
        { c0: 6, c1: 11, r: 16, dir: 1, speed: 175, at: 3 },
        { c0: 36, c1: 41, r: 10, dir: -1, speed: 150, at: 27 },
      ],
      fakeDoors: [{ c: 33, r: 9 }],                       // crest the stair onto a fake exit
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 }, { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L17 — MEAT GRINDER: a long, dense ground gauntlet with a no-jump tunnel.
  function L17() {
    const W = 58, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 9, "v"); put(g, 16, 17, "v"); tunnel(g, 22, 27);   // relentless, evenly spaced; DON'T jump in the tunnel
    put(g, 16, 35, "v"); put(g, 16, 43, "v");
    put(g, 15, W - 2, "E");
    return { name: "MEAT GRINDER", bg: ["#100606", "#05040a"], block: "#4a1f1f", manual: true, grid: S(g),
      jumpCols: [8, 16, 34, 42],
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 }, { do: "popspike", c: 13, r: 15, at: 12 },
        { do: "popspike", c: 31, r: 15, at: 30 }, { do: "popspike", c: 39, r: 15, at: 38 },
        { do: "popspike", c: 47, r: 15, at: 46 }, { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  // L18 — DOUBLE CROSS: the door bolts twice, through a tunnel and the guns.
  function L18() {
    const W = 58, g = G(W); ground(g, W); put(g, 15, 2, "S");
    put(g, 16, 10, "v"); fill(g, 16, 15, 17, "c");
    tunnel(g, 22, 27);
    const st = stair(g, 31); pit(g, 40, 56); fill(g, 10, 40, 56, "#");
    put(g, 9, 50, "E");                                 // door scoots FORWARD when you reach it
    return { name: "DOUBLE CROSS", bg: ["#0c0710", "#05040a"], block: "#45236a", manual: true, grid: S(g),
      jumpCols: [9, ...st.launch],
      cannons: [{ c: 47, r: 9, dir: -1, period: 2.2, speed: 270, phase: 0.0, life: 1.4 }],
      traps: [
        { do: "popspike", c: 6, r: 15, at: 5 },
        { do: "runaway", to: { c: 55, r: 9 }, at: 49 }, // bolts further right — chase it through the fire
        { do: "doorspike", c: 54, r: 9, at: 53 },
      ] };
  }

  // L19 — MELTDOWN: climb a lava shaft while a spiked wall grinds up behind you.
  function L19() {
    const W = 30, g = G(W);
    for (let r = 0; r < 20; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); }
    fill(g, 18, 0, W - 1, "#"); fill(g, 17, 1, 4, "#"); put(g, 16, 2, "S");
    const launch = climb(g, 5, 15, 6);
    put(g, 4, 26, "E");
    put(g, 13, 13, "v"); put(g, 7, 13, "B"); put(g, 9, 13, "v"); // three lies, off the safe climb line
    return { name: "MELTDOWN", bg: ["#150709", "#05040a"], block: "#4a1f1f", manual: true, grid: S(g),
      rise: { at: 99, atTime: 0.6, speed: 33, max: 18 },  // relentless lava
      jumpCols: [4, ...launch.slice(0, 5)],
      traps: [] };
  }

  // L20 — THE RECKONING: the long one. Everything, on three legs.
  function L20() {
    const W = 72, g = G(W); ground(g, W); put(g, 15, 2, "S");
    // leg 1: ground gauntlet — pit, drop, crumble, conveyor, pit
    put(g, 16, 10, "v"); fill(g, 16, 19, 21, "c"); fill(g, 16, 25, 30, ">"); put(g, 16, 33, "v");
    // leg 2: climb to a deck over a chasm — fake door + spikes
    const st = stair(g, 36); pit(g, 45, 51); fill(g, 10, 45, 60, "#");
    put(g, 10, 58, "v");
    // leg 3: drop back down, thread a no-jump tunnel, reach the door
    tunnel(g, 63, 67);
    put(g, 15, W - 2, "E");
    return { name: "THE RECKONING", bg: ["#0c0608", "#05040a"], block: "#5a1530", manual: true, grid: S(g),
      jumpCols: [9, 32, ...st.launch, 49, 57],
      conveyors: [{ c0: 25, c1: 30, r: 16, dir: 1, speed: 175, at: 22 }],
      fakeDoors: [{ c: 50, r: 9 }],
      traps: [
        { do: "popspike", c: 5, r: 15, at: 4 }, { do: "drop", c: 14, r: 11, at: 12, floorR: 15 },
        { do: "popspike", c: 54, r: 9, at: 53 }, { do: "doorspike", c: W - 3, r: 15, at: W - 5 },
      ] };
  }

  window.LEVELS = [L1(), L2(), L3(), L4(), L5(), L6(), L7(), L8(), L9(), L10(),
    L11(), L12(), L13(), L14(), L15(), L16(), L17(), L18(), L19(), L20()];
})();
