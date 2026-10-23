# Szenen, Freunde und Unterbodenlicht – 23.10.2026

- Tierportrait folgt im Begrüßungsbereich direkt auf den Namen.
- Die Startliste vereint akzeptierte Freunde und Crew-Mitglieder ohne Duplikate und ohne Begrenzung auf sechs Personen. Crew-Mitglieder ohne Freundschaft öffnen ihr Crew-Profil. Im Profil sind alle akzeptierten Freunde erreichbar.
- Eigene Fahrzeugfotos werden im Avatar als einzelnes Bild gerendert. SVG-Atlanten sind zusätzlich begrenzt, sodass benachbarte Modellbilder nicht aus dem Ausschnitt herausragen. Julines konkretes Originalfoto wurde nicht aus dem privaten Konto ausgelesen; der Fehlerpfad wurde mit einem Testfoto geprüft.
- Kleiderschrank-Kachel zeigt stärker den Kleidungsteil des Motivs. Haustiermotiv hat mehr Rand, Hunde in der Profilszene sind um 10 Prozent kleiner. Garage und Motive sind heller abgestimmt.
- Pink, Violett, Grün, Rot und Weiß ergänzen Cyan/Amber ab Level 3. Die additive Migration `20261022070000_vehicle_glow_colors.sql` wurde am 23.10.2026 erfolgreich auf Supabase ausgeführt; die erweiterte öffentliche Farbprojektion wurde danach geprüft. Vorherige Funktionsdefinition lokal für einen Rückweg gesichert. Keine Spielerdaten gelöscht.
- Felgeneinsätze sind kleiner, mit dezenterem Ring und Bremsscheibenhintergrund; die vorhandenen Schweller sind schmaler. Vollständige modellgenaue Bodykits bleiben offen. Diese Änderungen sind keine vollständige grafische Neuentwicklung sämtlicher Tuningpakete.

Prüfung: 235 Unit-/Servertests; 66 Browserprüfungen der gemeinsamen Funktionen einschließlich Begrüßung, acht Freunden und Fotoavatar ohne Modell; 108 Garagenprüfungen und 52 Designprüfungen; 66 PostgreSQL-Prüfungen einschließlich neuer Unterbodenfarbe in öffentlichen Profilen. Mobilansicht visuell geprüft. Kein Astra-Review durchgeführt.
