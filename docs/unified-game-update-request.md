# CAR HIDE & SEEK – GROßES UI-, GARAGE-, TUNING- UND PROFIL-UPDATE

Arbeite direkt im bestehenden CAR HIDE & SEEK Projekt.

WICHTIG:
Dies ist keine reine Designaufgabe. Prüfe zuerst die bestehende Implementierung, Komponenten, Datenmodelle, State-Verwaltung, Fahrzeugdaten, Charakterdaten, Haustierdaten und vorhandenen Assets.

Danach die folgenden Punkte wirklich implementieren.

Bestehende funktionierende Funktionen dürfen NICHT kaputtgehen.

Insbesondere dürfen folgende Bereiche nicht beeinträchtigt werden:
- Login
- Lobby-Erstellung
- Lobby-Beitritt
- Freunde
- Chat
- Crew
- Standort
- Map
- Ready-System
- Spielstart
- Profil
- Garage
- Rejoin
- vorhandene Fahrzeugauswahl
- vorhandene Charakterauswahl

Mobile First entwickeln.

Desktop muss weiterhin sauber funktionieren, aber die Smartphone-Ansicht hat Priorität.

---

# 1. ZENTRALES FAHRZEUGSYSTEM

Aktuell besteht offenbar das Problem, dass Fahrzeugkonfigurationen auf unterschiedlichen Seiten unterschiedlich dargestellt werden.

Beispiel:
Ein Nutzer wählt:
- BMW E36
- bestimmte Fahrzeugfarbe
- andere Felgen
- Bodykit
- weitere Tuningteile

In der Garage sieht man diese Konfiguration teilweise, im Profil, auf der Startseite oder in der Lobby jedoch nicht.

Das darf nicht mehr passieren.

Erstelle bzw. überarbeite eine zentrale VehicleConfiguration.

Beispielstruktur:

vehicleConfig:
- brand
- series
- model
- generation
- bodyType
- year
- baseVehicleAsset
- paintColor
- wheelId
- wheelSize
- bodyKitId
- frontBumper
- rearBumper
- sideSkirts
- spoiler
- suspension
- exhaust
- tint
- accessories
- customUploadedVehicle
- customVehicleTransform

Diese Konfiguration muss die EINZIGE Quelle für die Fahrzeugdarstellung sein.

Alle Seiten müssen exakt dasselbe Fahrzeug rendern:

- Garage
- Profil
- Startseite
- Lobby
- Spielerkarte
- Crew
- Freunde
- Leaderboard, falls dort Fahrzeuge dargestellt werden
- Match-Ergebnis
- sonstige Fahrzeugvorschau

Wenn ich beispielsweise meine Felgen ändere, muss die Änderung sofort überall sichtbar sein.

Genauso bei:
- Fahrzeugfarbe
- Bodykit
- Spoiler
- Tieferlegung
- Zubehör
- Scheibentönung
- sonstigem Tuning

Keine separaten Fahrzeugzustände je Seite.

---

# 2. FELGENSYSTEM KOMPLETT ÜBERARBEITEN

Aktuell sehen andere Felgen teilweise aus, als würde einfach ein Bild über das Fahrzeug gelegt.

Das ist nicht akzeptabel.

Besonders beim BMW 2er sieht man, dass die Felge nicht wirklich zum Fahrzeug gehört.

Felgen müssen geometrisch korrekt am Fahrzeug sitzen.

Für jedes Fahrzeugmodell müssen entsprechende Wheel Anchors vorhanden sein.

Beispiel:

frontWheel:
- x
- y
- width
- height
- rotation
- perspective

rearWheel:
- x
- y
- width
- height
- rotation
- perspective

Die Position hängt vom jeweiligen Fahrzeugbild ab.

Eine Felge darf NICHT einfach mit derselben Position auf jedes Fahrzeug gelegt werden.

Berücksichtige:
- Radstand
- Perspektive des Fahrzeugbildes
- Vorderachse
- Hinterachse
- Raddurchmesser
- Fahrzeughöhe
- Bildskalierung
- mögliche unterschiedliche Perspektiven der Fahrzeuge

Die Felgen sollen sich visuell so verhalten, als wären sie Bestandteil des Autos.

Bei Bedarf für Fahrzeuge individuelle Wheel-Masks oder Anchor-Konfigurationen anlegen.

Felgen müssen:
- sauber ausgeschnitten sein
- keinen rechteckigen Bildhintergrund haben
- keine sichtbaren Bildränder besitzen
- korrekt skaliert sein
- perspektivisch passen
- nicht über Kotflügel hinausragen
- nicht neben dem Auto schweben

---

# 3. BMW E36 – FARBFEHLER BEHEBEN

