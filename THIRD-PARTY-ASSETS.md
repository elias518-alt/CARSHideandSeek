# Figuren und Schmuck

## Quaternius – vorhandene CC0-Modelle

Die neue Kollektion verwendet sechs vorhandene Modelle von Quaternius, keine neu generierten Bilder:

- [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html): `Casual_2`, `Casual_Hoodie`, `Punk`.
- [Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html): `Casual`, `Formal`, `Punk`.

Lizenz: CC0 1.0. Die mitgelieferten Texte stehen in `assets/characters/quaternius/LICENSE-men.txt` und `LICENSE-women.txt`. Öffentliche Quelldateien: [FreeModels](https://github.com/agentkaerf/FreeModels), geprüfter Stand `db3df04d1e4714298a09510b26fb6de6645138a2`.

Die WebP-Dateien sind transparente Renderings der bestehenden glTF-Geometrie mit deren eigener Idle-Pose. Haare, Oberteile, Hosen beziehungsweise Rock und Schuhe lassen sich innerhalb derselben Körpergruppe kombinieren. Zwei zusätzliche Hautschichten aus den vorhandenen Modellen schließen die Knöchellücke beim Austausch hoher Stiefel gegen niedrige Schuhe. Der Schmuck lässt sich separat abwählen; fest eingebaute Ohrringe wurden aus der Kopfebene entfernt. Die bisherigen drei Figuren bleiben als klassische Kollektion erhalten.

Reproduzieren: Quelldateien separat herunterladen, `npm ci` ausführen, anschließend:

```sh
node scripts/render-characters.mjs /pfad/zu/FreeModels /tmp/characters-svg
python scripts/rasterize-characters.py /tmp/characters-svg assets/characters/quaternius
```

Python benötigt CairoSVG und Pillow. Der Renderer verwendet Three.js unter MIT; dessen Lizenz steht in `scripts/THREE-LICENSE.txt`. Die Bibliothek wird nur zur Asset-Erstellung benötigt, nicht im Browser oder Spielserver.

## Lorc – vorhandenes Schmucksymbol

[Gem pendant](https://game-icons.net/1x1/lorc/gem-pendant.html), Lorc / Game-icons.net, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Datei: `assets/characters/gem-pendant.svg`. Änderungen: Größenanpassung und gold- beziehungsweise silberfarbige Darstellung als CSS-Maske. Der Urheberhinweis mit Lizenzlink erscheint auch im Kleiderschrank.

Diese Angaben betreffen die neue Kollektion. Bereits vorhandene Fahrzeug- und Hintergrunddateien wurden nicht neu lizenziert oder ersetzt.

## Neue Studio-Kleidung und Schulter-Papagei (Oktober 2026)

Für dieses Projekt generierte, lokal ausgelieferte transparente WebP-Grafiken: `assets/characters/studio/wardrobe-male.webp`, `wardrobe-female.webp` und `assets/pets/parrot-shoulder.webp`. Im Spiel erfolgt kein Aufruf eines Bildgenerierungsdienstes. Die Original-PNGs bleiben in der Entwicklungsumgebung erhalten:

- Mann: `/workspace/generated_images/exec-e41c6829-66ef-4c76-84bf-de93e94f52b2.png`
- Frau: `/workspace/generated_images/exec-5c4e1cda-1a5c-4585-8daf-b361693d19fb.png`
- Papagei ohne Ständer: `/workspace/generated_images/exec-1544f7c6-1724-4d9b-8ce0-6eee4fc52997.png`

Magenta/Cyan bzw. grüne Iris dienen als Materialkanäle. Die App färbt Kleidung/Fell und Augen unabhängig ein. Bestehende Figuren und Tierdateien bleiben erhalten. Die vorhandenen Fahrzeugatlanten sind dadurch nicht als logo-frei verifiziert; offene Grafikprüfungen stehen in `docs/vehicle-asset-audit.json`.

Zusätzlich: `assets/vehicles/bmw-e36-coupe.webp`, eigenständige generierte, visuell logo-frei geprüfte E36-inspirierte Zweitürer-Grafik. Original `/workspace/generated_images/exec-331508dd-1b62-4445-b9f2-ece9effac044.png` (1536 × 1024). Magenta-Karosseriematerial, neutrale Scheiben/Reifen/Felgen; eigene Radanker getrennt von der Limousine. Keine Aussage offizieller Herstellerfreigabe.

# Profilkarten-Motive (22.10.2026)

`assets/profile/wardrobe.webp` und `assets/profile/pets.webp` sind für dieses Projekt generierte Originalmotive. Die PNG-Originale liegen unter `/workspace/generated_images/exec-f9ca1aa3-f684-474d-8860-645372cf22fa.png` und `/workspace/generated_images/exec-5e2861e4-f6f2-4daf-9d11-838ab99cc8a5.png`; die WebP-Dateien wurden mit Qualität 86 konvertiert. Keine fremden Logos oder Textvorlagen verwendet.
