# Freundes- und Crewkarte · 13. Oktober 2026

Ausgangsstand: `d1b745f1893db1e32e922959fa0aeb5f35b986a1` auf GitHub `main`.

## Vorarbeiten

Die vorhandene, saubere Cloud-Arbeitskopie wurde per Fast-forward aktualisiert. Node 24.19.0, `npm ci` und alle 170 bestehenden Node-Tests wurden geprüft. Der lokale Server startet mit `npm start`; App und Rechtsinformationen antworten mit HTTP 200, geschützte Kontodaten ohne Anmeldung mit 401 und interner Servercode mit 404. Cloud-Installationsskript und Startanweisungen wurden als Entwurf gespeichert. Speichern ist keine Veröffentlichung und kein Nachweis einer Wiederherstellung in einer neuen Aufgabe.

Der Render-Connector ist in dieser Sitzung nicht verfügbar. Es sind keine Render-/Supabase-Verwaltungszugänge injiziert. Live-Deployment und produktiver Neustart sind deshalb nicht geprüft. Die früher dokumentierten physischen Mehrgerätetests und die fehlenden Betreiberangaben bleiben offen.

## Verhalten

- In **Freunde** und **Crew** öffnet eine eigene Taste die Karte. Sie verwendet dieselbe MapLibre-Version und OpenFreeMap-Karte wie die Lobby, ohne Spielradius oder Treffpunktroute.
- Freigegebene Personen erscheinen mit Profilfoto bzw. Initialen und Name. Die Liste und Marker-Popups zeigen **Standortzeit** und **letzte Aktivität** getrennt. Ältere Messungen und deren Genauigkeit sind kenntlich; es wird kein Live-Standort behauptet.
- Die Freigabe ist standardmäßig aus. Optionen: bestätigte Freunde, aktuelle Crew, beide Gruppen oder eine Auswahl aus diesen Kontakten. Die zusätzliche Zustimmung ist nicht vorgewählt. Gruppen schließen später hinzukommende Mitglieder ein; darauf weist die Auswahl hin.
- Ein zuletzt geteilter Punkt bleibt maximal 24 Stunden abrufbar. Ausschalten und jede Änderung des Empfängerkreises löschen den bisherigen Punkt serverseitig. Neue Empfänger erhalten erst einen danach ermittelten Standort. Ein abgebrochener oder fehlgeschlagener Speichervorgang wird als Fehler angezeigt.
- Geolocation wird außerhalb laufender Runden nur bei sichtbarer App und aktiver Freigabe angefragt, höchstens ungefähr einmal pro Minute automatisch. Die Browserfreigabe bleibt Voraussetzung. Es gibt keinen Hintergrunddienst, keinen Standortverlauf und keine Speicherung von Koordinaten im lokalen Browser-Speicher.
- Ein Aktivitätssignal aktualisiert die letzte aktive Nutzung, aber nicht die Messzeit oder Ablaufzeit des Standorts. Die gemeinsame Freigabe umfasst beide Angaben.
- Geöffnete Karten werden alle 15 Sekunden aktualisiert. Ausgeblendete Seiten, Verbindungsfehler, Kontowechsel und Abmelden entfernen die angezeigten Koordinaten. Bereits gesehene oder kopierte Informationen lassen sich nicht rückwirkend zurückrufen.

## Zugriff und Spielregeln

Die neue Migration ergänzt drei private Tabellen mit RLS und ohne direkte Rechte für Browserrollen. Öffentliche RPC-Wrapper rufen eng begrenzte Implementierungen im privaten Schema auf. Eigentümer ist immer `auth.uid()`. Ein mitgesendeter fremder Nutzername oder eine fremde ID erteilt keine Rechte.

Jeder Abruf prüft aktuelle Freundschaft/Crew-Zugehörigkeit, den gewählten Empfängerkreis, beidseitige Blockierungen, Kontosperren und Ablauf. Auch ein ausgewählter Empfänger verliert den Zugriff, wenn keine gültige Beziehung mehr besteht. Private Hilfsfunktionen können nicht zur Abfrage anderer Konten aufgerufen werden.

Änderungen und Standortschreibvorgänge werden pro Konto serialisiert. Jede Freigabeänderung erneuert eine Revisions-ID. Eine verspätete GPS-Antwort mit einer alten Freigabe kann einen gelöschten Punkt nicht wieder veröffentlichen. Ältere Fixes ersetzen keinen neueren Punkt.

Während COUNTDOWN, HEADSTART oder ACTIVE blockiert die Datenbank die soziale Karte für beteiligte Konten und deren Standortveröffentlichung. Die Prüfung verwendet den bestehenden, ausschließlich serverbeschreibbaren Spielstand. Ein Trigger entfernt soziale Punkte der Teilnehmer beim Speichern des Rundenstarts. Auch ausgeschiedene Teilnehmer können diese Karte während der Runde nicht als zusätzliche Gegnerortung verwenden. Voraussetzung ist die bestehende produktive Supabase-Persistenz des Spielservers; isolierter lokaler Dateispeicher synchronisiert keine Spielphasen an eine entfernte Datenbank.

