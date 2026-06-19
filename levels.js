/* DEVIL'S DUE — levels.
   Every level LOOKS like a calm walk to a door. None of them are. Traps are invisible until they kill
   you; the gauntlet re-arms identically on death so it is beatable by MEMORY, not luck. Difficulty and
   surprise escalate level to level — and within each level the surprises never stop.

   Tile legend (everything deadly is drawn IDENTICAL to something safe, or is simply not there yet):
     #  solid block        v  floor that VANISHES the instant you stand on it (pit/spikes beneath)
     c  floor that CRUMBLES a beat after you step (drawn solid)     B  block that ERUPTS spikes on landing
     ~ < >  CONVEYOR floor (looks solid; starts sliding you once armed)
     ^  visible floor spikes (decor / honest danger)   V  visible ceiling spikes
     S  start    E  exit door
   Trap defs (fire by x-threshold `at` in tiles, or `atTime` in seconds):
     popspike {c,r,at}     drop {c,at,floorR}   doorspike {c,r,at}   risefloor {c,r,at}
     flyspike {r,at,fromRight,speed}            runaway {to:{c,r}, at}
   Systems (level-wide): scroll {at,speed}  rise {at,speed,max}  close {at,speed,x0,x1}
   Plus: conveyors[] {c0,c1,r,dir,speed,at}   cannons[] {c,r,dir,period,speed,phase}   fakeDoors[] {c,r} */
