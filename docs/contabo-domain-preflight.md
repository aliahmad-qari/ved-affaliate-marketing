# VED domain preflight - 20 October 2026

Status: READ-ONLY investigation; no VPS changes, reloads, certificates or deployment performed. SSH is unavailable in this session (no configured SSH connection; local ssh command is a denied wrapper). Never send passwords, private keys, .env contents or full process environments in chat.

## Verified externally

- Google DNS: apex A 46.250.242.208; www CNAME to apex, resolving to the same address.
- IP port 8084 homepage and /api/health returned 200 with nginx/1.24.0 (Ubuntu) headers.
- Forced-address HTTP request for apex on port 80 returned nginx 404.
- Forced-address TLS request for apex on port 443 failed certificate hostname validation. This is not evidence that a valid VED certificate exists.
- Ports 80 and 443 accept connections. Their owning processes, existing site list, firewall, certificate inventory, document roots and service environments are not verified.
- Local repository uses FRONTEND_URL for allowed origins/backend-generated links, VITE_API_BASE_URL for build-time frontend API routing, NODE_ENV for production cookies/trust proxy. Production cookies are Secure and SameSite=None. Old hosting names occur in .env.example and optional RENDER_EXTERNAL_URL compatibility; this does not establish their presence in the live environment.
- Earlier public bundle inspection found neither old VED Render nor Vercel hostname; recheck the actual current release before applying configuration changes.

## Phase 1: manual read-only inspection

Run on the VPS through your existing authorized SSH session. Review full output privately. Nginx configs can contain credentials/custom headers; only share redacted findings.

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8084/
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8084/api/health
sudo ss -lntp '( sport = :80 or sport = :443 or sport = :8084 )'
systemctl is-active nginx caddy apache2 traefik
sudo nginx -t
# Review privately: owner/include paths, all server_name/listen/proxy_pass/root,
# duplicate VED names, 8084 upstream, body limits, caching, forwarded headers.
sudo nginx -T 2>&1 | less
sudo ufw status verbose
sudo nft list ruleset
command -v certbot
sudo certbot certificates
systemctl list-timers --all | grep -Ei 'certbot|acme'
```

Also inspect Contabo's external firewall, and DNS A/AAAA/CAA records for both names. Do not disable any firewall or add broad rules. If another proxy/container owns 80/443, use that proxy's existing deployment mechanism instead of installing a competing web server.

Identify the VED Node service behind 8084 and its environment source privately (systemd unit, PM2 process or container). Inspect only the nonsecret settings FRONTEND_URL, VITE_API_BASE_URL, PORT, NODE_ENV and any APP_URL/RENDER_EXTERNAL_URL usage. Do not dump the full environment. Inspect the deployed JS locally for obsolete API domains. Do not start the backend to inspect it: startup contains seed/update behavior.

Determine whether 8084 routes /api separately to Node and / to static assets. Check its existing Host/X-Forwarded-Host/X-Forwarded-Proto/X-Forwarded-For handling. Preserve the external HTTPS scheme all the way to Express; an inner `proxy_set_header X-Forwarded-Proto $scheme` would replace HTTPS with HTTP. Do not blindly change global trust proxy or shared includes. Any necessary edit to a VED-only inner location requires a separate reviewed diff and backup.

STOP HERE. Share redacted findings and get approval before the following changes.

## Proposed isolated Nginx setup (conditional on inspection)

Assumptions to verify: host Nginx owns ports 80/443, includes /etc/nginx/sites-enabled/* inside http {}, and loopback 8084 serves the VED application for the requested Host. No existing block already owns either VED hostname. No WebSocket dependency found in repository; optional support is included below. Match existing verified VED upload limits; 20m below is proposed, not a verified current value.

After approval, record a private backup before editing:

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/root/ved-domain-backup-$STAMP"
sudo install -d -m 700 "$BACKUP"
sudo cp -a /etc/nginx "$BACKUP/nginx"
# Also back up the precise VED environment/service files if an approved change is needed.
sudo install -d -m 755 /var/www/ved-acme/.well-known/acme-challenge
# Use only a NEW, verified-unused site path; do not overwrite an existing file.
sudo test ! -e /etc/nginx/sites-available/vedaffiliatepvtltd.com || exit 1
sudo test ! -e /etc/nginx/sites-enabled/vedaffiliatepvtltd.com || exit 1
sudoedit /etc/nginx/sites-available/vedaffiliatepvtltd.com
```

Initial HTTP-only file (certificate bootstrap):

```nginx
server {
    listen 80;
    server_name vedaffiliatepvtltd.com www.vedaffiliatepvtltd.com;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/ved-acme;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 503; }
}
```

