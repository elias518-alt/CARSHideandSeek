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
