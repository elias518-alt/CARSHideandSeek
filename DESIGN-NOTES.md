# Garage and interface refresh

The local WebP images are generated illustrations. The current vehicle renderer reuses twelve existing neutral vehicle silhouettes, not a complete manufacturer/model library or an exact paint colour. Uploaded vehicle photos take priority.

The small generation catalogue is deliberately limited to verified examples. Other vehicles support a manually entered generation and production year. Ranges cover European generations across body variants; individual engines, countries and derivatives can differ. “ab” indicates a known starting year, not a claim that production continues today.

Sources checked 2026-09-29:

- Ford Focus I–III: https://media.ford.com/content/fordmedia/feu/de/de/news/2014/09/11/_auto-der-vernunft---die-erfolgsgeschichte-des-ford-focus.html
- Ford Focus IV introduction: https://media.ford.com/content/fordmedia/feu/gb/en/news/2018/04/10/ford-unveils-all-new-focus--most-innovative--dynamic-and-excitin.html
- Golf VI: https://www.volkswagen-newsroom.com/en/golf-6-20082012-19484
- Golf VII and VIII: https://www.volkswagen-newsroom.com/en/the-new-golf-international-vehicle-presentation-5609/download
- BMW E36 production: https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-4-1.bmw-3-series-e36.html
- BMW E46 production (December 1997–November 2006; market introduction 1998): https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-5-1.bmw-3-series-e46.html

No database migration is required. Existing vehicle ownership policies cover insert/update/delete, and the active-vehicle foreign key uses ON DELETE SET NULL. Lobby friendship actions reuse the existing authenticated RPCs. Test fixtures and preview controls are local only and must not be deployed.

## Crew lobby and shorter garage selection (2026-09-30)

The waiting lobby uses a foreground character in front of each existing vehicle photo or body-shape illustration. The host has a larger center group; other players are arranged in two rear groups. On phones those groups move above the centered host. Character choices are stable per authenticated profile, with three default appearances. The existing night scene remains the background, with a lighter overlay. Active-round cards retain their compact layout.

The garage now has one make/model search, which also accepts a year (for example `BMW 3er 2015` or `Ford Focus 2015`). Selection fills the single year field and suggests a body shape. Known unambiguous generations are derived from the year; custom or ambiguous saved series are preserved. Manual series entry is optional and collapsed. Color swatches are selectable. Editing, activation, deletion, ownership filters and photo storage continue to use the existing code and database schema.

### New character asset

- Final project path: `assets/crew-characters.png`.
- Generated with the built-in ImageGen tool; no CLI/API fallback was used.
- Prompt brief: a transparent sprite atlas containing three full-body, stylized game-lobby streetwear characters in three equal horizontal cells; a man in a charcoal bomber jacket and white shirt, a woman in a white jacket and dark trousers, and a man in an orange jacket. Front-facing standing poses, consistent scale, clean separation and no cars or text.
- The original RGBA output is copied unchanged. CSS selects a cell with `background-size:300% 100%`.
- These are default decorative characters; profile photos remain visible below the player names.

### Validation and limits

All 31 Node tests pass: existing find/GPS rules, vehicle search/catalogue, real garage handlers against isolated form/account adapters, and waiting/active lobby rendering. JavaScript syntax and whitespace checks also pass. The adapters never contact live accounts or Storage.

Browser visual and mobile touch verification remain outstanding because the available browser blocks local preview pages. No production deploy, database migration, authentication change or game-server change is included. Preview fixtures are outside the repository and must not be deployed.

## Shared parking scene (2026-09-30)

The waiting room now uses `assets/lobby-meetup.webp`, an existing photographic parking scene, with a CSS violet colour grade. The existing transparent `assets/vehicle-lineup.webp` atlas supplies twelve vehicle templates, with measured ground baselines. The three existing crew characters are reused unchanged. No new images were generated for this change.

The host occupies a separate foreground layer. Up to nineteen peers use four rear slots per horizontal parking section; navigation buttons, horizontal scrolling and the complete player strip reach every participant without shrinking the cars. Nameplates open the existing profile/friendship dialog. Polls preserve scroll position and selected players. New lobby codes reset the selection. Active-round controls and server rules remain unchanged.

Vehicle templates distinguish city cars, small hatchbacks, compact hatchbacks, classic/modern saloons, sports cars, coupes, estates, SUVs, crossovers, vans and roadsters. They are approximations; the model search does not imply that every individual model has an exact illustration. Original and transparent uploaded photos remain preferred over templates. Character stance variety is limited by the three existing standing sprites.

Validation: 44 Node tests, including 1/5/10/20-player layout, preserved photos/profiles, escaped names and existing garage/GPS/round rules. In this sandbox the runner uses `node --test --test-isolation=none *.test.cjs` because spawning isolated child processes is blocked. Local browser fixtures live outside the repository, with no live accounts or database writes.

Browser validation covered 1/5/10/20 participants, 320/390-pixel mobile widths and a 1280-pixel desktop width. The final parking section, previous/next buttons, player selection, guest controls, profile/friendship dialog, vehicle photo precedence and transition to active-round cards/map were exercised. Real-device touch gestures and live multiplayer/account storage remain separate checks.
