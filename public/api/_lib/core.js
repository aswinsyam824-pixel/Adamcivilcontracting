/* Shared helpers for the Vercel functions: storage, sessions, validation.
   Production: Upstash Redis (project data, login lockout) + Vercel Blob (photos).
   Local/dev without those env vars: falls back to files in ./.localdata and ./uploads. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
/* Blob key: the standard name, or any variable holding a Vercel Blob read-write token (custom prefixes) */
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN ||
  Object.values(process.env).find(v => typeof v === "string" && /^vercel_blob_rw_/.test(v)) || "";
const BLOB = !!BLOB_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), ".localdata");
const KEY_PROJECTS = "acc:projects";
const LOCK_AFTER = 5, LOCK_SECONDS = 15 * 60;
const SECRET = process.env.SESSION_SECRET || (global.__accDevSecret ||= crypto.randomBytes(32).toString("hex"));

/* ---------- Redis (REST, no extra package) ---------- */
async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: "POST", headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Database error: " + (j.error || r.status));
  return j.result;
}
const useRedis = () => !!(REDIS_URL && REDIS_TOKEN);
function localRead(name, def) { try { return JSON.parse(fs.readFileSync(path.join(LOCAL_DIR, name), "utf8")); } catch (e) { return def; } }
function localWrite(name, v) { fs.mkdirSync(LOCAL_DIR, { recursive: true }); fs.writeFileSync(path.join(LOCAL_DIR, name), JSON.stringify(v, null, 2)); }

/* ---------- projects ---------- */
const sortP = list => list.sort((a, b) => (a.order || 0) - (b.order || 0));
async function getProjects() {
  let list = null;
  if (useRedis()) { const raw = await redis(["GET", KEY_PROJECTS]); list = raw ? JSON.parse(raw) : null; }
  else list = localRead("projects.json", null);
  if (!Array.isArray(list)) list = JSON.parse(JSON.stringify(require("./seed.json")));   // first run: start from the seed
  return sortP(list);
}
async function setProjects(list) {
  if (useRedis()) await redis(["SET", KEY_PROJECTS, JSON.stringify(list)]);
  else localWrite("projects.json", list);
}
function publicView(list) {
  return sortP(list.filter(p => p.published)).map(p => {
    const o = { slug: p.slug, title: p.title, type: p.type, category: p.category, location: p.location, year: p.year, status: p.status,
      summary: p.summary, about: p.about, scope: p.scope, cover: p.cover, images: p.images };
    if (p.sample) o.sample = true;
    return o;
  });
}

/* ---------- website settings (contact details + logo) ---------- */
const KEY_SETTINGS = "acc:settings";
const SETTINGS_FIELDS = ["email", "phone", "address", "logo"];
async function getSettings() {
  let s = null;
  if (useRedis()) { const raw = await redis(["GET", KEY_SETTINGS]); s = raw ? JSON.parse(raw) : null; }
  else s = localRead("settings.json", null);
  const out = {}; SETTINGS_FIELDS.forEach(k => out[k] = (s && typeof s[k] === "string") ? s[k] : "");
  out.updated = s && s.updated || null;
  return out;
}
async function setSettings(s) {
  if (useRedis()) await redis(["SET", KEY_SETTINGS, JSON.stringify(s)]);
  else localWrite("settings.json", s);
}

/* ---------- login lockout ---------- */
async function lockedFor(ip) {
  if (useRedis()) { const ttl = await redis(["TTL", "acc:lock:" + ip]); return ttl > 0 ? ttl : 0; }
  const m = localRead("locks.json", {}); const r = m[ip]; return r && r.until > Date.now() ? Math.ceil((r.until - Date.now()) / 1000) : 0;
}
async function failedLogin(ip) {
  if (useRedis()) {
    const n = await redis(["INCR", "acc:fail:" + ip]);
    if (n === 1) await redis(["EXPIRE", "acc:fail:" + ip, LOCK_SECONDS]);
    if (n >= LOCK_AFTER) { await redis(["SET", "acc:lock:" + ip, "1", "EX", LOCK_SECONDS]); await redis(["DEL", "acc:fail:" + ip]); }
    return;
  }
  const m = localRead("locks.json", {}); const r = m[ip] || { n: 0, until: 0 }; r.n++;
  if (r.n >= LOCK_AFTER) { r.n = 0; r.until = Date.now() + LOCK_SECONDS * 1000; } m[ip] = r; localWrite("locks.json", m);
}
async function clearFails(ip) {
  if (useRedis()) { await redis(["DEL", "acc:fail:" + ip]); return; }
  const m = localRead("locks.json", {}); delete m[ip]; localWrite("locks.json", m);
}

