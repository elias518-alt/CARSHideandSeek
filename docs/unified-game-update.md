# Gemeinsames Spiel-, Fahrzeug- und Profilupdate

Ausgangsstand: `main dfc4912`. Auftrag: [vollständiger Prompt](unified-game-update-request.md). Umsetzung: `codex/unified-game-update`.

Nutzerentscheidung: Ein eigenes Foto hat standardmäßig Vorrang. Die Tuningvorschau zeigt immer das Spielmodell. Die gespeicherte Wahl „Eigenes Foto / Getuntes Spielmodell“ gilt außerhalb der Tuningvorschau überall. Keine Tuninggrafik wird auf das eigene Foto geklebt.

## Bearbeitung aller 34 Auftragspunkte

| Nr. | Bereich | Ergebnis |
|---|---|---|
| 1 | Zentrales Fahrzeug | `vehicle-configuration.js` normalisiert gespeicherte Fahrzeuge, öffentliche Spieler und Altbestände. Alle Szenen verwenden dieselben Renderfunktionen. Zusätzliche, noch nicht bebilderte Bauteile stehen als Stock-Felder im Schema. |
| 2 | Felgen | Explizite Anker und perspektivische Ellipsen pro vorhandener kalibrierter Illustration. F22/G42 und E36-Coupé neu kalibriert; ohne Anker gesperrt. Vollständige Katalogabdeckung wartet auf passende Assets. |
| 3 | Madeira Violett | Gemeinsame Farbzuordnung `#51364f` für Garage, Profil, Home und Lobby. |
| 4 | Pakete | Stock, Street Sport, Clean und Track für unterstützte Illustrationen. Hersteller-/Modell-/Jahr-Regeln für weitere Pakete als Grafikbriefs vorbereitet. Vollständige Stoßfänger, Spoiler und Tieferlegung bleiben assetabhängig offen. |
| 5 | Fahrzeuge/Hersteller | Alle 1.175 Katalogdefinitionen einschließlich Aliassen/Baujahrbereichen geprüft. 969 lösen eine vorhandene Illustration auf, 112 haben gemessene Radanker. Nicht mit 1.175 unterschiedlichen Bildern verwechseln. Modellbezogene Lücken im JSON-Audit. Bestehende Atlanten sind nicht pauschal logo-frei verifiziert. |
| 6 | Eigene Fotos | Automatische Alpha-Grenzen, unverzerrtes Seitenverhältnis, gespeicherte Größe und horizontale Position. Bodenhöhe wird fest gehalten; Figur und Tier bekommen separate Flächen. Bei nicht auslesbaren CORS-Bildern bleibt das Bild mit ursprünglichen Grenzen nutzbar. |
| 7 | Tiere | Typ-, Pose-, Größen- und Breitenabhängige Anker. Hunde/Katzen/große Tiere auf Boden; Papagei/Affe/Hamster an Schulter. Papagei ohne Ständer, eigener Fußanker trotz langem Schwanz. |
| 8 | Begrüßung | Runder Kopfausschnitt des ausgewählten Tiers; Klick öffnet Haustierprofil mit Fell-/Augenfarbe und Wechselaktion. |
| 9 | Profilkarten | Vier bebilderte Zugänge: Garage, Outfit, Statistik, Haustier. Für Outfit und Haustiere wurden echte, passende Hintergrundbilder ergänzt. Die Karten zeigen Szenenmotive, nicht den jeweils gewählten Look oder das individuell gewählte Haustier. Das Erfolge-Fenster wurde verkleinert. |
| 10 | Kleidung | Originalfiguren bleiben. Luca/Mia zusätzlich mit jeweils 12 Oberteilen und 12 unabhängig kombinierbaren Unterteilen, getrennten Farben, Sneakerfarbe und abwählbaren Accessoires. PLUS bleibt serverseitig erforderlich. Bestehende Stand-/Siegereffekte bleiben; keine neuen 3D-Animationen behauptet. |
| 11 | Crew-Dresscode | Nur CHIEF speichert vier Regeln. Die Einstellung „Crew-Farben & Dresscode“ steht sichtbar direkt unter der Crew-Navigation. Geschlechtsübergreifende Kleidungs-IDs statt falscher Zahlenindizes. Mitglieder sehen Empfehlung und können einen Entwurf öffnen; erst „Look speichern“ ändert das Outfit. |
| 12 | Crew finden | Vorschläge aus echten vorhandenen öffentlichen/Anfrage-Crews, Mitglieder/freie Plätze und Beitreten/Anfragen/Erstellen. Keine erfundene Nähe oder Aktivität. |
| 13 | Karte | Bestehende Quellen und Standortregeln erhalten; differenzierte Straßen/Parks/Wasser, lesbare Beschriftungen, klare Rollenmarker und kompakte weiterhin erreichbare Quellenangabe. |
| 14 | Werbung | Zehn insgesamt bestätigte Rewarded-Videos, kein täglicher Fortschrittsreset; dauerhafte Hintergrundauswahl. Persistentes Ledger und Anbieterprüfung bleiben. Kein freigeschalteter Live-Anbieter vorhanden. |
| 15 | Tuning überall | Gespeicherter Look wird über Server-/Freunde-/Crew-/Ergebnis-Projektionen weitergegeben. Bei Foto-Modus bleibt absichtlich das Originalfoto sichtbar, gemäß Nutzerentscheidung. |
| 16 | Dunkle Autos | Dezente Hintergrundaufhellung und Bodenschatten, keine künstliche Umfärbung des Fahrzeugs. |
| 17 | Lobbytitel | Eigener normaler Layoutbereich mit oberer Safe Area statt Überlagerung der Fahrzeuge. |
| 18 | Lobbyboden | Gemeinsame Unterkante für Auto und stehende Figur, lokale Schatten. |
| 19 | Spielerszene | Bei neuer Lobby offen; einklappbar; Polling überschreibt die Entscheidung nicht. |
| 20 | Statistik | Runden/Siege/Funde/Siegquote als vier Karten plus Quotenring, echte Daten und Freischaltungen. |
| 21 | Erfolge | Drei zunächst sichtbar, freigeschaltete zuerst; vollständige Liste über funktionierenden Dialog. |
| 22 | Titel | Freigeschaltet/gesperrt/aktiv unterscheidbar; bestehender sicherer Equip-RPC; Profil, Lobby und Ergebniskarte zeigen Titel. |
| 23 | Titel-UX | Vorschau, Speichern-Rückmeldung, erneutes Öffnen zeigt gespeicherten Titel. Gesperrte Auswahl bleibt auch während anderer Mutationen gesperrt. |
| 24 | Gemeinsame Szene | `scene-layout.js` + `showroom.js` für Home, Profil, Lobby, Spieler-/Freund-/Crewkarte und Ergebnis. |
| 25 | Mobile | Safe Areas, getrennte Szenelemente, kleinere/größere Viewports geprüft; keine horizontale Seitenüberbreite in den geprüften Abläufen. |
| 26 | Performance | Lokale WebP-Atlanten, Browsercache, gecachte Alpha-Grenzen, geplante statt mehrfacher Layoutberechnung, unveränderte Lobby-Knoten beim Polling erhalten. Kein neues 3D-/KI-Runtime-Paket. |
| 27 | Datenmodell | Konfigurations-, Modell-, Kleidungs-, Crew- und Ankerregeln in separaten Datenmodulen. Fehlende Teile werden nicht scheinbar ausgerüstet. |
| 28 | Altbestände | Additive Migration; Foto als Standard, Stock-Fallback; Originalfiguren erhalten; bestehende permanente Werberechte und noch gültige temporäre Alt-Rechte bleiben gültig. |
| 29 | Design | Dunkle Spieloberfläche, klare Akzente und Bildkarten in bestehender App. |
| 30 | Hierarchie | Auto/Figur/Tier auf eigener Szene; Name/Titel/Bedienung außerhalb ihrer Stellflächen. |
| 31 | Abnahme | Lokale Browser-, Pixel-, Unit- und PostgreSQL-Prüfungen unten. Visuelle Modellabdeckung begrenzt auf dokumentierte Assets. |
| 32 | Vorgehen | Erst bestehende Systeme und Tests geprüft; anschließend gemeinsames Daten-/Renderformat, UI und Regressionen. |
| 33 | Funktion | Neue Aktionen mit tatsächlicher Speicherung/Navigation; gesperrte Teile erklären Level-/Asset-Grenzen. Werbung ohne Anbieter bleibt deaktiviert. |
| 34 | Bericht | Dieser Bericht und vollständiger Grafik-Audit, keine als fertig ausgegebenen fehlenden Grafikvarianten. |

