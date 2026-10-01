# CAR HIDE & SEEK – Playable Alpha 0.5

## Kleiderschrank, Kontosperren und Zustimmung

Der Profilbereich enthält einen Kleiderschrank mit den bisherigen drei Figuren und sechs zusätzlichen frei lizenzierten Quaternius-Figuren. Frisur, Oberteil, Hose/Rock und Schuhe lassen sich innerhalb der jeweiligen Körpergruppe kombinieren; ein Anhänger ist optional. Die Auswahl wird im Supabase-Konto gespeichert und im Warteraum dargestellt. Quellen, Lizenzen und Reproduktion: [THIRD-PARTY-ASSETS.md](THIRD-PARTY-ASSETS.md).

Adminrechte stammen ausschließlich aus der Servervariable `CHS_ADMIN_USER_IDS` (kommagetrennte Auth-Konto-UUIDs). Die Administration zeigt Spieler, Meldungen und ein Moderationsprotokoll. Zeitlich begrenzte oder dauerhafte Sperren und ihre Aufhebung benötigen eine Begründung. Freigeschaltete Admins können nicht über diese Oberfläche gesperrt werden. E-Mails, private Nachrichten und genaue Spielerpositionen werden dort nicht angezeigt. Eine Sperre beendet die Teilnahme an den vom Server verwalteten Lobbys und sperrt den direkten Datenbankzugriff über bestehende RLS-Policies und Social-RPCs. Die Zustimmungsschranke schützt Spielserver-Aktionen; sie ersetzt keine vollständig konsolidierte Zugriffsschicht für alle bisherigen Profil-/Social-RPCs.

Neue Datenbankmigrationen: `20261001062228_wardrobe_admin_legal.sql` und `20261001063042_restrict_signup_trigger_rpc.sql`. Sie wurden im bestehenden Projekt angewendet; die Dateinamen entsprechen den zurückgelesenen Remote-Versionen. Nicht erneut anwenden. Bans, versionierte Zustimmungen und Moderationsprotokoll sind nur mit dem Server-Schlüssel erreichbar. Benutzer-Metadaten können keine Adminrechte vergeben. Das Entfernen der öffentlichen EXECUTE-Rechte vom bestehenden Signup-Trigger lässt dessen Triggerbindung bestehen.

Vor Veröffentlichung des App-Updates am Server konfigurieren:

- `SUPABASE_SECRET_KEY` oder `SUPABASE_SERVICE_ROLE_KEY`: vorhandener Supabase-Server-Schlüssel, ausschließlich als Secret.
- `CHS_ADMIN_USER_IDS`: überprüfte Auth-UUID des Entwicklerkontos; nicht E-Mail-Adresse oder Profilname.
- `CHS_OPERATOR_NAME`, `CHS_OPERATOR_ADDRESS`, `CHS_OPERATOR_EMAIL`: echte Anbieter- und Kontaktangaben, einschließlich ladungsfähiger Anschrift.
- `CHS_LEGAL_REVIEWED=true`: erst nach Prüfung der Texte und tatsächlichen Datenverarbeitung setzen.

`/legal/terms`, `/legal/privacy` und `/legal/imprint` sind öffentlich erreichbar. Ohne vollständige Angaben und Freigabemarker zeigt die App den Entwurfsstatus und lässt neue Spielaktionen nicht zu. Nutzungsbedingungen, Sicherheitsregeln, Volljährigkeit und Kenntnisnahme der Datenschutzhinweise werden getrennt und ohne vorausgewählte Häkchen bestätigt. Der Server speichert Textstand, Hash und Zeitpunkt. Geänderte Texte erfordern eine erneute Bestätigung. Die Datenschutz-Kenntnisnahme ist keine pauschale Einwilligung.

Die Rechtstexte sind ein prüfbedürftiger Entwurf für den beschriebenen kostenlosen Betrieb, keine Garantie vollständiger Haftungsfreiheit. Anbieteranschrift, Auftragsverarbeitungsverträge, Hostingregionen, Drittlandübermittlungen und tatsächliche Backupfristen müssen vor Freigabe geklärt werden. PLUS/Payments/Ads benötigen eigene Umsetzung und passende Texte. Eine Kontrollbox macht die Bedienung am Steuer nicht zulässig. Bestehende XP-RPCs benötigen weiterhin eine separate Absicherung gegen selbst behauptete Spielergebnisse.

Prüfstand dieser Erweiterung: Node-Tests einschließlich HTTP-Autorisierung, gefälschter Admin-Metadaten, Rechtsstand-Hash, Sperren trotz bestehenden Tokens und Zugriffsausfall; Datenbankprüfung für gesperrte und normale Konten, Signup-Triggerbindung und Browserprivilegien. Smartphone-Reconnect und vollständige Browserbedienung müssen vor Veröffentlichung zusätzlich geprüft werden. Diesen PR bis zu diesen Prüfungen und der Serverkonfiguration als Entwurf belassen.

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
