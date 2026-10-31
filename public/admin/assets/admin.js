/* Adam Civil Contracting — Admin panel (talks to /api/admin on Vercel) */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const img = p => !p ? "" : /^https?:\/\//i.test(p) ? p : "../" + String(p).replace(/^\//, "");
  const page = document.body.dataset.page;
  const CATS = ["Fit-Out", "MEP", "AMC", "Civil", "Landscaping", "Other"];
  const COLORS = { "Fit-Out": "#D74F44", "MEP": "#3F7A5E", "AMC": "#C9A227", "Civil": "#4A5568", "Landscaping": "#7BA05B", "Other": "#9A9EA5" };
  const colorOf = c => COLORS[c] || "#9A9EA5";
  let CSRF = null;

  /* ---------- API ---------- */
  async function api(action, { method = "GET", body, form } = {}) {
    const opts = { method, credentials: "same-origin", headers: {} };
    if (CSRF) opts.headers["X-CSRF-Token"] = CSRF;
    if (form) opts.body = form;
    else if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    let res, data;
    try { res = await fetch("../api/admin?action=" + encodeURIComponent(action).replace(/%26/g, "&").replace(/%3D/g, "="), opts); }
    catch (e) { throw new Error("Cannot reach the server. Check your connection."); }
    try { data = await res.json(); } catch (e) { throw new Error("The server returned an unexpected response. Check that the /api functions are deployed."); }
    if (res.status === 401 && page !== "login") { location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); throw new Error("Please sign in."); }
    if (!data.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  /* ---------- UI helpers ---------- */
  function toast(msg, err) {
    let box = $(".toasts"); if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast" + (err ? " toast--err" : ""); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), err ? 6000 : 3000);
  }
  function confirmBox(title, text, okLabel = "Delete") {
    return new Promise(resolve => {
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = `<div class="modal__box" role="alertdialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">${esc(title)}</h2><p>${esc(text)}</p>
        <div class="modal__actions"><button class="btn" data-a="0">Cancel</button><button class="btn btn--red" data-a="1">${esc(okLabel)}</button></div></div>`;
      const prev = document.activeElement; document.body.appendChild(m); $("[data-a='0']", m).focus();
      const done = v => { m.remove(); if (prev) prev.focus(); resolve(v); };
      m.addEventListener("click", e => { if (e.target === m) done(false); const a = e.target.closest("[data-a]"); if (a) done(a.dataset.a === "1"); });
      m.addEventListener("keydown", e => { if (e.key === "Escape") done(false); });
    });
  }
  const meta = p => [p.type, p.location, p.year].filter(Boolean).join(" · ");
  const ICON_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';
  const ICON_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  function card(p, compact) {
    const badge = p.published ? '<span class="badge badge--live">Published</span>' : '<span class="badge badge--draft">Draft</span>';
    return `<article class="pc${compact ? " pc--compact" : ""}" data-slug="${esc(p.slug)}">
      <a class="pc__img" href="edit.html?p=${encodeURIComponent(p.slug)}" aria-label="Edit ${esc(p.title)}">
        ${p.cover ? `<img src="${esc(img(p.cover))}" alt="" loading="lazy">` : '<span class="noimg">No image yet</span>'}
        <span class="pc__badges"><span class="tag"><i style="width:7px;height:7px;border-radius:2px;background:${colorOf(p.category)}"></i>${esc(p.category)}</span>${badge}</span>
      </a>
      <div class="pc__body"><h3 class="pc__title">${esc(p.title)}</h3><p class="pc__meta">${esc(meta(p)) || "&nbsp;"}</p>
        ${p.sample ? '<p style="margin:8px 0 0"><span class="badge badge--sample">Sample — replace before launch</span></p>' : ""}</div>
      <div class="pc__foot">
        <span class="imgs">${ICON_IMG}${(p.images || []).length}</span>
        <label class="switch" title="Show on website"><input type="checkbox" data-act="publish" ${p.published ? "checked" : ""}><span class="track"></span><span class="sr-only">Published on website</span></label>
        <a class="btn btn--sm" href="edit.html?p=${encodeURIComponent(p.slug)}">Edit</a>
        <div class="menu"><button class="btn btn--sm btn--ghost" data-act="menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions for ${esc(p.title)}">${ICON_DOTS}</button>
          <div class="menu__list" hidden><button data-act="up">Move earlier</button><button data-act="down">Move later</button><button data-act="view">View on website</button><hr><button data-act="delete" class="danger">Delete project</button></div></div>
      </div></article>`;
  }

  /* ---------- shell: auth guard, sidebar, account ---------- */
  async function shell() {
    const me = await api("me");
    if (me.setup || !me.loggedIn) { location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); return null; }
    CSRF = me.csrf;
    $$(".js-user").forEach(e => e.textContent = me.user);
    $$(".js-avatar").forEach(e => e.textContent = (me.user || "A").slice(0, 2));
    $$("[data-logout]").forEach(b => b.addEventListener("click", async () => { try { await api("logout", { method: "POST", body: {} }); } catch (e) {} location.href = "login.html"; }));
    const side = $(".side"), mb = $("#menuToggle");
    if (mb) mb.addEventListener("click", () => { const o = side.classList.toggle("is-open"); mb.setAttribute("aria-expanded", o); });
    document.addEventListener("click", e => {
      if (side.classList.contains("is-open") && !side.contains(e.target) && !e.target.closest("#menuToggle")) { side.classList.remove("is-open"); mb && mb.setAttribute("aria-expanded", false); }
    });
    return me;
  }
  /* ---------- login / first-time setup ---------- */
  async function loginPage() {
    const next = new URLSearchParams(location.search).get("next") || "index.html";
    const safeNext = /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(next) ? next : "index.html";
    let me; try { me = await api("me"); } catch (e) { $("#err").textContent = e.message; return; }
    if (me.loggedIn) { location.href = safeNext; return; }
    if (!me.configured) $("#err").textContent = "The admin account is not set up yet. Add ADMIN_USER and ADMIN_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.";
    $("#lUser").focus();
    $("#loginForm").addEventListener("submit", async e => {
      e.preventDefault(); const b = $("#loginForm button[type=submit]"); b.disabled = true; $("#err").textContent = "";
      try { await api("login", { method: "POST", body: { user: $("#lUser").value.trim(), password: $("#lPass").value } }); location.href = safeNext; }
      catch (err) { $("#err").textContent = err.message; b.disabled = false; $("#lPass").select(); }
    });
  }

  /* ---------- website settings (contact details + logo) ---------- */
  let siteDefaults = null;
  async function liveDefaults() {          // what the public site currently shows, used until settings are saved once
    if (siteDefaults) return siteDefaults;
    siteDefaults = { email: "", phone: "", address: "", logo: "" };
    try {
      const html = await (await fetch("../", { cache: "no-store" })).text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const foot = doc.querySelector(".fcard") || doc.body;
      const txt = foot.textContent;
      siteDefaults.email = (txt.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/) || [""])[0];
      siteDefaults.phone = ((txt.match(/\+971[\d\s\-()]{7,16}\d/) || [""])[0]).replace(/\s+/g, " ").trim();
      const lg = doc.querySelector(".brand img, .fcard__logo"); if (lg) siteDefaults.logo = lg.getAttribute("src").replace(/^\.?\//, "");
    } catch (e) {}
    return siteDefaults;
  }
  async function loadSettings() {
    const { settings: S } = await api("settings"); const D = await liveDefaults();
    return { saved: S, view: { email: S.email || D.email, phone: S.phone || D.phone, address: S.address, logo: S.logo || D.logo }, defaults: D };
  }

  /* ---------- dashboard ---------- */
  const errBox = (el, e) => { el.innerHTML = `<div class="err-box"><b>Could not load this section.</b><br>${esc(e.message)}</div>`; };
  const fmt = n => Number(n || 0).toLocaleString();
  const delta = (cur, prev) => {
    if (!prev && !cur) return '<span class="delta flat">–</span>';
    if (!prev) return '<span class="delta up">new</span>';
    const p = Math.round((cur - prev) / prev * 100);
    return `<span class="delta ${p > 0 ? "up" : p < 0 ? "down" : "flat"}">${p > 0 ? "▲" : p < 0 ? "▼" : ""} ${Math.abs(p)}%</span>`;
  };
  const LABELS = { call: "Phone calls", email: "Email clicks", quote: "Request a Quote clicks", email_draft: "Contact page email drafts", whatsapp: "WhatsApp" };
  function hbars(el, rows, label = x => x) {
    const max = Math.max(1, ...rows.map(r => r[1]));
    el.innerHTML = rows.length && rows.some(r => r[1]) ? rows.map(([k, v]) => `<li><span class="t" title="${esc(label(k))}">${esc(label(k))}</span><b>${fmt(v)}</b><span class="b"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span></li>`).join("")
      : '<li><span class="none">No data yet for this period.</span></li>';
  }
  function chart(days) {
    const el = $("#chart"), tip = $("#tip"), W = 700, H = 210, pl = 30, pb = 22, pt = 8, n = days.length;
    const max = Math.max(4, ...days.map(d => d.pv)); const step = Math.pow(10, Math.floor(Math.log10(max))) / 2 || 1; const top = Math.ceil(max / step) * step;
    const x = i => pl + (W - pl - 4) * (n === 1 ? .5 : i / (n - 1)), y = v => pt + (H - pt - pb) * (1 - v / top), bw = Math.max(2, (W - pl) / n * .62);
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = top * k / 4, yy = y(v); g += `<line x1="${pl}" x2="${W}" y1="${yy}" y2="${yy}" stroke="#EFEEEC"/><text class="ax" x="${pl - 6}" y="${yy + 3}" text-anchor="end">${Math.round(v)}</text>`; }
    days.forEach((d, i) => { g += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${y(d.pv).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - pb - y(d.pv)).toFixed(1)}" rx="2" fill="#D9D6D1"/>`; });
    g += `<polyline fill="none" stroke="#3F7A5E" stroke-width="2.2" stroke-linejoin="round" points="${days.map((d, i) => `${x(i).toFixed(1)},${y(d.uv).toFixed(1)}`).join(" ")}"/>`;
    days.forEach((d, i) => { if (d.enq) g += `<circle cx="${x(i).toFixed(1)}" cy="${y(d.uv).toFixed(1)}" r="4" fill="#D74F44" stroke="#fff" stroke-width="1.5"/>`; });
    const every = Math.ceil(n / 7);
    days.forEach((d, i) => { if (i % every === 0 || i === n - 1) g += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${new Date(d.d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}</text>`; });
    days.forEach((d, i) => { g += `<rect class="hit" data-i="${i}" x="${(x(i) - (W - pl) / n / 2).toFixed(1)}" y="0" width="${((W - pl) / n).toFixed(1)}" height="${H}" fill="transparent"/>`; });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily page views, visitors and enquiry actions">${g}</svg>`;
    el.onmousemove = e => {
      const r = e.target.closest && e.target.closest(".hit"); if (!r) { tip.hidden = true; return; }
      const d = days[+r.dataset.i]; tip.hidden = false;
      tip.innerHTML = `<b>${new Date(d.d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</b>${fmt(d.uv)} visitors · ${fmt(d.pv)} page views · ${fmt(d.enq)} enquiry actions`;
      const box = el.closest(".card").getBoundingClientRect(); let left = e.clientX - box.left + 12; if (left + 260 > box.width) left -= 280;
      tip.style.left = left + "px"; tip.style.top = (e.clientY - box.top - 10) + "px";
    };
    el.onmouseleave = () => tip.hidden = true;
  }
  async function analytics(range) {
    $$("#range button").forEach(b => b.setAttribute("aria-pressed", b.dataset.r === String(range)));
    try {
      const { analytics: A } = await api("analytics&range=" + range);
      const t = A.totals, pv = A.previous, rate = t.uv ? (t.enquiries / t.uv * 100) : 0, prate = pv.uv ? (pv.enquiries / pv.uv * 100) : 0;
      $("#kpis").innerHTML = [
        ["Visitors", fmt(t.uv), delta(t.uv, pv.uv), "#3F7A5E", "unique people"],
        ["Page views", fmt(t.pv), delta(t.pv, pv.pv), "#C9C6C1", "pages opened"],
        ["Enquiry actions", fmt(t.enquiries), delta(t.enquiries, pv.enquiries), "#D74F44", "call, email & quote clicks"],
        ["Enquiry rate", rate.toFixed(1) + "%", delta(rate, prate), "#16181B", "of visitors"],
      ].map(s => `<div class="stat"><dt><i style="background:${s[3]}"></i>${s[0]}</dt><dd>${s[1]}${s[2]}</dd><small>${s[4]} · vs previous ${A.range} days</small></div>`).join("");
      chart(A.days);
      hbars($("#enq"), Object.entries(t.events).sort((a, b) => b[1] - a[1]), k => LABELS[k] || k);
      const pname = p => p === "/" ? "Home" : p.replace(/^\/|\/$/g, "").replace(/\//g, " › ").replace(/-/g, " ");
      hbars($("#pages"), A.pages, pname);
      hbars($("#pviews"), A.projects, s => (window.__projectTitles || {})[s] || s);
      hbars($("#refs"), A.refs, r => r === "(direct)" ? "Direct / bookmarks" : r);
      const dv = A.devices, tot = dv.mobile + dv.desktop + dv.tablet;
      $("#devs").innerHTML = tot ? ["desktop", "mobile", "tablet"].map(k => `<span>${k[0].toUpperCase() + k.slice(1)} <b>${Math.round(dv[k] / tot * 100)}%</b></span>`).join("") : "";
      if (!t.pv) $("#kpis").insertAdjacentHTML("beforeend", '<p class="muted-s" style="grid-column:1/-1;margin:0">No visits recorded yet. Counting starts once this update is live; numbers appear here as people visit the website.</p>');
    } catch (e) { errBox($("#kpis"), e); $("#chart").innerHTML = ""; }
  }
  async function dashboard(me) {
    $("#hello").textContent = `Welcome back, ${me.user}. Here is how the website is doing.`;
    if (!window.__rangeBound) { window.__rangeBound = 1; $$("#range button").forEach(b => b.addEventListener("click", () => analytics(+b.dataset.r))); }
    /* projects (independent of analytics) */
    const projectsPart = (async () => {
      try {
        const { projects: P } = await api("projects");
        window.__projectTitles = Object.fromEntries(P.map(p => [p.slug, p.title]));
        const pub = P.filter(p => p.published), drafts = P.length - pub.length;
        $("#navCount").textContent = P.length;
        $("#pstats").innerHTML = `<div><dt>Total</dt><dd>${P.length}</dd></div><div><dt>Published</dt><dd>${pub.length}</dd></div><div><dt>Drafts</dt><dd>${drafts}</dd></div>`;
        const recent = [...P].sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || ""))).slice(0, 4);
        $("#recent").innerHTML = recent.length ? recent.map(p => card(p, true)).join("")
          : `<div class="empty" style="grid-column:1/-1"><b>No projects yet</b>Add your first project to show it on the website.<br><br><a class="btn btn--dark" href="edit.html">+ Add project</a></div>`;
        const ratio = P.length ? pub.length / P.length : 0, L = 251.3;
        $("#gauge").innerHTML = `<svg viewBox="0 0 200 116" aria-hidden="true"><path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="#E4E2DE" stroke-width="14" stroke-linecap="round"/>
          <path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="#3F7A5E" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(L * ratio).toFixed(1)} ${L}"/></svg>
          <div class="gauge__v"><b>${pub.length}</b><small>of ${P.length} live</small></div>`;
        $("#gaugeLegend").innerHTML = `<div><b>${pub.length}</b><span><i style="background:#3F7A5E"></i>Published</span></div><div><b>${drafts}</b><span><i style="background:#C9C6C1"></i>Drafts</span></div>`;
        const cats = {}; P.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
        const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        $("#catBar").innerHTML = entries.map(([c, n]) => `<i style="width:${(n / P.length * 100).toFixed(1)}%;background:${colorOf(c)}" title="${esc(c)}"></i>`).join("");
        $("#catLegend").innerHTML = entries.length ? entries.map(([c, n]) => `<li><i style="background:${colorOf(c)}"></i>${esc(c)}<b>${n}</b><span class="p">${Math.round(n / P.length * 100)}%</span></li>`).join("") : "<li>No projects yet</li>";
        const completed = P.filter(p => p.status === "Completed").length, images = P.reduce((a, p) => a + (p.images || []).length, 0);
        $("#overview").innerHTML = [[completed, "Completed"], [P.length - completed, "Ongoing"], [P.length ? (images / P.length).toFixed(1) : 0, "Images / project"], [P.filter(p => p.sample).length, "Sample projects"]]
          .map(o => `<div><b>${o[0]}</b><span>${o[1]}</span></div>`).join("");
        const home = [...pub].sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 3);
        $("#homeList").innerHTML = home.length ? home.map((p, i) => `<li><img src="${esc(img(p.cover))}" alt=""><div><b>${esc(p.title)}</b><span>${esc(p.category)}</span></div><span class="n">#${i + 1}</span></li>`).join("") : "<li style='color:var(--muted)'>No published projects</li>";
        bindCardActions($("#recent"), P, () => dashboard(me));
      } catch (e) { errBox($("#recent"), e); errBox($("#pstats"), e); }
    })();
    /* website details (independent) */
    const sitePart = (async () => {
      try {
        const { view: V } = await loadSettings();
        $("#dLogo").innerHTML = V.logo ? `<img src="${esc(img(V.logo))}" alt="Current logo">` : "";
        const row = (k, v) => `<div><dt>${k}</dt><dd class="${v ? "" : "none"}">${v ? esc(v) : "Not set"}</dd></div>`;
        $("#dSite").innerHTML = row("Phone", V.phone) + row("Email", V.email) + row("Address", V.address);
      } catch (e) { $("#dSite").innerHTML = `<div><dt>Error</dt><dd class="none">${esc(e.message)}</dd></div>`; }
    })();
    await projectsPart;               // project titles are used to label "Most viewed projects"
    await Promise.all([analytics(30), sitePart]);
  }

  /* ---------- card actions (publish toggle, menu, reorder, delete) ---------- */
  function bindCardActions(root, P, refresh) {
    const bySlug = s => P.find(p => p.slug === s);
    const ordered = () => [...P].sort((a, b) => (a.order || 0) - (b.order || 0));
    root.onclick = async e => {
      const btn = e.target.closest("[data-act]"); if (!btn || btn.dataset.act === "publish") return;
      const cardEl = btn.closest(".pc"), p = bySlug(cardEl.dataset.slug), act = btn.dataset.act;
      if (act === "menu") {
        const list = btn.nextElementSibling, open = list.hidden;
        $$(".menu__list", root).forEach(l => { l.hidden = true; l.previousElementSibling.setAttribute("aria-expanded", false); });
        list.hidden = !open; btn.setAttribute("aria-expanded", open); if (open) $("button", list).focus(); return;
      }
      btn.closest(".menu__list") && (btn.closest(".menu__list").hidden = true);
      if (act === "view") { window.open("../projects/view/?p=" + encodeURIComponent(p.slug), "_blank", "noopener"); return; }
      if (act === "delete") {
        if (!(await confirmBox("Delete this project?", `“${p.title}” and its uploaded images will be removed from the website. This cannot be undone.`))) return;
        try { await api("delete", { method: "POST", body: { slug: p.slug } }); toast("Project deleted"); refresh(); } catch (err) { toast(err.message, true); }
        return;
      }
      if (act === "up" || act === "down") {
        const list = ordered(), i = list.indexOf(p), j = act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) { toast(act === "up" ? "Already first" : "Already last"); return; }
        [list[i], list[j]] = [list[j], list[i]];
        try { await api("reorder", { method: "POST", body: { slugs: list.map(x => x.slug) } }); toast("Order updated"); refresh(); } catch (err) { toast(err.message, true); }
      }
    };
    root.onchange = async e => {
      const sw = e.target.closest("[data-act='publish']"); if (!sw) return;
      const p = bySlug(sw.closest(".pc").dataset.slug); sw.disabled = true;
      try {
        await api("save", { method: "POST", body: { ...p, about: (p.about || []).join("\n\n"), published: sw.checked, originalSlug: p.slug } });
        toast(sw.checked ? "Published on the website" : "Hidden from the website"); refresh();
      } catch (err) { sw.checked = !sw.checked; sw.disabled = false; toast(err.message, true); }
    };
    if (!root.dataset.bound) {
      root.dataset.bound = "1";
      document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".menu__list", root).forEach(l => l.hidden = true); });
      document.addEventListener("click", e => { if (!e.target.closest(".menu")) $$(".menu__list", root).forEach(l => l.hidden = true); });
    }
  }

  /* ---------- projects list ---------- */
  async function projectsPage() {
    const st = { status: "all", cat: "All", q: "" };
    const load = async () => {
      const { projects: P } = await api("projects");
      $("#navCount").textContent = P.length;
      $("#count").textContent = `${P.length} project${P.length === 1 ? "" : "s"} · ${P.filter(p => p.published).length} published`;
      const cats = ["All", ...new Set(P.map(p => p.category))];
      if (!cats.includes(st.cat)) st.cat = "All";
      $("#catChips").innerHTML = cats.map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === st.cat}">${esc(c)} <span class="n">${c === "All" ? P.length : P.filter(p => p.category === c).length}</span></button>`).join("");
      $$("#statusChips .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.status === st.status));
      const q = st.q.toLowerCase();
      const list = P.filter(p => (st.status === "all" || (st.status === "live") === !!p.published) && (st.cat === "All" || p.category === st.cat)
        && (!q || [p.title, p.type, p.location, p.category].join(" ").toLowerCase().includes(q)));
      $("#grid").innerHTML = list.length ? list.map(p => card(p)).join("")
        : `<div class="empty" style="grid-column:1/-1"><b>${P.length ? "No projects match" : "No projects yet"}</b>${P.length ? "Try a different filter or search." : "Add your first project to show it on the website."}<br><br><a class="btn btn--dark" href="edit.html">+ Add project</a></div>`;
      bindCardActions($("#grid"), P, load);
    };
    $("#statusChips").addEventListener("click", e => { const b = e.target.closest("[data-status]"); if (b) { st.status = b.dataset.status; load(); } });
    $("#catChips").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) { st.cat = b.dataset.cat; load(); } });
    let t; $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); load(); }, 200); });
    await load();
  }

  /* ---------- add / edit ---------- */
  async function editPage() {
    const slug = new URLSearchParams(location.search).get("p");
    const { projects: P } = await api("projects");
    $("#navCount").textContent = P.length;
    const existing = slug ? P.find(p => p.slug === slug) : null;
    if (slug && !existing) { toast("Project not found", true); setTimeout(() => location.href = "projects.html", 1200); return; }
    const s = existing ? { ...existing, about: (existing.about || []).join("\n\n"), scope: [...(existing.scope || [])], images: [...(existing.images || [])] }
      : { title: "", type: "", category: "Fit-Out", location: "", year: String(new Date().getFullYear()), status: "Completed", summary: "", about: "", scope: [], images: [], cover: "", published: true, sample: false };
    $("#pageTitle").textContent = existing ? "Edit project" : "Add project";
    document.title = (existing ? "Edit project" : "Add project") + " | Admin";
    $("#deleteCard").hidden = !existing;
    const dl = $("#catList"); dl.innerHTML = [...new Set([...CATS, ...P.map(p => p.category)])].map(c => `<option value="${esc(c)}">`).join("");
    let dirty = false; const touch = () => { dirty = true; preview(); };
    window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

    /* simple fields */
    const bind = (id, key) => { const el = $("#" + id); el.value = s[key] || ""; el.addEventListener("input", () => { s[key] = el.value; touch(); }); };
    bind("fTitle", "title"); bind("fType", "type"); bind("fCat", "category"); bind("fLoc", "location"); bind("fYear", "year"); bind("fSummary", "summary"); bind("fAbout", "about");
    const cnt = () => $("#sumCount").textContent = `${(s.summary || "").length}/300`; cnt(); $("#fSummary").addEventListener("input", cnt);
    $$("#fStatus button").forEach(b => { b.setAttribute("aria-pressed", b.dataset.v === s.status); b.addEventListener("click", () => { s.status = b.dataset.v; $$("#fStatus button").forEach(x => x.setAttribute("aria-pressed", x === b)); touch(); }); });
    $("#fPub").checked = !!s.published; $("#fPub").addEventListener("change", e => { s.published = e.target.checked; touch(); });
    $("#fSample").checked = !!s.sample; $("#fSample").addEventListener("change", e => { s.sample = e.target.checked; touch(); });

    /* scope tags */
    const tags = $("#scopeTags"), tin = $("#scopeIn");
    const drawTags = () => { $$(".t", tags).forEach(t => t.remove()); s.scope.forEach((t, i) => { const el = document.createElement("span"); el.className = "t"; el.innerHTML = `${esc(t)}<button type="button" aria-label="Remove ${esc(t)}" data-i="${i}">✕</button>`; tags.insertBefore(el, tin); }); };
    const addTag = () => { const v = tin.value.replace(/,/g, "").trim(); if (v && !s.scope.includes(v) && s.scope.length < 20) { s.scope.push(v); drawTags(); touch(); } tin.value = ""; };
    tin.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } else if (e.key === "Backspace" && !tin.value && s.scope.length) { s.scope.pop(); drawTags(); touch(); } });
    tin.addEventListener("blur", addTag);
    tags.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) { s.scope.splice(+b.dataset.i, 1); drawTags(); touch(); tin.focus(); } else tin.focus(); });
    drawTags();

    /* images */
    const thumbs = $("#thumbs"), file = $("#file"), drop = $("#drop");
    let dragFrom = null;
    const drawThumbs = () => {
      if (!s.cover && s.images.length) s.cover = s.images[0];
      thumbs.innerHTML = s.images.map((p, i) => `<li class="thumb" draggable="true" data-i="${i}">
        <img src="${esc(img(p))}" alt="Project image ${i + 1}">${p === s.cover ? '<span class="cover">Cover</span>' : ""}
        <div class="bar2"><button type="button" data-a="left" aria-label="Move image ${i + 1} earlier">←</button><button type="button" data-a="right" aria-label="Move image ${i + 1} later">→</button>
        ${p === s.cover ? "" : `<button type="button" data-a="cover">Set cover</button>`}<button type="button" class="del" data-a="del" aria-label="Remove image ${i + 1}">✕</button></div></li>`).join("")
        + $$(".thumb.is-loading", thumbs).map(x => x.outerHTML).join("");
      $("#imgCount").textContent = `${s.images.length} image${s.images.length === 1 ? "" : "s"}`;
      preview();
    };
    thumbs.addEventListener("click", e => {
      const b = e.target.closest("button[data-a]"); if (!b) return;
      const i = +b.closest(".thumb").dataset.i, a = b.dataset.a;
      if (a === "del") { const [gone] = s.images.splice(i, 1); if (gone === s.cover) s.cover = s.images[0] || ""; }
      if (a === "cover") s.cover = s.images[i];
      if ((a === "left" && i > 0) || (a === "right" && i < s.images.length - 1)) { const j = a === "left" ? i - 1 : i + 1; [s.images[i], s.images[j]] = [s.images[j], s.images[i]]; }
      drawThumbs(); touch();
    });
    thumbs.addEventListener("dragstart", e => { const t = e.target.closest(".thumb"); if (!t) return; dragFrom = +t.dataset.i; t.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; });
    thumbs.addEventListener("dragover", e => { const t = e.target.closest(".thumb"); if (dragFrom === null || !t) return; e.preventDefault(); $$(".thumb", thumbs).forEach(x => x.classList.toggle("is-target", x === t)); });
    thumbs.addEventListener("drop", e => { const t = e.target.closest(".thumb"); if (dragFrom === null || !t) return; e.preventDefault(); const to = +t.dataset.i; const [m] = s.images.splice(dragFrom, 1); s.images.splice(to, 0, m); dragFrom = null; drawThumbs(); touch(); });
    thumbs.addEventListener("dragend", () => { dragFrom = null; $$(".thumb", thumbs).forEach(x => x.classList.remove("is-drag", "is-target")); });
    /* resize to max 1920 px and re-save as JPEG (also strips hidden metadata); returns base64 */
    const shrink = file => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1920 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => { if (!b) return reject(new Error("Could not process this image.")); const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.readAsDataURL(b); }, "image/jpeg", 0.82);
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This file is not a valid image.")); };
      im.src = url;
    });
    const upload = async files => {
      for (const f of files) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast(`${f.name}: only JPG, PNG or WebP`, true); continue; }
        if (f.size > 25 * 1024 * 1024) { toast(`${f.name} is larger than 25 MB`, true); continue; }
        const ph = document.createElement("li"); ph.className = "thumb is-loading"; ph.textContent = "Uploading…"; thumbs.appendChild(ph);
        try { const data = await shrink(f); const r = await api("upload", { method: "POST", body: { data } }); ph.remove(); s.images.push(r.path); drawThumbs(); touch(); }
        catch (err) { ph.remove(); toast(`${f.name}: ${err.message}`, true); }
      }
    };
    drop.addEventListener("click", () => file.click());
    drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
    file.addEventListener("change", () => { upload([...file.files]); file.value = ""; });
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("is-over"); } }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("is-over")));
    drop.addEventListener("drop", e => { if (e.dataTransfer.files.length) { e.preventDefault(); upload([...e.dataTransfer.files]); } });
    drawThumbs();

    /* live preview (same look as the public card) */
    function preview() {
      $("#pv").innerHTML = `${s.cover ? `<img src="${esc(img(s.cover))}" alt="">` : ""}<div class="pv__b"><span class="pv__tag">${esc(s.category || "Category")}</span>
        <div class="pv__t">${esc(s.title || "Project name")}</div><div class="pv__m">${esc(meta(s) || "Type · Location · Year")}</div></div>`;
    }
    preview();

    /* save / delete */
    const save = async () => {
      const t = $("#fTitle");
      if (!s.title.trim()) { t.setAttribute("aria-invalid", "true"); t.focus(); toast("Add a project name", true); return; }
      t.removeAttribute("aria-invalid");
      if ($$(".thumb.is-loading", thumbs).length) { toast("Wait for the images to finish uploading", true); return; }
      $$("[data-save]").forEach(b => b.disabled = true);
      try {
        const r = await api("save", { method: "POST", body: { ...s, originalSlug: existing ? existing.slug : "" } });
        dirty = false; toast(s.published ? "Saved and published" : "Saved as draft");
        if (!existing || r.project.slug !== existing.slug) setTimeout(() => location.replace("edit.html?p=" + encodeURIComponent(r.project.slug)), 600);
        else { Object.assign(existing, r.project); $$("[data-save]").forEach(b => b.disabled = false); }
      } catch (err) { toast(err.message, true); $$("[data-save]").forEach(b => b.disabled = false); }
    };
    $$("[data-save]").forEach(b => b.addEventListener("click", save));
    document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
    $("#deleteBtn").addEventListener("click", async () => {
      if (!(await confirmBox("Delete this project?", `“${existing.title}” and its uploaded images will be removed from the website. This cannot be undone.`))) return;
      try { await api("delete", { method: "POST", body: { slug: existing.slug } }); dirty = false; location.href = "projects.html"; } catch (err) { toast(err.message, true); }
    });
    if (existing) $("#viewLink").href = "../projects/view/?p=" + encodeURIComponent(existing.slug); else $("#viewLink").hidden = true;
  }

  /* ---------- settings page ---------- */
  async function settingsPage() {
    const { projects: P } = await api("projects"); $("#navCount").textContent = P.length;
    const { saved, view, defaults } = await loadSettings();
    const st = { ...view, logo: saved.logo };           // logo "" = keep the website's own logo
    let dirty = false;
    window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
    const shownLogo = () => st.logo || defaults.logo;
    const draw = () => {
      const l = shownLogo(), tag = l ? `<img src="${esc(img(l))}" alt="Logo preview">` : '<span style="color:var(--soft)">No logo</span>';
      $("#lgDark").innerHTML = tag; $("#lgLight").innerHTML = tag; $("#fpLogo").innerHTML = l ? `<img src="${esc(img(l))}" alt="">` : "";
      $("#lgNote").textContent = st.logo ? "Using an uploaded logo." : "Using the website's original logo.";
      $("#lgReset").hidden = !st.logo;
      $("#fpPhone").textContent = st.phone || "Phone not set"; $("#fpEmail").textContent = st.email || "Email not set"; $("#fpAddr").textContent = st.address || "";
    };
    [["sPhone", "phone"], ["sEmail", "email"], ["sAddress", "address"]].forEach(([id, k]) => {
      const el = $("#" + id); el.value = st[k] || ""; el.addEventListener("input", () => { st[k] = el.value; dirty = true; draw(); el.removeAttribute("aria-invalid"); });
    });
    $("#lastSaved").textContent = saved.updated ? "Last saved " + new Date(saved.updated).toLocaleString() : "Not saved yet: showing what the website currently uses.";
    draw();
    /* logo: keep transparency (PNG), max 1200 px */
    const shrinkPng = file => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => { if (!b) return reject(new Error("Could not process this image.")); const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.readAsDataURL(b); }, "image/png");
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This file is not a valid image.")); };
      im.src = url;
    });
    $("#lgUpload").addEventListener("click", () => $("#lgFile").click());
    $("#lgFile").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      if (!/^image\/(png|webp|jpeg)$/.test(f.type)) { toast("Use a PNG, WebP or JPG image", true); return; }
      $("#lgNote").textContent = "Uploading…";
      try { const r = await api("upload", { method: "POST", body: { data: await shrinkPng(f), kind: "logo" } }); st.logo = r.path; dirty = true; draw(); toast("Logo uploaded. Save to apply it."); }
      catch (err) { draw(); toast(err.message, true); }
    });
    $("#lgReset").addEventListener("click", () => { st.logo = ""; dirty = true; draw(); });
    const save = async () => {
      $$("[data-save]").forEach(b => b.disabled = true);
      try {
        const r = await api("saveSettings", { method: "POST", body: { email: st.email.trim(), phone: st.phone.trim(), address: st.address.trim(), logo: st.logo } });
        dirty = false; Object.assign(st, { email: r.settings.email, phone: r.settings.phone, address: r.settings.address });
        $("#lastSaved").textContent = "Last saved " + new Date(r.settings.updated).toLocaleString(); toast("Saved. The website updates within about a minute.");
      } catch (err) {
        toast(err.message, true);
        if (/email/i.test(err.message)) $("#sEmail").setAttribute("aria-invalid", "true");
        if (/phone/i.test(err.message)) $("#sPhone").setAttribute("aria-invalid", "true");
      }
      $$("[data-save]").forEach(b => b.disabled = false);
    };
    $$("[data-save]").forEach(b => b.addEventListener("click", save));
    document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
  }

  /* ---------- boot ---------- */
  (async () => {
    try {
      if (page === "login") return loginPage();
      const me = await shell(); if (!me) return;
      if (page === "dashboard") await dashboard(me);
      if (page === "projects") await projectsPage();
      if (page === "edit") await editPage();
      if (page === "settings") await settingsPage();
    } catch (e) { if (e.message !== "Please sign in.") toast(e.message, true); }
  })();
})();