Beim BMW E36 stimmt die gewählte Fahrzeugfarbe in der Tuningansicht aktuell nicht mit der eigentlichen Fahrzeugfarbe überein.

Das korrigieren.

Die gewählte Farbe muss exakt dieselbe sein in:

- Garage
- Tuningansicht
- Profil
- Lobby
- Startbild
- Spielerkarte

Wenn Madeira Violett ausgewählt ist, darf das Auto beispielsweise nicht plötzlich blau, schwarz oder anders eingefärbt dargestellt werden.

Prüfe insbesondere:
- Blend Modes
- CSS Filter
- Masken
- Farb-Overlays
- Opacity
- Farbtonverschiebungen
- unterschiedliche Assets

Es soll eine einheitliche PaintColor-Logik geben.

---

# 4. BODYKITS UND TUNINGPAKETE

Erweitere das Fahrzeug-Tuning erheblich.

Die Tuningmöglichkeiten müssen zum jeweiligen Hersteller UND Modell passen.

Nicht jedes Fahrzeug bekommt dieselben Optionen.

Beispiele:

BMW:
- Standard
- Sport-Paket
- M-Paket / M-Sport-inspirierte Variante
- Alpina-inspirierte Variante, wenn passend
- AC-Schnitzer-inspirierte Variante, wenn passend
- Street
- Track
- Clean

Mercedes:
- Standard
- AMG-Line / sportlich inspirierte Variante
- AMG Performance, wenn zum Modell passend
- Brabus-inspirierte Variante
- Maybach-inspirierte Luxusvariante, wenn zum Modell passend
- Street
- Luxury

Audi:
- Standard
- S-Line
- S-inspirierte Variante
- RS-inspirierte Variante
- ABT-inspirierte Variante
- Street
- Track

Volkswagen:
- Standard
- R-Line
- GTI-inspiriert, wenn passend
- R-inspiriert, wenn passend
- Street

Opel:
Je nach Modell beispielsweise:
- Standard
- Sport
- GS
- GSi/OPC-inspirierte sportliche Variante, wenn historisch bzw. modellbezogen passend
- Street
- Track

Porsche:
- Standard
- Sport
- SportDesign-inspiriert
- GT-inspiriert bei geeigneten Modellen
- Touring
- Track

Toyota:
- Standard
- GR Sport
- GR-inspirierte Performance-Variante
- Street
- Track

Cupra:
- Standard
- Performance
- VZ-inspiriert
- Track

Volvo:
- Standard
- Sport
- R-Design-inspiriert
- Performance

Renault:
- Standard
- Sport
- R.S.-inspirierte Variante bei passenden Generationen
- Esprit-Alpine-inspirierte Variante bei neueren passenden Modellen

Dacia:
- Standard
- Extreme-inspiriert
- Adventure
- Offroad bei geeigneten Modellen

Ferrari und andere Supersportwagen:
Nicht einfach erfundene offizielle Paketnamen verwenden.

Hier lieber:
- Standard
- Street
- Aero
- Track
- Lightweight
- Performance

verwenden, sofern kein reales passendes Paket vorhanden ist.

WICHTIG:

Nicht einfach behaupten, dass es ein bestimmtes offizielles Paket für ein Fahrzeug gibt, wenn es dieses nicht gibt.

Das System soll pro:

Hersteller → Baureihe → Modell → Generation

festlegen, welche Tuningmöglichkeiten zulässig sind.

---

# 5. FAHRZEUGBILDER UND HERSTELLER

Für ALLE bereits im Projekt gelisteten Automarken und Fahrzeugmodelle soll das Fahrzeugangebot weiter ausgebaut werden.

Nicht nur einzelne bekannte Modelle.

Gehe die bestehende Fahrzeugdatenbank durch und stelle sicher, dass jedes vorhandene Modell:

- ein Fahrzeugbild
- Fahrzeugfarbe
- Wheel Anchors
- passende Felgen
- passende Tuningpakete
- passende Skalierung
- passende Positionierung

besitzt.

Die Fahrzeuge sollen weiterhin sehr realistisch aussehen und klar erkennen lassen, um welche Fahrzeugklasse bzw. welches Modell es sich handelt.

ABER:

Keine echten Herstellerlogos auf den Fahrzeugen verwenden.

Keine sichtbaren:
- BMW Logos
- Mercedes Sterne
- Audi Ringe
- Porsche Wappen
- VW Logos
- Ferrari Logos
- usw.

Die Fahrzeuge sollen im gleichen realistischen Stil wie die bereits vorhandenen Fahrzeuge aussehen.

Keine Cartoon-Autos.

Keine offensichtlich KI-mäßigen Fahrzeuge.

Keine billigen PNG-Sticker.

Sie sollen optisch zusammenpassen.

