/* =====================================================================
   Devil's Due — coin economy + shop (skins, improvements, IAP packs).
   Coins are EARNED by playing (every level you clear pays, finishing pays
   big) and SPENT on skins (cosmetic) and improvements (fair, optional
   assists). All state persists in localStorage. Real-money coin packs are
   wired through shop-config.js (payment link deferred to the owner).

   window.Shop is consumed by play.html (HUD + shop overlay) and applies the
   equipped skin/assists to the engine via Due.setSkin / Due.setAssist.
   ===================================================================== */
window.Shop = (function () {
  "use strict";
  const K = { coins: "dd.coins", owned: "dd.owned", equip: "dd.equip", cleared: "dd.cleared" };

  // ---- catalogs ----
  const SKINS = [
    { id: "imp",     name: "Lil' Imp",     price: 0,   blurb: "The classic. Born to die (a lot).",
      skin: { body: ["#ff8aa0", "#ff3b54", "#c01030"], feet: "#f2c14e", glow: "255,90,60" } },
    { id: "ghost",   name: "Pale Wretch",  price: 150, blurb: "A washed-out spectre with a cold halo.",
      skin: { body: ["#f4f6ff", "#cfd6f0", "#9aa6d8"], feet: "#e6e9f7", glow: "200,210,255", aura: "#cfe0ff" } },
    { id: "shadow",  name: "Shade",        price: 200, blurb: "All black, red eyes. Edgelord supreme.",
      skin: { body: ["#5a5f70", "#2b2f3e", "#0c0e16"], feet: "#3a3f50", glow: "60,70,120", eye: "#ff5d6c", pupil: "#2a0008" } },
    { id: "toxic",   name: "Slime",        price: 250, blurb: "Radioactive ooze with a sickly aura.",
      skin: { body: ["#d6ff9a", "#7ed957", "#2f8f2f"], feet: "#9be36b", glow: "150,255,120", aura: "#aaff77" } },
    { id: "cyber",   name: "Glitch",       price: 320, blurb: "Neon circuitry. Beep boop, you're dead.",
      skin: { body: ["#aef7ff", "#39d4e6", "#1175a8"], feet: "#28c0d8", glow: "80,220,255", aura: "#7ddfff", eye: "#00f0ff" } },
    { id: "royal",   name: "Lil' Prince",  price: 380, blurb: "Purple-blooded, horned, insufferable.",
      skin: { body: ["#e6c8ff", "#a45dff", "#5a1fb0"], feet: "#c08bff", glow: "170,90,255", aura: "#c8a0ff", horns: true } },
    { id: "gold",    name: "Gilded Imp",   price: 450, blurb: "Solid gold and twice as smug.",
      skin: { body: ["#fff0b0", "#ffcf5c", "#c98a12"], feet: "#a86b08", glow: "255,200,90", horns: true } },
    { id: "inferno", name: "Inferno",      price: 600, blurb: "Molten, horned, ringed in fire. Deluxe.",
      skin: { body: ["#ffd6a0", "#ff7a18", "#a82800"], feet: "#ffb04d", glow: "255,120,40", aura: "#ff9a3c", horns: true } },
    { id: "void",    name: "Void Walker",  price: 900, blurb: "A hole in reality wearing a face. Legendary.",
      skin: { body: ["#c0a0ff", "#5a3fa0", "#140a2a"], feet: "#7a5fd0", glow: "120,80,210", aura: "#9a7aff", horns: true } },
  ];
  // improvements — optional, FAIR aids (they never break "memorize to beat"; off until you equip them)
  const ASSISTS = [
    { id: "sense",     name: "Sixth Sense",  price: 220, blurb: "A faint ☠ marks every spot a trap got you this level." },
    { id: "forgiving", name: "Sure Foot",    price: 300, blurb: "Kinder jump timing — more coyote-time & input buffer." },
    { id: "doubler",   name: "Greed",        price: 500, blurb: "Permanent: earn DOUBLE coins from every level, forever." },
  ];
  const PACKS = (window.SHOP_CONFIG && window.SHOP_CONFIG.packs) || [];
  const PACK_NOTE = (window.SHOP_CONFIG && window.SHOP_CONFIG.note) || "";

  // ---- persistence ----
  function lget(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  let coins = lget(K.coins, 0);
  let owned = lget(K.owned, { skins: ["imp"], assists: [] });
  let equip = lget(K.equip, { skin: "imp", assists: [] });
  let cleared = lget(K.cleared, []);   // level indices already paid a first-clear bonus
  if (!owned.skins) owned.skins = ["imp"]; if (!owned.assists) owned.assists = [];
  if (owned.skins.indexOf("imp") < 0) owned.skins.unshift("imp");
  if (!equip.assists) equip.assists = [];
  function save() { lset(K.coins, coins); lset(K.owned, owned); lset(K.equip, equip); lset(K.cleared, cleared); }

  const skinById = id => SKINS.find(s => s.id === id) || SKINS[0];
  const assistById = id => ASSISTS.find(a => a.id === id);
  const ownsSkin = id => owned.skins.indexOf(id) >= 0;
  const ownsAssist = id => owned.assists.indexOf(id) >= 0;
  const assistOn = id => equip.assists.indexOf(id) >= 0;
  const hasDoubler = () => ownsAssist("doubler");   // owning Greed = it's active

  // ---- apply equipped loadout to the engine ----
  function apply() {
    if (!window.Due) return;
    Due.setSkin(skinById(equip.skin).skin);
    const a = { coyote: 1, jumpBuf: 1, sense: false };
    if (assistOn("sense")) a.sense = true;
    if (assistOn("forgiving")) { a.coyote = 1.6; a.jumpBuf = 1.5; }
    Due.setAssist(a);
  }

  // ---- earning ----
  // award is called when a level is CLEARED. levelCleared = the 1-based level number just beaten.
  function award(levelCleared, finished) {
    let earned = 0;
    const firstTime = cleared.indexOf(levelCleared) < 0;
    if (firstTime) { earned += 30; cleared.push(levelCleared); }   // first clear of a level
    else earned += 5;                                              // replay value
    if (finished) earned += 300;                                   // beat the whole game
    if (hasDoubler()) earned *= 2;
    coins += earned; save();
    return earned;
  }

  // ---- spending ----
  function buySkin(id) {
    const s = skinById(id); if (ownsSkin(id)) return { ok: false, reason: "owned" };
    if (coins < s.price) return { ok: false, reason: "poor" };
    coins -= s.price; owned.skins.push(id); equip.skin = id; save(); apply();
    return { ok: true };
  }
  function equipSkin(id) { if (!ownsSkin(id)) return { ok: false, reason: "locked" }; equip.skin = id; save(); apply(); return { ok: true }; }
  function buyAssist(id) {
    const a = assistById(id); if (!a) return { ok: false, reason: "missing" };
    if (ownsAssist(id)) return { ok: false, reason: "owned" };
    if (coins < a.price) return { ok: false, reason: "poor" };
    coins -= a.price; owned.assists.push(id);
    if (id !== "doubler") equip.assists.push(id);   // auto-equip toggleable assists; Greed is always-on
    save(); apply(); return { ok: true };
  }
  function toggleAssist(id) {
    if (!ownsAssist(id) || id === "doubler") return { ok: false };
    const i = equip.assists.indexOf(id);
    if (i >= 0) equip.assists.splice(i, 1); else equip.assists.push(id);
    save(); apply(); return { ok: true, on: assistOn(id) };
  }
  // coin packs (IAP) — open the configured payment link, or report it's not set up yet
  function buyPack(id) {
    const p = PACKS.find(x => x.id === id); if (!p) return { ok: false };
    if (p.buyUrl) { try { window.open(p.buyUrl, "_blank", "noopener"); } catch (e) {} return { ok: true, opened: true }; }
    return { ok: false, reason: "unconfigured" };
  }

  return {
    catalog: { skins: SKINS, assists: ASSISTS, packs: PACKS, packNote: PACK_NOTE },
    coins: () => coins, apply, award,
    ownsSkin, ownsAssist, assistOn, hasDoubler, equippedSkin: () => equip.skin,
    buySkin, equipSkin, buyAssist, toggleAssist, buyPack,
  };
})();
