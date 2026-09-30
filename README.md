# CAR HIDE & SEEK – Playable Alpha 0.5

## Start
1. Node.js 18+ installieren.
2. Ordner öffnen.
3. `npm start`
4. Browser: `http://localhost:3000`

Für einen echten GPS-Test auf Smartphones muss die Seite über HTTPS erreichbar sein (Browser-Sicherheitsvorgabe). Auf localhost funktioniert Geolocation ebenfalls.

## In dieser Version wirklich implementiert
- Spielerprofil (Name, Fahrzeug, Farbe, Fahrer/Beifahrer)
- Private Lobby + 5-stelliger Code
- Mehrspieler-Lobby bis zu 20 Teilnehmern: allein mittig, zwei nebeneinander, ab drei Host vorne und weitere Spieler in hinteren Parkreihen
- Hintergrundwahl durch den Host im Warteraum und Profil-Voreinstellung; vorhandenes nasses Parkdeck, violette Variante und Neon-Halle
- Öffentliche Lobby-Suche und Beitritt im Umkreis von 1 km um den Host, unabhängig vom Spielradius
- Straßenkarte, Treffpunkt am aktuellen Hoststandort und Straßenroute beim Lobbybeitritt als Gast
- Supabase-Profil, Garage mit Fahrzeugfotos, Freunde, Direktnachrichten, Lobby-Einladungen und globale Hinweise auf Freundschaftsanfragen bei geöffneter App
- Ready-System
- Host-Wechsel beim Verlassen und längerem Ausfall; Runden bleiben bestehen
- konfigurierbarer Radius, Spielzeit, Headstart, Escape-Zeit
- GPS-Streaming über Browser-Geolocation
- Startpunkt setzen
- Countdown, Headstart, ACTIVE, RESULT
- automatische Rollenverteilung mit fairer Rotation
- Näherungsstufen
- 10–15-s-Fund-Countdown mit festem Ziel; Verstecker bewegen sich frei und können einmal entkommen; beteiligter Sucher sieht die Fahrt des Ziels
- Fundversuch mit serverseitiger GPS-/Accuracy-/Freshness-/Plausibilitätsprüfung
- gestaffelter Fehlversuch-Cooldown
- Ergebnis + XP/Level-Grundlogik
- Reconnect über lokale Session oder authentifizierte Rundensuche; Ausfallfristen und kein Wiederbeleben nach Ausscheiden
- Rematch
- Fahrer-Fundfunktion nur bei bestätigtem Stillstand; Beifahrermodus
- 50-m-Treffpunkt beim Start; Sucher warten während des Headstarts; Ersatzsucher mit 30-s-Frist und GPS-Stillstandsbestätigung
- Adaptive GPS-Abfragen, Radius-/AFK-Warnung, Mehrheitsabbruch, Kick vor Start
- Lobby-Blockierung, Meldungen, Ereignisjournal und detaillierte Ergebnisse; Diagnose/Meldungseinsicht nur für konfigurierte Admins

## Noch NICHT produktiv angebunden
Apple/Google Login, Hintergrund-Push bei geschlossener App, automatische Moderation, Payments/PLUS, Ads, vollständige Fahrzeug-/3D-Bibliothek und App-Store-Signing sind nicht implementiert. Neustarts werden mit eingerichtetem Server-Speicher wiederhergestellt; ohne diesen startet die neue Version auf Render keine echten Runden. Supabase-Kontodaten bleiben separat gespeichert.

## Konfiguration und Prüfung

`SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY` können am Spielserver gesetzt werden. Die Browserkonfiguration steht am Anfang von `app.js`; nur veröffentlichbare Schlüssel gehören dort hinein. Das Supabase-Projekt benötigt die verwendeten Tabellen/RPCs. Ergänzende Migrationen stehen unter `supabase/migrations`.

`REMOVE_BG_API_KEY` aktiviert optional die Fahrzeugfreistellung über remove.bg. Bestehende Vorlagen benötigen das nicht.

Straßenrouten verwenden standardmäßig `https://router.project-osrm.org`; `OSRM_BASE_URL` kann einen eigenen Routingserver wählen. Für regelmäßigen Produktivbetrieb ist ein geeigneter Routingdienst erforderlich. Bei fehlendem GPS oder Routenausfall zeigt die Karte einen Hinweis und den verfügbaren Treffpunkt.

`npm test` führt die Node-Tests aus. In Umgebungen ohne erlaubte Kindprozesse kann ein aktuelles Node `node --test --test-isolation=none *.test.cjs` verwenden.

Prüfergebnis, bereits bereinigte Doppelungen und offene Probleme bei XP/Spielregeln: [CODE-REVIEW.md](CODE-REVIEW.md).

## Dauerhafter Spielzustand

Im bestehenden Supabase-Projekt ist die Migration `20260930193420_gameplay_server_state` bereits angewendet. Neue Installationen wenden die Migration aus `supabase/migrations` an. Die Tabelle ist nur für den Server erreichbar; keine Browser-Policies und keine Freigabe an `anon`/`authenticated`.

Render benötigt `SUPABASE_SECRET_KEY` (bevorzugt) oder den bestehenden `SUPABASE_SERVICE_ROLE_KEY` als Server-Umgebungsvariable. **Kein Secret in `app.js`, Git oder den Chat kopieren.** Beim Start wird der letzte Stand geladen; absolute Phasentimer, Locks, Rollen und verbrauchte Fluchten bleiben erhalten. API-Antworten warten auf die Speicherung, parallele Anfragen werden zu einer begrenzten Schreibwarteschlange zusammengeführt. Bei Speicherfehlern wird kein ungespeicherter Erfolg bestätigt. Lokale Entwicklung nutzt `.state/gameplay.json`; alternativ kann `CHS_STATE_FILE` auf einen tatsächlich dauerhaften Datenträger zeigen. Render-Free-Dateien sind keine dauerhafte Ablage.

Eine Serverinstanz beibehalten. Das Snapshot-Verfahren ist keine gemeinsame Spielverwaltung für mehrere Instanzen. Resultate löschen aktive GPS-Daten sofort; aktive Lobbys werden spätestens nach 6 Stunden verworfen. Ergebnisjournale/Meldungen enthalten keine Koordinaten und sind auf 30 Tage und eine begrenzte Anzahl beschränkt. `CHS_ADMIN_USER_IDS` erlaubt ausgewählten authentifizierten Konten die Diagnose-/Meldungseinsicht; Benutzer-Metadaten vergeben keine Adminrechte.

Die produktive Einrichtung des Schlüssels und ein Neustarttest auf Render stehen noch aus. Bis dahin den Gameplay-PR als Entwurf belassen. Regeln und Abgleich beider Anhänge: [GAMEPLAY-ABGLEICH.md](GAMEPLAY-ABGLEICH.md). Die bestehende XP-RPC muss separat auf ausschließlich serverbestätigte Gutschriften umgestellt werden.