Erstelle ein einheitliches Fahrzeug-Asset-System.

Beispiel:

vehicles/
  bmw/
    e36-coupe/
    f30/
    f32/
    g20/
  mercedes/
  audi/
  volkswagen/
  porsche/
  opel/
  toyota/
  cupra/
  volvo/
  renault/
  dacia/

Dabei vorhandene Projektstruktur respektieren und nicht blind eine zweite parallele Struktur erstellen.

---

# 6. CUSTOM FAHRZEUGBILDER

Nutzer können eigene Fahrzeugbilder hinzufügen.

Hier besteht aktuell ein Darstellungsproblem.

Beispiel:
Der Hund steht teilweise auf dem Auto.

Das eigene Fahrzeug ist außerdem teilweise falsch positioniert oder skaliert.

Erstelle deshalb für benutzerdefinierte Fahrzeuge eine Transform-Konfiguration:

customVehicleTransform:
- scale
- translateX
- translateY
- groundY
- visualWidth
- visualHeight
- characterOffset
- petOffset

Beim Upload soll versucht werden, das Fahrzeug sauber innerhalb eines definierten Fahrzeugbereiches darzustellen.

Keine starke Verzerrung.

Seitenverhältnis beibehalten.

Das Fahrzeug soll optisch auf dem Boden stehen.

Wenn das Bild bereits freigestellt ist, keinen zusätzlichen Hintergrund hinzufügen.

---

# 7. HAUSTIER – POSITIONIERUNG KOMPLETT VERBESSERN

Die vorhandenen Haustiere gefallen grundsätzlich und sollen NICHT ersetzt werden.

Aber ihre Positionierung funktioniert nicht überall gut.

Probleme:
- Tiere stehen teilweise hinter Fahrzeugen.
- Tiere sind zu klein.
- Tiere werden verdeckt.
- Tiere stehen an unlogischen Positionen.
- Hund steht teilweise auf dem Auto.
- manche Tiere verlieren ihre Sichtbarkeit.

Erstelle deshalb ein Pet-Anchor-System.

Je nach Haustiertyp soll eine andere Position verwendet werden.

Beispiele:

Hund:
- neben Charakter oder Fahrzeug
- am Boden
- gut sichtbar
- niemals auf dem Auto

Katze:
- neben Charakter
- eventuell leicht vor dem Charakter
- nicht vom Auto verdeckt

Papagei:
- auf der Schulter des Charakters

Affe:
- auf bzw. nahe der Schulter des Charakters

Hamster:
- ebenfalls als kleines Shoulder-/Character-Pet positionieren, sofern das optisch funktioniert
- alternativ sichtbar in der Nähe des Charakters
- niemals irgendwo zufällig schweben

Das muss besonders funktionieren in:

- Lobby
- Startbild
- Profil
- Crew
- Spielerkarte

Verwende responsive Anchor-Positionen.

Position darf sich abhängig von:
- Character Pose
- Fahrzeuggröße
- Screenbreite
- Pet-Typ

ändern.

---

# 8. HAUSTIER IM „HEY ELIAS“-BEREICH

Auf der Startseite gibt es den Bereich:

„Hey Elias“

Hier soll zusätzlich das aktuell ausgewählte Haustier sichtbar sein.

Nicht das komplette Tier.

Zeige dort eine kleine Haustier-Profilansicht.

Zum Beispiel:
runder bzw. hochwertiger Game-Avatar mit dem Kopf des ausgewählten Tieres.

Beispiel:

Hey Elias 👋

[Profilbild Spieler] [kleiner Haustierkopf]

oder eine ähnliche optisch hochwertige Lösung.

Das Tier soll erkennbar sein.

Beim Anklicken des Haustierkopfes:
→ Haustierprofil öffnen.

Das Haustierprofil kann enthalten:
- Name
- Tierart
- Seltenheit
- eventuell Level später
- ausgewählt / nicht ausgewählt
- Haustier wechseln

Nicht überladen.

---

# 9. PROFIL-KACHELN ÜBERARBEITEN

Im Profil hat aktuell nur „Garage“ ein richtiges Hintergrundbild.

Andere Bereiche wirken dadurch unfertig.

Die folgenden Profilbereiche sollen ALLE große visuelle Bilder bekommen:

GARAGE
→ Auto / Garage / Parkhaus im Hintergrund

KLEIDERSCHRANK
→ Charakter mit Outfit im Hintergrund

STATISTIKEN
→ spielbezogenes Motiv, z. B. Trophy, Karte, Siegesszene, Ranking, Neon-Statistik-Visual

HAUSTIERE
→ ausgewähltes Tier bzw. mehrere Tiere im Hintergrund

