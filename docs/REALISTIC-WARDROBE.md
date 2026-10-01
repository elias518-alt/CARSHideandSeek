# Realistischer Kleiderschrank – vereinbarter Umfang

Stand: 01.10.2026. Originaldateien für die technische Prüfung liegen vor. Der Nutzer bestätigt für beide Modelle die Personal-Stufe der Fab-Standardlizenz. Die ausgewählten Figuren werden privat verarbeitet; Originaldateien gehören nicht ins öffentliche Repository. Dieser Text dokumentiert die Auswahl und Prüfungen; er aktiviert keine unfertigen Optionen.

## Ausgewählte Basisfiguren

- Camilia von NoEdge: https://www.fab.com/listings/5e145586-3955-4688-8666-dc4b242e78e9
- Free Male Body realistic muscular male von NoEdge: https://www.fab.com/listings/ba23c693-6123-4db0-b160-5cfbdb2c0dec

Der Nutzer hat beide gewählt. Keine Ersatzfiguren ohne Rücksprache erzeugen. Fab zeigt im hier verfügbaren Browser eine Sicherheitsprüfung. Produktbeschreibungen ersetzen nicht die Originaldateien oder den Nachweis der tatsächlich erworbenen Lizenz.

## Ausstattung

| Bereich | Mann | Frau |
| --- | --- | --- |
| Haare | Drei verschiedene Frisuren, mehrere Haarfarben | Drei verschiedene Frisuren, mehrere Haarfarben |
| Oberteile | T-Shirt, Hoodie, Halfzip-Pullover mit darunter sichtbarem T-Shirt; jeweils verschiedene Farben | T-Shirt, Hoodie, bauchfreies Oberteil; jeweils verschiedene Farben |
| Hosen | Kurze Hose, Jeans, lockere Regular-Fit-Jogginghose mit offenem Beinabschluss | Kurze Hose, Jeans, lockere Regular-Fit-Jogginghose mit offenem Beinabschluss |
| Schmuck | Königskette | Normale Kette, Ohrringe |
| Zubehör | Sonnenbrille | Sonnenbrille |

Haar- und Kleidungsfarben getrennt auswählbar. Schmuck und Sonnenbrille unabhängig und optional. Hautfarbe als separate Materialvariante prüfen. Vorhandene Schuhauswahl bleibt erhalten; passende Schuhe für die neuen Körper sind anhand der Quelldateien zu prüfen. Keine Markenlogos hinzufügen.

Die drei konkreten Frisuren und Farbpaletten wurden noch nicht benannt. Vorhandene kompatible Assets bevorzugen. Zuerst Dateiinhalte sichten und auf vorhandene Haare, riggbare Körper und Texturen prüfen; keine nicht vorhandenen Optionen behaupten.

## Benötigte Eingaben

Die heruntergeladenen Archive beider Modelle mit FBX oder Blender-Dateien, Texturen und Lizenztext/Erwerbsnachweis. GLB kann ergänzend helfen; konvertierte Dateien garantieren keine vollständig übernommenen Gesichtsmorphs und Materialien. Keine Kontopasswörter oder Schlüssel anfordern.

## Umsetzung ohne Verlust bestehender Funktionen

1. Lizenzen, Geometrie, Rig, Materialien und Auflösung der Originaldateien prüfen.
2. Kompatible Kleidungs-/Haarassets beschaffen; an Körper und Pose anpassen. Ein Bild erzeugt keine 3D-Geometrie.
3. Den bestehenden leichten WebP-Layer-Ansatz als mögliche Ausgabe beibehalten. Aus einem einheitlichen Kamerawinkel mit gleicher Beleuchtung rendern; verdeckte Körperflächen, Schmuckpositionen und Haarübergänge prüfen.
4. Nur falls Rasterbilder nötig sind: eine gemeinsame Bildgenerierung für ein Sammelbild/Atlas, wie ausdrücklich gewünscht. Keine KI-Ersatzgesichter für die ausgewählten Figuren erzeugen. Generierte Teile sind erst nach Prüfung auf Größe, Transparenz und Ausrichtung einsatzfähig.
5. Appearance-Version erweitern, gespeicherte Version-1-Profile weiterhin lesen; bisherige Figuren erhalten. Neue Sammlung erst anzeigen, wenn sämtliche Assets vorhanden sind.
6. Vorschau, Speicherung, Lobbydarstellung und Synchronisierung mit einem zweiten Konto prüfen. Keine Änderung an Spielregeln, Anmeldung, Moderation oder Kontoschutz.

## Aktueller App-Stand

PR #22 ist zusammengeführt. Render-Deployment dep-dav16i2j7g8c73ab0ot0 ist live. Gateway-Token wurde nach ausdrücklicher Zustimmung ausschließlich serverseitig eingerichtet; authentifizierte Kontoprüfung und Spielstandabruf erfolgreich. Entwickler-Testzugang aktiviert. Rechtstexte bleiben Entwürfe; Betreiberanschrift vor öffentlicher Freigabe ergänzen. Die hier beschriebene realistische Sammlung ist noch nicht implementiert.

## Geprüfter Verarbeitungsweg – 01.10.2026

Blender 4.0.2 aus signierten Ubuntu-Paketquellen wurde in einem separaten Arbeitsordner entpackt. Keine Laufzeitabhängigkeit für die App: Render bleibt ein Node-Spielserver. Eingabedateien werden mit `--disable-autoexec` geöffnet, nicht überschrieben und nicht in Git aufgenommen.

