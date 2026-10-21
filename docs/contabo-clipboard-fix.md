# Clipboard fix - local delivery, 20 October 2026

Frontend-only patch. No database, environment, backend, vendor URL, authentication or financial changes. URL construction and WhatsApp actions remain unchanged.

Copy uses the secure-context Clipboard API first, then a temporary read-only textarea and execCommand('copy'). Failures are caught. The temporary field is removed and trigger focus restored. If both methods fail, the page renders the complete unchanged text in a selectable, read-only field, scrolls it into view and selects it. Only a resolved writeText or a true execCommand result triggers Copied. This is browser-reported success, not clipboard read-back (no clipboard read permission is requested).

## Validation

- npm run lint (TypeScript)
- npm run build
- node --import tsx --test tests/clipboard.test.tsx tests/vendorTracking.test.ts tests/leadCapture.test.ts tests/leadCaptureOrigin.test.ts tests/leadCaptureUi.test.tsx
- Seven tests passed: supported secure clipboard; permission denial; HTTP fallback without invoking modern clipboard; absent APIs; legacy false/exception; cleanup/focus; selectable full-text markup; multiple distinct campaign URLs and partner identifiers; existing tracking/capture/origin regressions.
- Clipboard tests use DOM doubles and server-rendered markup, not real mobile/desktop browsers. Actual device selection, clipboard contents and WhatsApp handoff remain browser acceptance checks.
- execCommand is deprecated and may be blocked. Manual copying remains the final fallback; HTTPS is still required for reliable modern Clipboard API support. No environment changes are part of this patch.

## Deployment after explicit approval only

The VPS application directory, SSH username and process manager were not supplied or verified. Do not guess them. First identify the existing service's application directory and frontend document root. The following commands apply when the current service serves APP_DIR/dist, as the repository's production server does. If Nginx uses a different root, confirm that root before replacing any files. Keep the existing running backend and environment unchanged.

1. Build locally with the same approved VITE build settings as the currently deployed frontend; do not silently replace existing build configuration. In PowerShell from the repository:

```powershell
npm run lint
npm run build
tar -czf ved-clipboard-dist.tgz dist
scp ./ved-clipboard-dist.tgz YOUR_EXISTING_SSH_USER@46.250.242.208:/tmp/ved-clipboard-dist.tgz
```

2. SSH using the existing authorized account. Set APP_DIR to the verified application directory, then execute in Bash. The explicit path checks must pass. Run with the deployment account that owns the app files; do not alter ownership globally.

```bash
APP_DIR='/REPLACE/WITH/VERIFIED/APPLICATION/DIRECTORY'
test "$APP_DIR" != '/REPLACE/WITH/VERIFIED/APPLICATION/DIRECTORY' || exit 1
test -d "$APP_DIR/dist" || exit 1
test -f "$APP_DIR/dist/index.html" || exit 1
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE="$APP_DIR/clipboard-stage-$STAMP"
BACKUP="$APP_DIR/dist-before-clipboard-$STAMP"
mkdir "$STAGE" || exit 1
tar -xzf /tmp/ved-clipboard-dist.tgz -C "$STAGE" || exit 1
test -f "$STAGE/dist/index.html" || exit 1
# Retain prior hashed assets for already-open browser sessions.
cp -an "$APP_DIR/dist/assets/." "$STAGE/dist/assets/" || exit 1
mv "$APP_DIR/dist" "$BACKUP" || exit 1
if ! mv "$STAGE/dist" "$APP_DIR/dist"; then
  mv "$BACKUP" "$APP_DIR/dist"
  exit 1
fi
printf 'Rollback backup: %s\n' "$BACKUP"
curl --fail --silent --output /dev/null http://127.0.0.1:8084/campaigns
```

This file swap has a brief interval between renames; use the existing atomic release mechanism instead if one is configured. No restart is normally needed for an existing Express/Nginx static root. Do not run npm start, database seed scripts, provisioning or migrations as part of this frontend-only release. Do not restart an unidentified service.

3. Hard-refresh the frontend. On Android and desktop check at least two campaign links (different slugs, same correct partner), profile referral link, referral-page link/code, success feedback and manual fallback. Compare copied text including ref/pid exactly; verify WhatsApp text unchanged. Verify existing login/dashboard/API behavior. Use an approved real tracking test only if production click/lead creation is authorized; copying links itself creates none.

## Rollback

Use the exact backup path printed above. In Bash with the same verified APP_DIR and deployment account:

```bash
BACKUP='/REPLACE/WITH/EXACT/PRINTED/BACKUP/PATH'
test -f "$BACKUP/index.html" || exit 1
FAILED="$APP_DIR/dist-clipboard-rollback-$(date +%Y%m%d-%H%M%S)"
mv "$APP_DIR/dist" "$FAILED" || exit 1
if ! mv "$BACKUP" "$APP_DIR/dist"; then
  mv "$FAILED" "$APP_DIR/dist"
  exit 1
fi
curl --fail --silent --output /dev/null http://127.0.0.1:8084/campaigns
```

Hard-refresh and recheck. No MongoDB restore/reset or backend/environment rollback is required. Keep backup assets until acceptance is complete. No production deployment has been performed.
