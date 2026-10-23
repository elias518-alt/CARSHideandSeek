# CAR HIDE & SEEK – Entwürfe und Umsetzungsprompts

Stand: 20. Oktober 2026. Dies sind Gestaltungsvorschläge, keine bereits implementierten Funktionen. Die Zahlen und Personen in den Bildern sind Beispieldaten. Jedes Bild zeigt einen eigenen Bereich in der Handyansicht. Die App wurde für diese Entwürfe nicht geändert.

## Gemeinsamer Rahmen – jedem Einzelprompt voranstellen

Arbeite am Repository elias518-alt/CARSHideandSeek. Setze ausschließlich den nachfolgend beschriebenen Bereich nach dem zugehörigen Entwurfsbild um. Prüfe zuerst die vorhandenen Komponenten und Datenquellen. Nutze die vorhandene HTML/CSS/JavaScript-Architektur und bestehende Ereignisse, IDs, Authentifizierung und APIs. Führe keinen Frameworkwechsel durch. Bestehende Funktionen und gespeicherte Einstellungen müssen erhalten bleiben.

Gestalte zuerst für Smartphones von 360 bis 430 CSS-Pixeln Breite. Verwende Asphaltgrau (#10131B), abgestufte dunkle Flächen (#1B202B), gebrochenes Weiß und den bestehenden konfigurierbaren Orange-Akzent (#FF762D als Standard). Akzentfarben dürfen ausschließlich über die bestehende PLUS-Berechtigung verändert werden. Texte und Status müssen auch mit alternativen Akzentfarben lesbar bleiben. Nutze eine markante, gut lesbare Überschriftenschrift und eine ruhige Textschrift, konsistente SVG-Symbole, mindestens 44 × 44 Pixel große Tippziele und die Safe-Area-Abstände. Verwende keine Emojis als primäre Navigationssymbole. Echte Bedienelemente und Texte werden in HTML umgesetzt; generierte Bilder dienen nur als Gestaltungsvorlage beziehungsweise geeignete Szenenassets.

Der gemeinsame Aufbau nutzt klare Seitenüberschriften, eine dominante Hauptaktion und eine ruhige Navigation mit Start, Garage, Spielen, Crew und Profil. Wenn bestehende Navigationsziele anders heißen, binde sie fachlich korrekt an, ohne Ziele oder Aktionen zu verlieren. Auf großen Bildschirmen soll der Inhalt sinnvoll wachsen und zentriert bleiben. Erzeuge keine breite Desktop-Seitenleiste als Hauptnavigation auf dem Handy. Beachte Tastaturbedienung, Fokus, Beschriftungen, Kontrast, reduced-motion und Lade-, Leer-, Fehler- sowie Offlinezustände. Die laufende Runde erhält eine eigene reduzierte Navigation.

Die Szenen nutzen einheitliche Kamera, Bodenhöhe und Beleuchtung. Reifen, Füße und Pfoten müssen auf einer gemeinsamen Bodenebene stehen. Erzeuge keine scheinbar schwebenden Objekte und keine verzerrten Fahrzeuge. Verwende nur verfügbare beziehungsweise rechtlich nutzbare Assets. Ein statisches Konzeptbild ist kein Ersatz für einen konfigurierbaren Showroom. Füge weder neue Währungen noch erfundene Spielstatistiken, unbelegte Onlineanzeigen oder aktive Bezahlangebote hinzu. Nicht verfügbare Funktionen werden ehrlich gekennzeichnet. Die Foto-zu-Figur-Funktion bleibt pausiert, bis sie separat umgesetzt und geprüft wurde.

Prüfe jeden umgesetzten Bereich visuell bei 360, 390, 430 und 1024 Pixeln Breite mit kurzen und langen Namen sowie ohne Profildaten. Verwende vorhandene sinnvolle Tests für betroffene Funktionen. Eine Bildähnlichkeit allein gilt nicht als funktionaler Nachweis. Bearbeite die Bereiche in der folgenden Reihenfolge und lege pro Bereich eine nachvollziehbare Änderung mit passenden Prüfungen vor.

## 01 – Start

Überarbeite `#home` und die tatsächlich verwendeten Showroom-Komponenten anhand von Bild 01. Das aktive Fahrzeug soll der Blickfang sein: etwa 80 Prozent der Szenenbreite, ohne abgeschnittene Räder oder Stoßfänger. Passe Kamera und Objektposition für Hochformat an, statt nur das fertige Bild größer zu skalieren. Sorge für glaubwürdige Bodenkontakte, Kontaktschatten und eine Perspektive, die zum ausgewählten Hintergrund passt. Figur und optionales Haustier stehen maßstabsgerecht neben dem Fahrzeug und verdecken es nicht. Prüfe besonders kurze Kleinwagen, lange Limousinen und hohe SUVs.

Platziere oben einen korrekt rund zugeschnittenen Profilavatar mit Namen und Benachrichtigungen. Unter der Szene stehen aktives Fahrzeug, echter Level und XP-Balken. Eine große Aktion „Spielen“ führt in die vorhandene Spielsuche; „Lobby erstellen“ und „Code eingeben“ bleiben als sekundäre Aktionen erreichbar. Darunter erscheint eine kompakte Crew-Zeile mit tatsächlichem Anwesenheitsstatus. Die Navigation darf keine Aktionen überdecken. Die Szene bleibt auch auf kleinen Handys groß, ohne wichtige Spielaktionen unter mehrere Bildschirmhöhen zu schieben.

## 02 – Profil

Überarbeite `#profile`, `.profileHero`, `#profileVehicleStage` und die Profilnavigation nach Bild 02. Gestalte das Profil als persönliche Spielerkarte mit korrekt rund zugeschnittenem Avatar, Spielername, Spieler-ID und tatsächlicher Mitgliedschaft. Stelle Fahrzeug, Figur und optionalen Begleiter in einer zusammenhängenden Szene dar. Level und XP bleiben echte Kontowerte.

Zeige Runden, Siege, Funde und Siegquote in vier gut lesbaren, kompakten Wertefeldern. Erfolge werden als hochwertige Abzeichen mit Titel und tatsächlichem Freischaltstatus präsentiert; gesperrte Abzeichen erhalten einen klaren Hinweis. Ersetze die lange ungegliederte Menüliste durch übersichtliche Zugänge zu Statistiken, Kleiderschrank, Haustieren und Garage. Konto und Einstellungen sind über das Zahnrad erreichbar. Alle bisherigen Profilaktionen müssen weiterhin funktionieren. PLUS wird nur angezeigt, wenn die vorhandene Berechtigungsquelle das bestätigt.

## 03 – Statistiken

Gestalte `openProfileStatistics()` und `#profileStatsDialog` aus `app.js` nach Bild 03 als mobile Vollbildansicht beziehungsweise auf größeren Displays als passenden Dialog. Ersetze die einfachen Textzeilen durch einen großen Siegquotenring, drei prägnante Kennzahlen und zwei Rollenbereiche für Sucher und Verstecker. Verwende für Runden, Siege, Funde, überlebte Runden, Level und XP die bestehenden Profilwerte und für die Rollenstatistik den vorhandenen `personal-stats`-Aufruf. Die durchschnittliche Überlebenszeit erhält eine verständlich beschriftete Darstellung.

Berechne die Siegquote aus den echten Werten, verhindere Division durch null und zeige bei fehlenden Werten keine erfundenen Zahlen. Ohne gespielte Runden erscheint ein hilfreicher Einstieg. Bei API-Fehlern bleiben die verfügbaren Profilwerte sichtbar und die Rollenstatistik meldet ihren Ladefehler. Zeige keine Verlaufsdiagramme, Ranglisten, Saisondaten oder Zeitfilter, wenn dafür keine echte Datenquelle existiert. Stelle sicher, dass spätere Antworten nicht das Profil eines inzwischen gewechselten Kontos überschreiben.

## 04 – Profileinstellungen

Überarbeite den bestehenden Profileditor und die zugehörigen Einstellungsoberflächen nach Bild 04. Ordne die Einstellungen in Konto, Privatsphäre und persönlicher Look. Zeige Profilbild, Spielername und verknüpftes Konto in einer kompakten Identitätskarte. Die Bildänderung verwendet den vorhandenen Upload und eine korrekt runde Vorschau. Kontoangaben werden nur dort bearbeitbar, wo die bestehende Kontoverknüpfung das unterstützt.

Führe zur vorhandenen Standortfreigabe mit den echten Optionen für aus, erlaubte Personen und gegebenenfalls alle freigegebenen Freunde. Erkläre verständlich, wer den Standort sehen darf. Übernimm bestehende Freigaben; ändere sie nicht durch das bloße Öffnen der Seite. Akzentfarbe ist PLUS-geschützt und wird mit zugänglichen Farbfeldern statt einem unbeschrifteten Farbstreifen dargestellt. Hintergrundwahl bleibt erreichbar. Datenschutz, Nutzungsbedingungen, Impressum und Abmelden sind klar auffindbar. Eine feste Speichern-Aktion darf nur Einstellungen speichern, die tatsächlich gemeinsam gespeichert werden können; kennzeichne getrennt gespeicherte Freigaben korrekt. Während des Speicherns Doppelklicks verhindern und Fehler bei den betroffenen Feldern anzeigen.

## 05 – Lobby / Warteraum

Überarbeite den Warteraum in `#game`, die Crew-Darstellung und `lobby-scene.js` nach Bild 05. Zeige die Crew als zusammenhängende Parkszene mit korrekt skalierten Fahrzeugen und Figuren. Das eigene Fahrzeug ist gut erkennbar; bei vielen Spielern wird eine horizontale Auswahl oder fokussierte Szene verwendet, statt alle Objekte unlesbar klein zu machen. Fehlende Assets erhalten einen ruhigen Ersatz.

Oben stehen Lobbyname, kopierbarer Code und der Zugang zu den Host-Einstellungen. Darunter folgen kompakte, echte Angaben zu Spielgebiet, Zeit und Anzahl bereiter Spieler. Markiere Host, eigene Person und Bereitschaft eindeutig. Die Hauptaktion heißt für Teilnehmer „Bereit“ beziehungsweise „Nicht mehr bereit“ und für den Host „Runde starten“, soweit die bestehenden Startbedingungen erfüllt sind. Freunde einladen, Chat, Spielkarte und Verlassen bleiben erreichbar. Standort und Rolleninformationen werden nur nach den bestehenden Spielregeln gezeigt. Erfinde weder Teilnehmer noch Onlinezustände. Berücksichtige Vollbelegung, Verbindungsabbruch und einen Hostwechsel.

## 06 – Lobby-Einstellungen

Gestalte `#freshSettingsDialog` und `#lobbySettingsPanel` nach Bild 06 als eigenständige, gut bedienbare Handyansicht. Ersetze die optisch alten Select-Listen dort durch zugängliche Auswahlkarten, Segmentknöpfe und beschriftete Schieberegler, wo die vorhandenen Werte das zulassen. Biete die bestehenden Vorlagen Schnell (500 m / 5 Min.), Normal (1 km / 15 Min.), Groß (3 km / 30 Min.) und Individuell an. Markiere die aktive Vorlage; bei einer abweichenden Einzeländerung wird Individuell aktiv.

Erhalte den gesamten Bereich für den Radius von 50 bis 10.000 m und zusätzlich ein präzises numerisches Eingabefeld. Spielzeit bietet die vorhandenen Werte 5, 10, 15, 20, 30 und 60 Minuten. Vorsprung bietet 30 Sekunden, 1, 2, 3 und 5 Minuten; Fund-Countdown 10 oder 15 Sekunden. Erhalte die Ersatzsucher-Regel und die Hintergrundauswahl. Zeige im kompakten Hauptbereich die häufigen Optionen; seltene Optionen dürfen unter „Weitere Regeln“ liegen, müssen aber vollständig erreichbar sein. Nur der Host kann vor der Runde bearbeiten. Andere Spieler sehen die Regeln mit einer eindeutigen Lesebeschränkung. Speichern verwendet die bestehenden API-Aufrufe und erhält Bereitschaften entsprechend der bisherigen Logik. Die kleine Kartenvorschau ist nur ein gestalterischer Überblick und darf keine versteckten Spieler verraten.

## 07 – Garage

Überarbeite `#garage`, `#garageCars`, die Fahrzeugsuche und die Showroom-Steuerung nach Bild 07. Das gewählte Fahrzeug steht groß in einer glaubwürdigen Garagenszene mit korrekter Bodenebene. Eine kompakte Fahrzeugauswahl mit Vorschaubildern macht weitere eigene Fahrzeuge erreichbar. „Als aktiv wählen“ zeigt den echten Aktivstatus und nutzt die vorhandene Speicherung. Details bearbeiten und Fahrzeug hinzufügen bleiben eigene erkennbare Aktionen.

Modell, Generation und Baujahr müssen zur tatsächlichen Auswahl passen. Erhalte die vorhandene marken- und generationenabhängige Fahrzeugsuche und die Jahresauswahl. Eine realistische Lackvorschau darf Glas, Reifen, Leuchten und Metallteile nicht pauschal mit einfärben. Verwende die vorhandenen Lackmasken und Materialien. Fahrzeugfarben sind kein automatisch neuer PLUS-Vorteil; erhalte die bestehenden Rechte. Die freiwillige Neon-Werbekarte bleibt erreichbar, erscheint aber kompakt und zeigt bis zu einer echten Anbieterfreigabe „Werbung noch nicht verfügbar“. Keine simulierten Videos oder Belohnungen und keine neuen Käufe ergänzen.

## 08 – Kleiderschrank / Figuren

Gestalte den bestehenden Kleiderschrank in `wardrobe.js`, `character-studio.js` und den zugehörigen UI-Komponenten nach Bild 08. Eine große ganze Figur steht auf einer gemeinsamen Bodenebene und lässt sich in den vorhandenen Ansichten beziehungsweise Posen prüfen. Füge verständliche Reiter für Figur, Oberteil, Hose, Schuhe und Pose hinzu und zeige nur Kategorien, die tatsächlich unterstützt sind. Darunter stehen übersichtliche Vorschaubilder mit Namen und klar markierter Auswahl. Verwende realistische, zum Autospiel passende Streetwear statt einer Comic- oder Selfie-Collage.

Alle bestehenden kostenlosen Lobbyfiguren bleiben für kostenlose Konten auswählbar. Vorhandene PLUS-Figuren, Kleidungsstücke und Posen werden entsprechend den tatsächlichen Rechten markiert und serverseitig geschützt. Die vormals wiederhergestellten Figuren dürfen nicht erneut verschwinden. Ein Tipp auf eine gesperrte Auswahl erklärt PLUS, startet aber keinen Kauf. Zeige die verfügbaren Varianten für männliche und weibliche Figuren fair und übersichtlich. Aussehen und Pose werden aus den bestehenden Auswahlwerten gespeichert. Die pausierte Foto-zu-Figur-Funktion erhält keinen aktiven Kamera- oder Uploadknopf und wird nicht als fertig dargestellt.

## 09 – Haustiere

Überarbeite den separaten Haustierbereich in `pet-ui.js`, `pets.js` und `pets.css` anhand von Bild 09. Er bleibt ein eigenes Ziel im Profil und wird nicht in den Kleiderschrank verschoben. Oben steht eine große realistische Vorschau des gewählten Begleiters mit korrektem Bodenkontakt; darunter eine übersichtliche Arten- und Rassenauswahl. Alle vorhandenen elf Varianten müssen erreichbar bleiben, einschließlich Schäferhund, Husky, Dobermann, Bengal-Katze, British Shorthair, Papagei, Fisch im runden Aquarium, Hamster, Pferd, Affe und Esel.

Fell- beziehungsweise Gefiederfarbe, Augenfarbe, Größe und unterstützte Ausrichtung oder Pose werden passend zur jeweiligen Tierart angeboten. Zeige bei einem Fisch beispielsweise keine irreführende Felloption. Verfügbare Sitz-/Stehvarianten der British Shorthair bleiben erhalten. Farben erhalten verständliche Namen und markierte Auswahlzustände. Pferd und Kleintiere benötigen artspezifische Größen- und Platzierungsregeln in den gemeinsamen Szenen. Begleiter sind PLUS-geschützt; die serverseitige Prüfung bleibt verbindlich. „Ohne Begleiter“ bleibt möglich. Speichere weiterhin unabhängig im bestehenden `chs_pet`-Metadatenfeld. Zeige einen ehrlichen Nur-Vorschau-Zustand ohne PLUS und keinen funktionierenden Kaufknopf.

## 10 – Freunde und Crew

Überarbeite `#friends` sowie die bestehenden Crew- und Standortkomponenten anhand von Bild 10. Nutze die Reiter Freunde und Crew, eine gut lesbare Suche und einen kompakten Zugang zu Einladungen beziehungsweise Anfragen. Freundeskarten zeigen Avatar, Namen, echten Anwesenheitsstatus und – nur bei vorhandener Freigabe – die letzte bekannte Ortsangabe und den Zeitpunkt. Unterscheide „Jetzt aktiv“, „Aktiv vor …“ und „Standort aktualisiert vor …“; Aktivität bedeutet nicht automatisch einen frischen Standort.

Die soziale Karte zeigt ausschließlich berechtigt freigegebene Personen und keinen Spielradius. Zugriff und Filterung müssen weiterhin serverseitig durchgesetzt sein. Biete gut sichtbar „Standortfreigabe“ und die bestehende Auswahl einzelner Personen an. Ohne Freigabe stehen weder Koordinaten noch Ortsnamen im DOM, in Vorschauen oder in Kartenmarkern. Erhalte Freundschaftsanfragen, Entfernen, Crew-Verwaltung und Nachrichten. Die Karte benötigt klare Zustände für fehlende Einrichtung, keine Freigaben, verweigerte GPS-Berechtigung und veraltete Positionsdaten. Zeige keine fiktive Entfernung oder Aktivitätszeit.

## 11 – Laufende Runde / Spielkarte

Gestalte die aktive Runde und die vorhandene Spielkarte nach Bild 11 als konzentrierte Spieloberfläche. Die Karte nimmt den größten Bereich ein; oben stehen ein echter Runden-Timer und die eigene Rolle. Nutze darunter nur die Informationen und Aktionen, die für die aktuelle Rolle und Phase erlaubt sind. Halte Markierungen, Lesbarkeit und Zoom auf kleinen Bildschirmen brauchbar. Die Radiusgrenze muss sich aus dem echten Spielgebiet ergeben. Kartenmittelpunkt und Follow-Funktion bleiben vorhanden.

Ändere die bestehenden Regeln zur Sichtbarkeit von Suchern und Versteckern nicht. Zeige insbesondere keine Gegnerposition nur für einen attraktiveren Entwurf. Die vereinfachte Karte im Bild ist eine Gestaltungsreferenz; produktiv werden echte Kartendaten und die vorhandenen Datenschutzregeln verwendet. Erhalte Fund-Countdown, Vorsprung und Verbindungszustände. Chat und Menü sind kompakt erreichbar, aber stören die Karte nicht. Die normale Seitennavigation tritt während der Runde zurück. Zeige keine Werbung während der Runde. Ergänze einen gut lesbaren Hinweis, das Handy nur im sicheren Stand zu bedienen; fordere nicht zur Bedienung während der Fahrt auf.

## 12 – Rundenergebnis

Überarbeite `#result` und die bestehende Ergebnispräsentation nach Bild 12. Verwende eine große eindeutige Ergebnisüberschrift, die je nach tatsächlichem Ausgang Sieg, Niederlage, Abbruch oder reguläres Rundenende korrekt darstellt. Zeige die eigene Figur mit unterstützter Pose, Fahrzeug und optionalem Begleiter glaubwürdig auf derselben Bodenebene. Gewinnerposen dürfen nur entsprechend den bestehenden PLUS-Rechten ausgewählt werden; eine normale Siegesanzeige bleibt für alle verfügbar.

Ergebniswerte, Funde und XP stammen aus dem gespeicherten Rundenergebnis. Verwende keine erfundene Platzierung, Bestenliste oder Belohnung. Erfolge und Fortschritte erscheinen nur bei tatsächlich bestätigter Vergabe. Die Hauptaktion führt zurück in die Lobby; Ergebnisdetails sind sekundär erreichbar. Ein optionales belohntes Video wird nur gezeigt, wenn die tatsächliche Anbieterintegration, Einwilligung und Freischaltung es erlauben. Bis dahin bleibt der Bereich verborgen oder ehrlich als nicht verfügbar beschriftet. Bestehende Werbung nach der Runde respektiert die geltenden Begrenzungen und Mitgliedschaftsrechte; ein Werbevideo startet hier nicht allein durch die Neugestaltung.

## Empfohlene tatsächliche Umsetzung

Zuerst die gemeinsamen Farben, Schriftgrößen, Abstände, Symbole und Navigationskomponenten festlegen. Danach 01 bis 04 umsetzen und auf einem echten schmalen Bildschirm prüfen. Anschließend Warteraum und Lobby-Einstellungen (05–06), Garage und Anpassung (07–09), Freunde/Crew (10) und zuletzt die laufende Runde und Ergebnisse (11–12). Die vorhandene Spiel- und Serverlogik bleibt die verbindliche Grundlage.

Die Entwürfe erfordern allein keine laufenden KI-Kosten. Neue bewegliche Figuren, Kleidungsstücke und Tiere können allerdings zusätzliche geeignete Assets oder Modellarbeit benötigen. Ein schönes generiertes Einzelbild beweist nicht, dass ein entsprechendes frei konfigurierbares 3D-Modell schon vorhanden ist.
