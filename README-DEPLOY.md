# Adam Civil Contracting — Website deployment

Static HTML/CSS/JS site. No database, no build step, no server code.

## What to upload
Upload the **contents of `public/`** to your web root (e.g. `public_html/`, `/var/www/adamcivil/`).
`index.html` must sit at the top level of the site.

```
public/
  index.html                 Home
  about/  services/  contact/  privacy/   (each has index.html)
  services/<6 service pages>/index.html
  404.html                   "Page not found"
  robots.txt
  .htaccess                  Apache/cPanel config (hidden file — make sure it uploads)
  assets/css, assets/js, assets/img, assets/video
```
`tools/` is NOT uploaded — it holds the photo/video helper scripts and the photo prompt list.

## Hosting options
**cPanel / Apache / LiteSpeed:** upload `public/` contents to `public_html/`. `.htaccess` handles the 404 page, HTTPS redirect, caching and compression.

**Nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name example.ae www.example.ae;
    root /var/www/adamcivil;
    index index.html;
    location / { try_files $uri $uri/ =404; }
    error_page 404 /404.html;
    location ~* \.(css|js|jpg|png|svg|mp4)$ { expires 30d; add_header Cache-Control "public"; }
    gzip on; gzip_types text/css application/javascript image/svg+xml;
}
server { listen 80; server_name example.ae www.example.ae; return 301 https://$host$request_uri; }
```

**Netlify / Cloudflare Pages / Vercel:** drag-and-drop or connect the `public/` folder. `404.html` is picked up automatically.

Enable HTTPS (Let's Encrypt or your host's free SSL). Required by the SRS.

## After the domain is confirmed (SRS SH-NFR-05)
1. Add to the `<head>` of each page: `<link rel="canonical" href="https://YOUR-DOMAIN/PATH/">`
2. Create `sitemap.xml` listing the 10 public pages (not 404.html) and add `Sitemap: https://YOUR-DOMAIN/sitemap.xml` to `robots.txt`.

## Check after upload
- Every menu, footer and button link opens the right page; reload each page directly.
- `https://YOUR-DOMAIN/anything-wrong` shows the 404 page.
- Hero video plays on desktop and phone; pause button works.
- Phone `tel:` and `mailto:` links open the right app.
- Run Lighthouse (mobile) on Home and one service page; target 90+.

## Before going public — company sign-off (SRS SH-AC-06)
- [ ] Email spelling `info@adamcivilcontractingt.ae` confirmed (brochure may contain a typo)
- [ ] Phone, company name and service list approved
- [ ] All page wording approved (mission, vision, service descriptions)
- [ ] Privacy Policy wording approved
- [ ] Images: AI-generated images carry a visible Gemini mark; replace with clean or real photos (same file names) — see `tools/PHOTO-LIST.md`
- [ ] Hero video licence kept on file and registered to Adam Civil Contracting
- [ ] Autoplay hero video approved (SRS SH-NFR-04 says avoid autoplay)

## Third-party requests
Google Fonts (fonts) and jsDelivr (Lenis smooth-scroll script). Both are disclosed in the Privacy Policy.
To self-host Lenis: `npm i lenis@1.3.18`, copy `node_modules/lenis/dist/lenis.min.js` to `assets/js/` and update the script tag in each page.
