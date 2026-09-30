# Codeprüfung und vorsichtige Bereinigung – 30.09.2026

Die Prüfung umfasst JavaScript, HTML, alle vier Stylesheets, Tests, Manifest und vorhandene SQL-Migrationen. Im Mittelpunkt stehen doppelte Definitionen, überflüssige Ressourcen, Lobby-/Social-Abläufe und Grenzen zwischen Browser, Spielserver und Supabase. Das ist eine statische Prüfung mit gezielten Regressionstests und lokaler Browserprüfung; keine Garantie für Fehlerfreiheit oder ein vollständiger Sicherheitstest mit echten Teilnehmern.

## Bereits bereinigt

- Leeres dynamisches Style-Element in `app.js` entfernt.
- Zweite MapLibre-CSS-Version aus `index.html` entfernt. Karten-JavaScript und Karten-CSS werden zusammen in derselben Version geladen.
- Doppelte Berechtigungs-/Sperrlogik des Lobby-Einstellungsbuttons in `updateLobbySettingsAccess` zusammengeführt. Ein Poll kann den Button während eines laufenden Speicherns nicht mehr freischalten.
- Hintergrundkatalog, erlaubte IDs und Parkpositionen in `lobby-scene.js` gebündelt. Profil und Lobby beziehen die Auswahl aus derselben Liste; der Server akzeptiert nur diese IDs.
- Ein gemeinsamer Social-Poll versorgt Freundesliste und globale Anfragehinweise. Hinweise respektieren Kontowechsel; fehlende Namen verwenden den Spielertag als Ersatz.
- Statischer HTTP-Server liefert nur bekannte Web-Ressourcentypen aus. Tests, SQL-Migrationen, Projektpaket und interne Serverskripte sind darüber nicht mehr abrufbar.
- Profil-Speicherung prüft nach der asynchronen Design-Synchronisierung erneut die Kontoidentität und meldet fehlgeschlagene Cloud-Synchronisierung sichtbar.
- Veraltete Funktionsbehauptungen im README korrigiert.

## Doppelungen und weitere Aufteilung

In den benannten Funktionsdefinitionen wurde keine doppelte Definition innerhalb derselben JavaScript-Datei gefunden. Das schließt ähnliche Logik oder Wiederholungen innerhalb von Callbacks nicht aus. `app.js` bleibt mit rund 3.800 Zeilen der größte Wartungspunkt; Profil, GPS/Session und Lobby sollten später jeweils mit eigenen Regressionstests ausgelagert werden.

Die Stylesheets enthalten zahlreiche wiederholte Selektoren: die einfache Bestandsaufnahme findet 68 in `style.css`, 34 in `premium.css`, 32 in `design-reference.css` und 19 in `crew-lobby.css`. Darunter sind notwendige responsive Regeln und bewusst später geladene Überschreibungen. Eine pauschale Löschung würde die Kaskade verändern. Ebenso referenzieren alte CSS-Regeln noch ältere Fahrzeug-/Hintergrundbilder; diese Dateien sind deshalb nicht als sicher unbenutzt gelöscht worden. Nächster sinnvoller CSS-Schritt: pro Bildschirm die wirksamen Regeln zusammenführen und Desktop/Mobil sowie Dialoge, Chat und aktive Runde vergleichen.

## Bestehende Probleme mit höherer Priorität

