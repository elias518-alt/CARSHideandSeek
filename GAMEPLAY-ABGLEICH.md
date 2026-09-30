# Gemeinsamer Abgleich beider Gameplay-Anhänge

Stand: geprüfte Erweiterung auf Basis des zusammengeführten PR #19. A bezeichnet die 18 Punkte des ersten Anhangs, B die 40 Punkte des zweiten. Die Anhänge bleiben unverändert; diese Liste entfernt Mehrfachanforderungen und trennt vorhandene Grundlagen von Ergänzungen und noch nötiger Einrichtung.

## Vorhanden – wiederverwenden, nicht nochmals bauen

| Anhang | Vorhandener Ablauf | Noch nötige Änderung |
|---|---|---|
| A1, B1/B3/B16/B17/B23 | Mindestens 2 Teilnehmer, automatische Sucherzahl, fünf Phasen, 5-s-Start, geprüfte Einstellungsgrenzen, Sperren nach Start | Checkpoint-Nähe, faire Rollenrotation und weitere Regeln in denselben Ablauf integrieren |
| A9/A13, B21/B22 | Server prüft Rollen, Phase, GPS-Alter/-Genauigkeit/-Sprünge und Funddistanz; Serverzeit | engere Distanz, Messreihen, Geschwindigkeit/Höhe, Verdachtsmarkierungen |
| A14, B24 | lokale Session, Login/Rejoin, laufende Rolle/Position erhalten, Ready-/Fund-Anfragen gegen parallele Klicks geschützt | serverseitige Rejoin-Suche, längeres Ausfallfenster und idempotente Fund-Locks |
| A15/A17, B28 | Hostwechsel beim Verlassen, Timer-/Fund-Rundenende, Rematch mit derselben Lobby | Host-Ausfall, freiwilliges Ausscheiden, andere Endgründe und Rotation |
| A3 | ein GPS-Zeitplan, langsamer in der Lobby als im Spiel | vorhandenen Zeitplan nach Nähe umschalten; kein zweiter Tracker |
| A18 | Ergebnis, XP-Grundlogik, bestehende Supabase-Fortschrittsanzeige | detaillierte Rundenergebnisse; keine neue Monetarisierung/Progression |

## Zusammengeführte Erweiterungen

| Gemeinsamer Punkt | Ursprüngliche Punkte | Umsetzung/Status |
|---|---|---|
| Checkpoint, Startbereitschaft und Presets | A1, B2/B15/B21/B31 | umgesetzt: 50-m-Treffpunkt mit Genauigkeitsgrenze; Host setzt eigenen Standort; Schnell/Normal/Groß/Individuell |
| Sucher am Treffpunkt, Disqualifikation/Ersatz, 30-s-Anhaltefrist | A2, B4/B5 | umgesetzt: wiederholte GPS-Fixes vor Disqualifikation; zufälliger aktiver Ersatz; 30 s plus bestätigter Stillstand; kein Ersatz → klare Endregel |
| Fundnähe 8 m, stabile GPS-Messreihen und Höhe | A4/A5/A9/A12/A13, B22/B23 | umgesetzt: 8 m inklusive Unsicherheit, zeitlich gepaarte Messreihen, Höhenprüfung bei verlässlichen Werten, sonst zusätzliche Bestätigungen |
| 10–15-s-Fund-Lock mit festem Ziel, maximal einmal entkommen | A6/A7, B6–B12 | umgesetzt nach Nutzerantwort: freie Bewegung im Radius; erste Flucht durch mehrere Messungen über 30 m; keine zweite Flucht; Sucher sieht nur sein Ziel und dessen Fahrtspur |
| Fehlversuche, Cooldowns und idempotente Aktionen | A8, B24 | umgesetzt: 5 s, jeder dritte Fehlversuch 30 s, 15 s nach Flucht; gleicher Fund bleibt derselbe Lock; Start/Ready/Abbruch/Rematch idempotent |
| Fahrer-/Beifahrersteuerung und adaptive GPS-Abfragen | A3, B13/B14/B19 | vorhandener Zeitplan erweitert: fern 15 s, unter 150 m 5 s, unter 50 m/Lock 2 s; Fahrer nur bei Stillstand; keine GPS-Abfrage nach Ausscheiden/Ergebnis |
| Radiuswarnung, 120-s-Frist und GPS-Fehler-Toleranz | A10/A11, B9 | umgesetzt: wiederholte Außenpositionen, Warnung, 120 s zur Rückkehr; GPS-Ausfallfrist bei bestehender Verbindung; keine Strafe für einen einzelnen Ausreißer |
| Disconnect, Rejoin, freiwilliges Verlassen, Hostmigration | A14–A17 | umgesetzt: 180 s für Verbindungsverlust, Login findet vorhandene Runde, kein Wiederbeleben nach Ablauf; Verlassen zählt als ausgeschieden; Host-Ausfall überträgt an längsten verbundenen Teilnehmer |
| Positionsschutz während Spiel, Ausscheiden und Ergebnis | B18–B20 | serverseitig umgesetzt: eigene/Teampositionen, Gegner nur beim eigenen Lock; Zuschauer bekommen keine Positionen; Ergebnis löscht GPS und Fahrtspur |
| AFK-Warnung und Bestätigung, Kick vor Start, Mehrheitsabbruch | B25–B27 | umgesetzt: 10 min plus 2 min Frist, Aktivitätsbestätigung, bewegtes GPS erneuert Aktivität; Kick nur im Warteraum, strikte Mehrheit aktiver Teilnehmer für Abbruch |
| Rollenrotation/fairere Zufallsauswahl | B29/B30 | bestehende Rollenfunktion erweitert: weniger Suchereinsätze bevorzugen, dann längere Wartezeit; zufälliger Gleichstand |
| Kurztutorial, Ereignisse, optionale Vibration/Töne | B32–B34 | umgesetzt: einmal pro Konto, sichtbare Ereignisse, freiwilliger Ton/Vibration-Schalter; abhängig von Browser/Gerät |
| Wiederherstellung nach Serverneustart | B35/B36 | implementiert und lokal/mit REST-Testadapter geprüft; geschützte Supabase-Tabelle angelegt. Render-Schlüssel noch prüfen/einrichten. Ohne dauerhaften Speicher sperrt die neue Version auf Render den Rundenstart |
| Melden und Blockieren | B37 | Lobby-Blockierung mit Aufheben, Beitritts-/Einladungsschutz; Meldungen nur von Mitspielern, persistent mit Ereigniskontext. Bestehende Supabase-Freundschafts-/DM-RPCs bleiben ein eigener Social-Ablauf |
| Ereignisjournal, persönliche Ergebnisstatistik, geschützter Debugmodus | A18, B38/B39 | Funde/Finder, Überleben, Fluchten, Fehlversuche, Außenzeit, vorhandene XP-Berechnung; Journal/Ergebnisse bis 30 Tage; Debug/Meldungseinsicht nur für serverseitig konfigurierte Admin-IDs |
| Mehrgeräte- und Fehlerfallprüfung | B40 | 95 Tests: u. a. 2/5/10/20 Teilnehmer, parallele Sucher, Flucht, Ersatz, Ausfälle, Persistenz, Karten-/GPS-Schutz; lokale Browserprüfung. Echte Geräte/GPS/Stockwerke noch vor Live-Runden prüfen |

