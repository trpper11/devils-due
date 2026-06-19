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

  window.LEVELS = [L1(), L2(), L3(), L4(), L5()];
})();