## Daten und Implementierung

- Fahrzeug: Fahrzeuge bleiben in `vehicles`, Loadouts in `auth.users.raw_user_meta_data.chs_vehicle_loadouts`. Pro eigener Fahrzeug-ID kommt `chs_vehicle_presentations` hinzu (`mode`, `customVehicleTransform`). Lesen/Schreiben prüft Eigentümer, Level und unterstützte Teile. Serverzustand und Rundenergebnis enthalten die normalisierte Darstellung.
- `VehicleConfiguration`: Marke, Modell, Baureihe, Baujahr, Lack, Foto und verfügbare Teile werden einmal normalisiert. `carPhotoMarkup`/`vehicleIllustration`/`lobbyCarMarkup` teilen diese Grenze. Nicht verfügbare Stoßfänger, Auspuff, Tint und Suspension bleiben Stock; es gibt dafür keine wirkungslosen Auswahlknöpfe.
- Radanker: x/y, Breite/Höhe, Rotation und perspektivische Ellipse beziehen sich auf den konkreten Sprite-Ausschnitt. F22/G42 haben verschiedene Koordinaten; andere Felgen werden nur auf kalibrierten Illustrationen angeboten. Weitere Modelle benötigen vermessene Grafiken, kein universelles Rad-Overlay.
- Foto-Transform: Scale 0,75–1,15, horizontale Verschiebung ±8 %, zusätzlich auf freie Stellfläche begrenzt. `translateY` und `groundY` bleiben 0, damit das Fahrzeug nicht angehoben wird. Sichtbare Grenzen stammen automatisch aus Alpha. `visualWidth/Height` und weitere Offset-Felder sind Schemareserven, keine frei wirksamen Positionsregler.
- Pet-Anker: Boden und Schulter getrennt; die Schulter berücksichtigt Blickrichtung, Tiergröße und beim Papagei den Fußkontakt statt des Schwanzendes. Tiere stehen nicht in der Fahrzeugfläche.
- Crew: `chs_crews.dresscode` ist additives JSON mit `top`, `pants`, `topColor`, `pantsColor`; `any` erlaubt freie Wahl. Der RPC schützt die Rolle, serialisiert Änderungen und validiert Werte. Kostenlose Figuren werden nicht automatisch durch PLUS-Figuren ersetzt.
- Titel: Kein zweiter widersprüchlicher Speicher. `chs_cosmetic_choices.title` bleibt der serverseitig ausgerüstete Wert; `crewUI.selectedTitleId` wird aus `chs_level_rewards.id` abgeleitet. Clients dürfen keine gesperrten Titel über die Lobbyidentität einschleusen.
- Werbung: `rewardCount` wird vor Aufräumen alter Ereignisse erhalten. Erst verifizierte Anbieterbelege zählen; nach zehn bleibt `rewardPermanent` bestehen. Wiederholte Belege, fehlgeschlagene Speicherung und unsichere Spielsituationen geben keine Belohnung. Die Tagesgrenze dient nur der Frequenzbegrenzung. Bereits früher gelöschte Ereignisse können nicht nachträglich rekonstruiert werden.
- Öffentliche Darstellung: Neue private SQL-Helfer geben nur erlaubte Kosmetikfelder aus, prüfen Level/PLUS und verbergen Gesichtsfotos/Traits/sonstige Metadaten. Keine neuen Standort- oder Nachrichtenfreigaben.

