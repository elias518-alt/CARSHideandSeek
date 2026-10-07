# Crew / Progression – Ausgangsstand und Regressionen

Basis 8e5daba374147efbb61326320ecebd3bb280a5fa (GitHub main, 07.10.2026).
Sauberes Arbeitsverzeichnis; bestehende Node-Suite: 165/165 bestanden.

Bestehende Pfade: app.js verwaltet Auth, Garage, Profile, lokale Session chs, Spielzustand, GPS, Polling und Rejoin. server.js validiert Lobby-/Spielaktionen; round-engine.js setzt Spielregeln um. social.js verwendet authentifizierte Supabase-RPCs für Freunde, Chat, Nachrichten-Badges und Lobby-Einladungen. account-ui.js prüft Zugriff, Einwilligung und Onboarding. Profile, Fahrzeuge, Resultate und Freunde sind persistent; XP werden ausschließlich durch serverbestätigte Resultate vergeben. Level = min(50, floor(Gesamt-XP / 1000) + 1).

Erweiterungsstrategie: eigene Crew-Tabellen/RPCs und neue UI-Module; vorhandene Freunde-/Chat-Oberfläche bleibt vollständig erreichbar. Bestehende Spielendpunkte, IDs, Listener und lokale Session bleiben bestehen. Kein Zurücksetzen von Profilen, XP, Fahrzeugen, Freundschaften oder Lobbys.

Bilddiagnose: assets/lobby-rooftop-violet.webp ist 540x304 Pixel bei 6.754 Bytes und wird als großflächiges Hintergrundbild skaliert. Wet/Garage sind 1672x941. Das kleine Violet-Asset wird durch eine neue hochauflösende Szene ergänzt/ersetzt; keine künstliche Weichzeichnung.

## Abschlussprüfung am 07.10.2026

Alle 167 bestehenden HTML-IDs sind weiterhin vorhanden. In app.js wurden nur zwei optionale UI-Hooks ergänzt. Keine bestehenden Listener oder Spielendpunkte wurden entfernt. server.js, round-engine.js, server-backend.js, state-store.js, account-service.js, account-ui.js, gameplay-ui.js, map.js, garage-actions.js und wardrobe.js sind gegenüber der Basis inhaltlich unverändert. Die bestehende Freunde-Seite ist über „Freunde & Chats“ erreichbar, inklusive Nachrichten-Badges.

| Bereich | Prüfung und Ergebnis |
| --- | --- |
| Bestehende Server-/Spielregeln | 165/165 unveränderte Node-Tests bestanden, darunter Join/Rejoin, Host-Wechsel, Start, Standortvalidierung, Einstellungen, Sperren, Ergebnis-Validierung und Wiederherstellung nach Neustart. |
| Neue Crew-/Level-Funktionen | 54/54 Prüfungen der tatsächlichen SQL-Migration in isoliertem PostgreSQL/PGlite bestanden: Mitgliedschaft, 50er-Limit, alle vier Rollen, Rechteeskalation, Crew-Leitungswechsel, Anfragen, Einladungen, Blockierungen, Ranglisten, echte Ergebnisstatistiken, gesperrte Cosmetics und direkte Tabellenzugriffe. |
| Profil-/Fahrzeug-Fallback | 11/11 bestehende SQL-Integrationstests bestanden; Profilbild vor aktivem eigenem Fahrzeug, anschließend neutraler Fallback. Keine private Garagenliste wird offengelegt. |
| Home / Navigation | Start, Garage, Profil, Crew, Freunde erreichbar. Schnell beitreten öffnet öffentliche Lobbys; Code-Beitritt fokussiert das bestehende Codefeld. Leere Lobby-Suche korrekt angezeigt. |
| Lobby / Chat / Ready | Lokale echte Server-Route: Lobby erstellt und verlassen, Ready gesetzt, Chat gesendet und angezeigt. Hintergrundwechsel bewahrt Ready. Alle bisherigen Spielparameter bleiben in den Einstellungen. |
| Garage / Profil | Aktives Fahrzeug, Bearbeiten, Fotoauswahl, Fahrzeugfarbe, Profil, Erfolge und bestehende Account-Menüs im Browser vorhanden. Bestehender Speicherpfad unverändert. |
| Neue UI | Crew erstellt, Freund eingeladen, Crew verlassen, Home unmittelbar aktualisiert; Global-Ranking mit 65 Testprofilen und eigener Position 55; zweite Seite geladen; Leveldetails und Belohnungsauswahl; Hintergrund-Vorschau, Speichern und Wiederladen. |
| Responsive | 375×667, 390×844, 393×852, 430×932 und 1280×900 geprüft. Kein horizontales Überlaufen der neuen Sheets. Home: primär 64px hoch; beide sekundären Buttons jeweils 48px hoch und gleich breit, vertikal angeordnet. Crew-Porträts 76px. |
| Console | Frischer abschließender lokaler Browser-Prüflauf ohne Warnungen/Fehler. Frühere lokale Testmeldungen kamen aus einem veralteten Test-Lobby-State und fehlender GET-Zahlenkonvertierung im Testserver; Testserver korrigiert. |
| Produktionsdatenbank | Migration 20261007171454 erfolgreich angewendet. Authentifizierte Lese-RPCs für Global, Fortschritt, Crew und Suche gegen vorhandenes Schema erfolgreich geprüft. Keine Testprofile/-Crews in Produktion angelegt. |

Die Migration ergänzt sechs Tabellen und zwei authentifizierte RPCs. Bestehende Profile, Fahrzeuge, Freunde, Rundenergebnisse, XP und Lobbys werden nicht zurückgesetzt. Alle neuen Tabellen haben RLS und keine direkten Lese-/Schreibrechte für anon/authenticated. Öffentliche Wrapper verwenden Invoker-Rechte; die private Implementierung prüft die echte Nutzer-ID und Crew-Rolle.

Supabase-Sicherheitsvergleich: keine neuen WARN-/ERROR-Befunde. Die sechs zusätzlichen INFO-Hinweise „RLS enabled, no policy“ sind durch den bewussten RPC-only-Zugriff erklärt. Bereits bestehend bleiben neun Hinweise auf ältere öffentliche Definer-Funktionen und der Hinweis zur deaktivierten Prüfung kompromittierter Passwörter. Sie wurden durch diese Erweiterung nicht verändert. Dokumentation: [RLS ohne direkte Policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [Definer-Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Passwortprüfung](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Grenzen: Browserprüfungen mit isolierten Testkonten und simuliertem Standort; Registrierung/OAuth, reale Uploads und GPS-/Kartenbetrieb mit mehreren physischen Geräten wurden nicht erneut end-to-end durchgeführt. Automatisierte Tests und Codevergleich liefern keinen vollständigen Ersatz für diesen Feldtest. Es wurde keine bekannte Regression offen gelassen.

## Bildherkunft

Neues Projektasset: `assets/rooftop-city-hd.png`, 1024×1536. Mit dem eingebauten image_gen-Tool erzeugt und ins Projekt kopiert; kein CLI-Fallback. Das ursprüngliche Bild bleibt im Repository erhalten.

Verwendete Motivvorgabe (zusammengefasst): Hochwertige fotorealistische leere Dachparkfläche zur blauen Stunde, violette Stadtsilhouette, warme bernsteinfarbene Lichtreflexionen auf nassem Asphalt, scharfe Details, Hochformat für Smartphone-Hintergrund, ohne Autos, Menschen, Schrift oder UI. Keine künstliche Unschärfe. Die Szene ergänzt das vom Nutzer vorgegebene App-Design; Icons bleiben Teil des bestehenden SVG-Systems.