## Grenzen der Anhänge

Browser-Geolocation kann Fake-GPS nicht zuverlässig beweisen und keine Fahrzeug-Sichtlinie feststellen. Plausibilitätsprüfung und Verdachtsmarkierungen dürfen deshalb nicht als garantierte Fake-GPS-Erkennung bezeichnet werden. Stockwerke sind nur mit ausreichend genauen Höhenwerten unterscheidbar; fehlende/unsichere Werte brauchen strengere Bestätigung.

Wasserflächen-/Gelände-Eignung wird im zweiten Anhang ausdrücklich als spätere Möglichkeit beschrieben. Ohne Gelände- und Nutzungsdaten lässt sich ein Gebiet nicht automatisch als geeignet freigeben; Checkpoint und Radius werden zunächst geometrisch geprüft, die reale Eignung bleibt sichtbar zu beurteilen.

XP, neue Levelsysteme, Ranglisten, Challenges, Cosmetics und Monetarisierung sind ausdrücklich nachgeordnet. Die vorhandene XP-Vertrauensgrenze aus `CODE-REVIEW.md` bleibt ein eigener Punkt; daraus entsteht hier kein zweites Fortschrittssystem.

## Festgelegte Regeln und Betriebsgrenzen

Die 10–15 Sekunden zählen auf dem Server. Verlässt ein Verstecker beim ersten Lock nachweislich den 30-m-Bereich, wird genau eine Flucht verbucht. Ein einzelner GPS-Ausreißer reicht nicht. Im Grenzfall am Ende des Countdowns darf die Bestätigung bis zu 3 Sekunden auf eine weitere Messung warten. GPS-Verlust, unsichere Fahrerbewegung und Ausscheiden brechen einen Lock ab; eine technische Unterbrechung gilt nicht automatisch als Flucht oder Betrugsbeweis.

B37 wurde als Lobby-Blockierung und Meldeweg umgesetzt. Ein automatisches Sanktionssystem und eine umfassende Sperre bestehender Supabase-Direktnachrichten/Freundschafts-RPCs sind separate Social-/Moderationsarbeit. Die vorhandenen Abläufe wurden nicht dupliziert.

Der Render-Dienst hat eine Instanz. Der Snapshot-Speicher stellt Neustarts wieder her, verteilt aber keinen gleichzeitigen Spielzustand zwischen mehreren Servern. Vor Skalierung ist eine gemeinsame transaktionale Spielverwaltung nötig. Aktive Lobbydaten einschließlich GPS werden spätestens nach 6 Stunden verworfen; bei Rundenschluss sofort. Journale/Statistiken enthalten keine Koordinaten. Meldungen/Journale werden bis 30 Tage und mit begrenzter Anzahl gespeichert.

Die Migration `20260930193420_gameplay_server_state` ist im bestehenden Supabase-Projekt angewendet. Verifiziert: RLS aktiv; `anon` und `authenticated` haben keinen Tabellenzugriff; `service_role` hat die benötigten Serverrechte. Der Supabase-Advisor meldet dafür erwartungsgemäß „RLS Enabled No Policy“ als Information: Es gibt bewusst keine Browserfreigabe. [Supabase-Linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Noch erforderlich für Render: vorhandenen `SUPABASE_SECRET_KEY` oder `SUPABASE_SERVICE_ROLE_KEY` prüfen und gegebenenfalls serverseitig setzen. Der Browser ist dort aktuell nicht angemeldet; die Render-Schnittstelle kann Variablen schreiben, aber keine vorhandenen Werte/Variablennamen lesen. Die produktive Wiederherstellung ist daher noch nicht bestätigt.
