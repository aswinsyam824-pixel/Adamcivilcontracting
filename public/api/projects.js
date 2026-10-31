/* Public, read-only list of published projects for the website — /api/projects
   Cached at Vercel's edge for 60 s, so admin changes appear on the site within about a minute. */
const C = require("./_lib/core");
module.exports = async (req, res) => {
  try {
    const list = C.publicView(await C.getProjects());
    C.send(res, 200, list, { "Cache-Control": "public, max-age=0, must-revalidate", "Vercel-CDN-Cache-Control": "max-age=60, stale-while-revalidate=600", "CDN-Cache-Control": "max-age=60", "Access-Control-Allow-Origin": "*" });
  } catch (e) {
    console.error(e);
    C.send(res, 500, { error: "Could not load projects" }, { "Cache-Control": "no-store" });
  }
};
