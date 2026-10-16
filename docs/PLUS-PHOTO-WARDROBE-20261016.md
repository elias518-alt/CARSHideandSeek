# PLUS wardrobe and local photo customization

Open the existing **Dein Look** menu, choose **Alex** or **Maya**, then choose a top and trousers independently. Each figure has nine full-body combinations, seven independent top/trouser colors, and its own clothing cuts. The three existing Crew figures remain free.

PLUS users can select a gallery image or use **Foto aufnehmen**. The latter uses the device's native file/camera chooser (`capture=user`); desktop browsers may show a file picker. A real mobile camera session still needs device validation. JPG, PNG and WebP are supported; unsupported HEIC photos get an actionable error.

The original stays in browser memory. Zoom, horizontal/vertical position and rotation produce a feathered 192 × 256 PNG without the original EXIF metadata. Separate controls align this crop on the figure. This is a **photo overlay**, not AI face reconstruction, facial recognition or a generated 3D head. Hair, body, skin outside the crop and pose remain those of the selected illustration; resemblance depends on lighting and manual alignment. No demographic traits are inferred.

Only **Look speichern**, after the explicit public-sharing checkbox, uploads the crop. Cancel never uploads it. The existing public `profile-images` bucket and owner-folder RLS are reused; paths are `<user UUID>/character-face-<random UUID>.png`. Metadata stores only a strict path and bounded alignment values, never the original image or a data URL. Gallery and camera processing require no paid runtime provider. Existing hosting, storage and transfer quotas/costs still apply.

`GET /api/wardrobe-access` checks server-side membership before upload. `POST /api/wardrobe-save` checks it again and rejects another user's photo path. Lobby create/join/identity strips foreign photo paths and applies the existing PLUS restriction. Non-PLUS users can remove an already stored photo by saving a free figure. v3 full outfits migrate to matching top/trouser indexes; legacy realistic looks retain their independent choices.

A replacement is uploaded under a new name; the previous object is removed only after metadata saves. Explicit 4xx save rejections remove the new upload. For ambiguous network/server failures, the new object is retained rather than deleting a possibly committed photo. A failed old-photo deletion remains visible as an error and can be retried by saving again in the open editor. Closing after a failed deletion or a connection loss may leave an unreferenced object; operator storage cleanup may be required. Public/CDN caches and copies already downloaded cannot be recalled immediately.

The privacy text includes character crops and the legal document version changes to `2026-10-16.1`, so the existing acceptance flow presents the updated notice. No new paid service, secret or database migration is required when the existing profile-image bucket migration is installed.

Validation commands:

```
npm test
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright node scripts/character-studio-browser-qa.cjs
```

The browser suite uses mocked account, membership and storage responses. It exercises the real DOM and local canvas pipeline, independent garments, free/PLUS access, publishing consent, storage failure, rejected-save cleanup, deletion retry, cancellation and color-mask pixel checks. It does not claim a production Supabase upload or physical-device camera verification.

Validated locally: 200 Node tests and 123 Chromium checks (360, 390 and 1000 px), including pixel checks for all 18 garment combinations; no skin samples changed when recoloring clothes.
