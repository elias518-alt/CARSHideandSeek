# Mobile Spieloberfläche – Umsetzung vom 20. Oktober 2026

Grundlage sind die einzelnen Umsetzungsprompts der [Designvorschau in PR #43](https://github.com/elias518-alt/CARSHideandSeek/pull/43). Die letzte Vorgabe des Nutzers lässt Startseite (01) und Lobby-Warteraum (05) im bestehenden Aufbau. Die Lobby-Regeln (06) werden trotzdem modernisiert.

[Screenshots der umgesetzten App](mobile-game-preview/README.md)

## Umgesetzte Bereiche

| Bereich | Änderung |
| --- | --- |
| 02 Profil | Spielerkarte mit Fahrzeug, Figur und Begleiter; runder Avatar; tatsächlicher PLUS-/Basisstatus; vier Kennzahlen und getrennte Zugänge zu Statistik, Looks, Haustieren und Garage. |
| 03 Statistik | Siegquotenring, echte Kontowerte, Sucher-/Versteckerstatistik und durchschnittliche Überlebenszeit. Leer-, Fehler- und Wiederholungszustände; verspätete Antworten nach Kontowechsel werden verworfen. |
| 04 Einstellungen | Konto, Privatsphäre und Look; bestehender Bild-Upload; separat gespeicherte Standortfreigabe; PLUS-Akzente, Hintergrund, Rechtstexte und Abmelden. |
| 06 Lobby-Regeln | Smartphone-Dialog mit Vorlagen, Segmenten, präzisem Radius und Schieberegler. Entwurf bleibt während Polling bestehen. Erst „Regeln speichern“ schreibt über die vorhandene API. Weitere Regeln enthalten Hintergrund, Vorsprung, Fund-Countdown und Ersatzsucher. Gäste können die Regeln ansehen, aber nicht bearbeiten. |
| 07 Garage | Große Modellvorschau, horizontale eigene Fahrzeugauswahl und bestehende Bearbeitungs-/Aktivierungsaktionen. Neue erspielte kosmetische Extras, getrennt vom freiwilligen Werbe-Neon-Look. |
| 08 Kleiderschrank | Große Figur, Reiter für unterstützte Kategorien, Outfit-Vorschauen und benannte Farbfelder. Drei kostenlose Figuren und vier bestehende PLUS-Figuren bleiben erhalten. |
| 09 Haustiere | Eigenständiger Bereich mit allen elf Varianten, großer Vorschau, Fell/Gefieder/Schuppen- und Augenfarben sowie Größe, Blickrichtung und unterstützter Haltung. Ohne PLUS lässt sich ansehen, aber kein Begleiter ausrüsten. |
| 10 Freunde/Crew | Eingebettete echte Karte mit ausschließlich freigegebenen Punkten, deutlich erreichbare Standortfreigabe und bestehende soziale Aktionen. Aktivitäts- und Standortzeit bleiben getrennt. |
| 11 Laufende Runde | Große vorhandene Spielkarte, kompakter Timer/Rolle, Spielaktionen und Sicherheitshinweis. Während der Runde ist die normale Seitennavigation ausgeblendet. Sichtbarkeitsregeln für Gegner bleiben unverändert. |
| 12 Ergebnis | Ergebnisüberschrift und alle gespeicherten Teilnehmer mit Fahrzeug/Figur/Begleiter und echten Resultaten, auch ausgeschiedene/verlassene Teilnehmer. Details in aufklappbarer Tabelle; Host kehrt per Rematch in die Lobby zurück, andere sehen den Wartehinweis. |

## Fahrzeugbelohnungen

- Level 2: Velocity-Felgen in Silber.
- Level 3: Unterbodenlicht Ice Blue oder Amber.
- Level 5: Street-Sport-Seitenschweller.
- Level 8: Velocity-Felgen in Graphit.

Auswahlen werden pro eigenem Fahrzeug in `chs_vehicle_loadouts` gespeichert. Der neue `/api/vehicle-rewards`-Endpunkt prüft Anmeldung, Kontozugang, Fahrzeugbesitz und das über `chs_community_read('progress')` gelesene Level. Metadaten allein schalten nichts frei. Konkurrierende Schreibzugriffe desselben Kontos werden innerhalb der Serverinstanz serialisiert. Beim Lobby-Beitritt übernimmt der Server ausschließlich geprüfte gespeicherte Extras; vom Browser gesendete Freischaltungen werden ignoriert. Bei nicht erreichbarer Fortschrittsquelle bleibt der normale Spielbeitritt mit Serienoptik möglich.

**Asset-Grenze:** Exakt platzierte Felgen und Seitenschweller sind zunächst für die vorhandenen BMW-3er-Limousinen E21/E30/E36/E46/E90/F30/G20 und die M2-Illustrationen F87/G87 verfügbar. Andere Baureihen erhalten das Unterbodenlicht; die übrigen Optionen sind als noch nicht unterstützt gekennzeichnet. Weitere Karosserien brauchen eigene gemessene Positionen. Es handelt sich um Illustrationen, nicht um frei drehbare 3D-Modelle. Eigene Fahrzeugfotos bleiben erhalten und werden nicht geometrisch umgebaut; die Garage zeigt für Tuning die Modellillustration.

Keine neue Währung, Zahlung oder simulierte Werbevergütung. Die vorhandene Werbekarte bleibt ohne freigegebenen Anbieter gesperrt. Foto-zu-Figur bleibt pausiert; Schuhe gehören weiterhin zum vorhandenen Outfit.

## Technik und Prüfung

Kein Frameworkwechsel und keine neue Paketabhängigkeit. Es werden die vorhandenen Supabase-RPCs, Fahrzeuge und Auth-Metadaten verwendet; keine neue Datenbankmigration oder zusätzlicher kostenpflichtiger Dienst ist erforderlich. Die vorhandene Crew-/Fortschrittsmigration muss bereits eingerichtet sein. Bei fehlender Einrichtung zeigt die Garage einen Fehler mit Wiederholung an.

- `npm test`: 219 erfolgreiche Tests, darunter neue Prüfungen zu Levelgrenzen, Fahrzeugbesitz, manipulierten Metadaten, parallelem Speichern und Ergebnis-Snapshots ohne GPS-/Auth-Daten.
- `scripts/game-design-browser-qa.cjs`: 52 Bildschirmprüfungen bei 360/390/430/1024 px, zusätzlich echte UI-Interaktionen für Ausrüsten, Lobby-Entwurf/Speichern, Gast-Leserechte, lange Namen, leere Profile und alle Ergebnis-Teilnehmer.
- `scripts/character-studio-browser-qa.cjs`: 302 erfolgreiche Prüfungen für Figuren, Kleidung, alle Haustiere, Speichern, PLUS-Ablauf und Kontowechsel während einer Antwort.
- `scripts/social-map-browser-qa.mjs`: 181 erfolgreiche Prüfungen mit tatsächlichem MapLibre und lokalen Karten-/API-Daten, einschließlich Vorschau ohne GPS-Freigabe, Zustimmung, Ablauf, ausgeschalteter Freigabe und verspäteten Antworten nach Abmeldung.

Die Browserprüfungen verwenden lokale Testkonten und Daten. Sie bestätigen keine produktive Anzeigenfreigabe, externe Kartenkacheln, physisches GPS oder einen Render-Deploy. Nach Zusammenführung muss Render den neuen Commit erfolgreich starten; erst dann ist diese Oberfläche live.
