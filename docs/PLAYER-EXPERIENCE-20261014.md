# Profil, Freunde, Garage und PLUS

## Ergebnis

- Runde Avatare mit fester Geometrie und eigenständigem Bildzuschnitt; Abzeichen bleiben außerhalb des Bildes sichtbar.
- Profilübersicht und ausführliche Statistiken mit Karten, Zahlenhierarchie, Fortschrittsanzeige und echten Kontowerten. Leere und fehlgeschlagene Rollenstatistiken werden benannt.
- Freunde zeigen echte letzte Aktivität; online bedeutet weniger als zwei Minuten seit dem letzten bekannten Aktivitätssignal. Der neue RPC liefert nur bestätigte, nicht blockierte und nicht gesperrte Freunde. Keine Standortkoordinaten in der Aktivitätsantwort.
- Die Freundesliste zeigt Hinweise auf freigegebene letzte Kartenpositionen. „In deiner Nähe“ bedeutet höchstens 1 km einschließlich beider Genauigkeitsradien, Messungen höchstens fünf Minuten alt und jeweils höchstens 100 m Genauigkeitsradius. Dafür werden keine zusätzlichen GPS-Abfragen gestartet.
- Bestehende Kartenfreigabe, Widerruf, Ablauf und Rundenschutz bleiben erhalten. Bei Offline-/Hintergrundwechsel werden angezeigte Positionen geleert; nach Rückkehr wird neu geprüft. Offene Freundeslisten/Karten aktualisieren Standortdaten alle 15 Sekunden. Empfänger können bereits angefertigte Kopien natürlich behalten.
- Keine verlässliche Ortsnamensquelle eingerichtet. Deshalb aktuell der ehrliche Ersatz „Letzter Standort auf Karte · vor …“ und Kartenbeschriftungen des Kartenanbieters. Keine erfundenen Orte und kein neuer externer Geocoding-Dienst.

## Garage

Neue Modelloptionen: Audi S3/RS3/RS4/RS6/Q4 e-tron, BMW i3/i4/i5/i7/iX/iX1/iX3, Mercedes CLE/EQA/EQB/EQE/EQS. Ergänzte Generationen u. a. BMW M2/M3/M4/1er/2er/3er, Audi A3/TT, Polo, A-Klasse, Supra und MX-5. Markt-/Karosserievarianten können abweichende Produktionszeiträume haben; freie Modellangaben bleiben möglich.

Acht eigenständig gezeichnete SVG-Ansichten in `vehicle-art.js`:

| Auswahl | Individuelle Ansicht |
| --- | --- |
| BMW M2 | F87 (2016–2021), G87 (ab 2023) |
| BMW 3er | E46, G20 |
| VW Golf | VII, VIII |
| Ford Focus | III, IV |

Die Grafiken sind stilisierte, an die Generation angelehnte Illustrationen und keine maßstabgetreuen Herstellerdarstellungen. Ohne eindeutig unterstützte Auswahl bleibt die vorhandene Karosserievorlage erhalten. Explizite Kombi-/SUV-/Van-/Cabrio-Auswahlen verwenden die passenden allgemeinen Vorlagen. Fotos haben unverändert Vorrang. Baujahr und Baureihe werden jetzt auch im Lobby-Protokoll transportiert, einschließlich Wiederbeitritt.

## PLUS bedienen

Profil → PLUS entdecken → Farbpalette. Unterstützt werden Orange, Rosa, Lila, Blau, Türkis und Weiß. Bedeutungsfarben für Warnungen/Erfolg, Kartenmarker, Medaillen und Fahrzeuglack bleiben unabhängig.

Für Datenbankrollen `admin` oder `super_admin` erscheint „PLUS verwalten“: Spieler über Name/Tag suchen oder eigenes Konto wählen, optionales Ablaufdatum und Begründung eintragen, freischalten/verlängern oder entziehen. Datumseingabe erfolgt in der lokalen Browserzeit, Speicherung in UTC. Moderatoren können keine Rechte vergeben.

Rechte, Ablauf und Farbspeicherung werden in geschützten SQL-RPCs geprüft. Ein Client-Flag vergibt keine Rechte. Alle manuellen Rechteänderungen werden mit vorherigem/nachfolgendem Zustand protokolliert; Aufbewahrung 90 Tage. Direkte Tabellenzugriffe sind für normale und anonyme Nutzer gesperrt.