Die Karten sollen alle nach demselben Designsystem aufgebaut sein.

Zum Beispiel:
- großes Hintergrundbild
- dunkler Gradient
- Titel unten
- kleines Icon
- leichte Tiefe
- dezentes Glow
- moderne Game-UI

Nicht vier komplett unterschiedliche Designs.

---

# 10. KLEIDERSCHRANK STARK ERWEITERN

Der Kleiderschrank ist aktuell zu eingeschränkt.

Erweitere ihn für männliche und weibliche Charaktere.

MÄNNER:

Oberteile:
- T-Shirt
- Oversized T-Shirt
- Tanktop
- Polo
- Hoodie
- Half-Zip
- Pullover
- Hemd
- Jacke
- leichte Jacke

Hosen:
- Jeans
- Slim Jeans
- Baggy Jeans
- Jogginghose
- Cargo Hose
- Stoffhose
- Anzugshose
- Leinenhose
- kurze Hose
- Sportshorts

FRAUEN:

Oberteile:
- T-Shirt
- Oversized Shirt
- Tanktop
- Top
- Crop Top
- bauchfreies Oberteil
- Hoodie
- Half-Zip
- Pullover
- Bluse
- Jacke

Unterteile:
- Jeans
- Baggy Jeans
- Skinny Jeans
- Jogginghose
- Cargo
- Stoffhose
- Leinenhose
- kurze Hose
- Sportshorts
- Rock
- kurzer Rock
- längerer Rock

Optional passende Kleider, sofern das vorhandene Charaktermodell dies technisch unterstützt.

Zusätzlich weiterhin:
- Schuhe
- Sonnenbrillen
- Ketten
- Ohrringe
- Uhren
- Accessoires

Farben sollen nicht nur fest mit einem Kleidungsstück verbunden sein.

Kleidungsstück auswählen → danach Farbe auswählen.

---

# 11. CREW-KLEIDERORDNUNG

Crew-Leader sollen eine Kleiderordnung für die Crew festlegen können.

Beispiel:

Crew Outfit:
Oberteil:
- Hoodie
- Farbe: Schwarz

Hose:
- beliebig
- Farbe: Grau

oder:

Oberteil:
- beliebig
- Farbe: Orange

Unterteil:
- Jeans
- Farbe: Schwarz

Konfigurierbar machen:

Oberteil:
- bestimmtes Kleidungsstück oder beliebig
- bestimmte Farbe oder beliebig

Unterteil:
- bestimmtes Kleidungsstück oder beliebig
- bestimmte Farbe oder beliebig

Optional später:
- Schuhe
- Accessoires

Im Crew-Menü:
„Crew Outfit“

Leader kann Outfit konfigurieren.

Mitglieder sehen:
„Crew Dresscode“

Wenn ein Spieler nicht passend gekleidet ist:
kleiner Hinweis:

„Dein Outfit entspricht noch nicht dem Crew-Dresscode.“

Optional Button:
„Outfit anpassen“

Nicht automatisch Kleidung ohne Zustimmung verändern.

---

# 12. CREW-BEREICH VERBESSERN

Aktuell gefällt mir „Crew finden“ nicht besonders.

Statt einer leeren oder langweiligen Suchansicht sollen direkt Crew-Vorschläge angezeigt werden.

Bereich:

„Crews für dich“

Zeige mehrere Crew-Karten.

Zum Beispiel:
- Crew-Logo
- Crew-Name
- Mitglieder
- freie Plätze
- Region
- Aktivität
- eventuell durchschnittliches Level
- öffentlich / privat
- Button „Beitreten“

Vorschläge können sich orientieren an:
- Region
- Sprache
- Aktivität
- verfügbaren Plätzen
- Freunden in Crew

Darunter:

„Crew erstellen“

als größere eigene Karte bzw. Button.

Zusätzlich Crew-Suche weiterhin anbieten.

---

# 13. MAP KOMPLETT ATTRAKTIVER GESTALTEN

Die aktuelle Map wirkt zu leblos.

Sie soll stärker zum Game passen.

MapLibre kann weiter verwendet werden.

Erstelle einen eigenen Game-Map-Style.

Die Karte darf trotzdem gut lesbar bleiben.

Designrichtung:

CAR HIDE & SEEK
- Dark Game Map
- leicht futuristisch
- mehr Farbe
- deutlich bessere Kontraste
- Orange und Lila als Akzentfarben
- Parks sichtbar
- Wasser sichtbar
- Hauptstraßen klar
- Nebenstraßen zurückhaltender
- Gebäude leicht sichtbar
- interessante Bereiche leicht hervorheben
- keine komplett graue tote Fläche

Spielbereich/Radius deutlich sichtbar.

