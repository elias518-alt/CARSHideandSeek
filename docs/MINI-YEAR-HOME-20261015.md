# Cooper S, Baujahrauswahl und Startansicht – 15.10.2026

## Bedienung und Änderungen

Garage → Fahrzeug hinzufügen/bearbeiten → Mini → Cooper S. Der Cooper S wird nicht mehr auf den normalen Cooper umgeschrieben. Eigene Ansichten für R53, R56, F56 und F66 sowie Cooper S 5-Türer (F55/F65), Cabrio (R52/R57/F57/F67) und Clubman (R55/F54) ergänzen den Katalog um zwölf Darstellungen auf insgesamt 192.

Das optionale Baujahr ist eine native Auswahlliste: aktuelles Kalenderjahr abwärts bis 1900. Sie wird bei jedem Öffnen aktualisiert. Bestehende Fahrzeuge behalten ihr Jahr; ein bereits gespeichertes nächstes Modelljahr bleibt beim Bearbeiten als ausdrücklich gespeicherte Option verfügbar. Baureihenzuordnung, Vorschau und Speichern verwenden den ausgewählten Wert.

Die Startansicht zeigt das aktive Fahrzeug über 98 % der Szene. Angepasste Bodenposition, Kontaktschatten und Hintergrundausrichtung verbinden Auto und Umgebung. Die kleinere Spielfigur steht rechts daneben. Persönlicher Hintergrund, eigene Fahrzeugfotos, allgemeine Ersatzillustration und leere Garage bleiben unterstützt. Die Regeln sind auf die Startseite begrenzt.

Dieser Stand übernimmt und überarbeitet die bisher ungemergte Startansicht aus PR #35; dieser ältere PR wird dadurch ersetzt. Keine Datenbankmigration oder neuen Zugangsdaten erforderlich. Sichtbar nach Merge und Deployment dieses Standes.

## Bildquelle

`assets/vehicles/mini-cooper-s.webp`: zwölf generierte, freigestellte Illustrationen, konvertiert aus `/workspace/generated_images/exec-4787e349-8142-4a06-bc20-d2536b8ba0e9.png`. Repräsentative Generationen, keine Herstellerfotos oder vollständigen Facelift-/Ausstattungskataloge. Lackmaskierung erhält Glas, Räder und Kontrastdächer.

## Prüfung

- `npm test`: 197 Prüfungen bestanden, einschließlich Cooper-S-Suche, Speichern, Generationen und Jahreswechsel.
- `scripts/home-garage-browser-qa.cjs`: 100 Prüfungen bei 360, 390, 430 und 1000 Pixeln. Native Jahresauswahl, generationsabhängige Vorschau, gespeicherte Fahrzeuge, große Startdarstellung für Limousine/SUV/Cooper S, Hintergrundwechsel, eigene Fotos und leere Garage.
- `scripts/vehicle-studio-browser-qa.mjs`: 64 Prüfungen bestanden; 192 Generationen, Lackwechsel und Erhalt neutraler Glas-/Zierleistenflächen. Alle zwölf neuen Cooper-S-Ansichten visuell kontrolliert.
- Browser- und Bildprüfungen verwenden lokale Testkonten; keine Produktionsdaten werden verändert.

Browserprüfungen:

```sh
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright CHS_QA_CHROMIUM=/usr/bin/chromium node scripts/home-garage-browser-qa.cjs
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright CHS_QA_CHROMIUM=/usr/bin/chromium node scripts/vehicle-studio-browser-qa.mjs
```

Die Browserprüfungen nacheinander ausführen. Die Studio-Prüfung erzeugt Kontaktbögen pro Bildatlas statt einer sehr hohen Gesamtaufnahme aller SVG-Filter.
