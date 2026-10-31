/* Admin API for the projects section — /api/admin?action=...  (Vercel Node.js function) */
const C = require("./_lib/core");

const cs = (v, m) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, m);
const slugify = s => (String(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "project").slice(0, 80);

function normalise(i, all, oldSlug) {
  const title = cs(i.title, 120);
  if (!title) throw Object.assign(new Error("Project name is required."), { status: 400 });
  let slug = slugify(i.slug || title); const taken = all.filter(p => p.slug !== oldSlug).map(p => p.slug); const base = slug; let n = 2;
  while (taken.includes(slug)) slug = `${base}-${n++}`;
  const about = String(i.about ?? "").replace(/\r/g, "").trim().slice(0, 8000).split(/\n\s*\n/).map(t => t.trim().slice(0, 2000)).filter(Boolean);
  const scope = (Array.isArray(i.scope) ? i.scope : []).map(t => cs(t, 80)).filter(Boolean).slice(0, 20);
  const images = [...new Set((Array.isArray(i.images) ? i.images : []).filter(C.validImage))].slice(0, 30);
  let cover = C.validImage(i.cover) ? i.cover : (images[0] || "");
  if (cover && !images.includes(cover)) images.unshift(cover);
  return { slug, title, type: cs(i.type, 80), category: cs(i.category, 40) || "Other", location: cs(i.location, 80), year: cs(i.year, 9),
    status: ["Completed", "Ongoing"].includes(i.status) ? i.status : "Completed", summary: cs(i.summary, 300), about, scope, cover, images,
    published: !!i.published, sample: !!i.sample };
}
const sniff = b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF ? "jpg" : b.slice(0, 8).toString("hex") === "89504e470d0a1a0a" ? "png"
  : b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" ? "webp" : null;

module.exports = async (req, res) => {
  const action = String((req.query && req.query.action) || new URL(req.url, "http://x").searchParams.get("action") || "");
  const fail = (msg, status = 400) => C.send(res, status, { ok: false, error: msg });
  const configured = !!(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);
  try {
    const s = C.readSession(req);
    const needAuth = () => {
      if (!s) { fail("Please sign in.", 401); return false; }
      if (req.method !== "GET" && !C.safeEqual(req.headers["x-csrf-token"] || "", C.csrfFor(s))) { fail("Session expired. Reload the page.", 403); return false; }
      return true;
    };
    const post = () => { if (req.method !== "POST") { fail("Method not allowed.", 405); return false; } return true; };
    res.setHeader("Cache-Control", "no-store");

    switch (action) {
      case "me":
        return C.send(res, 200, { ok: true, setup: false, configured, loggedIn: !!s, user: s ? s.u : null, csrf: s ? C.csrfFor(s) : null,
          storage: { redis: C.useRedis(), blob: C.BLOB } });

      case "login": {
        if (!post()) return;
        if (!configured) return fail("The admin account is not set up. Add ADMIN_USER and ADMIN_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.", 503);
        const ip = C.clientIp(req); const wait = await C.lockedFor(ip);
        if (wait) return fail(`Too many attempts. Try again in ${Math.ceil(wait / 60)} minutes.`, 429);
        const b = await C.readBody(req);
        const ok = C.safeEqual(b.user || "", process.env.ADMIN_USER) & C.safeEqual(b.password || "", process.env.ADMIN_PASSWORD);   // & on purpose: always check both
        if (!ok) { await C.failedLogin(ip); await new Promise(r => setTimeout(r, 400)); return fail("Username or password is not correct.", 401); }
        await C.clearFails(ip);
        const token = C.makeSession(process.env.ADMIN_USER), sess = C.readSession({ headers: { cookie: "acc_admin=" + token } });
        return C.send(res, 200, { ok: true, user: sess.u, csrf: C.csrfFor(sess) }, { "Set-Cookie": C.cookie(req, token, 8 * 3600) });
      }

      case "logout":
        if (!needAuth()) return;
        return C.send(res, 200, { ok: true }, { "Set-Cookie": C.cookie(req, "", 0) });

      case "projects":
        if (!needAuth()) return;
        return C.send(res, 200, { ok: true, projects: await C.getProjects() });

      case "save": {
        if (!post() || !needAuth()) return;
        const b = await C.readBody(req); const all = await C.getProjects();
        const old = b.originalSlug ? String(b.originalSlug) : null; const idx = old ? all.findIndex(p => p.slug === old) : -1;
        const p = normalise(b, all, idx < 0 ? null : old); p.updated = new Date().toISOString();
        let removed = [];
        if (idx < 0) { p.order = Math.min(0, ...all.map(x => x.order || 0)) - 1; p.created = p.updated; all.push(p); }   // new projects first
        else { removed = (all[idx].images || []).filter(x => !p.images.includes(x)); p.order = all[idx].order || 0; p.created = all[idx].created || p.updated; all[idx] = p; }
        await C.setProjects(all);
        if (removed.length) await C.deleteImages(removed);
        return C.send(res, 200, { ok: true, project: p });
      }

      case "delete": {
        if (!post() || !needAuth()) return;
        const slug = String((await C.readBody(req)).slug || ""); const all = await C.getProjects(); const i = all.findIndex(p => p.slug === slug);
        if (i < 0) return fail("Project not found.", 404);
        const [gone] = all.splice(i, 1); await C.setProjects(all);
        const stillUsed = new Set(all.flatMap(p => p.images || []));
        await C.deleteImages([...new Set([...(gone.images || []), gone.cover])].filter(x => x && !stillUsed.has(x)));
        return C.send(res, 200, { ok: true });
      }

      case "reorder": {
        if (!post() || !needAuth()) return;
        const order = ((await C.readBody(req)).slugs || []).map(String); const all = await C.getProjects();
        all.forEach(p => { const k = order.indexOf(p.slug); p.order = k < 0 ? 9999 : k; });
        await C.setProjects(all); return C.send(res, 200, { ok: true });
      }

      case "analytics": {
        if (!needAuth()) return;
        const A = require("./_lib/analytics");
        return C.send(res, 200, { ok: true, analytics: await A.report(Number((req.query && req.query.range) || 30)) });
      }

      case "settings":
        if (!needAuth()) return;
        return C.send(res, 200, { ok: true, settings: await C.getSettings() });

      case "saveSettings": {
        if (!post() || !needAuth()) return;
        const b = await C.readBody(req); const old = await C.getSettings();
        const email = cs(b.email, 120), phone = cs(b.phone, 30);
        const address = String(b.address ?? "").replace(/\r/g, "").split("\n").map(l => cs(l, 120)).filter(Boolean).slice(0, 4).join("\n");
        if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}$/.test(email)) return fail("Enter a valid email address.");
        if (phone && !/^\+?[0-9][0-9 ()\-]{5,24}$/.test(phone)) return fail("Enter a valid phone number, e.g. +971 4 355 7666.");
        const logo = b.logo ? String(b.logo) : "";
        if (logo && !C.validImage(logo)) return fail("Logo image is not valid.");
        const next = { email, phone, address, logo, updated: new Date().toISOString() };
        await C.setSettings(next);
        if (old.logo && old.logo !== logo) await C.deleteImages([old.logo]);
        return C.send(res, 200, { ok: true, settings: next });
      }

      case "upload": {   // body: { data: base64 } — the admin page resizes photos before sending (keeps under Vercel's 4.5 MB limit)
        if (!post() || !needAuth()) return;
        const b = await C.readBody(req); const buf = Buffer.from(String(b.data || ""), "base64");
        if (!buf.length) return fail("No image received.");
        if (buf.length > 4 * 1024 * 1024) return fail("Image is too large.");
        const ext = sniff(buf); if (!ext) return fail("Only JPG, PNG or WebP images are allowed.");
        const folder = b.kind === "logo" ? "site" : "projects";
        return C.send(res, 200, { ok: true, path: await C.saveImage(buf, ext, folder) });
      }

      default: return fail("Unknown action.", 404);
    }
  } catch (e) {
    console.error(e);
    return fail(e.status ? e.message : "Server error. Check the Vercel function logs.", e.status || 500);
  }
};