Camilias Blender-Datei aus dem ZIP und die separat hochgeladene Datei sind SHA-256-identisch. 236 Objekte, darunter ein Körpermesh mit 14.162 Vertices, Rigify-Rig mit 724 Bones, LongCurly-Haarmesh und 120 Bilder (119 gepackt). Das Laden funktioniert. Blender meldet eine beschädigte Shape-Key-Verknüpfung und entfernt diese beim Laden; Gesichtsmorphs sind damit noch nicht vollständig validiert. Ein CPU-Render von Gesicht und Haaren wurde erfolgreich erzeugt und visuell geprüft. Das ist ein Materialtest, keine fertige Lobbyfigur.

Männliches OBJ erfolgreich importiert: 29.708 Vertices. Es enthält UVs und einige Materialnamen, aber keine direkt verknüpften Hauttexturen; die Darstellung muss weiter geprüft werden. USDZ enthält Texturen, kann jedoch von diesem Ubuntu-Blender-Build nicht direkt importiert werden. Der erfolgreiche OBJ-Import belegt weder ein funktionsfähiges männliches Rig noch korrekte Hautmaterialien.

Die FBX-Dateien wurden nicht gelesen: Der direkte Dateitransfer meldet eine Grenze von 32 MiB. Weitere Upload-Schleifen sind nicht nötig, solange der vorhandene Verarbeitungsweg geprüft wird.

Reproduzierbarer Camilia-Materialtest (Blender bereits installiert):

```sh
blender --background --disable-autoexec INPUT.blend --python scripts/render-realistic-proof.py -- --output OUTPUT.png --samples 128
```

Das Skript rendert einen Testausschnitt; es erzeugt keine neue Kleidung und schaltet keine Sammlung frei. Bei Verwendung eines separat entpackten Blender-Builds müssen dessen Bibliotheks-, Skript-, Daten- und OCIO-Pfade gesetzt sein. Im hier getesteten Build ist OpenImageDenoiser nicht enthalten; das Skript verwendet deshalb CPU-Rendering ohne diesen optionalen Dienst.

Noch offen: männliche Hautmaterialien, Pose/Rig, drei Frisuren pro Figur, alle vereinbarten Oberteile/Hosen/Accessoires, Farbvarianten, saubere transparente Layer, versionierte Auswahl und Cloud-/Lobbyprüfung. Es wurden keine KI-Bilder erzeugt und keine neuen Figuren im Live-Spiel aktiviert.

## Umsetzung der realistischen Sammlung – 01.10.2026

Appearance-Version 2 ergänzt die Sammlung `realistic`; Classic- und Quaternius-Profile bleiben in Version 1 lesbar. Beide ausgewählten NoEdge-Modelle werden als transparente 384×540-WebP-Layer dargestellt. Originalmodelle, USD-Daten, Blender-Szenen und Texturen werden nicht veröffentlicht. Die Bildausgabe benötigt keine Blender-Laufzeit und keine laufende WebGL-Szene auf dem Handy.

Auswahl: männliche/weibliche Figur; drei abgeleitete Frisuren je Figur; vier Haarfarben; T-Shirt/Hoodie/Halfzip mit weißem Untershirt beim Mann und T-Shirt/Hoodie/Crop-Top bei Camilia; Shorts/Jeans/Jogger mit offenem Beinabschluss; sieben getrennte Farbvarianten für Oberteil und Hose; gold-/silberfarbene Kette, Sonnenbrille und optionale Creolen bei Camilia. Frisuren wurden aus den Originalhaaren abgeleitet. Kleidungsgeometrie und Zubehör werden im Render-Skript erstellt. Sneakers sind feste, zur Pose passende Renderteile. Vorhandene Schuhe der Quaternius-Sammlung bleiben auswählbar.

Der USD-Importer verwendet bei skinned meshes die bereits vorhandenen Bind-Koordinaten. Eine erneute Anwendung der Parent-Joint-Transformation hatte zuvor Haare und Gesichtsteile doppelt verschoben. Haar-, Kleidungs- und Schmuck-Layer verwenden einen Holdout-Körper zur korrekten Verdeckung. Der publizierte Haut-Layer enthält ausschließlich exponierte Bereiche; keine vollständige unbekleidete Figur wird ausgeliefert.

Prüfung: 111 Node-Tests erfolgreich, darunter kompatible alte Profile, Schutz vor eingeschleusten Assetpfaden/CSS, sämtliche 54 Haar-/Oberteil-/Hosen-Kombinationen und eine HTTP-Lobby mit zwei simulierten authentifizierten Konten inklusive Look-Wechsel und Wiederbeitritt. Dies ist keine Prüfung mit zwei echten angemeldeten Geräten. Ganzkörperkombinationen wurden lokal gerendert und visuell geprüft. Es wurden keine KI-Bilder erzeugt. Keine Spielregeln, Anmeldung oder Moderationsrechte geändert.

Verarbeitung: `export-realistic-usd.py INPUT.usdz PRIVATE_OUTPUT`, danach Blender mit `import-realistic-male.py -- --source PRIVATE_OUTPUT --output PRIVATE_MODEL.blend`. `render-realistic-wardrobe.py -- --gender male|female --output PRIVATE_RENDERS --samples 256` erzeugt die Layer; `--only` erlaubt einzelne Korrekturen. Keine Quelldateien ins Repository aufnehmen.
