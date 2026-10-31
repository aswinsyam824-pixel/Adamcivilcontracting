/* First-party, cookie-free website analytics stored in the same Upstash Redis.
   No raw IP addresses are stored: visitors are counted with a daily-rotating anonymous hash.
   Keys expire automatically after 400 days. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const SECRET = process.env.SESSION_SECRET || (global.__accDevSecret ||= crypto.randomBytes(32).toString("hex"));
const TTL = 400 * 24 * 3600;
const EVENTS = ["call", "email", "whatsapp", "quote", "email_draft"];
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i;

const day = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const daysBack = (n, offset = 0) => Array.from({ length: n }, (_, i) => day(new Date(Date.now() - (offset + n - 1 - i) * 864e5)));

/* ---------- Redis pipeline (one HTTP request for many commands) ---------- */
async function run(cmds) {
  if (!cmds.length) return [];
  if (REDIS_URL && REDIS_TOKEN) {
    const r = await fetch(REDIS_URL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(j)) throw new Error("Analytics database error: " + r.status);
    return j.map(x => x.result);
  }
  return local(cmds);
}
/* local fallback (development/testing): a tiny interpreter for the commands used here */
function local(cmds) {
  const f = path.join(process.cwd(), ".localdata", "analytics.json");
  let db = {}; try { db = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
  const out = cmds.map(([c, k, ...a]) => {
    switch (c) {
      case "HINCRBY": db[k] = db[k] || {}; db[k][a[0]] = (db[k][a[0]] || 0) + Number(a[1]); return db[k][a[0]];
      case "HGETALL": return db[k] ? Object.entries(db[k]).flat().map(String) : [];
      case "PFADD": db[k] = db[k] || []; if (db[k].includes(a[0])) return 0; db[k].push(a[0]); return 1;
      case "PFCOUNT": return new Set([k, ...a].flatMap(x => db[x] || [])).size;
      case "ZINCRBY": db[k] = db[k] || {}; db[k][a[1]] = (db[k][a[1]] || 0) + Number(a[0]); return String(db[k][a[1]]);
      case "ZRANGE": return db[k] ? Object.entries(db[k]).sort((x, y) => y[1] - x[1]).flat().map(String) : [];
      case "EXPIRE": return 1;
      default: throw new Error("unsupported " + c);
    }
  });
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(db));
  return out;
}

/* ---------- record a page view or an enquiry action ---------- */
async function record(req, b) {
  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOT.test(ua)) return;
  if ((req.headers["dnt"] || "") === "1" || (req.headers["sec-gpc"] || "") === "1") return;   // respect Do Not Track / Global Privacy Control
  const d = day(), K = s => `a:${s}:${d}`;
  const cmds = [];
  if (b.t === "pv") {
    const p = String(b.p || "/").split("?")[0].replace(/index\.html$/, "").slice(0, 120);
    if (!p.startsWith("/") || p.startsWith("/admin")) return;
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
    const salt = crypto.createHmac("sha256", SECRET).update("visitor:" + d).digest();
    const vid = crypto.createHmac("sha256", salt).update(ip + "|" + ua).digest("hex").slice(0, 20);
    const dev = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
    cmds.push(["HINCRBY", K("d"), "pv", 1], ["HINCRBY", K("d"), "dev:" + dev, 1], ["PFADD", K("uv"), vid], ["ZINCRBY", K("pg"), 1, p]);
    const slug = /^[a-z0-9-]{1,80}$/.test(String(b.pj || "")) ? b.pj : "";
    if (slug) cmds.push(["ZINCRBY", K("pj"), 1, slug]);
    let ref = ""; try { ref = b.r ? new URL(String(b.r)).hostname.replace(/^www\./, "").slice(0, 60) : ""; } catch (e) {}
    const host = String(req.headers.host || "").replace(/^www\./, "");
    cmds.push(["ZINCRBY", K("ref"), 1, ref && ref !== host ? ref : "(direct)"]);
    ["d", "uv", "pg", "pj", "ref"].forEach(s => cmds.push(["EXPIRE", K(s), TTL]));
  } else if (b.t === "ev" && EVENTS.includes(b.e)) {
    cmds.push(["HINCRBY", K("d"), "ev:" + b.e, 1], ["EXPIRE", K("d"), TTL]);
  } else return;
  await run(cmds);
}

/* ---------- report for the admin dashboard ---------- */
const pairs = arr => { const o = []; for (let i = 0; i < (arr || []).length; i += 2) o.push([arr[i], Number(arr[i + 1])]); return o; };
const hash = arr => Object.fromEntries(pairs(arr));
async function report(n) {
  n = [7, 30, 90].includes(n) ? n : 30;
  const cur = daysBack(n), prev = daysBack(n, n);
  const cmds = [];
  cur.forEach(d => cmds.push(["HGETALL", `a:d:${d}`], ["PFCOUNT", `a:uv:${d}`], ["ZRANGE", `a:pg:${d}`, 0, 49, "REV", "WITHSCORES"],
    ["ZRANGE", `a:pj:${d}`, 0, 49, "REV", "WITHSCORES"], ["ZRANGE", `a:ref:${d}`, 0, 29, "REV", "WITHSCORES"]));
  cmds.push(["PFCOUNT", ...cur.map(d => `a:uv:${d}`)]);
  prev.forEach(d => cmds.push(["HGETALL", `a:d:${d}`]));
  cmds.push(["PFCOUNT", ...prev.map(d => `a:uv:${d}`)]);
  const r = await run(cmds);
  const add = (map, list) => list.forEach(([k, v]) => { map[k] = (map[k] || 0) + v; });
  const days = [], pages = {}, projects = {}, refs = {}, events = Object.fromEntries(EVENTS.map(e => [e, 0])), devices = { mobile: 0, desktop: 0, tablet: 0 };
  let pv = 0;
  cur.forEach((d, i) => {
    const h = hash(r[i * 5]); const uv = Number(r[i * 5 + 1] || 0);
    const dpv = h.pv || 0; pv += dpv;
    let enq = 0; EVENTS.forEach(e => { const v = h["ev:" + e] || 0; events[e] += v; enq += v; });
    Object.keys(devices).forEach(k => devices[k] += h["dev:" + k] || 0);
    add(pages, pairs(r[i * 5 + 2])); add(projects, pairs(r[i * 5 + 3])); add(refs, pairs(r[i * 5 + 4]));
    days.push({ d, pv: dpv, uv, enq });
  });
  const uv = Number(r[n * 5] || 0);
  let ppv = 0, penq = 0;
  prev.forEach((d, i) => { const h = hash(r[n * 5 + 1 + i]); ppv += h.pv || 0; EVENTS.forEach(e => penq += h["ev:" + e] || 0); });
  const puv = Number(r[n * 5 + 1 + n] || 0);
  const top = (m, k = 8) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, k);
  const enquiries = Object.values(events).reduce((a, b) => a + b, 0);
  return { range: n, days, totals: { pv, uv, enquiries, events }, previous: { pv: ppv, uv: puv, enquiries: penq },
    pages: top(pages), projects: top(projects, 6), refs: top(refs, 6), devices };
}
module.exports = { record, report, EVENTS };