Die Datenschutzhinweise wurden um die freiwillige Freigabe ergänzt; Dokumentversion ist `2026-10-13.1`. Der vorhandene Rechtsstand-Hash ändert sich. Die eigenständige Standortzustimmung ersetzt keine noch offene allgemeine Rechtsfreigabe.

## Prüfungen reproduzieren

Die Hilfspakete liegen außerhalb des Repositorys; Anwendungsabhängigkeiten und Lockdatei bleiben unverändert.

```sh
cd /workspace/CARSHideandSeek
npm ci --cache /tmp/chs-npm-cache
npm test
npm install --prefix /workspace/chs-qa --cache /tmp/chs-npm-cache --save-exact \
  @electric-sql/pglite@0.5.8 playwright@1.56.1 maplibre-gl@5.6.0
node scripts/social-map-sql-qa.mjs /workspace/chs-qa/node_modules/@electric-sql/pglite/dist/index.js
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright \
CHS_QA_MAPLIBRE=/workspace/chs-qa/node_modules/maplibre-gl/dist/maplibre-gl.js \
CHS_QA_CHROMIUM=/usr/bin/chromium \
node scripts/social-map-browser-qa.mjs
```

Der Browserpfad bezeichnet das hier vorhandene Chromium. Auf anderen Maschinen kann `CHS_QA_CHROMIUM` auf einen vorhandenen Browser zeigen oder Playwrights normaler Browser verwendet werden. Keine TLS-/Artefaktprüfung wurde abgeschaltet. SQL-Prüfungen sind zusätzlich im vorhandenen GitHub-Workflow registriert.

SQL-Prüfung: tatsächliche neue Migration und vorhandene Crew-Migration in PGlite, authentifizierte Rollen und `auth.uid()`, einschließlich verbotener Direktzugriffe, Zielauswahl, Beziehungen, Sperren, Phasen, verspäteter Fixes und Löschung. Browserprüfung: tatsächliche App und MapLibre auf 360/390/430/1000 Pixeln; Konten, RPC-Antworten, GPS und Kartenstil sind lokale Testdaten. Das ist kein echter OAuth-, Straßenkarten-, Geräte- oder Supabase-Integrationstest.

Abschlussstand: **170/170 Node-Tests, 61/61 SQL-Prüfungen und 57/57 Browserprüfungen bestanden**. Kein Test wurde dafür deaktiviert oder übersprungen. Syntax- und Diff-Prüfung bestanden. Nach lokalem Serverneustart wurden App, neue JS-/CSS-Dateien, die aktualisierte Rechtsversion und der Zugriffsschutz erneut per HTTP geprüft. Die Browserprüfung umfasst auch Ausschalten bei ausstehendem GPS, Speichern während eines Sichtbarkeitswechsels und eine verspätete Antwort nach Abmeldung. Externe OpenFreeMap- und Supabase-Abrufe wurden vom Cloud-Netzwerk mit HTTP 403 abgewiesen.

## Vor Bereitstellung noch erforderlich

1. Migration `20261013080000_social_location_sharing.sql` einmal auf dem vorgesehenen Supabase-Projekt anwenden, nach den bereits vorhandenen Crew-Migrationen. Sie wurde hier **nur lokal geprüft**, nicht produktiv ausgeführt.
2. Bei vorhandenem `pg_cron` richtet die Migration `chs-social-location-retention` im Zehn-Minuten-Takt ein. Aktivität und Ausführungsrechte der Aufgabe in der Zielumgebung prüfen. Ablauf schließt Lesezugriff unabhängig von Cron aus; zusätzlich entfernt jeder Karten-Schreibzugriff abgelaufene Punkte. Ohne laufenden Job ist keine fristgerechte physische Löschung bei inaktiver App nachgewiesen.
3. Bestehende Supabase-Spielstandpersistenz und Rundenstart-Trigger gegen den echten Spielserver prüfen. Erst danach Anwendung einschließlich der geänderten Datenschutzhinweise bereitstellen.
4. Im Cloud-Konfigurationsentwurf wurden `tiles.openfreemap.org`, `unpkg.com`, `yyvljkzitodxhtkilsxm.supabase.co` und `router.project-osrm.org` zur benutzerdefinierten Netzwerkliste hinzugefügt. Vorhandene Paketmanager-Voreinstellungen bleiben erhalten. Die Freigaben sind gespeichert, aber noch nicht als aktiv bestätigt.
5. Zwei echte Konten testen: Freigabe, Ausschalten, Personenauswahl, Blockieren/Entfreunden, Crew-Austritt, Geräteberechtigung, Hintergrund und Rückkehr. Echte Kartenkacheln und Geräte-GPS prüfen. Danach die bestehenden 2/5/10-Geräte-Abnahmen fortsetzen.

Code und Migration sind auf GitHub im Branch `codex/social-location-sharing` veröffentlicht. Das automatische Erstellen eines Draft-Pull-Requests wurde versucht, aber der Zugriff auf `https://api.github.com/graphql` wurde mit HTTP 403 abgewiesen. Die zusätzliche API-Domain ist im Cloud-Konfigurationsentwurf gespeichert; deren Aktivierung ist noch nicht bestätigt. Der PR-Text ist vorbereitet. Es wurde kein Merge, Produktionsdeployment und keine Cloud-Veröffentlichung durchgeführt.