## Grafikabdeckung und offene Assets

[vehicle-asset-audit.json](vehicle-asset-audit.json) nennt jede Marke, Modell-/Generationsdefinition, vorhandenes Asset, Radanker, Paketbrief und fehlende Variante. Reproduzierbar mit `node scripts/vehicle-asset-audit.cjs`.

Für neue Grafiksets: 1024 × 512 px, transparentes WebP, vorne links in Dreiviertelansicht, ohne Logos, Magenta-Lackmaterial bzw. separate Lackmaske. Erforderlich sind Vorder-/Hinterradanker mit Ellipsen-/Maskenmaßen, getrennte Stoßfänger/Schweller/Spoiler, Glasmaske und Karosserie-/Radtrennung für echte Tieferlegung. Pakete wie M-Sport-, AMG-Line- oder S-Line-inspiriert sind **Grafikbriefs**, keine Behauptung offizieller historischer Modellverfügbarkeit.

Neu nutzbar: BMW 2er F22/G42 für kalibrierte Felgen/Seitenschweller; Mesh-Felgen (Level 12), Clean (Level 10), Track (Level 15), neben bisherigen Silber/Graphit, Street Sport und Unterbodenlicht. Zusätzlich eine neue, visuell logo-frei geprüfte E36-Coupé-Grafik, getrennt von der Limousine, mit eigenen Radankern. Noch offen: flächendeckende modellgenaue Bodykits, Spoiler, Tieferlegung, Scheibentönung sowie verifizierte logo-freie Ersetzungen bestehender Fahrzeugatlanten. Diese assetabhängigen Teile sind nicht auswählbar.