Beispiel:
- Radius leicht transparent
- orange/lila Linie
- subtiler Glow

Spieler:
- hochwertige Marker
- Profilbild oder Fahrzeugindikator
- unterschiedliche Marker für Sucher und Verstecker

Eigener Standort:
besonders klar sichtbar.

Die Karte darf nicht zu bunt oder kindisch werden.

Sie soll wie eine moderne Multiplayer-Game-Map wirken.

WICHTIG ZUR ATTRIBUTION:

MapLibre-Branding nicht unnötig groß darstellen.

Prüfe, welche Attribution durch den tatsächlich verwendeten Karten-/Tile-/Datenanbieter verpflichtend ist.

Rechtlich erforderliche Attribution NICHT einfach entfernen.

Falls die aktuelle große Anzeige nur MapLibre selbst betrifft und nicht erforderlich ist:
reduzieren bzw. entfernen.

Notwendige Kartenquellen-Attribution sehr kompakt und unauffällig in einer Ecke bzw. einer zulässigen Attribution-Control darstellen.

Sie soll das Spiel nicht optisch stören.

---

# 14. GARAGENHINTERGRUND – WERBUNG ÄNDERN

Aktuell kann man offenbar mit:

1 Werbung innerhalb von 24 Stunden

den Garagenhintergrund wechseln bzw. freischalten.

Das ändern.

Neue Regel:

Der Nutzer muss insgesamt 10 vollständig angesehene Werbungen abschließen.

Fortschritt anzeigen:

3 / 10 Werbungen

7 / 10 Werbungen

10 / 10 → Freigeschaltet

Fortschritt muss gespeichert werden.

Nicht nach 24 Stunden zurücksetzen.

Nur eine tatsächlich vollständig abgeschlossene Rewarded Ad darf zählen.

Nicht zählen:
- Werbung abgebrochen
- Werbung nicht vollständig geladen
- Werbung sofort geschlossen
- Fehler

Nach 10 erfolgreichen Anzeigen:
Feature dauerhaft freischalten.

Zum Beispiel:

„Garagenhintergründe freigeschaltet“

Danach kein erneutes 10-Werbungen-Zählen für dieselbe Freischaltung.

---

# 15. TUNING MUSS AUF STARTSEITE UND IM PROFIL SICHTBAR SEIN

Aktuell verschwinden Tuningteile außerhalb der Garage.

Beheben.

Wenn ich folgendes auswähle:

BMW E36
+
Madeira Violett
+
andere Felgen
+
Sport-Bodykit
+
Spoiler
+
Tieferlegung

muss genau dieses Fahrzeug auch sichtbar sein in:

- Profil
- Startseite
- Lobby
- Spielerkarte
- Crew
- Freundesprofil

Nicht wieder das Standardfahrzeug anzeigen.

---

# 16. STARTBILD – FAHRZEUGE SICHTBARER MACHEN

Beim Start ist beispielsweise Justins Fahrzeug aktuell sehr dunkel.

Man erkennt das Fahrzeugmodell kaum.

Verbessere:
- Beleuchtung
- Hintergrundkontrast
- Schatten
- Fahrzeugkontrast
- Fahrzeugskalierung
- Fahrzeugposition

Das Auto darf nicht komplett in einem dunklen Hintergrund verschwinden.

Trotz Night-/Garage-Atmosphäre muss man sofort erkennen:

„Das ist sein Auto.“

Das gilt für alle Spieler.

Falls Fahrzeugfarbe dunkel ist:
automatisch subtilen Rim-Light bzw. Background-Separation verwenden.

Keine übertriebene weiße Kontur.

---

# 17. LOBBY – „NIGHT HUNT“ POSITION

In der Lobby befindet sich „Night Hunt“ aktuell sehr mittig und stört die Szene.

Prüfe Desktop UND Smartphone.

Auf Smartphone darf der Titel nicht:
- Charaktere verdecken
- Fahrzeuge verdecken
- Spielerinformationen überlagern

Setze den Lobby-Titel weiter nach oben in eine Safe Area.

Responsive gestalten.

Bei kleinen Displays eventuell:
- kleinere Schrift
- weniger Abstand
- höher positionieren

---

# 18. LOBBY – AUTO STEHT UNTER DEM PARKPLATZ

In der Lobby stimmt die Fahrzeugposition nicht.

Das Auto wirkt so, als würde es unter dem Parkplatz bzw. unter der Bodenebene stehen.

Korrigieren.

Fahrzeuge brauchen einen klaren Ground Anchor.

Beispiel:

vehicleGroundY

Das Fahrzeug muss optisch auf dem Parkplatz stehen.

Berücksichtigen:
- unterschiedliche Fahrzeughöhen
- unterschiedliche Fahrzeugbilder
- Custom Uploads
- mobile Ansicht
- Desktop