/* ---------- photos ---------- */
async function saveImage(buf, ext, folder = "projects") {
  const name = `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  if (BLOB) {
    let put;
    try { ({ put } = require("@vercel/blob")); }
    catch (e) { throw Object.assign(new Error("Photo storage library is missing. Make sure package.json (with @vercel/blob) is in the same folder as the api folder, then redeploy."), { status: 500 }); }
    try {
      const r = await put(`${folder}/${name}`, buf, { token: BLOB_TOKEN, access: "public", addRandomSuffix: true, contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" });
      return r.url;
    } catch (e) {
      console.error("blob put", e);
      const msg = /private/i.test(e.message) ? "Your Blob store is set to Private. Create a Blob store with Public access and connect it to this project, then redeploy."
        : "Photo storage error: " + e.message;
      throw Object.assign(new Error(msg), { status: 502 });
    }
  }
  if (process.env.VERCEL) {   // Vercel's disk is read-only: photos must go to Blob
    throw Object.assign(new Error("Photo storage is not connected. In Vercel open Storage → Blob → connect your Blob store to this project (Production), then redeploy."), { status: 503 });
  }
  const dir = path.join(process.cwd(), "uploads", folder); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf); return `uploads/${folder}/` + name;
}
const isBlobUrl = p => /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(projects|site)\/[\w.\-]+$/i.test(p);
async function deleteImages(paths) {
  const blobs = paths.filter(isBlobUrl), local = paths.filter(p => /^uploads\/(projects|site)\/[\w.\-]+$/.test(p));
  if (blobs.length && BLOB) { try { const { del } = require("@vercel/blob"); await del(blobs, { token: BLOB_TOKEN }); } catch (e) { console.error("blob delete", e); } }
  local.forEach(p => { try { fs.unlinkSync(path.join(process.cwd(), p)); } catch (e) {} });
}
const validImage = p => typeof p === "string" && p.length < 400 && !p.includes("..") &&
  (isBlobUrl(p) || /^(uploads\/(projects|site)|assets\/img)\/[\w\/.\-]+\.(jpe?g|png|webp|svg)$/i.test(p));

/* ---------- sessions: signed cookie, no server storage ---------- */
const b64 = s => Buffer.from(s).toString("base64url");
const sign = s => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
function makeSession(user) {
  const payload = b64(JSON.stringify({ u: user, exp: Date.now() + 8 * 3600e3, n: crypto.randomBytes(12).toString("hex") }));
  return payload + "." + sign(payload);
}
function readSession(req) {
  const m = /(?:^|;\s*)acc_admin=([^;]+)/.exec(req.headers.cookie || ""); if (!m) return null;
  const [payload, sig] = m[1].split("."); if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const s = JSON.parse(Buffer.from(payload, "base64url").toString()); return s.exp > Date.now() ? s : null; } catch (e) { return null; }
}
const csrfFor = s => crypto.createHmac("sha256", SECRET).update("csrf:" + s.n).digest("hex");
function cookie(req, value, maxAge) {
  const secure = (req.headers["x-forwarded-proto"] || "").includes("https") || process.env.VERCEL ? "; Secure" : "";
  return `acc_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest(), hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ---------- request helpers ---------- */
async function readBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 6 * 1024 * 1024) throw Object.assign(new Error("Request too large."), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch (e) { return {}; }
}
function send(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}
const clientIp = req => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim().slice(0, 64);

module.exports = { getSettings, setSettings, getProjects, setProjects, publicView, lockedFor, failedLogin, clearFails, saveImage, deleteImages, validImage,
  makeSession, readSession, csrfFor, cookie, safeEqual, readBody, send, clientIp, useRedis, BLOB };
