# Devil's Due

A rage-bait platformer. **It only looks easy.**

A sequel to [Devil's Lie](https://trpper11.github.io/devils-lie/). Vanilla JS + HTML5 Canvas, no dependencies, no build step.

**▶ Play: https://trpper11.github.io/devils-due/**

## The deal

Every level looks like a calm walk to a glowing door. None of them are. The traps are **invisible and untelegraphed** — there are no cracks, shimmers, or arrows warning you. You *cannot* dodge them the first time; that's the point. You die, you learn the spot, you go again. The whole gauntlet re-arms **identically** on every death, so it is beatable by **memory**, not luck or reflexes.

And the surprises never stop — they escalate, and the world itself turns on you.

## The five levels

1. **The Long Walk** — a flat, empty corridor mined with invisible spikes, vanishing floor, and a doorstep that bites.
2. **The Floor Moves** — conveyor strips slide you into pits, friendly stepping-stones erupt, a gap grows a spike mid-jump.
3. **The Screen Moves** — the camera drags you forward into a kill-wall. No stopping, no studying. Pure memory.
4. **The Pit Closes** — a lake of lava climbs from below while you race up a staircase, where two of the stones are lies.
5. **Two Doors** — the obvious central door is lethal; the real one bolts behind you, into the cannon fire.

## The trap vocabulary

Pop spikes · pitfalls · vanishing floor · crumbling ledges · bait blocks · ceiling drops · fly spikes · rise-mid-jump spikes · cannons · conveyors · runaway doors · fake doors · rising lava · closing walls. Hundreds of combinations, one promise: **no tells**.

## Controls

`← →` / `A D` move · `Space` / `↑` / `W` jump · `R` restart. Touch controls on mobile.

## Structure

- `engine.js` — the scrolling platformer engine + trap/system runtime
- `levels.js` — data-driven level definitions
- `play.html` — the game · `index.html` — the landing page
- `verify.cjs` — headless Playwright harness (proves every level is rage-bait *and* beatable)
