/* Receives page views and enquiry clicks from the website — /api/track (POST, sent with navigator.sendBeacon). */
const A = require("./_lib/analytics");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  try {
    let b = req.body;
    if (b === undefined || b === null) { const chunks = []; for await (const c of req) { chunks.push(c); if (chunks.length > 8) break; } b = Buffer.concat(chunks).toString(); }
    if (typeof b === "string") { try { b = JSON.parse(b.slice(0, 2000)); } catch (e) { b = {}; } }
    await A.record(req, b || {});
  } catch (e) { console.error("track", e.message); }
  res.statusCode = 204; res.end();
};