(function () {
  const T = 40;
  function G(w, h) { return Array.from({ length: h }, () => Array(w).fill(" ")); }
  function put(g, r, c, ch) { if (g[r] && c >= 0 && c < g[r].length) g[r][c] = ch; }
  function fill(g, r, c0, c1, ch) { for (let c = c0; c <= c1; c++) put(g, r, c, ch); }
  function S(g) { return g.map(a => a.join("")); }

  // ---------- L1 — THE LONG WALK ----------
  // A wide, flat, empty-looking corridor. Five cheap deaths are sprinkled across it from the very first
  // steps. Nothing is telegraphed. Memorize the rhythm: jump, jump, skip a tile, jump, jump the doorstep.
  function L1() {
    const W = 46, g = G(W, 12);
    fill(g, 10, 0, W - 1, "#");          // floor
    fill(g, 11, 0, W - 1, "^");          // spike pit beneath (any fall kills)
    put(g, 9, 1, "S"); put(g, 9, W - 2, "E");
    put(g, 10, 9, "v");                  // invisible pit #1
    fill(g, 10, 24, 26, "c");            // crumbling stretch — don't dawdle
    return {
      name: "THE LONG WALK", bg: ["#0c0710", "#05040a"], block: "#3a2350",
      grid: S(g),
      fakeDoors: [{ c: 35, r: 9 }],                       // "oh, the exit!" — no. it's a lie. jump it or die on it.
      traps: [
        { do: "popspike", c: 5, r: 9, at: 4.0 },         // first blood, four steps in
        { do: "drop", c: 12, r: 0, at: 10.0, floorR: 9 },// ceiling spike plants as a floor spike: jump it
        { do: "popspike", c: 18, r: 9, at: 17.0 },
        { do: "popspike", c: 30, r: 9, at: 29.0 },
        { do: "doorspike", c: W - 3, r: 9, at: W - 5 },  // the doorstep itself
      ],
    };
  }

  // ---------- L2 — THE FLOOR MOVES ----------
  // Same calm corridor — but the floor itself betrays you. Conveyor strips slide you into pits, a helpful
  // stepping block erupts, and a gap that begs to be jumped grows a spike at the landing.
  function L2() {
    const W = 50, g = G(W, 12);
    fill(g, 10, 0, W - 1, "#"); fill(g, 11, 0, W - 1, "^");
    put(g, 9, 1, "S"); put(g, 9, W - 2, "E");
    fill(g, 10, 10, 16, "~");            // conveyor → shoves you RIGHT toward...
    put(g, 10, 18, "v");                 // ...an invisible pit
    put(g, 10, 23, "B");                 // bait block (looks like a friendly step)
    put(g, 10, 28, " ");                 // a small, innocent-looking gap (spikes below)
    put(g, 11, 28, "^");
    fill(g, 10, 36, 42, "<");            // conveyor → drags you BACK toward the start
    return {
      name: "THE FLOOR MOVES", bg: ["#0a0f10", "#04060a"], block: "#234a3e",
      grid: S(g),
      conveyors: [
        { c0: 10, c1: 16, r: 10, dir: 1, speed: 170, at: 8.0 },
        { c0: 36, c1: 42, r: 10, dir: -1, speed: 150, at: 34.0 },
      ],
      traps: [
        { do: "popspike", c: 6, r: 9, at: 5.0 },
        { do: "popspike", c: 12, r: 9, at: 11.0 },       // erupts WHILE the conveyor shoves you over it
        { do: "risefloor", c: 33, r: 9, at: 31.5 },      // a spike erupts from flat ground after the gap
        { do: "popspike", c: 40, r: 9, at: 39.0 },       // and again, mid-conveyor, as you're dragged back
        { do: "doorspike", c: W - 3, r: 9, at: W - 5 },
      ],
    };
  }

  // ---------- L3 — THE SCREEN MOVES ----------
  // The longest yet. Once you start walking, the CAMERA drags you forward and a kill-wall chases from the
  // left — you cannot stop, cannot backtrack, cannot study. Every jump must already be in your memory.
  function L3() {
    const W = 64, g = G(W, 12);
    fill(g, 10, 0, W - 1, "#"); fill(g, 11, 0, W - 1, "^");
    put(g, 9, 1, "S"); put(g, 9, W - 2, "E");
    // a string of invisible traps you must clear WHILE being pushed forward
    put(g, 10, 12, "v"); fill(g, 10, 20, 22, "c"); put(g, 10, 30, "v");
    fill(g, 10, 38, 39, " "); fill(g, 11, 38, 39, "^");   // forced jump over a real gap
    fill(g, 10, 48, 50, "c"); put(g, 10, 56, "v");
    return {
      name: "THE SCREEN MOVES", bg: ["#0c0a16", "#05040a"], block: "#2f2a55",
      grid: S(g),
      scroll: { at: 3.5, speed: 96 },                    // slower than you can run — keep ahead and you live
      traps: [
        { do: "popspike", c: 8, r: 9, at: 7.0 },
        { do: "drop", c: 16, r: 0, at: 14.0, floorR: 9 },
        { do: "popspike", c: 26, r: 9, at: 25.0 },
        { do: "drop", c: 34, r: 0, at: 32.0, floorR: 9 },
        { do: "drop", c: 44, r: 0, at: 42.0, floorR: 9 },
        { do: "popspike", c: 53, r: 9, at: 52.0 },
        { do: "doorspike", c: W - 3, r: 9, at: W - 5 },
      ],
    };
  }

  // ---------- L4 — THE PIT CLOSES ----------
  // You land at the bottom of a shaft and a lake of lava immediately starts climbing toward you — the pit,
  // closing in. The only way is UP: a staircase of ledges to a high exit. Two of the tempting stepping
  // stones are lies (one vanishes, one erupts). Climb clean and fast or be swallowed.
  function L4() {
    const W = 28, H = 16, g = G(W, H);
    fill(g, 15, 0, W - 1, "#");                 // base (becomes lava floor)
    for (let r = 0; r < H; r++) { put(g, r, 0, "#"); put(g, r, W - 1, "#"); } // shaft walls
    fill(g, 14, 1, 4, "#"); put(g, 13, 2, "S"); // start ledge
    fill(g, 12, 5, 8, "#");                     // P1
    fill(g, 10, 9, 12, "#");                    // P2
    fill(g, 8, 13, 16, "#");                    // P3
    fill(g, 6, 17, 21, "#"); put(g, 5, 19, "E");// exit ledge + door
    // the lies — drawn identical to real ledges, off the safe staircase line:
    fill(g, 12, 13, 14, "v");                   // a tempting higher stone that vanishes
    fill(g, 8, 9, 10, "B");                     // a tempting stone that erupts spikes
    return {
      name: "THE PIT CLOSES", bg: ["#140709", "#05040a"], block: "#4a1f1f",
      grid: S(g),
      rise: { at: 99, atTime: 0.8, speed: 27, max: 15 }, // lava climbs from the bottom
      jumpCols: [4, 8, 12, 16],                  // launch points of the safe staircase (for the verifier)
      traps: [],
    };
  }

  // ---------- L5 — TWO DOORS ----------
  // There are two doors. The obvious one — dead center, glowing, right on your path — is a lie; touch it and
  // die. The real one runs away the moment you reach for it, and cannons rake the floor while you chase it.
  function L5() {
    const W = 56, g = G(W, 12);
    fill(g, 10, 0, W - 1, "#"); fill(g, 11, 0, W - 1, "^");
    put(g, 9, 1, "S");
    put(g, 10, 14, "v"); put(g, 10, 22, "B");
    fill(g, 10, 30, 32, "c");
    put(g, 9, W - 2, "E");                       // the REAL door (far right) — and it bolts
    return {
      name: "TWO DOORS", bg: ["#0c0710", "#05040a"], block: "#45236a",
      grid: S(g),
      fakeDoors: [{ c: 10, r: 9 }, { c: 27, r: 9 }], // an early decoy AND the obvious central one — both lethal
      cannons: [
        { c: 44, r: 9, dir: -1, period: 2.2, speed: 280, phase: 0.0, life: 1.4 }, // one cannon guarding the door-chase
      ],
      traps: [
        { do: "popspike", c: 6, r: 9, at: 5.0 },
        { do: "drop", c: 18, r: 0, at: 16.0, floorR: 9 },
        { do: "flyspike", r: 9, at: 28.0, fromRight: true, speed: 500 }, // a spike screams across before the gallery
        { do: "runaway", to: { c: 36, r: 9 }, at: W - 5 }, // reach for the real door and it bolts back behind you
        { do: "doorspike", c: 35, r: 9, at: 36.5 },        // ...onto a fresh doorstep spike
      ],
    };
  }

  window.LEVELS = [L1(), L2(), L3(), L4(), L5()];
})();