Sichtbare Sitzungen prüfen PLUS alle 30 Sekunden, beim Wiederöffnen und bei Rückkehr aus dem Hintergrund. Das bekannte Ablaufdatum hat zusätzlich einen lokalen Timer. Bei Offline-/Prüffehlern wird die Standardfarbe aktiv. Ein Widerruf gilt sofort auf dem Server; bei anderen Geräten benötigt die Anzeige den nächsten erfolgreichen Abruf. Ausbleibende PLUS-Antworten laufen nach acht Sekunden in einen Fehler.

Keine echten Käufe, Preise oder Zahlungsanbieter. Die Spalte `source` reserviert eine spätere Zahlungsherkunft, wird aber durch keine öffentliche Aktion auf `payment` gesetzt. Vor einer Zahlungsintegration müssen Webhooks und Prioritätsregeln ergänzt werden, siehe `ADS-AND-BILLING.md`.

## Datenbank und Bereitstellung

Am 14. Oktober 2026 auf dem bestehenden Supabase-Projekt installiert und im Migrationsverlauf registriert:

1. `20261014090000_friend_presence.sql`
2. `20261014100000_plus_entitlements.sql`

**Nicht erneut manuell ausführen.** Die alte Standortmigration vom 13. Oktober wurde nicht erneut ausgeführt. Die neuen Migrationen verändern weder bestehende Spielstände noch Nutzerrechte; niemand wurde durch die Einrichtung automatisch PLUS-Mitglied.

Live geprüft: RLS für alle drei neuen Tabellen aktiv, direkte SELECT/INSERT-Rechte fehlen für `authenticated`, anonyme Funktionsausführung gesperrt, authentifizierte RPC-Ausführung erlaubt, tägliche Auditbereinigung aktiv. Ein vorhandenes Administratorkonto wurde anhand der Anzahl der passenden Rollen bestätigt, ohne Identitätsdaten auszugeben.

Der Frontend-/Servercode wird über den PR bereitgestellt. Ein Render-Zugang und eine öffentliche App-URL sind in dieser Umgebung nicht verfügbar; ein Render-Deployment oder dessen Erfolg darf deshalb nicht als erledigt gelten. Für die Änderungen sind nach Zusammenführung ins Deployment keine neuen Render-Geheimnisse nötig. Der bestehende Supabase-Zugang der App wird weiterverwendet.

Die Dokumentversion wurde auf `2026-10-14.1` angehoben: Aktivitätsanzeige, manuelle PLUS-Rechte und Farbe sind in den Datenschutzhinweisen beschrieben. Der bestehende Zustimmungsablauf kann deshalb erneut erscheinen. Noch fehlende Betreiberangaben/rechtliche Freigaben werden durch diese Arbeit nicht ersetzt.

## Prüfung

- Node-Testlauf: 172 bestanden, keine fehlgeschlagenen oder übersprungenen Tests.
- PGlite: 88 Prüfungen mit tatsächlichen Migrationen und Rollen, einschließlich Standort-ACL, Freundesaktivität, unberechtigter Vergabe, Ablauf, Widerruf, Farbmanipulation, gesperrtem Checkout und Audit.
- Browser: 113 Prüfungen bestanden; echte Anwendung und MapLibre mit simulierten RPCs/Auth/GPS; 360/390/430/1000 px. Avatargeometrie und hochformatiges Testbild, Profilstatistik, getrennte Fahrzeugansichten, Palette, Ablauf/Widerruf sowie Kartenregressionen.
- Lokaler Serverstart über `npm start` und HTTP-Prüfungen: neue Assets und Rechtstexte erreichbar, geschützte API ohne Anmeldung 401, Serverquellen/Migrationen 404.
- Browserartefakte liegen außerhalb des Repositorys in `/tmp/chs-social-map-qa/`. Diese simulierten Prüfungen ersetzen keine Tests mit echten OAuth-Konten und mehreren Smartphones.

Reproduzieren:

```sh
npm ci --cache /tmp/chs-npm-cache
npm test
node scripts/social-map-sql-qa.mjs /workspace/chs-qa/node_modules/@electric-sql/pglite/dist/index.js
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright CHS_QA_MAPLIBRE=/workspace/chs-qa/node_modules/maplibre-gl/dist/maplibre-gl.js CHS_QA_CHROMIUM=/usr/bin/chromium node scripts/social-map-browser-qa.mjs
```

Der SQL-Lauf bleibt in CI eingebunden. Browserabhängigkeiten liegen isoliert unter `/workspace/chs-qa`; keine neue Produktionsabhängigkeit erforderlich.
