# Originalfiguren und PLUS-Haustiere

Die v5-Karikaturen wurden durch die ursprünglichen realistischen Studiofiguren Alex und Maya ersetzt. Night Rider, Silver Line und Orange Shift bleiben kostenlos auswählbar. Nico und Lea ergänzen das PLUS-Studio mit natürlichen Proportionen, realistischen Gesichtern und drei Streetwear-Looks. Die Originalgrafiken werden nicht überschrieben.

## Kleiderschrank

- Alex und Maya: wieder drei getrennt kombinierbare Oberteile und Hosen (je neun vorhandene Komplettgrafiken).
- Nico und Lea: je drei abgestimmte Komplettlooks; Oberteil und Hose lassen sich getrennt einfärben. Es wird keine freie Kombination angeboten, für die keine passende Grafik vorhanden ist.
- Zehn Kleidungsfarben, originale oder gespiegelte Blickrichtung. Drei kurze Sieger-Effekte: Sprung, goldener Schein, Konfetti. Sieg-/Abbruchprüfung und `prefers-reduced-motion` bleiben erhalten. Dies sind hochauflösende 2D-Grafiken, keine frei beweglichen 3D-Modelle.
- `chs_appearance` Version 6 ergänzt die allowlist-validierte `figure`. Vorhandene männliche/weibliche Studioauswahlen fallen automatisch auf Alex/Maya zurück. Ungültige Auswahlwerte werden begrenzt; alte Selfie-Gesichtsauflagen werden weiterhin nicht gerendert. Die frühere Bildlöschung beim Speichern bleibt erhalten.
- Die Selfie-Gestaltung wird bei diesen Figuren nicht angeboten. Die Foto-/Erkennungsskripte werden von der App nicht geladen. Frühere normalisierte Gesichtsmerkmale können für Kompatibilität in Metadaten verbleiben, werden jedoch nicht auf die realistischen Figuren angewandt. Die UI erklärt die Einschränkung.

## Separater Profilbereich: Haustiere · PLUS

Elf Begleiter: Schäferhund, Husky, Dobermann, Bengalkatze, Britisch Kurzhaar, Papagei, Fisch im runden Aquarium, Hamster, Pferd, Kapuzineraffe und Esel. Britisch Kurzhaar hat zusätzlich eine stehende und sitzende Variante.

Jeder Begleiter bietet artgerechte Farbpaletten für Fell/Gefieder/Schuppen, Augenfarbe, drei Darstellungsgrößen und eine gespiegelte Blickrichtung. Rassetypische schwarze/weiße Fellzeichnungen, Glas, Holz und weitere neutrale Details bleiben beim Farbwechsel erhalten. Pro Spieler ist ein Begleiter aktiv. „Ohne Begleiter“ entfernt die Auswahl.

Die Auswahl erscheint auf Startseite, in der Lobby und im Ergebnis. Die skalierte Bodenposition und Begrenzung halten auch große Tiere innerhalb der Szene auf dem Handy. Der Kleiderschrank enthält keine Tierkonfiguration.

## Speicherung und PLUS-Schutz

`pets.js` normalisiert ausschließlich bekannte Rassen, Farbwerte und begrenzte Größen-/Haltungsoptionen. Bildadressen und beliebige freie Metadaten werden verworfen. `POST /api/pets-save` prüft Authentifizierung, Kontozugriff und aktive PLUS-Rechte über die vorhandene RPC. Es speichert ausschließlich `chs_pet` über die Auth-API; Kleidungsdaten bleiben getrennt. Entfernen ist auch nach PLUS-Ablauf möglich.

`create`, `join` und `identity` normalisieren und prüfen die Begleiter serverseitig. Die bestehenden Membership-Caches gelten auch für Tiere; beim nächsten `state`-Abruf des Spielers wird ein Begleiter nach Rechteverlust entfernt. Clientseitiger Rechteverlust blendet ihn sofort aus. Bei Kontowechsel/Logout wird der Dialog entsorgt; verspätete Speicherantworten dürfen das neue Konto nicht verändern.

Keine Datenbankmigration, neue Umgebungsvariable oder externe Runtime-API nötig. Die neuen Grafiken kommen als lokale WebP-Dateien mit ungefähr 1 MB Gesamtgröße hinzu. Käufe bleiben deaktiviert. Die Datenschutzfassung 2026-10-19.2 beschreibt kosmetische Einstellungen und die pausierte Selfie-Funktion; bestehende Zustimmungsprüfung greift erneut.

## Prüfung

- `npm test`: Normalisierung, Wiederherstellung, PLUS-Prüfungen für Haustier-Speichern/gefälschte Lobbydaten/Entzug, getrennte Metadatenfelder, Kontowechsel und Siegerbedingungen.
- `scripts/character-studio-browser-qa.cjs`: tatsächliche UI bei 360/390/1000 px, Original- und neue Figuren, alle Tierarten, Konfiguration/Speichern, Ablehnung/Retry, getrennte Metadaten, Logout während eines Speichervorgangs, Ergebnisanzeige und mobile Grenzen.
- `scripts/companions-visual-qa.cjs`: Kontaktbögen und echte Pixelprüfung aller elf Begleiter. Fell- und Augenänderungen müssen sichtbar sein; neutrale Materialbereiche dürfen nicht umgefärbt werden.
- `scripts/showroom-browser-qa.cjs`: bestehende Fahrzeug-/Figurenplatzierung.

Ergebnis am 19.10.2026: 212 Node-Tests, 302 Browserprüfungen, 172 Showroom-Prüfungen sowie Pixelprüfungen für elf Tiere und zwölf Kleidungsansichten bestanden. In den geprüften neutralen Tierbereichen und Hautbereichen der Figuren wurden keine Farbänderungen durch die Materialregler festgestellt.

Vorschauen: [Startseite auf dem Handy](previews/plus-home-20261019.png) · [Alle Begleiter mit natürlichen Farben](previews/plus-pets-20261019.png).