1. **XP und Erfolge sind durch Browserangaben manipulierbar.** `chs_claim_game_result` akzeptiert Resultat-ID, Rolle, Sieg, Funde und Überleben direkt aus dem Browser. Die Migration begrenzt Werte und verhindert doppelte Gutschriften derselben ID, bestätigt aber kein serverseitig gespeichertes Rundenergebnis. Die aktuell installierte RPC wurde dazu ausschließlich lesend geprüft. Lösung: ausschließlich vom Spielserver bestätigte Ergebnisse gutschreiben, anschließend RPC/Migration und Replay-/Berechtigungstests gemeinsam ändern.
2. **Escape-Zeit ist noch keine funktionierende Spielregel.** Einstellung und Anzeige existieren, aber der Server liefert `escapeUntil: 0` und bestätigt einen gültigen Fund sofort. Vor einer Änderung muss feststehen, wann die Fluchtphase beginnt und wann ein Fund endgültig gilt; hierfür braucht es eigene Spielregeltests. Das README kennzeichnet die Lücke jetzt.
3. **Karte liefert während der Runde alle gespeicherten Spielerpositionen.** `resultState().map.positions` filtert nicht nach Rolle. Wenn Verstecker geheim bleiben sollen, muss die API gezielt Positionen beschränken; ein bloßes Ausblenden im Browser reicht nicht. Die neu ergänzte Treffpunktanzeige und Route sind auf den Warteraum begrenzt.
4. **Lobbys leben nur im Arbeitsspeicher eines Servers.** Neustarts verlieren sie; mehrere unabhängig laufende Serverinstanzen teilen keinen Zustand. Das ist für eine Alpha möglich, benötigt aber vor Skalierung persistente, gemeinsame Speicherung.

## Neue Funktionen und ihre Grenzen

Ein Spieler steht mittig, zwei stehen gleich groß nebeneinander. Ab drei steht der Host vorne; hintere Reihen bleiben bei ungeraden Teilnehmerzahlen ausgewogen. Bis zu 20 Personen bleiben über Parkreihen und die vollständige Spielerleiste erreichbar.

Drei Designoptionen verwenden zwei vorhandene Bilder: nasses Parkdeck, violett gefärbte Variante desselben Parkdecks und Neon-Halle. Keine neuen Bilder wurden erzeugt. Profilpräferenzen speichern nur Darstellung in Supabase-Auth-Metadaten; Hostberechtigungen kommen weiterhin aus der authentifizierten Spielsitzung. Die Profilwahl gilt für neu erstellte Lobbys, die Lobbywahl für den aktuellen Raum.

Öffentliche Entdeckung und Beitritt sind auf 1 km um den aktuellen Hoststandort beschränkt, unabhängig vom Spielradius. Der Warteraum öffnet Gästen automatisch die Karte mit Treffpunkt am Host. Eine echte Straßenroute wird nur mit frischem GPS berechnet; bei veraltetem GPS oder Routenausfall wird keine erfundene Luftlinie angezeigt.

Routing verwendet standardmäßig den öffentlichen OSRM-Dienst, mit Zeitlimit und Cache pro Teilnehmer. Für einen verlässlich betriebenen Dienst kann `OSRM_BASE_URL` auf einen eigenen oder geeigneten Routingserver zeigen. An den Routendienst gehen Ausgangs- und Zielkoordinaten, keine Kontodaten. API-Format: [offizielle OSRM-Dokumentation](https://project-osrm.org/docs/v26.4.0/http).

Freundschaftshinweise erscheinen während geöffneter App auf allen Seiten und lassen sich annehmen oder ablehnen. Sie sind keine Hintergrund-Pushnachrichten bei geschlossener App.

## Nachweise und verbleibende Live-Prüfung

61 Node-Tests bestehen: bestehende Garage/Spiel/GPS/Rejoin-Fälle sowie Aufstellung für 1–20 Personen, Hostberechtigungen, 1-km-Entdeckung, Hintergrundpräferenzen, Route/Fehlerfälle, Kontoisolation und HTTP-Ressourcenfilter. Der lokale Runner verwendet `node --test --test-isolation=none *.test.cjs`, weil isolierte Kindprozesse hier blockiert sind.

Browserprüfung mit isolierten Testkonten: kleine/größere Lobbys, Profil-Voreinstellung, Hintergrundwechsel bei erhaltener Bereitschaft, globale Anfrage mit sichtbarem Namen/Annehmen, Gastkarte mit Treffpunkt/Straßenroute und Übergang zur aktiven Runde. Die Vorschau und Testkonten liegen außerhalb des Repositorys.

Offen bleibt ein Test mit zwei echten Geräten für GPS, Supabase-Kontosynchronisierung und gegenseitige Benachrichtigungen. In dieser Änderung wurden keine Datenbankmigrationen ausgeführt und keine Produktionsdaten verändert.
