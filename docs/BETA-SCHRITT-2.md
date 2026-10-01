# Schritt 2 · Moderation und technische Beta

Stand: 1. Oktober 2026. Technische Umsetzung und lokale Prüfungen abgeschlossen; reale Mehrgerätetests stehen aus. Keine zugesicherte Produktionsreife. Die Rechtsfreigabe bleibt erhalten; während der Entwicklung kann ausschließlich das konfigurierte Betreiberkonto die bestehende Entwickler-Vorschau verwenden.

## Umsetzung

- Persistente Meldungen mit Kategorie, freiwilligem Kommentar und Status offen/in Prüfung/erledigt/zurückgewiesen. Bearbeitung mit unverändertem Datenbank-Revisionswert verhindert Überschreiben paralleler Prüfungen. Gleichzeitige Meldungen eines Konto-Paars werden serverseitig zusammengefasst.
- Persistente, beidseitig wirksame Blockierungen verhindern Beitritt und Wiederbeitritt; bis 200 Einträge je Konto. Gleichzeitiges Blockieren/Entblockieren wird je Konto geordnet. Alte gültige Blockierungen und Meldungen werden aus dem Wiederherstellungsspeicher übernommen. Host-Kick und freiwilliges Verlassen bleiben erhalten.
- Rollen ausschließlich aus Server-Konfiguration und geschützter Datenbank: Spieler ohne Verwaltungsrechte; Moderatoren bearbeiten Meldungen; Administratoren zusätzlich Konten/Sperren/Lobbys/Auswertung/Protokoll; Superadministratoren zusätzlich Rollen. Selbständerungen und Sperren von Superadministratoren sind ausgeschlossen. Keine Rollen aus Nutzer-Metadaten.
- Sperren mit Ablauf, Dauerhaftigkeit und begründeter Aufhebung. Kritische Aktionen prüfen Sperren frisch. Standort-/Statusanfragen nutzen höchstens zwei Sekunden alten Kontostatus; Sperren aus dieser Verwaltungsoberfläche entwerten den Cache unmittelbar.
- Audit für Sperren, Aufhebung, Rollenänderung, Meldungsbearbeitung und Lobby-Schließung. Datenbank verhindert nachträgliches Umschreiben; Kontolöschung darf Identifikatoren anonymisieren. Schließung erfordert konkreten Erstellungszeitpunkt, Begründung und Bestätigung; laufende Runden enden ohne XP.
- Verwaltung zeigt UUID, Konto-/Rundendaten, Verbindungszeitpunkte und freiwillige grobe Region. Keine E-Mail-Adressen, Koordinaten oder privaten Nachrichten. Regionssummen erst ab drei Konten. Kein Reverse-Geocoding und kein GPS-Verlauf für Auswertung.
- Echte registrierte Konten, tägliche/wöchentliche/monatliche Aktivität, erfasste Runden insgesamt/heute, laufende Runden, öffentliche/private Wartelobbys, verbundene Teilnehmer, durchschnittliche Spielerzahl/Dauer, offene Meldungen und aggregierte Betriebszähler. Keine rückwirkend erfundenen Messwerte. Aktivität wird durch Nutzung der Spiel-API erfasst, nicht bloß durch eine geöffnete Anmeldung.
- Runden werden atomar mit Teilnehmerstatistiken und unveränderlicher Ergebnis-ID erfasst. Wiederholung schreibt keine zweite Runde. Gelöschte Konten verhindern die Erfassung verbleibender Teilnehmer nicht. Persönliche Rollen-/Überlebensstatistik wird in SQL aggregiert und unterliegt keiner REST-Zeilenbegrenzung. Bestehende XP-/Level-/Siegeswerte und serverbestätigte Belohnungen bleiben erhalten.
- Betriebszähler für API/Auth/GPS/Disconnect/Rejoin/Backend sowie bereinigte Frontend-Fehler. Keine Fehlermeldungstexte, Token, URLs, Positionsdaten oder vollständigen Stacks in der neuen Fehlererfassung. Kein WebSocket: Die App nutzt HTTP-Polling. Client-Fehler sind selbst gemeldet, keine unabhängige Gerätebeobachtung.
- Einführung mit elf Regeln, Standardradius 500 m, Verbot von Garagen/Parkhäusern und sicherem Warten ohne Beobachten. Bestätigung wird versioniert gespeichert und ist auch serverseitig Voraussetzung für die Spiel-API; Abmeldung/Verlassen bleiben möglich. Region ist freiwillig.
- Ergebnistabelle ergänzt den Finder beziehungsweise Überlebensstatus. Bestehende Rematch-/Verlassen-Aktionen bleiben; administrativ geschlossene Runden können kein Rematch starten.

## Aufbewahrung

Positionshaltiger Snapshot läuft sechs Stunden nach letzter Speicherung ab. Eine Datenbankaufgabe `chs-beta-retention` läuft alle zehn Minuten unabhängig von Render und leert abgelaufene Lobbys. Ausgeschiedene und beendete Spieler verlieren ihre aktuelle Position und Fix-Proben bereits im Spielserver. Keine freie Standort-Historie. Anbieter-Backups sind vor öffentlicher Freigabe gesondert zu klären.

