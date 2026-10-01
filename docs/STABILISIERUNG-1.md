# Schritt 1 – technische Stabilisierung, 1. Oktober 2026

Ausgangspunkt: veröffentlichter Stand aus PR 24, lokal gesichert durch Commit 140990d. Änderungen auf eigener Branch. Bestehende 111 Tests vor Änderungen bestanden.

## Änderungen

- Standardradius 500 m in Frontend und Server. Auswahl 50 m, 100–10.000 m in 100-m-Schritten, zusätzlich bestehender Wert 750 m; „Eigener Radius“ und „Radius eingeben“ für ganze Meter. Server lehnt falsche Typen, Null, Dezimalzahlen und Werte außerhalb 50–10.000 m ab.
- Aktive GPS-Abfrage: fern 10 s mit reduzierter Genauigkeit, mittel 4 s, unmittelbare Nähe/Fund 1 s. Ergebnis und ausgeschiedene Spieler stoppen die Abfrage. Bestehende MapLibre-Objekte und Radius-Geometrie bleiben wiederverwendet.
- Standort und Polling schreiben nicht mehr pro Request in die Datenbank. Ein gemeinsamer Checkpoint alle 2 s enthält den letzten vollständigen Stand. Kritische POST-Aktionen wie Start, Einstellungen, Fund und Verlassen warten weiterhin auf Speicherung. Bei hartem Prozessabbruch können die letzten bis zu 2 s der Telemetrie fehlen; Rollen, Phasen und feste Fristen bleiben erhalten. Speicherfehler werden protokolliert und erneut versucht.
- GPS-Typen und Messzeit strenger geprüft. Bestehende Prüfungen für Aktualität, Genauigkeit, Sprünge, stabilen Fundkontakt und zwei unabhängige Radiusüberschreitungen bleiben erhalten. Keine automatische Parkhauserkennung oder Parkhaus-Disqualifikation ergänzt.
- Serverseitige Limits für Standort-, Fund-, Chat-, Lobby-, Einladungs- und Moderationsanfragen. Bereit-Status nur als Boolean. Blockieren und Melden verwenden jetzt die bereits vom Frontend gesendeten POST-Anfragen; der bisherige GET-Zwang war ein Fehler.
- Bewegte Fahrer können Chat und komplexe Lobbyaktionen nicht ausführen. Ein Wechsel zum Beifahrermodus durch Rejoin setzt bestätigten Stillstand voraus; fehlender Modus setzt einen Fahrer nicht mehr versehentlich auf Beifahrer. Menüs bleiben während der Fahrersperre geschlossen. Eine tatsächliche Fahrertätigkeit kann die App nicht physisch feststellen.
- Ausdrücklich bestätigte Sucherregel: sicher abseits warten und nicht beobachten. Wartebereich bleibt serverseitig überwacht; Gegnerpositionen und jetzt auch Näherungshinweise bleiben in der Versteckphase verborgen. Blickrichtung und tatsächliches Beobachten sind keine per GPS beweisbaren Zustände.
- Verbot mehrstöckiger Parkhäuser in Regeln und Lobbyinfos, Wortlaut aus Anhang übernommen.
- Sicherheitslücke geschlossen: direkte Profiländerungen an XP, Level, Gewinnen und Runden sind gesperrt. Die bestehende Ergebnis-RPC benötigt jetzt eine unveränderliche Bestätigung vom Spielserver. Serverbestätigung enthält die authentifizierte Konto-ID und echte Rundendaten. Wiederholte Gutschriften bleiben idempotent; kosmetische Profil-/Fahrzeugänderungen bleiben erlaubt.

## Datenbank und Bereitstellung

Migration `20261001105143_server_verified_results.sql` angewendet. Gateway Version 2 erlaubt zusätzlich ausschließlich unveränderliche Ergebnisbestätigungen. Öffentliche Browserkonten haben keine Schreibrechte auf Bestätigungen oder Moderationstabellen. Supabase-Changelog und aktuelle RLS-/RPC-Rechte wurden geprüft.

## Verifikation

- 118 Node-Tests bestanden, einschließlich bestehender 2/5/10/20-Teilnehmer-Simulationen, Fund-Cooldowns, Rejoin, Hostmigration, Neustart, Fahrzeug-/Charakter-Synchronisation und Berechtigungen.
- Neue Tests: Radiusstandard und eigene Werte bei mehreren Spielern, Rejoin, Hostwechsel und Recovery; ungültige Radien; Erstellungs-Spam; gedrosselte Checkpoints; keine Gegnernähe in Versteckphase; Fahrersperre und Moduswechsel; idempotente Bestätigung mit serverseitiger Konto-ID.
- Echte PostgreSQL-Prüfung innerhalb vollständig zurückgerollter Transaktion: erfundene und veränderte Ergebnisse abgelehnt; bestätigtes Ergebnis akzeptiert; zweiter Claim zahlt nicht erneut. Direkte XP-/Level- und Bestätigungsschreibrechte sowie TRUNCATE-Recht negativ geprüft; Fahrzeugauswahlrecht positiv geprüft.
- Chromium mit 390×844 Pixeln: echte Frontend-Dateien geladen, Radiusoptionen, ausgeblendetes Zahlenfeld, eigener 350-m-Wert und Laden der Lobby-Einstellungen geprüft; keine JavaScript-Seitenfehler. Anmeldung für diese Formularprüfung lokal simuliert; kein echter Google-/Zweikonten-Gerätetest behauptet.
- Syntax- und Diff-Prüfung bestanden.

## Status und nächste Phase

Technische Änderungen aus Schritt 1 umgesetzt und automatisiert geprüft. Echte GPS-Bewegung, Akku-/Wärmemessung, Gerätewechsel und Mehrgerätetests vor Ort sind aus dieser Umgebung nicht durchgeführt. Diese Validierung gehört in die Beta-Prüfung von Schritt 2; sie ist keine zugesicherte Produktionsreife.

Schritt 2: persistente Moderation mit Bearbeitungsstatus, getrennte Rollen und Adminrechte, echte aggregierte Kennzahlen, Audit, datensparsame Aufbewahrung, Onboarding, Lastprüfung und reale Mehrgerätetests. Schritt 3 startet gemäß Auftrag erst nach dieser technischen Prüfung.