Neue lokale Grafikdateien: `bmw-e36-coupe.webp` (~228 KiB), `wardrobe-male.webp` (~316 KiB), `wardrobe-female.webp` (~248 KiB), `parrot-shoulder.webp` (~292 KiB), `assets/profile/wardrobe.webp` und `assets/profile/pets.webp`. Originale und Herkunft siehe [THIRD-PARTY-ASSETS.md](../THIRD-PARTY-ASSETS.md).

## Noch offen / nur teilweise umgesetzt

- **Fahrzeugposition und eigene Fotos (6, 18, 24, 25):** Die gemeinsame Szene und Alpha-Beschnitt sind implementiert; die vom Nutzer gemeldete schlechte Bildposition ist damit nicht abschließend behoben. Aktuell wirken nur Größe und horizontale Verschiebung. Ein individuelles Foto mit opakem Hintergrund oder ungewöhnlichem Aufnahmewinkel lässt sich nicht automatisch zuverlässig auf die Straßenebene setzen. Vertikale Korrektur, visuelle Abmessungen sowie Charakter-/Tierabstand sind lediglich Schemafelder. Eine visuelle Abnahme mit dem konkreten betroffenen Foto auf Mobilgeräten fehlt.
- **Fahrzeug- und Tuninggrafiken (2, 4, 5, 15):** Nur 112 von 1.175 Definitionen haben Radanker; 969 Definitionen lösen ein bestehendes Bild auf, oft als gemeinsamer Atlas statt eigenem Modellbild. Modell- und jahrgenaue Fahrzeuge, Radmasken, Bodykits, Spoiler, Auspuff, Tieferlegung und Tönung sind nicht flächendeckend vorhanden. Ältere Atlanten sind nicht vollständig auf Herstellerlogos und realistische Farbwirkung geprüft.
- **Dynamische Profilkarte (9):** Die vier Karten haben nun echte Bildhintergründe. Kleiderschrank und Haustiere zeigen Motive; das aktuell gewählte Outfit/Tier wird in der kleinen Karte noch nicht als dynamisch zugeschnittenes Motiv gerendert.
- **Crew-Farben (11):** Festlegbar sind bisher Kleidungsfarben als Empfehlung für den Dresscode. Eine eigene Crew-Designfarbe für Oberfläche/Emblem und automatisches Erzwingen des Outfits sind nicht implementiert.
- **Kleidung und Crew (10–12):** Die 12×12-Kombinationen gelten für zwei zusätzliche PLUS-Figuren; weitere individuell modellierte Kleidungsstücke, Schuhformen und neue Posen/Animationen fehlen. Der Crew-Dresscode umfasst Oberteil, Hose und deren Farben, nicht Schuhe oder Accessoires. Crew-Empfehlungen basieren auf verfügbaren echten Crews, nicht auf Nähe oder Live-Aktivität.
- **Werbung (14):** Reward-Ledger und dauerhafte Freischaltung sind vorbereitet. Reale Videos, Anbieterbelege und Einnahmen funktionieren erst nach Anbietereinrichtung und Freigabe; es gibt noch keine produktive Werbeauslieferung.
- **Produktionsabnahme (13, 16–19, 26, 28, 31):** Kartenstil, Bodenwirkung, Bildkomposition und Performance wurden lokal bzw. mit Testdaten geprüft. Für alle Geräte, echte Fotos, echte GPS-Situationen und reale Spielrunden steht eine visuelle/technische Abnahme aus. Die Spielerszene öffnet sich beim Beitritt, aber keine einzelne Spielerprofilkarte automatisch. Der neue App-Code ist noch nicht auf Render live.

## Tests und Abnahme

