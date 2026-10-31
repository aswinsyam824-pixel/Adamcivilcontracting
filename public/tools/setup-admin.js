#!/usr/bin/env node
/* One-time setup for the admin panel. Run from your project root (the folder with index.html):
     node tools/setup-admin.js
   It will:
     1. add the site script (contact details, logo, visitor counting) to every page
     2. create api/_lib/seed.json from YOUR current projects (assets/js/projects-data.js), so the admin
        starts with the projects your website shows today
     3. check that every admin file is in place
   Safe to run again. It never changes the content of your pages, only adds one <script> line. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = process.cwd();
const ok = m => console.log("  ✓ " + m), warn = m => console.log("  ! " + m), bad = m => { console.log("  ✗ " + m); problems++; };
let problems = 0;

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.log("Run this from your website folder (the one that contains index.html)."); process.exit(1);
}

/* 1. script tag on every page */
console.log("\n1. Adding the site script to your pages");
const SKIP = new Set(["admin", "api", "node_modules", ".git", ".vercel", "tools"]);
let added = 0, had = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith(".")) walk(p); continue; }
    if (!e.name.endsWith(".html")) continue;
    let html = fs.readFileSync(p, "utf8");
    if (html.includes("site-settings.js")) { had++; continue; }
    if (!html.includes("</body>")) { warn("no </body>, skipped " + path.relative(ROOT, p)); continue; }
    const m = /<html[^>]*\sdata-root="([^"]*)"/i.exec(html);
    const depth = path.relative(ROOT, path.dirname(p)).split(path.sep).filter(Boolean).length;
    const prefix = m ? m[1] : "../".repeat(depth);
    fs.writeFileSync(p, html.replace("</body>", `<script src="${prefix}assets/js/site-settings.js" defer></script>\n</body>`));
    added++;
  }
})(ROOT);
ok(`${added} page(s) updated, ${had} already had it`);

/* 2. seed from the projects your site shows today */
console.log("\n2. Starting project list for the admin");
const seedPath = path.join(ROOT, "api/_lib/seed.json");
const dataPath = path.join(ROOT, "assets/js/projects-data.js");
if (fs.existsSync(seedPath) && !process.argv.includes("--force")) ok("api/_lib/seed.json already exists (use --force to rebuild it)");
else if (!fs.existsSync(dataPath)) { fs.mkdirSync(path.dirname(seedPath), { recursive: true }); fs.writeFileSync(seedPath, "[]"); warn("assets/js/projects-data.js not found: admin starts with no projects"); }
else {
  try {
    const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), sandbox, { timeout: 2000 });
    const list = Array.isArray(sandbox.window.PROJECTS) ? sandbox.window.PROJECTS : [];
    const now = new Date().toISOString();
    const seed = list.map((p, i) => ({
      slug: String(p.slug || "project-" + (i + 1)), title: String(p.title || "Untitled project"), type: p.type || "", category: p.category || "Other",
      location: p.location || "", year: String(p.year || ""), status: p.status === "Ongoing" ? "Ongoing" : "Completed", summary: p.summary || "",
      about: Array.isArray(p.about) ? p.about : (p.about ? [String(p.about)] : []), scope: Array.isArray(p.scope) ? p.scope : [],
      cover: p.cover || (p.images || [])[0] || "", images: Array.isArray(p.images) ? p.images : [], published: true, sample: !!p.sample,
      order: i, created: now, updated: now }));
    fs.mkdirSync(path.dirname(seedPath), { recursive: true }); fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
    ok(`api/_lib/seed.json created with your ${seed.length} current project(s)`);
  } catch (e) { bad("could not read assets/js/projects-data.js: " + e.message); }
}

/* 3. check files */
console.log("\n3. Checking admin files");
["admin/index.html", "admin/projects.html", "admin/edit.html", "admin/settings.html", "admin/login.html", "admin/assets/admin.css", "admin/assets/admin.js",
 "api/admin.js", "api/projects.js", "api/settings.js", "api/track.js", "api/_lib/core.js", "api/_lib/analytics.js", "api/_lib/seed.json",
 "assets/js/site-settings.js", "package.json", "vercel.json"].forEach(f => fs.existsSync(path.join(ROOT, f)) ? ok(f) : bad(f + " is missing: copy it from the admin kit"));
try { const pk = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")); (pk.dependencies || {})["@vercel/blob"] ? ok("package.json includes @vercel/blob") : bad('package.json needs "@vercel/blob" in dependencies'); } catch (e) {}

console.log(problems ? `\n${problems} problem(s) above. Fix them, then run this again.` : "\nAll set. Commit and push (or run: vercel --prod), then open /admin/ on your website.\n");
