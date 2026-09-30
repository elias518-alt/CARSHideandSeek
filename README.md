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
- Host + Host-Wechsel
- konfigurierbarer Radius, Spielzeit, Headstart, Escape-Zeit
- GPS-Streaming über Browser-Geolocation
- Startpunkt setzen
- Countdown, Headstart, ACTIVE, RESULT
- automatische Rollenverteilung
- Näherungsstufen
- Escape-Einstellung und Anzeige vorhanden; die Fluchtphase wird serverseitig noch nicht angewendet
- Fundversuch mit serverseitiger GPS-/Accuracy-/Freshness-/Plausibilitätsprüfung
- gestaffelter Fehlversuch-Cooldown
- Ergebnis + XP/Level-Grundlogik
- Reconnect über lokale Session
- Rematch
- Fahrer-Modus-Warnung

## Noch NICHT produktiv angebunden
Apple/Google Login, Hintergrund-Push bei geschlossener App, Moderations-Backend, Payments/PLUS, Ads, vollständige Fahrzeug-/3D-Bibliothek und App-Store-Signing sind nicht implementiert. Lobbys leben im Arbeitsspeicher des Spielservers; ein Neustart verliert sie. Supabase-Kontodaten bleiben separat gespeichert.

## Konfiguration und Prüfung

`SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY` können am Spielserver gesetzt werden. Die Browserkonfiguration steht am Anfang von `app.js`; nur veröffentlichbare Schlüssel gehören dort hinein. Das Supabase-Projekt benötigt die verwendeten Tabellen/RPCs. Ergänzende Migrationen stehen unter `supabase/migrations`.

`REMOVE_BG_API_KEY` aktiviert optional die Fahrzeugfreistellung über remove.bg. Bestehende Vorlagen benötigen das nicht.

Straßenrouten verwenden standardmäßig `https://router.project-osrm.org`; `OSRM_BASE_URL` kann einen eigenen Routingserver wählen. Für regelmäßigen Produktivbetrieb ist ein geeigneter Routingdienst erforderlich. Bei fehlendem GPS oder Routenausfall zeigt die Karte einen Hinweis und den verfügbaren Treffpunkt.

`npm test` führt die Node-Tests aus. In Umgebungen ohne erlaubte Kindprozesse kann ein aktuelles Node `node --test --test-isolation=none *.test.cjs` verwenden.

Prüfergebnis, bereits bereinigte Doppelungen und offene Probleme bei XP/Spielregeln: [CODE-REVIEW.md](CODE-REVIEW.md).
