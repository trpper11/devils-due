# Devil's Due

A rage-bait platformer. **It only looks easy.**

A sequel to [Devil's Lie](https://trpper11.github.io/devils-lie/). Vanilla JS + HTML5 Canvas, no dependencies, no build step.

**▶ Play: https://trpper11.github.io/devils-due/**

## The deal

Every level looks like a calm walk to a glowing door. None of them are. The traps are **invisible and untelegraphed** — there are no cracks, shimmers, or arrows warning you. You *cannot* dodge them the first time; that's the point. You die, you learn the spot, you go again. The whole gauntlet re-arms **identically** on every death, so it is beatable by **memory**, not luck or reflexes.

And the surprises never stop — they escalate, and the world itself turns on you.

## The five levels (all multi-story)

Every level stacks two or three floors connected by staircases, bridges, drops and tunnels — the ground floor is blocked by a pit, so the upper route isn't optional.

1. **The Long Walk** — a chasm blocks the ground; climb to the upper deck (past a fake exit) and drop to the real door.
2. **The Floor Moves** — conveyors on two storeys: shoved into a pit below, dragged backward off the deck above.
3. **The Screen Moves** — the camera drags you into a kill-wall; a trench splits the floor — bridge it and drop, no stopping.
4. **The Pit Closes** — a vertical shaft; lava climbs from below while you race up a staircase where two stones are lies.
5. **Two Doors** — the obvious ground-floor door is lethal; the real one is upstairs and bolts into the cannon fire.

## Controls & zoom

`← →` / `A D` move · `Space` / `↑` jump · `R` restart. The camera is **zoomable** — `+` / `−`, mouse scroll, or pinch — and the view is fully responsive to window size. Graphics are vector-drawn, so they stay crisp at any zoom.

## The trap vocabulary

Pop spikes · pitfalls · vanishing floor · crumbling ledges · bait blocks · ceiling drops · fly spikes · rise-mid-jump spikes · cannons · conveyors · runaway doors · fake doors · rising lava · closing walls. Hundreds of combinations, one promise: **no tells**.

Touch controls (move / jump buttons, pinch-to-zoom) appear on mobile.

## Structure

- `engine.js` — the scrolling platformer engine + trap/system runtime
- `levels.js` — data-driven level definitions
- `play.html` — the game · `index.html` — the landing page
- `verify.cjs` — headless Playwright harness (proves every level is rage-bait *and* beatable)