Aktivität/Fehlerzählungen: 30 Tage. Erledigte Meldungen: 30 Tage nach Bearbeitung; übrige maximal 90 Tage. Audit: 90 Tage. Rollen, freiwillige Region, Blockierungen und persönliche Statistik werden bei Kontolöschung entfernt. Der Snapshot enthält maximal 1.000 jüngere Rundenergebnisse; der Datenbank-Rundenzähler ist dauerhaft. Kurze Betriebszähler werden in begrenzten Arbeitsspeicher-Batches gepuffert und können bei hartem Absturz vor dem Flush verloren gehen. Eine ausgefallene Datenbank verhindert kritische Moderationsbestätigungen, statt Erfolg vorzutäuschen.

## Nachgewiesene Prüfungen

- `npm test`: 155 Tests, alle erfolgreich; bestehende Spiel-/Recovery-/Fahrersicherheitsprüfungen plus Rechte-Matrix, Eingabegrenzen, doppelte gleichzeitige Meldungen, blockierter Wiederbeitritt, Revisionswerte, SQL-Aggregation, idempotente Fehler-Batches und gesperrte Server-Dateien.
- Lokales PostgreSQL/WASM (PGlite 0.5.8): 13 Prüfungen, einschließlich Datenbankrechte, auditierter Rollenänderung, Selbstschutz, konkurrierender Meldungsbearbeitung, unveränderlichem Audit, GPS-Aufbewahrung, idempotenter Runde und gelöschtem Teilnehmer. Cron wird dort nicht simuliert; die echte Supabase-Aufgabe ist separat als aktiv und mit Zehn-Minuten-Intervall geprüft.
- Chromium: 16 Prüfungen auf 360/390/430/1000 Pixeln. Neue Onboarding-/Moderationsdialoge, eingeschränkte Moderator-Tabs, Text-Injektion und Erhalt des Mikrosekunden-Revisionswerts. API und Anmeldung simuliert; kein echter Google-Anmeldetest.
- Echtes Supabase-Schema: alle neun neuen Tabellen mit RLS, keine direkten Browser-Leserechte; Verwaltungs-/Aufbewahrungs-RPCs für `authenticated` nicht ausführbar. Gateway Version 3 mit eigener Server-Authentifizierung; keine Browser- oder Secret-Schlüssel im Client ergänzt.
- Sicherheitsadvisor: serverprivate Tabellen ohne Browser-Policy sind beabsichtigt gesperrt. Bestehende bewusst authentifiziert aufrufbare SECURITY-DEFINER-Spiel-/Social-RPCs und deaktivierter Schutz gegen geleakte Passwörter bleiben separat vor Produktionsfreigabe zu prüfen: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable und https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

### Lokaler HTTP-Lasttest

Supabase/Auth deterministisch simuliert, keine Last auf Live-Diensten. Wartelobbys mit zehn Teilnehmern, je drei Zyklen Status und Standort, bis 50 gleichzeitig gestartete HTTP-Anfragen. Warme Auth-/Kontocaches zwischen Stufen. Snapshot-Schreiber und aktive Fund-/Spielphasen sind nicht Bestandteil dieser Messung. Zahlen belegen ausschließlich diesen lokalen API-Test.

| Teilnehmer | Anfragen | p95 | RSS | CPU-Zeit | Fehler |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 | 300 | 95 ms | 86 MB | 431 ms | 0 |
| 100 | 600 | 64 ms | 129 MB | 552 ms | 0 |
| 500 | 3.000 | 29 ms | 235 MB | 1.267 ms | 0 |
| 1.000 | 6.000 | 34 ms | 270 MB | 3.478 ms | 0 |

Backend-Fixture-Abfragen und -Schreibzahlen sowie Dauer: `docs/qa/beta-load-2026-10-01.json`. Keine Messung realer Supabase-Latenz, CPU/RAM auf Render, Geräte-GPS, Akku, Temperatur oder Produktionskapazität.

Reproduktion: `node scripts/beta-load.cjs /tmp/chs-beta-load.json`. SQL-Prüfung optional nach `npm install --prefix /tmp/chs-sql-qa @electric-sql/pglite@0.5.8`: `node scripts/moderation-sql-qa.mjs supabase/migrations/20261001112512_moderation_roles_beta.sql /tmp/chs-sql-qa/node_modules/@electric-sql/pglite/dist/index.js`.

## Noch vor der echten Beta-Abnahme

Für jede Größe 2, 5 und 10 echte Geräte: Google-Anmeldung, Profil/Fahrzeug, Lobby/Einladung, Treffpunkt/GPS, Bereitschaft, Start/Vorsprung, Nähe/Fund/Flucht, Radius und zweiminütige Frist, Ende/XP/Rematch/Verlassen. Danach Netzwerkverlust, Browser-Hintergrund, GPS-Entzug, Gerätewechsel, Server-Neustart, Host-Verlassen, Meldung/Blockierung/Sperre. Ergebnisse mit Geräten, Zeit und Abweichungen in `docs/MEHRGERAETE-ABNAHME.md` festhalten. Nicht auf öffentlichen Straßen während des Fahrens testen.

Schritt 3: präzise Designumsetzung nach technischer Abnahme. Das erneut erwähnte Lobby-Referenzbild ist im wiederhergestellten Arbeitsordner nicht vorhanden; für eine verlässliche Umsetzung muss es erneut angehängt werden. Die vorhandene Lobby- und Charakterdarstellung wurde in Schritt 2 nicht neu gestaltet.
