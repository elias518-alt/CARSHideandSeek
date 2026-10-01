# Schritt 3 · Ansichten und private Benachrichtigungen

Stand: 1. Oktober 2026. Die acht Ansichten der erneut angehängten Referenz dienen als Kompositionsvorlage. Die zuvor festgelegten orangefarbenen Aktionen bleiben erhalten; Bereitschaft und Aktivität werden grün dargestellt.

## Private Chats und Anfragen

- Die Crew-Taste unten und die Benachrichtigungstaste auf Start zeigen die Summe aus empfangenen ungelesenen Privatnachrichten und eingehenden Freundschaftsanfragen. Freundes-/Anfrage-Tabs und einzelne Chat-Tasten haben eigene Zähler; ab 100 steht `99+`.
- Lesestände sind kontogebunden in Supabase gespeichert. Eine Nachricht gilt erst bei geöffnetem, sichtbarem Chat am Nachrichtenende als gelesen. Der Server leitet den Cursor aus einer tatsächlich an das angemeldete Konto gerichteten Nachricht ab. Später eintreffende Nachrichten bleiben ungelesen. Ein anderer Account oder eine gesperrte Sitzung kann den Cursor nicht übernehmen.
- Aktualisierung bei sichtbarer App alle vier Sekunden und bei Rückkehr zur App. Ausgehende Anfragen und eigene gesendete Nachrichten erhöhen den Zähler nicht.
- Freundesliste, Suche, Anfragen, Chat-Kopf, Crew, Lobby-Einladung und Ergebnisübersicht zeigen das vorhandene Profilfoto mit deutlich sichtbarem Namen. Ohne Foto erscheinen Initialen. Namen, IDs und Bildquellen werden weiterhin geschützt eingesetzt.
- Eingehende Anfragen stehen als normale Karten auf Start. Sie schweben nicht mehr über der Freundesliste. Unveränderte Listen werden beim Polling nicht ersetzt.

## Ansichten nach Vorlage

1. **Start:** persönliche Begrüßung, eigenes Fahrzeug und bestehender Charakter auf dem Parkdeck, Benachrichtigungskarten, echte Crew und Beitritts-/Erstellungszugang. Vier untere Tabs: Start, Garage, Crew, Profil.
2. **Wartelobby:** Host vorn, weitere Fahrzeuge in zwei versetzten Reihen, Name und Profilfoto über jedem Fahrzeug, Teilnehmer-/Bereitschaftsleiste. Größere Lobbys bleiben seitlich navigierbar. Die Starttaste wartet auf Bereitschaft, Verbindung und Standort aller Mitspieler; der Server prüft unverändert zusätzlich GPS-Alter, Genauigkeit und Treffpunktentfernung.
3. **Versteckphase:** lesbarer Countdown und Rollenanzeige, bestehende echte Spielkarte und rollenabhängiger Hinweis. Sucher warten sicher und beobachten keine Verstecker. Es wird keine zusätzliche, funktionslose „Bereit versteckt“-Aktion eingebaut.
4. **Aktive Runde:** echte Karte vor Fundauswahl und kompakter Teilnehmerliste. Fahrer-, GPS-, Flucht-, Ersatzsucher- und Ausscheidungshinweise sowie servergeprüfte Fundfunktionen bleiben erhalten.
5. **Garage:** Fahrzeugansicht auf dem Parkdeck; bestehende Fahrzeugauswahl, Farbe, eigenes Foto und Speicherung bleiben verbunden.
6. **Eigenes Foto:** Hinweis zur Aufnahme schräg von vorn und Vorschau des tatsächlich gewählten Fahrzeugbilds neben dem bestehenden Charakter auf dem Parkdeck. Wiederholtes Auswählen nach Entfernen funktioniert ebenfalls.
7. **Profil und Crew:** vorhandenes Profilfoto, Name, Fahrzeug, XP, echte Kontostatistik, Crew und bestehende Erfolge/Kontofunktionen.
8. **Ergebnis:** Parkdeck mit eigenem Fahrzeug/Charakter, tatsächlicher Sieger, serverseitiger XP-Wert und Teilnehmerübersicht mit Profilfoto, Name und Ausgang. Detaillierte Fund-/Überlebensauswertung, Ereignisse und autorisierte Revanche bleiben erhalten.

Die vorhandenen NoEdge-Charaktere und markenneutralen Fahrzeugvorlagen werden weiterverwendet. Eigene Fahrzeugfotos werden bevorzugt. Das ist keine identische Nachbildung der BMW-Modelle oder Personenposen im Referenzbild; ohne eigenes Foto bleibt das Fahrzeug eine ausdrücklich markenneutrale Vorlage mit angenäherter Farbe.

## Prüfung

- `npm test`: 157 erfolgreiche Tests; bestehende Spiel-, GPS-, Recovery-, Moderations- und Rechteprüfungen sowie Zähler/Identität/Escaping.
- `scripts/reference-ui-qa.mjs`: 105 Browserprüfungen auf 360/390/430/1000 Pixeln, einschließlich Start, Chats, Profil, Garage, Wartelobbys mit 2/5/10 Spielern, Versteckphase für beide Rollen, aktive Runde, Ergebnis und wiederholte Foto-Vorschau. Tatsächlicher Frontend-Code; Anmeldung, RPCs und Spiel-API sind lokale Fixtures. Keine echten Nachrichten versendet.
- `scripts/social-sql-qa.mjs`: 13 Prüfungen der tatsächlichen Migration mit PGlite 0.5.8, einschließlich Teil-Lesestand, monotonem Cursor, neuen Nachrichten nach dem Lesen, fremdem Konto, Sperre und Tabellenrechten.
- Migration `20261001121528_social_notifications_avatars.sql` in Supabase angewendet. RLS aktiv, keine direkten Tabellenleserechte für `anon`/`authenticated`, Lese-RPC anonym gesperrt. Öffentliche Wrapper verwenden SECURITY INVOKER; die accountgeprüften Kerne liegen im privaten Schema. Die bekannten, bestehenden Advisor-Hinweise aus Schritt 2 bleiben separat dokumentiert.

Browserprüfung reproduzieren: Playwright lokal bereitstellen und `node scripts/reference-ui-qa.mjs` aufrufen. Optional `CHS_QA_PLAYWRIGHT` als Modulpfad, `CHS_QA_CHROMIUM` als Chromium-Pfad und `CHS_QA_OUTPUT` als Screenshot-Ziel setzen. SQL-Prüfung: `node scripts/social-sql-qa.mjs supabase/migrations/20261001121528_social_notifications_avatars.sql`, optional den PGlite-Modulpfad als drittes Argument.

Die Browser-Fixtures bestätigen Layout und Zustandswechsel, keine echten GPS-Runden. Externe Kartenbibliothek/Kartenkacheln waren in dieser Testumgebung nicht erreichbar und werden durch diese Prüfung nicht als funktionsfähig bestätigt. Bestehende Kartenlogik und Radiusprüfungen sind unverändert. Die physische Abnahme mit 2/5/10 Geräten aus `MEHRGERAETE-ABNAHME.md` steht weiterhin aus. Rechtsfreigabe und normaler Kontozugang behalten ihre bestehenden Regeln.