Keine Fahrzeuge dürfen im Boden versinken.

---

# 19. SPIELERKARTE BEIM LOBBY-BEITRITT DIREKT ÖFFNEN

Beim Betreten einer Lobby soll die Spielerkarte direkt sichtbar sein.

Nicht erst irgendwo klicken müssen.

Die wichtigste Ansicht nach dem Beitritt soll sofort zeigen:

- eigener Spieler
- andere Spieler
- Host
- Fahrzeuge
- Charaktere
- Haustiere
- Ready-Status

Die Karte kann weiterhin geschlossen/minimiert werden.

Aber Initial State beim Lobby-Beitritt:

playerCardOpen = true

bzw. passend zur bestehenden Architektur.

---

# 20. STATISTIKEN GAME-LIKE MACHEN

Aktuell wirken:

- Runden
- Siege
- Funde
- Siegquote

zu ernst bzw. wie ein Business-Dashboard.

Das soll wie ein Spiel aussehen.

Erstelle vier hochwertige Game-Stat-Cards.

Beispiele:

RUNDEN
Icon: Flagge / Start
große Zahl

SIEGE
Icon: Trophy / Krone

FUNDE
Icon: Radar / Ziel

SIEGQUOTE
Icon: Prozent / Rang

Optik:
- kleine Icons
- große Zahlen
- leichte Verläufe
- Game-UI
- leichte Tiefe
- nicht überladen
- passend zum restlichen Dark/Orange/Purple Design

Optional kleine Vergleichswerte wie:
„+4 diese Woche“

nur wenn Daten dafür wirklich vorhanden sind.

Keine erfundenen Werte.

---

# 21. ERFOLGE VERBESSERN

Die Erfolge nehmen aktuell zu viel Platz ein bzw. sind nicht optimal aufgebaut.

Standardmäßig nur drei wichtige Erfolge anzeigen.

Beispiel:

ERFOLGE

[Erfolg 1]
[Erfolg 2]
[Erfolg 3]

Darunter:

„Alle Erfolge anzeigen“

Beim Öffnen:
vollständige Achievement-Liste.

Die drei standardmäßig angezeigten Erfolge können sein:
- zuletzt freigeschaltet
- seltenste
- vom Nutzer angepinnte

Wenn Nutzer Erfolge anpinnen können:
maximal 3.

Visuell eher wie Game-Badges als einfache Textkarten.

---

# 22. TITEL-SYSTEM ENDLICH SICHTBAR MACHEN

Aktuell ist völlig unklar:

- wo ein Titel ausgewählt wird
- wo ein Titel gespeichert wird
- wo der Titel sichtbar ist

Prüfe zuerst die aktuelle Implementierung.

Falls bereits Titel existieren:
vorhandene Daten weiterverwenden.

Ansonsten sauberes Titel-System implementieren.

Bereich:

Profil
→ Statistiken
→ Erfolge & Titel

Dort eigener Abschnitt:

„Titel“

Anzeige:
- freigeschaltete Titel
- gesperrte Titel
- Voraussetzung
- aktuell ausgewählter Titel

Beispiel:

Street Hunter
Night Hunter
Hide Master
Radar King
Escape Artist
First Blood
Veteran
Legend

Keine dieser Bezeichnungen zwingend verwenden, wenn bereits Titel vorhanden sind.

Nutzer kann einen freigeschalteten Titel auswählen:

„Als Titel verwenden“

State:

selectedTitleId

Dieser Titel muss danach sichtbar sein:

PROFIL
unter dem Benutzernamen

LOBBY
auf der Spielerkarte

STARTBILD / PLAYER CARD
unter Name oder Level

LEADERBOARD
optional unter dem Namen, sofern genügend Platz

Beispiel:

ELIAS
Street Hunter
Level 18

Der Nutzer muss jederzeit erkennen können:
- welchen Titel er besitzt
- welchen Titel er ausgewählt hat
- wo er ihn ändern kann

---

# 23. PROFIL / STATISTIK / TITEL UX

Aktuell wirkt es so, als könne man etwas bei Statistiken anlegen, ohne danach zu erkennen, wo es erscheint.

Das darf nicht passieren.

Nach Auswahl eines Titels:

kleine Bestätigung:

„Street Hunter ist jetzt dein aktiver Titel.“

Danach direkt eine Vorschau zeigen:

So sehen andere Spieler dein Profil:

[Profilbild]

ELIAS
Street Hunter
Level 18

---

# 24. HAUSTIER + CHARAKTER + AUTO ALS EINE SZENE BEHANDELN

Aktuell scheinen Auto, Charakter und Haustier teilweise unabhängig voneinander platziert zu werden.

