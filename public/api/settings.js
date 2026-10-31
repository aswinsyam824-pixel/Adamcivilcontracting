/* Public, read-only website settings (contact details + logo) — /api/settings
   Cached at Vercel's edge for 60 s, so changes appear on the site within about a minute. */
const C = require("./_lib/core");
module.exports = async (req, res) => {
  try {
    const s = await C.getSettings();
    C.send(res, 200, { email: s.email, phone: s.phone, address: s.address, logo: s.logo },
      { "Cache-Control": "public, max-age=0, must-revalidate", "Vercel-CDN-Cache-Control": "max-age=60, stale-while-revalidate=600", "CDN-Cache-Control": "max-age=60" });
  } catch (e) {
    console.error(e);
    C.send(res, 200, {}, { "Cache-Control": "no-store" });   // never break the site: it keeps its built-in details
  }
};
