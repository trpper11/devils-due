/* =====================================================================
   Devil's Due — global leaderboard + geo + points
   Backend: the same open Firebase Realtime DB as Devil's Lie, under a
   SEPARATE /due_scores node so the two boards never mix. localStorage
   fallback means the game ALWAYS works even if the network is down.

   EVERYONE who enters a name goes on the board — not just finishers, and
   not just people who clear a level. A name is captured before the game
   starts, so a player who dies on level 1 still gets a row.

   Points:  level reached × 500
            + 5000 finish bonus (+ a speed bonus that decays with time)
            − 25 per death
   Ranking: points desc, then fewest deaths, then fastest time.
   Each browser has a stable id so a player keeps updating their own row.
   ===================================================================== */
window.LB = (function () {
  "use strict";
  const URL = "https://devils-lie-default-rtdb.firebaseio.com/due_scores.json";
  const REMOTE_ON = true;
  const LS_SCORES = "devilsdue.local.scores";
  const LS_GEO = "devilsdue.geo";
  const LS_NAME = "devilsdue.name";
  const LS_ID = "devilsdue.id";
  const TOTAL_LEVELS = (window.LEVELS && window.LEVELS.length) || 20;

  function lget(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  const getName = () => { try { return localStorage.getItem(LS_NAME) || ""; } catch (e) { return ""; } };
  const setName = (n) => { try { localStorage.setItem(LS_NAME, n); } catch (e) {} };
  function myId() {
    let id = null; try { id = localStorage.getItem(LS_ID); } catch (e) {}
    if (!id) {
      id = "d" + Math.abs(((getName() + navigator.userAgent).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))) + "_" + (lget("devilsdue.seq", 0));
      try { localStorage.setItem(LS_ID, id); } catch (e) {}
    }
    return id;
  }

  function flag(cc) {
    if (!cc || cc.length !== 2) return "🏴‍☠️";
    try { return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))); }
    catch (e) { return "🏴‍☠️"; }
  }

  // points: progression dominates, deaths is the tiebreaker, finishing is the prize.
  function points(s) {
    if (!s) return 0;
    let p = Math.max(1, s.level || 1) * 500;
    if (s.finished) p += 5000 + Math.max(0, 4000 - Math.round(s.time || 0) * 5);
    p -= (s.deaths || 0) * 25;
    return Math.max(0, Math.round(p));
  }

  async function geo() {
    const cached = lget(LS_GEO, null);
    if (cached && cached.cc) return cached;
    try {
      const r = await fetch("https://api.country.is/", { cache: "no-store" });
      const j = await r.json();
      const cc = (j.country || "").toUpperCase();
      let country = cc;
      try { country = new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch (e) {}
      const g = { country, cc };
      if (cc) lset(LS_GEO, g);
      return g;
    } catch (e) { return { country: "", cc: "" }; }
  }

  // ranking: points desc, then fewest deaths, then fastest time, then most recent
  function sortScores(arr) {
    return arr.slice().sort((a, b) => {
      const pa = points(a), pb = points(b);
      if (pa !== pb) return pb - pa;
      if ((a.deaths || 0) !== (b.deaths || 0)) return (a.deaths || 0) - (b.deaths || 0);
      const ta = a.finished ? (a.time || 0) : 1e9, tb = b.finished ? (b.time || 0) : 1e9;
      if (ta !== tb) return ta - tb;
      return (b.ts || 0) - (a.ts || 0);
    });
  }
  // collapse to one row per player id (latest wins)
  function dedupe(arr) {
    const byId = new Map();
    for (const e of arr) {
      if (!e || typeof e !== "object") continue;
      const key = e.id || (e.name + "|" + e.ts);
      const prev = byId.get(key);
      if (!prev || (e.ts || 0) >= (prev.ts || 0)) byId.set(key, e);
    }
    return [...byId.values()];
  }

  async function fetchRemote() {
    if (!REMOTE_ON) return null;
    try {
      const r = await fetch(URL, { cache: "no-store" });
      if (!r.ok) throw new Error("bad status");
      const j = await r.json();
      return Array.isArray(j) ? j : (j && Array.isArray(j.scores) ? j.scores : []);
    } catch (e) { return null; }
  }
  async function fetchScores() {
    const remote = await fetchRemote();
    const local = lget(LS_SCORES, []);
    const merged = dedupe((remote || []).concat(local)).map(s => ({ ...s, points: points(s) }));
    return sortScores(merged);
  }

  // ---- the current player's run ----
  let me = null, flushTimer = null, lastFlush = 0;
  function stamp() { if (me) me.points = points(me); }
  function saveLocal() {
    if (!me) return;
    stamp();
    const local = dedupe(lget(LS_SCORES, []).concat([me]));
    lset(LS_SCORES, sortScores(local).slice(0, 300));
  }
  async function flush() {
    if (!me) return false;
    lastFlush = Date.now();
    saveLocal();
    if (!REMOTE_ON) return false;
    try {
      const remote = await fetchRemote();
      if (remote === null) return false;            // offline — local copy already saved
      const merged = dedupe(remote.concat([me]));
      const top = sortScores(merged).slice(0, 300);
      const r = await fetch(URL, { method: "PUT", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(top) });
      return r.ok;
    } catch (e) { return false; }
  }
  function scheduleFlush(immediate) {
    saveLocal();
    if (immediate) { if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; } return flush(); }
    if (flushTimer) return;
    const wait = Math.max(0, 5000 - (Date.now() - lastFlush)); // throttle network writes to ~1/5s
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, wait);
  }

  function startRun(info) {
    me = {
      id: myId(), name: (info.name || "ANON").slice(0, 14), cc: info.cc || "", country: info.country || "",
      finished: false, level: 1, deaths: 0, time: 0, points: 0, ts: Date.now()
    };
    stamp();
    scheduleFlush(true);                             // appear on the board immediately
  }
  function progress(level, deaths) {
    if (!me) return;
    me.level = Math.max(me.level || 1, level | 0);
    me.deaths = Math.max(me.deaths || 0, deaths | 0);
    me.ts = Date.now();
    scheduleFlush(false);
  }
  function finish(info) {
    if (!me) me = { id: myId(), name: (info.name || "ANON").slice(0, 14), cc: info.cc || "", country: info.country || "" };
    me.finished = true;
    me.deaths = Math.max(me.deaths || 0, info.deaths | 0);
    me.time = +info.time || 0;
    me.level = info.totalLevels || TOTAL_LEVELS;
    me.ts = Date.now();
    return scheduleFlush(true);
  }

  return { geo, flag, points, fetchScores, sortScores, getName, setName, startRun, progress, finish, myId };
})();