Das verursacht:
- Hund auf Auto
- Haustier verdeckt
- Charakter an falscher Stelle
- Auto im Boden
- Größenprobleme

Erstelle deshalb ein Scene Layout System.

Beispiel:

scene:
- vehicleBounds
- vehicleGroundY
- characterAnchor
- petAnchor
- titleSafeArea
- uiSafeArea

Je nach Ansicht können Presets existieren:

HOME_SCENE
LOBBY_SCENE
PROFILE_SCENE
CREW_SCENE

Die Elemente sollen nicht mehr zufällig positioniert werden.

---

# 25. RESPONSIVE MOBILE SAFE AREAS

Besonders Lobby und Startseite müssen auf aktuellen Smartphones funktionieren.

Beachten:
- iPhone Notch
- Dynamic Island
- Android Statusbar
- Bottom Navigation
- kleinere Displays

Keine wichtigen Elemente hinter Safe Areas.

„Night Hunt“ entsprechend positionieren.

Fahrzeuge und Charaktere dürfen nicht durch Bottom-Navigation abgeschnitten werden.

---

# 26. PERFORMANCE

Da viele Fahrzeuge, Tuningteile, Charaktere und Haustiere hinzukommen:

Keine riesigen Bilddateien ungefiltert laden.

Verwenden:
- WebP oder AVIF, falls bestehendes System kompatibel
- Lazy Loading
- Asset Preloading nur für unmittelbar benötigte Assets
- Cache
- kleine Thumbnails in Listen
- große Assets erst in Detailansichten

Nicht 200 Fahrzeugbilder gleichzeitig laden.

Das Smartphone soll sich nicht unnötig stark erhitzen.

---

# 27. DATENMODELL NICHT HARDCODEN

Bitte keine Konstruktionen wie:

if car === "BMW E36"

für hunderte Fahrzeuge.

Erstelle datengetriebene Konfigurationen.

Beispielsweise:

vehicleDefinitions
tuningPackages
wheelAnchors
vehicleTransforms
petAnchors
characterAnchors
crewOutfitRules

Die UI liest diese Konfigurationen.

Neue Fahrzeuge sollen später ohne große Änderungen am UI ergänzt werden können.

---

# 28. BESTEHENDE DATEN MIGRIEREN

Bestehende Nutzer dürfen ihr Auto, Charakter, Tier oder Outfit nicht verlieren.

Wenn alte Daten zum Beispiel nur:

selectedCar

enthalten und neu:

vehicleConfig

benötigt wird:

automatische Fallback-/Migration-Logik erstellen.

Beispiel:

wenn vehicleConfig fehlt:
→ aus bestehenden Fahrzeugdaten erzeugen.

---

# 29. DESIGNRICHTUNG

Die komplette App soll weiterhin die bisher gewünschte Richtung haben:

- modernes Multiplayer-Game
- Fortnite-/Racing-Game-Einfluss
- hochwertiges Mobile Game
- Dark UI
- Orange
- Purple
- Glass / leichte Transparenz
- starke Fahrzeugpräsentation
- Charakter und Auto im Mittelpunkt

NICHT:

- Business Dashboard
- langweilige graue Karten
- Bootstrap-Standard
- billige Neon-Überladung
- KI-Look
- extrem viele Glows
- unstrukturierte Menüs

---

# 30. WICHTIGE VISUELLE HIERARCHIE

HOME:
Spieler + Auto + Haustier

LOBBY:
alle Spieler + Autos + Haustiere

GARAGE:
Auto

KLEIDERSCHRANK:
Charakter

HAUSTIERE:
Tier

STATISTIK:
Spielerfortschritt

CREW:
Crew + Mitglieder

MAP:
aktuelles Spiel

Diese Bereiche dürfen visuell nicht miteinander konkurrieren.

---

# 31. ABNAHMEKRITERIEN

Die Aufgabe ist erst erledigt, wenn folgende Tests funktionieren:

TEST 1:
BMW E36 auswählen.

Madeira Violett auswählen.

Andere Felgen auswählen.

Bodykit auswählen.

Ergebnis:
identische Konfiguration in Garage, Profil, Startseite und Lobby.

TEST 2:
BMW 2er auswählen.

Felgen wechseln.

Ergebnis:
Felgen sitzen exakt an Vorder- und Hinterachse und wirken nicht wie ein darübergelegtes Bild.

TEST 3:
Eigenes Fahrzeugbild hochladen.

Hund auswählen.

Ergebnis:
Hund steht korrekt neben dem Fahrzeug und niemals auf dem Fahrzeug.

TEST 4:
Papagei auswählen.

Ergebnis:
Papagei sitzt in Lobby und Home sichtbar auf der Schulter des Charakters.

