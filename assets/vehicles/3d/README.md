# CHS Coupé 96 — first modular 3D tuning model

Original project geometry, authored with Blender via `scripts/build-coupe.py`. A generic 1990s coupé, with no manufacturer marks or third-party vehicle meshes. The `.blend` is editable source; the GLB is the runtime asset. Rebuild from repository root:

    blender -b --python scripts/build-coupe.py

Metres, source Z-up, front -X. Blender exports glTF Y-up. Stable replacement nodes: `rims_stock/silver/graphite/mesh` and `package_stock/clean/sport/track`. All four wheels share the same mounting positions across styles. `paint` is the recolorable material. Glass and tyres keep independent materials.

This first version activates only for the E36 coupé mapping in garage tuning. It is an original game model, not a licensed or exact E36 replica. The other vehicle views retain the existing photo/model presentation. Saved cosmetic keys and server-side unlock validation are reused. Package changes in this 3D view include bumpers and, for Track, a rear wing; legacy 2D views still display their existing sill details.

Runtime budget: GLB approximately 2.4 MB, tested Track + mesh view approximately 91k rendered triangles including shadows, 32 draw calls. Fixed coachwork is batched by shared materials. Transparent WebGL compositing and a shadow-only floor place the car directly over the garage image. Texture-free vehicle materials, 1024px shadow, DPR capped at 1.5, on-demand rendering with no idle animation. No compression decoder dependency is needed for this initial asset. Further detail/optimization and real-device performance testing are needed before extending the catalog.

Three.js r186 is self-hosted under `assets/vendor/three` with its MIT license. No runtime CDN is used for the viewer. Renderer and materials are disposed when replacing or closing the view. Load/WebGL failure retains the existing model illustration with an explanatory hint.

Browser QA:

    CHS_QA_PLAYWRIGHT=/path/to/playwright node scripts/coupe-3d-browser-qa.cjs

Covers mobile/desktop viewport rendering, keyboard camera input, exclusive replacement groups, saving, disposal and failed GLB download fallback. Screenshots go to `/tmp/chs-coupe-390.png` and `/tmp/chs-coupe-1000.png`. This is not a physical-device FPS benchmark.

## Reference-driven proportion revision

The revised silhouette uses the supplied red 1990s sport-coupe photograph as a visual reference: longer bonnet, lower beltline, larger coupe glazing, rounded wings and wraparound bumpers with recessed openings. Wheelbase is 2.70m; tyres are approximately 0.63m in diameter. The original meshes remain project-authored.

`rolling_gear` stays fixed at the ground plane. `coachwork` and the selected package lower by 20mm (Clean), 40mm (Sport), or 55mm (Track). The cosmetic save keys are unchanged. Exact root-name matching is essential: glTF may split each multi-material package into child meshes named `package_sport_1` etc.; those children must inherit root visibility rather than be independently hidden.

`node scripts/coupe-reference-render.cjs` (with CHS_QA_PLAYWRIGHT configured) produces a red Sport / five-spoke / no-glow comparison render at `/tmp/chs-coupe-reference.png`. Browser QA checks that each selected package has actually visible child geometry and that lowering the body does not move the tyre contact plane.
