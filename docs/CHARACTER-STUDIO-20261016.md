# Fahrzeuge und Charakterstudio – 16.10.2026

## Sichtbare Änderungen

Startseite und Profil verwenden dieselben vollständigen Garagendaten. Die Startdarstellung nutzt die verfügbare Breite; überflüssiger Bildraum wird bei den älteren Vektor-/Vorlagenansichten in diesen beiden Ansichten entfernt. Eigene Fotos bleiben unterstützt. Die Profilansicht richtet SVGs und Fotos unten aus und setzt einen direkten Kontaktschatten darunter. Fahrzeug und Fortschrittskarte stehen im normalen Layout untereinander, damit die Reifen nicht durch einen festen Abstand über der Karte schweben.

Im Kleiderschrank gibt es drei kostenlose Crew-Figuren: Night Rider, Silver Line und Orange Shift. Sie sind unabhängig von PLUS auswählbar. PLUS schaltet Alex und Maya frei. Beide haben die Looks Cargo & T-Shirt, Denim & Hoodie sowie Bomber & Jogger. Oberteil- und Hosenfarben lassen sich getrennt einstellen. Die neuen Illustrationen ersetzen die bisher sichtbaren Quaternius-/NoEdge-Darstellungen und Herstellernamen.

Bestehende modulare/realistische Metadaten bleiben lesbar. Ihre Darstellung wird einer neuen Studiofigur und einem Outfit zugeordnet; frühere Einzeloptionen für Haare, Brille, Schmuck und separat zusammengestellte Kleidungsstücke werden im neuen Studio nicht angeboten. Neu gespeichert werden Figur, komplettes Outfit und beide Kleidungsfarben. Ohne aktives PLUS erscheint die gespeicherte kostenlose Ersatzfigur; das gespeicherte Premium-Aussehen wird nicht automatisch gelöscht.

## Rechte und Speichern

Die UI liest die bestehende serverseitige PLUS-Freigabe und reagiert auf Ablauf, Entzug und Kontowechsel. `POST /api/wardrobe-save` prüft Authentifizierung, Kontozugriff und für Studiofiguren die bestehende `chs_plus_read`-RPC mit dem JWT des Spielers. Anschließend speichert die Supabase-Auth-API nur normalisierte Erscheinungsdaten. Kostenlose Figuren benötigen keine PLUS-Abfrage.

Beim Lobbybeitritt und bei Identitätsänderungen überprüft der Spielserver Premium-Aussehen erneut; ein gefälschtes PLUS-Feld im Client gewährt keine Freigabe. Bei der eigenen Lobbyabfrage wird ein entzogener Look auf die kostenlose Figur zurückgesetzt (Prüfcache höchstens 30 Sekunden). Ein nicht erreichbarer PLUS-Dienst verhindert das Speichern eines Premium-Looks; laufende Lobbyabfragen bleiben mit einer kostenlosen Darstellung möglich.

Keine neuen Zugangsdaten oder Migrationen. Die bestehende PLUS-Einrichtung muss für Premium-Freischaltungen verfügbar sein. Käufe bleiben entsprechend dem bestehenden Projektstand deaktiviert. Diese Änderung schaltet keine kostenpflichtigen Rechte automatisch frei.

## Validierung

- `npm test`: 198 Prüfungen bestanden, einschließlich serverseitiger Ablehnung gefälschter Rechte und Rücknahme des Premium-Looks nach Entzug.
- Home-/Garage-Browserprüfung: 100 Prüfungen bei 360, 390, 430 und 1000 Pixeln bestanden.
- Charakter-/Profil-Browserprüfung: 66 Prüfungen bestanden. Das Programm prüft kostenlose Auswahl, PLUS-Auswahl, Speichern, Entzug, Profilboden und Haut-/Kleidungsfarben mit lokalen Kontofikturen. Screenshots werden nach `/tmp/chs-character-qa` geschrieben.

```sh
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright node scripts/home-garage-browser-qa.cjs
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright node scripts/character-studio-browser-qa.cjs
```

Die Browserprogramme nacheinander ausführen. Keine Tests verändern Produktionskonten. Der Live-Stand von PR #37 war bei Beginn dieser Arbeit per HTTP erreichbar und entsprach den ausgelieferten HTML-/CSS-Dateien; diese neue Überarbeitung benötigt ihren eigenen Merge und Render-Deploy.
