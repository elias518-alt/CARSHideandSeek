# Spielansicht und Belohnungen – Abschlussprüfung

Ausgangsstand: `9351518` (unveränderter Hauptbranch vor diesem Auftrag).

## Änderungen

- Bestehende Karte nimmt in Countdown, Versteck- und Suchphase die volle Bildschirmfläche ein. Bestehende Aktionen und vollständige Spielerliste bleiben darunter erreichbar; die Navigation bleibt erhalten.
- Eigene Rolle erscheint ungefähr drei Sekunden groß, danach oben mittig. Sessionkennung verhindert Wiederholung bei jedem Poll oder Reload; ein Rollenwechsel wird erneut angezeigt.
- Größerer, aus der bestehenden Serverzeit berechneter Countdown einschließlich Fund-/Fluchtphase.
- Untere Spielerübersicht mit Profil-/Fahrzeugbildern, Suchern, Versteckern und getrennten Zuständen für gefunden, ausgeschieden, verlassen und Verbindungsverlust.
- Konkrete GPS-/Verbindungshinweise und Lobby-Startvoraussetzungen.
- Abbruchgrund für alle betroffenen Teilnehmer; persönliche Rundenwerte und gespeicherter Fortschritt im Ergebnis.
- Belohnungsvorschau mit tatsächlichem Freischaltlevel, verbleibenden XP und bestehenden Anlegen-Aktionen. Die bestehende Datenbankprüfung entscheidet weiterhin über Freischaltung und Speicherung.
- Erneut aufrufbare Einführung von Home und Spielansicht. Die bisherige einmalige Regel-Einführung erscheint bereits im Warteraum, damit sie die Rollenanzeige nicht verdeckt.
- Seitensymbol beseitigt den vorher vorhandenen favicon-404.

## Abbruchberechtigungen

`server.js` erlaubt die bestehende Aktion `abort-vote` aktiven, nicht gefundenen, ausgeschiedenen oder ausgetretenen Spielern. Mehr als die Hälfte der aktiven Spieler muss zustimmen. Wiederholte Stimmen zählen nicht mehrfach. Alle Teilnehmer erhalten das gleiche Ergebnis samt Grund. Nur `debugAvailable` und die Rundendiagnose sind administratorabhängig. Diese Berechtigungen wurden nicht erweitert.

## Erhaltung und Prüfung

- 170/170 Node-Tests bestanden: bestehende 165 Tests plus fünf neue Tests. Abgedeckt sind unter anderem Auth-/Account-Sicherheit, Garage/Fahrzeugdaten, Lobby/Ready, Standortlogik, Funde, Rejoin, Host-/Sitzungswechsel, Speicherung und Servervalidierung.
- 47 Browserprüfungen bestanden, keine JavaScript- oder Console-Fehler. Breiten 360, 390, 430 und 1000 px; Karte 844 px hoch, kein horizontaler Seitenüberlauf, Rolle mittig, Timer mindestens 42 px. Chat, sichtbare Lobby-Einstellungen, Rollenwechsel, Spielerstatus, Abbruch, Ergebnis, Belohnungsdialog, Anlegen des Kupferrahmens und Hilfe getestet.
- 54 Prüfungen der unveränderten PostgreSQL-Funktionen bestanden: Rollen, Ranglisten, Einladungen, Kosmetika und Zugriffsschutz.
- Keine Änderung an Server-Endpunkten, Spielregeln, GPS-Zeitplan, Datenbankstruktur oder Migrationen. Bestehende DOM-Knoten und Event Listener werden weiterverwendet.
- Gegen Ausgangsstand geprüft: Änderungen an bestehenden Dateien beschränken sich auf Präsentations-Hooks, Fortschrittsdarstellung, Zeitpunkt des Tutorials und Asset-Verweise. Neue Darstellung ist getrennt ergänzt.

## Grenzen

Browserprüfungen nutzten isolierte Konten und eine lokale PostgreSQL-Testdatenbank; die Karte lud reale Kartendaten mit einem festen Teststandort. Es wurden keine Produktionskonten geändert. Physische Mehrhandy-Runden, echte GPS-Bewegung, OAuth/Registrierung und reale Foto-Uploads wurden in diesem Auftrag nicht erneut Ende-zu-Ende geprüft. Diese offenen Feldtests sind keine behaupteten Test-Erfolge.