TEST 5:
Garage, Kleiderschrank, Statistiken und Haustiere im Profil öffnen.

Ergebnis:
Alle vier Profilkarten besitzen hochwertige passende Hintergrundbilder.

TEST 6:
Crew-Leader legt fest:
schwarzes Oberteil + graue Hose.

Ergebnis:
Crew-Mitglieder sehen den Dresscode und können ihr Outfit entsprechend anpassen.

TEST 7:
Map öffnen.

Ergebnis:
deutlich lebendigeres Game-Design bei weiterhin guter Lesbarkeit.

TEST 8:
Garagenhintergrund freischalten.

Nach Werbung 1:
1/10.

Nach Werbung 9:
9/10.

Nach Werbung 10:
Freigeschaltet.

App neu starten.

Ergebnis:
Freischaltung bleibt bestehen.

TEST 9:
Lobby betreten.

Ergebnis:
Spielerkarte ist direkt geöffnet.

TEST 10:
Lobby auf Smartphone.

Ergebnis:
Night Hunt liegt nicht mehr störend über Spielern oder Autos.

TEST 11:
Lobby Fahrzeug.

Ergebnis:
Auto steht sichtbar auf dem Parkplatz und nicht darunter.

TEST 12:
Statistik öffnen.

Ergebnis:
Runden, Siege, Funde und Siegquote wirken wie Game-Statistiken und nicht wie ein Business-Dashboard.

TEST 13:
Erfolge öffnen.

Ergebnis:
zunächst drei Erfolge sichtbar.

Button:
„Alle Erfolge“

öffnet vollständige Liste.

TEST 14:
Titel auswählen.

Ergebnis:
Titel wird gespeichert und erscheint unter dem Spielernamen im Profil und in der Lobby.

TEST 15:
Startseite mit anderem Spieler mit dunklem Fahrzeug.

Ergebnis:
Fahrzeugmodell ist trotzdem eindeutig erkennbar.

---

# 32. VORGEHENSWEISE FÜR DIE IMPLEMENTIERUNG

Arbeite nicht blind Datei für Datei.

Zuerst Projekt analysieren.

Dann bestehende Systeme identifizieren:

1. Vehicle State
2. Vehicle Rendering
3. Garage
4. Tuning
5. Profile
6. Lobby
7. Home
8. Pets
9. Character/Wardrobe
10. Crew
11. Stats/Achievements/Titles
12. Map
13. Rewarded Ads

Danach gemeinsame Datenstrukturen reparieren.

Erst danach UI aktualisieren.

Keine vier verschiedenen Lösungen für dasselbe Problem bauen.

---

# 33. KEINE FUNKTIONSLOSEN MOCKUPS

Wichtig:

Nicht einfach Buttons hinzufügen, die nichts tun.

Wenn ein Button sichtbar ist, muss er funktionieren.

Insbesondere:

- Outfit anpassen
- Titel auswählen
- Alle Erfolge
- Crew beitreten
- Crew erstellen
- Haustier öffnen
- Garagenhintergrund freischalten
- Fahrzeugtuning
- Bodykit auswählen
- Felgen auswählen

Keine Fake-Komponenten.

---

# 34. ABSCHLUSSBERICHT

Nach der Umsetzung bitte kurz auflisten:

1. Welche Dateien wurden geändert?
2. Welche neuen Komponenten wurden erstellt?
3. Welche Datenmodelle wurden verändert?
4. Wie wurde die VehicleConfiguration zentralisiert?
5. Wie funktionieren die Wheel Anchors?
6. Wie funktionieren die Pet Anchors?
7. Wie funktioniert der Crew-Dresscode?
8. Wie funktioniert die 10-Werbungen-Freischaltung?
9. Wo wird selectedTitleId gespeichert?
10. Welche Fahrzeugmodelle/Tuningpakete wurden ergänzt?
11. Welche Assets fehlen eventuell noch?
12. Welche Tests wurden ausgeführt?
13. Gibt es noch bekannte Fehler?

Wenn für einzelne Fahrzeugmodelle noch echte Grafikassets fehlen, nicht einfach schlechte Platzhalter verwenden.

Stattdessen:
- komplette technische Unterstützung vorbereiten
- fehlende Assets exakt auflisten
- nennen, welche Ansicht benötigt wird
- benötigte Bildgröße nennen
- benötigte Wheel Anchors nennen
- benötigte Tuningvarianten nennen

Ziel ist eine skalierbare hochwertige Lösung und keine Sammlung einzelner Hacks.

SETZE DIE ÄNDERUNGEN DIREKT IM PROJEKT UM UND BESCHRÄNKE DICH NICHT AUF EINE ERKLÄRUNG ODER EINEN VORSCHLAG.