- `npm test`: 235 Tests für Server, Rejoin, Ready/Spielstart, Standort, Moderation, Berechtigungen, Rewards, Rendering und neue Konfiguration.
- `scripts/unified-game-browser-qa.cjs`: 60 Prüfungen, Foto-/Modellwechsel samt API-Speicherung, identische E36-Darstellung bei fremdem Spieler, Titel/Locks, drei/alle Erfolge und kompaktes Fenster, Crew-Empfehlung/Beitritt/Dresscode direkt bei der Navigation, Hintergrundfreischaltung und Account-Reset, aufklappbare Lobby.
- `scripts/showroom-browser-qa.cjs`: 224 Prüfungen für eigene Fotos/Modelle, unterschiedliche Figuren und alle Tierarten bei 360/390/568/1000 px.
- `scripts/character-studio-browser-qa.cjs`: 320 Prüfungen, bestehende Auswahl, PLUS-Grenzen, neue Kleidung samt unabhängiger Speicherung, Haustiere und Account-Wechsel bei 360/390/1000 px.
- `scripts/garage-progress-browser-qa.cjs`: 108 Prüfungen, Garagenauswahl, Tuningvorschau, Farb-Editor aus dem Tuning, Level-Locks, Freischaltungen und leere Garage.
- `scripts/crew-progression-sql-qa.mjs`: 65 echte PostgreSQL-Prüfungen mit PGlite für Rollen, Kapazität, Einladungen, RLS, Titel, Dresscode und öffentliche Kosmetikprojektion.
- `scripts/companions-visual-qa.cjs`: Pixeldifferenzen für elf Tierarten und 18 Outfitproben; Fell/Augen bzw. Ober-/Unterteile ändern sich unabhängig, neutrale Details/Haut bleiben erhalten.
- `scripts/game-design-browser-qa.cjs`: 52 Prüfungen bei 360/390/430/1024 px. `scripts/social-map-browser-qa.mjs`: 181 Prüfungen mit tatsächlichem MapLibre und lokalen Standort-/RPC-Fixtures. `scripts/vehicle-studio-browser-qa.mjs`: 67 Prüfungen, darunter E36-Coupé-Lack ohne Veränderungen an neutralen Scheiben/Details.

Die 15 Abnahmeszenarien werden durch diese Prüfungen abgedeckt, mit zwei klaren Grenzen: Reale Werbeauslieferung ist mangels freigeschaltetem Anbieter nicht testbar; die vollständige Fahrzeug-/Tuninggrafikabdeckung ist gemäß Asset-Ausnahme des Auftrags noch offen. GPS-Prüfungen verwenden synthetische Orte, keine fremden Live-Standorte. Nicht jede mögliche Mischung aus 144 Kleidungsvarianten wurde einzeln visuell freigegeben; Grenzfälle und unabhängige Materialfarben wurden geprüft.

## Auslieferung und Rückweg

`20261021100000_unified_vehicle_crew.sql` wurde am 22.10.2026 erfolgreich in einer Transaktion auf Supabase angewandt. Vorherige Funktionsdefinitionen wurden für den Rückweg gesichert. Anschließend geprüft: Dresscode-Spalte vorhanden, öffentliche Crew-RPC ausführbar, private Projektionshelfer nicht direkt für `authenticated` ausführbar. Kein Spielerbestand wurde gelöscht oder zurückgesetzt.

App-Code ist bis zum Merge dieses Branches **nicht auf Render live**. Er kann nach Merge über den bestehenden Render-Startbefehl ausgeliefert werden; geänderte Frontenddateien besitzen neue Cache-Versionen. Die additive Datenbankänderung ist mit dem bisherigen Client kompatibel. Ein App-Rollback auf den vorherigen Commit erfordert kein Löschen von Fahrzeugen, Outfits oder der neuen Dresscode-Spalte. Vorherige SQL-Funktionen nur bei tatsächlichem Bedarf aus der gesicherten Version wiederherstellen.

## Änderungsübersicht

Neue Module: `vehicle-configuration.js`, `vehicle-definitions.js`, `scene-layout.js`, `crew-outfit.js`, `wardrobe-catalog.js`, `wardrobe-renderer.js`, `game-map-style.js`, `unified-game.css`.

Bestehende Integrationen: `app.js`, `server.js`, `round-engine.js`, `reference-ui.js`, `showroom.js`, `vehicle-studio.js`, `vehicle-art.js`, `vehicle-rewards.js`, `vehicle-reward-service.js`, `vehicle-rewards-ui.js`, `account-ui.js`, `character-studio.js`, `pet-ui.js`, `pets.js`, `crew-hub.js`, `community-ui.js`, `social.js`, `map.js`, `social-map.js`, `game-design.js`, `ad-service.js`, `ads-ui.js`, `index.html`.

Dazu gehören die additive SQL-Migration, vier lokale Grafikdateien, Herkunftsnachweise, neue/angepasste Unit- und Browser-/SQL-/Pixelprüfungen sowie Anforderung, dieser Bericht und Grafik-Audit. Der vollständige Dateidiff steht im zugehörigen Pull Request.
