# PLUS-Avatar v5

Ersetzt die bisherige Fotoauflage im Kleiderschrank. Ein Selbstporträt dient ausschließlich als lokale Vorlage für eine illustrierte Spielfigur. Das eigene Foto wird nicht als Textur in die Figur eingefügt.

## Auswahl

- Männliche und weibliche Figur, acht Oberteile, sechs Hosen, vier Schuhtypen; zehn getrennt wählbare Farben für Oberteil, Hose und Schuhe.
- Fünf Standposen: entspannt, Hand an der Hüfte, Arme verschränkt, lässiger Stand, winken.
- Drei Siegerposen: beide Arme hoch, Siegerfaust, Victory-Zeichen. Die Vorschau ist im Studio möglich. Im Ergebnis erscheint der Jubel nur für einen tatsächlichen, nicht ausgeschiedenen Gewinner mit aktivem PLUS. Abgebrochene Runden, gefundene Verstecker und Verlierer jubeln nicht. Wiederholte Ergebnisabrufe starten die Animation nicht neu. Reduzierte Bewegung wird respektiert.
- Gesicht: vier Formen, sechs Hauttöne, acht Frisuren und Haarfarben, vier Augenfarben, vier Bartoptionen, Brille und begrenzte Proportionsregler.
- Die drei bestehenden Crew-Figuren bleiben kostenlos. PLUS wird beim Speichern und in der Lobby serverseitig geprüft; bei Widerruf wird die freie Figur angezeigt. Käufe bleiben deaktiviert.

## Selfie-Verarbeitung und Grenzen

`selfie-avatar.js` lädt die selbst gehostete Face-API mit Tiny Face Detector und Tiny 68-Landmark-Modell erst nach einer Fotoauswahl. JPG, PNG und WebP (bis 12 MB / 40 MP) werden auf maximal 768 Pixel skaliert. Genau ein frontal erkennbares Gesicht ist erforderlich. HEIC muss zuvor als JPG exportiert werden.

Aus Gesichtspunkten werden Gesichtsform, Augenabstand/-größe, Nasen- und Mundbreite abgeleitet. Kleine Farbproben schlagen Haut- und Haarfarben vor. Das ist eine parametrisierte Illustration, keine fotorealistische Rekonstruktion und kein generativer Bilddienst. Die Ähnlichkeit ist begrenzt; Licht und Perspektive beeinflussen das Ergebnis. Frisur, Bart, Brille, Augenfarbe und Figurtyp wählt die Person selbst. Alle Vorschläge lassen sich korrigieren. Bei Ladefehlern oder ungeeignetem Foto bleibt die manuelle Gestaltung verfügbar.

Originalfoto und Gesichtspunkte werden weder hochgeladen noch gespeichert. Nach der Analyse werden lokale Blob-URLs freigegeben und der temporäre Canvas geleert. Gespeichert werden nur die allowlist-normalisierten visuellen Werte in `chs_appearance` (Version 5). Es gibt keinen Identitätsabgleich und keine Gesichtsdatenbank. Ein Abbruch, Konto-/Figurwechsel oder PLUS-Entzug verhindert die Übernahme eines verspäteten Ergebnisses.

Keine zusätzlichen API-Kosten pro Avatar. Normale Kosten für Hosting/Datenverkehr bleiben bestehen; die lazy geladenen Bibliothek-/Modelldateien umfassen insgesamt ungefähr 1,6 MB. Paketquelle, Lizenz, Version und Prüfsummen stehen unter `assets/vendor/face-api/NOTICE.md`.

## Migration und Bereitstellung

Alte v4-Gesichtsfotos werden nicht mehr gerendert. Beim erneuten Speichern des Looks entfernt der Client das eigene alte Bild aus dem Supabase-Bildspeicher; bei Fehlern kann die Löschung im geöffneten Studio wiederholt werden. Fotos in Konten, die den Look noch nicht erneut gespeichert haben, können bis dahin weiterhin im bisherigen öffentlichen Speicher liegen. Die Datenschutztexte wurden entsprechend aktualisiert (Fassung 2026-10-19.1; erneute Zustimmung nach bestehendem Ablauf).

Keine neue Datenbankmigration, kein Schlüssel und kein neuer externer Anbieter erforderlich. Neue JS-Dateien und lokale Modelldateien müssen zusammen mit `index.html` und `server.js` ausgeliefert werden. Der Server erlaubt ausschließlich die zwei fest benannten Modell-Binärdateien zusätzlich zu den bisherigen statischen Dateitypen. AdSense bleibt unverändert.

## Prüfung

- `npm test`: Normalisierung, PLUS-Schutz über HTTP, alte Foto-Metadaten, Sieg-/Abbruchregeln, statische Modellfreigabe.
- `CHS_QA_PLAYWRIGHT=/path/to/playwright node scripts/character-studio-browser-qa.cjs`: tatsächliche lokale Gesichtserkennung, kein Foto-Upload, mobile/desktop Studioauswahl, Speichern, serverseitige Ablehnung, Migration mit Löschretry, Siege/Niederlagen/Entzug, verspätete Analyse nach Entzug. Portrait-Testmaterial wird aus der mitgelieferten synthetischen Charaktergrafik erzeugt.
- `scripts/showroom-browser-qa.cjs`: Auto-/Figurenposition mit Kataloggrafiken und gepolsterten transparenten Fotos.

Ergebnis am 19.10.2026: 208 Node-Tests, 181 Avatar-Browserprüfungen (360/390/1000 px) und 172 Showroom-Prüfungen bestanden. Die mobilen Studio- und Startansichten wurden zusätzlich visuell geprüft.
