/* Adam Civil Contracting — applies the contact details and logo saved in the admin panel (Settings) to every page,
   and counts visits and enquiry clicks (cookie-free) for the admin Dashboard.
   If nothing has been saved, or the API is unreachable, the page keeps the details already written in its HTML. */
(function () {
  "use strict";
  if (location.protocol === "file:") return;
  var root = document.documentElement.getAttribute("data-root") || "";
  var EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
  var PHONE_RE = /\+971[\d\s\-()]{7,16}\d/g;

  function eachText(fn) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { var p = n.parentNode && n.parentNode.nodeName; return (p === "SCRIPT" || p === "STYLE" || p === "NOSCRIPT") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(fn);
  }
  function setMailto(a, email) {
    var href = a.getAttribute("href"), q = href.indexOf("?");
    a.setAttribute("href", "mailto:" + email + (q > -1 ? href.slice(q) : ""));
  }
  function addressNode(text, cls) {
    var el = document.createElement(cls === "li" ? "li" : "span");
    el.setAttribute("data-site-address", ""); el.style.whiteSpace = "pre-line"; el.textContent = text;
    return el;
  }

  function apply(s) {
    if (!s || typeof s !== "object") return;
    if (s.email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) { setMailto(a, s.email); });
      eachText(function (n) { if (EMAIL_RE.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(EMAIL_RE, s.email); EMAIL_RE.lastIndex = 0; });
      var draft = document.getElementById("mailDraft");          // Contact page email draft keeps changing its link
      if (draft && window.MutationObserver) new MutationObserver(function () {
        var h = draft.getAttribute("href") || ""; if (h.indexOf("mailto:" + s.email) !== 0) setMailto(draft, s.email);
      }).observe(draft, { attributes: true, attributeFilter: ["href"] });
    }
    if (s.phone) {
      var tel = "tel:" + s.phone.replace(/[^\d+]/g, "");
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.setAttribute("href", tel); });
      eachText(function (n) { if (PHONE_RE.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(PHONE_RE, s.phone); PHONE_RE.lastIndex = 0; });
    }
    document.querySelectorAll("[data-site-address]").forEach(function (e) { (e.closest("[data-site-address-wrap]") || e).remove(); });
    if (s.address) {
      // footer: "Contact" column
      document.querySelectorAll(".fcard__cols h3").forEach(function (h) {
        if (/contact/i.test(h.textContent)) { var ul = h.parentNode.querySelector("ul"); if (ul) { var li = addressNode(s.address, "li"); li.style.color = "rgba(255,255,255,.65)"; li.style.fontSize = ".9rem"; li.style.padding = "6px 0"; ul.appendChild(li); } }
      });
      // Contact page: an "Office address" card next to Phone and Email
      var ch = document.querySelector(".channels");
      if (ch) {
        var card = document.createElement("div"); card.className = "channel"; card.setAttribute("data-site-address-wrap", "");
        card.innerHTML = '<span class="k">Office address</span><span><span class="v v--sm"></span></span>';
        card.querySelector(".v").appendChild(addressNode(s.address)); ch.appendChild(card);
        if (ch.children.length > 2) ch.style.gridTemplateColumns = "repeat(auto-fit,minmax(260px,1fr))";
      }
    }
    if (s.logo) {
      var src = /^https?:\/\//i.test(s.logo) ? s.logo : root + s.logo.replace(/^\//, "");
      document.querySelectorAll(".brand img, .fcard__logo, img[data-site-logo]").forEach(function (img) { img.src = src; img.removeAttribute("srcset"); });
    }
  }

  /* ---------- cookie-free visit + enquiry counting (shown in the admin Dashboard) ---------- */
  function send(data) {
    try {
      var body = JSON.stringify(data), url = root + "api/track";
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
      else fetch(url, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } });
    } catch (e) {}
  }
  if (navigator.doNotTrack !== "1" && !navigator.globalPrivacyControl) {
    var pj = /\/projects\/view\//.test(location.pathname) ? (new URLSearchParams(location.search).get("p") || "") : "";
    send({ t: "pv", p: location.pathname, r: document.referrer || "", pj: pj });
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a, button"); if (!a) return;
      var h = a.getAttribute("href") || "", ev = "";
      if (a.id === "mailDraft") ev = "email_draft";
      else if (/^tel:/i.test(h)) ev = "call";
      else if (/^mailto:/i.test(h)) ev = "email";
      else if (/wa\.me|whatsapp/i.test(h)) ev = "whatsapp";
      else if (/#enquiry$/.test(h)) ev = "quote";
      if (ev) send({ t: "ev", e: ev });
    }, true);
  }

  fetch(root + "api/settings", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (s) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { apply(s); }); else apply(s); })
    .catch(function () {});
})();
