# Garage und Lobby: Studio-Fahrzeuge und drei zusätzliche Orte

Die App verwendet für unterstützte Baureihen jetzt generierte, freigestellte Studio-Illustrationen mit räumlicher Ansicht. Die bestehende Verwendung eigener Fahrzeugfotos bleibt vorrangig. Die Bilder werden in Garage, Formularvorschau, Profil und Lobby über dieselbe Darstellungsfunktion ausgewählt.

## Umfang

| Modellfamilie | Enthaltene Generationen |
| --- | --- |
| BMW 3er | E21, E30, E36, E46, E90, F30, G20 |
| BMW 5er | E12, E28, E34, E39, E60, F10, G30, G60 |
| BMW M2 | F87, G87 |
| Mercedes-Benz C-Klasse | W202, W203, W204, W205, W206 |
| Mercedes-Benz 190 | W201 |
| Audi A4 | B5, B6, B7, B8, B9 |
| Audi A6 (Verbrenner) | C4, C5, C6, C7, C8, C9 |
| Audi 80 | B4 |

Das sind 35 Darstellungen. Sie zeigen repräsentative Limousinen, beim E21 einen Zweitürer und beim M2 Coupés. Kombis, Cabrios, andere Coupés und unbekannte Kombinationen verwenden weiterhin die passende allgemeine Karosserie beziehungsweise eigene Fotos. A6 e-tron wird nicht als Verbrenner dargestellt.

`vehicle-generations.js` teilt die europäischen Baureihenintervalle zwischen Katalog und Bildauswahl. Baujahr oder explizite Baureihe steuern die Auswahl; eine passende explizite Baureihe hat bei zeitlichen Überschneidungen Vorrang. Ohne Baureihe wird in Überschneidungsjahren die neuere Generation verwendet. Motorvarianten wie 320d, 530i und C200 werden der jeweiligen Familie zugeordnet. Konflikte zwischen Baujahr und expliziter Baureihe erzeugen keine vermeintlich passende Studio-Darstellung.

Die Intervalle beschreiben Modellfamilien; Markteinführung, einzelne Karosserien und Länder können abweichen. Die generierten Bilder sind an reale Generationen angelehnt, keine maßstabgetreuen Herstellerbilder. Facelifts, Ausstattungslinien, Felgenoptionen und jedes einzelne Modelljahr sind nicht separat nachgebildet. Der Hinweis auf die Illustration bleibt sichtbar.

## Lackierung

Die magentafarbene Karosserie in den Ausgangsbildern dient ausschließlich als Materialmaske. `vehicle-studio.js` isoliert diese über Rot-minus-Grün und Blau-minus-Grün, mischt die gewählte Lackfarbe mit vorhandenen Reflexionen und setzt Glas, Reifen, Chrom und Leuchten aus dem Originalbild ein. Schwarz, Weiß, Silber und Grau besitzen unterschiedliche Werte; deutsche Farbnamen einschließlich Grün und Weiß sowie sechsstellige Hexwerte werden unterstützt. Unbekannte Farben fallen auf neutrales Silber zurück; eigene Fotos werden nicht umgefärbt.

Die vier WebP-Atlanten werden vom Browser gemeinsam genutzt (zusammen etwa 1,3 MB). Jeder SVG-Filter ist auf den sichtbaren Ausschnitt begrenzt, damit pro Fahrzeug nicht das gesamte Bildraster verarbeitet werden muss. Gemessene Zellgrenzen und SVG-Clipping verhindern, dass benachbarte Autos in die Darstellung ragen.

## Hintergründe

Über die bisherigen Einstellungen beziehungsweise die Lobby-Einstellungen des Hosts stehen zusätzlich zur bisherigen Auswahl bereit:

- Skyline bei Nacht: nasses Parkdeck mit Stadtlichtern.
- Alpen · Golden Hour: Aussichtspunkt mit Bergpanorama.
- Industriehalle · Amber: warme Werkstattbeleuchtung und Betonboden.

Browser und Server verwenden dieselbe Positivliste in `lobby-scene.js`. Der Hintergrund gilt für die ganze Lobby. Es werden keine neuen Premium-Rechte oder Werbefreischaltungen eingeführt.

## Herkunft der neuen Bilddateien

Alle sieben Dateien wurden mit dem integrierten ImageGen-Werkzeug erzeugt und als WebP exportiert. Keine heruntergeladenen Herstellerfotos. Briefing: realistische leere Kulissen beziehungsweise freigestellte Fahrzeugraster in gleicher Perspektive, generationstypische Karosserie und Leuchten, ohne Beschriftung; magentafarbene Lackflächen zur Materialtrennung. Generierte Details können von realen Modellen abweichen.

- `assets/scenes/skyline.webp`: Ausgabe `exec-37af4bcf-6cda-4614-af03-963ddd6be346`.
- `assets/scenes/alpine.webp`: Ausgabe `exec-f14a3295-f7a5-4084-8206-1e3b0aa58559`.
- `assets/scenes/hangar.webp`: Ausgabe `exec-220b646e-1c15-4f2d-a720-92609ccb9078`.
- `assets/vehicles/bmw-3.webp`: Ausgabe `exec-72c4d199-dd42-48cb-bb6b-ef8ad0c20a8b` (Freistellungsbearbeitung der ersten Generierung).
- `assets/vehicles/bmw-5.webp`: Ausgabe `exec-02f70b36-a953-4c82-bd51-463fb939182d`.
- `assets/vehicles/mercedes-c.webp`: Ausgabe `exec-4493e3b0-04be-4df5-a85f-cdc1309fff0f`.
- `assets/vehicles/audi.webp`: Ausgabe `exec-53f02923-25d9-4e48-904e-548a5cbfcde1`.

## Prüfung

`npm test` prüft auch Jahresgrenzen, Varianten, widersprüchliche Eingaben, sichere Farbwerte und die vorhandenen Assets. `scripts/vehicle-studio-browser-qa.mjs` rendert alle 35 Varianten und eine Farbtafel in Chromium; bei vier Familien vergleicht es die Pixel schwarzer und weißer Lackierung auf Veränderungen von Karosserie und neutralen Bauteilen. Die erweiterte `scripts/social-map-browser-qa.mjs` prüft zudem die echte Garage sowie die drei Hintergrundwechsel mit Fahrzeugen bei 360, 390, 430 und 1000 Pixel Breite. Authentifizierung und APIs sind lokale Fixtures; keine produktiven Konten oder Datenbankänderungen.

Für die Veröffentlichung sind Merge und App-Deployment erforderlich. Es gibt keine neue Serverkonfiguration, Datenbankmigration oder Abhängigkeit.

Ergebnis am 14. Oktober 2026: 187 Node-Tests, 173 Prüfungen der App im Browser und 13 Studio-/Pixelprüfungen bestanden. In den neutralen Stichproben aller vier Fahrzeugfamilien wurden beim Lackwechsel keine Farbänderungen gefunden. Vorschauen liegen lokal unter `/tmp/chs-studio-qa` und `/tmp/chs-social-map-qa`.
