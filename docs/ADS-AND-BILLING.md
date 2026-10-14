# Werbung und spätere Zahlungen

Stand: 14. Oktober 2026. Keine echten Käufe, Werbeauslieferung, SDKs oder Tracking-Pixel aktiviert.

## Empfehlung für CAR HIDE & SEEK

Zunächst freiwillige Werbung nur außerhalb einer Runde erproben. Die App kann beim Autofahren genutzt werden; Countdown, Vorbereitung, aktive Runde, Standort-/Sicherheitsaktionen und Wiederverbindung bleiben werbefrei. Auch im Fahrer-Modus keine Werbung. Werbung darf weder eine Aktion verdecken noch eine Runde verzögern.

| Format | Geeigneter Platz | Erlös und Nutzung |
| --- | --- | --- |
| Banner | Optional unten in Garage/Profil, mit reserviertem Platz und Abstand zu Navigation | Meist geringer Erlös pro Impression; Sichtbarkeit und Klickqualität zählen. Keine Layoutsprünge oder absichtliche Fehlklicks. |
| Interstitial | Frühestens nach abgeschlossener Runde und ausdrücklich gewählter Rückkehr ins Menü | Häufig höherer Erlös pro Impression, aber starke Unterbrechung. Für die erste Version weglassen; später höchstens alle drei abgeschlossenen Runden, mindestens zehn Minuten Abstand und maximal drei pro Tag als Ausgangspunkt testen. |
| Freiwillige Rewarded Ad | Eigener Button in der Garage: vorab klar benannte kosmetische Belohnung | Häufig höherer Erlös pro abgeschlossener Impression, weil Nutzer sich bewusst entscheiden. Kein Vorteil bei Sichtbarkeit, Radius, Finden, Geschwindigkeit, XP oder Ranglisten. |

Eine PLUS-Werbefreiheit ist noch keine zugesagte Leistung. Erst Produktentscheidung treffen, bevor sie beworben wird. Ein Werbeversprechen oder eine kosmetische Belohnung wird erst angezeigt, wenn ein Anbieter die Gelegenheit tatsächlich liefern kann. Bei fehlender Werbung keine Strafe, Endlosschleife oder blockierte Navigation.

## Sind 15 Sekunden sinnvoll?

Für freiwillige Clips sind 15 Sekunden ein guter Wunschwert. Netzwerke bestimmen jedoch Creative-Länge, Überspringbarkeit und Belohnungsbedingungen. Auch 20–30 Sekunden und zusätzliche Endkarten sind möglich. Eine feste Dauer darf die Oberfläche nur versprechen, wenn der ausgewählte Anbieter sie garantiert. Die App darf keinen eigenen Timer verwenden, der eine noch nicht bestätigte Wiedergabe als abgeschlossen wertet.

Mehr Sekunden bedeuten nicht automatisch mehr Geld. Entscheidend sind unter anderem Nutzerregion, Werbenachfrage, Saison, Plattform, Einwilligung, verfügbare Anzeigen, Sichtbarkeit und tatsächlicher Abschluss. Rewarded Ads erzielen oft höhere eCPMs als Banner; eine Garantie ist das nicht.

Rechenweg: ausgelieferte Impressionen / 1.000 × beobachteter eCPM. Rein hypothetisch ergeben 10.000 ausgelieferte Impressionen bei 5 € eCPM 50 €. Das ist keine Prognose und berücksichtigt keine Steuern, Gebühren oder Ausfälle. Aufrufe der App entsprechen nicht ausgelieferten Werbeimpressionen. Erst reale Anbieterberichte erlauben eine belastbare Kalkulation.

## Web-App und native App

Die aktuelle App ist eine Web-App. Ein natives Mobile-SDK wie AdMob lässt sich nicht einfach als Script einbauen. Für Web ist ein ausdrücklich für diese Nutzung zugelassenes Web-Produkt nötig; Rewarded-Inventar hängt von Anbieter, Freischaltung und Browser ab. Eine spätere native App oder ein Wrapper benötigt eine eigene SDK-/Plattformprüfung. Keine Integration nur aufgrund eines vermeintlich höheren eCPMs wählen.

## Technische Vorbereitung

`monetization-policy.js` definiert unveränderliche, deaktivierte Fähigkeiten, einen gesperrten Checkout-Vertrag und die Sicherheitskontexte für Werbung. Es lädt keinen Anbieter. SQL lehnt nicht unterstützte PLUS-Aktionen einschließlich Checkout ab. Entitlements entstehen aktuell ausschließlich über Administratoren mit Datenbankrollen `admin` oder `super_admin`.

Spätere Zahlungsintegration benötigt:

- Einen bewusst ausgewählten Anbieter, Geschäfts-/Auszahlungsdaten und verifizierte Produkte; keine erfundenen Preise oder Firmendaten.
- Serverseitige Checkout-Erstellung mit zugelassenen Produkt-IDs. Nutzerwerte bestimmen niemals den Preis.
- Signaturgeprüfte, wiederholbar verarbeitbare Webhooks mit eindeutiger Ereignis-ID; Ablauf, Kündigung, Erstattung und Rückbuchung berücksichtigen.
- Abgleich bezahlter Entitlements, klare Priorität gegenüber manuellen Freischaltungen und Auditprotokoll.
- Separate Freigabe für echte Käufe nach Sandbox-Prüfung. Keine Käufe allein durch ein Frontend-Flag aktivieren.

Spätere Werbung benötigt Anbieterfreigabe, korrektes Konto, Einwilligungsablauf einschließlich Widerruf, dokumentierte Datenflüsse und getestete Plattformunterstützung. Belohnungen erst nach verifiziertem Abschluss, bei unterstütztem Anbieter serverseitig bestätigen und gegen Wiederholung sichern. Frequenzlimits kontobezogen durchsetzen. Keine Werbe-IDs oder Trackingdaten vor wirksamer Einwilligung speichern.