Enable the new site only; test and gracefully reload, never stop Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/vedaffiliatepvtltd.com /etc/nginx/sites-enabled/vedaffiliatepvtltd.com
sudo nginx -t && sudo systemctl reload nginx
```

Confirm challenge reachability for BOTH names. Use existing Certbot tooling; installation method needs approval if absent. Do not run standalone mode (it can conflict with occupied port 80). Obtain a certificate using the webroot without rewriting other Nginx sites:

```bash
# Replace the email placeholder with the owner's approved operational address.
sudo certbot certonly --webroot -w /var/www/ved-acme \
  --cert-name vedaffiliatepvtltd.com \
  -d vedaffiliatepvtltd.com -d www.vedaffiliatepvtltd.com \
  --email OWNER_APPROVED_EMAIL --agree-tos
```

After successful issuance, back up the bootstrap file privately, then replace ONLY this new VED file with:

```nginx
map $http_upgrade $ved_connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 80;
    server_name vedaffiliatepvtltd.com www.vedaffiliatepvtltd.com;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/ved-acme;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 308 https://vedaffiliatepvtltd.com$request_uri; }
}
server {
    listen 443 ssl;
    server_name www.vedaffiliatepvtltd.com;
    ssl_certificate /etc/letsencrypt/live/vedaffiliatepvtltd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vedaffiliatepvtltd.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    return 308 https://vedaffiliatepvtltd.com$request_uri;
}
server {
    listen 443 ssl;
    server_name vedaffiliatepvtltd.com;
    ssl_certificate /etc/letsencrypt/live/vedaffiliatepvtltd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vedaffiliatepvtltd.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:8084;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $ved_connection_upgrade;
    }
}
```

This is an Internet-facing edge: overwrite forwarded client headers rather than trust a caller-supplied chain. If an additional trusted upstream CDN exists, review its real-IP configuration first. Include IPv6 listeners only if the existing listener layout and IPv6 routing require them. URI and query string pass through unchanged because proxy_pass has no replacement URI. No proxy caching or proxy_redirect rewrites are proposed.

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --cert-name vedaffiliatepvtltd.com --dry-run
```

Verify a renewal timer AND a successful deploy hook that runs nginx -t and reloads Nginx after renewal. If absent, add an approved domain-specific hook through the existing certificate automation; do not replace other projects' hooks. Do not use a broad renewal run as a substitute for inspecting existing automation.

## Application environment proposal - separate reviewed change

- Set FRONTEND_URL to https://vedaffiliatepvtltd.com, retaining any other intentionally supported origins during transition only after review. www redirects to canonical; include it only if an actual supported flow requires it.
- Same-origin VITE_API_BASE_URL should be empty, or the canonical HTTPS origin if required by existing deployment. Change/rebuild ONLY if the served build is stale; do not deploy the unrelated pending clipboard patch as part of this migration.
- Preserve PORT, MongoDB settings, JWT secret, cookies, payout rules, destinations and vendor attribution logic. Update other origin settings only if actually used. Do not invent PUBLIC_APP_URL or BACKEND_URL configuration.
- Restart only the identified VED backend process if its runtime environment changes, using its actual service manager. No guessed service names or global PM2 restarts.
- No m.Stock referral URL/parameter changes. Vendor-registered callback domain changes, if any, require vendor confirmation and separate approval.

## Acceptance and risks

Check HTTP apex/www and HTTPS www redirects preserve path/query; HTTPS apex certificate includes both names; homepage/assets, deep campaign pages and /api/health work without mixed content. Check console/network, Secure cookies, session persistence, CORS on the canonical origin, partner/admin login, campaign/share URLs. Registration/lead submission and full vendor handoff can write production records: perform only with explicitly authorized test accounts/cases, not fabricated leads. Validate m.Stock destination preservation offline/read-only before any authorized handoff. Verify unrelated hostnames before and after reload.

Risks: existing hostname conflicts; wrong upstream/container loopback; nested proxy losing HTTPS headers; too-large upload requests; wrong CORS/runtime/build origin; cookie sessions from the IP not transferring to the domain (users may need to log in); invalid AAAA/CAA/challenge routing; certificate renewal without reload; unintended bundled source release. Do not add global HSTS/preload or close 8084 during this initial migration.

## Rollback

If this new site alone caused a problem, unlink ONLY /etc/nginx/sites-enabled/vedaffiliatepvtltd.com after verifying it is the symlink created above, then nginx -t and gracefully reload. Preserve certificate/config files for investigation; do not delete shared certificate stores. If an existing VED-only inner proxy file was changed, restore only that file from its recorded backup, test, reload. Do not restore the entire shared Nginx directory over other projects' subsequent changes. Restore only approved VED environment/build changes and restart only its identified service. Keep original port 8084 available throughout. No database restore/reset is part of rollback.

References: https://nginx.org/en/docs/http/ngx_http_proxy_module.html ; https://nginx.org/en/docs/http/websocket.html ; https://nginx.org/en/docs/beginners_guide.html ; https://eff-certbot.readthedocs.io/en/stable/using.html
