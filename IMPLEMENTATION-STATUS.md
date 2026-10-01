# Aktueller Arbeitsstand – 01.10.2026

PR #21 ist in `main` zusammengeführt und auf Render veröffentlicht. Die folgende Gateway-Ergänzung baut auf `a66c4fa19831c6b1fa686394153d8ce602ebc4a5` auf und liegt im Branch `codex/server-protection-setup`. Bestehende Garage, Fahrzeugbilder, Lobbyhintergründe, Spielphasen und GPS-Regeln wurden weiterverwendet.

## Umgesetzt

| Anforderung | Stand |
| --- | --- |
| Vorhandene freie Figuren verwenden | Sechs Quaternius-Modelle unter CC0, als kleine transparente WebP-Schichten. Keine neu generierten Bilder in der Erweiterung. Quellen und Lizenzen in THIRD-PARTY-ASSETS.md. |
| Haare, Oberteil, Hose/Rock, Schuhe und Schmuck | Auswahl im Kleiderschrank, Vorschau, Cloud-Speicherung und Darstellung in der Lobby. Drei Varianten je Körpergruppe; Anhänger optional. Bisherige Figuren bleiben wählbar. |
| Profil ändern, ohne die Runde zu verlassen | Bestehender Profilablauf bleibt erhalten; kosmetische Änderungen werden in die bestehende Lobby synchronisiert. Ein Fehler wird angezeigt. |
| Entwicklerverwaltung | Serverseitige Admin-UUID-Liste, Spielerübersicht, Suche, Meldungen und Moderationsprotokoll. Keine Rollenvergabe über Browser-Metadaten. |
| Spieler sperren und entsperren | Begründung, Dauer oder permanente Sperre; geschützter Server-Endpunkt und atomarer Datenbankvorgang mit Protokoll. Normale Konten können ihn nicht aufrufen. |
| Sperre trotz vorhandener Sitzung | Spiel-API, Datenbankregeln und bestehende Social-RPCs prüfen Sperren. Die Moderation entfernt den Spieler aus den Server-Lobbys. |
| Erklärungen vor der Teilnahme | Getrennte, nicht vorgewählte Bestätigungen für Bedingungen, Sicherheit, Volljährigkeit und gelesene Datenschutzhinweise. Textstand/Hash/Serverzeit werden gespeichert. |
| Rechtstexte und Impressum | Öffentlich lesbare Entwürfe. Persönliche Betreiberangaben ausschließlich über Serverkonfiguration. Unvollständige Einrichtung verhindert die Freigabe. |
| Veraltete Kontoantworten | Abmelden/Kontowechsel verwerfen überholte Antworten und entfernen private Dialoge. Eine Teilnahme-Sperre stoppt GPS und Polling. |

## Bereits in der Datenbank angewendet – nicht wiederholen

- `20261001062228_wardrobe_admin_legal`
- `20261001063042_restrict_signup_trigger_rpc`
- `20261001074617_backend_gateway_credentials`

Die Dateiversionen wurden mit der Remote-Migrationsliste abgeglichen. Rechte auf Moderation und Zustimmungsnachweise sind für Browserkonten gesperrt. Gesperrte Konten und normale Konten wurden getrennt geprüft; temporäre Prüfsperren wurden zurückgerollt. Der Signup-Trigger bleibt gebunden, obwohl Browserkonten seine Funktion nicht direkt ausführen dürfen.

## Prüfung

108 Node-Tests bestanden: Gateway-Authentifizierung, Ressourcenbeschränkungen, dauerhafte Speicherung und ausschließlich serverseitig freigeschalteter Entwickler-Testzugang sowie bisherige Garage-/Lobby-/GPS-/Wiederherstellungsfälle, neue HTTP- und Berechtigungstests sowie verzögerte Kontoantworten bei Abmelden/Kontowechsel. Syntax- und Diff-Prüfung bestanden. Die bestehenden Figuren wurden durch native Bildmontagen auf überlagerte Haare und Übergänge zwischen Hose und Schuhen geprüft.

Für diese Erweiterung wurde keine vollständige Browser- oder Smartphone-Prüfung behauptet. Echte GPS-Bewegung, Wiederbeitritt nach Handy-Absturz und Rendering auf zwei Geräten bleiben vor Veröffentlichung zu prüfen.

## Vor Freischaltung offen

1. Betreiberanschrift vor öffentlicher Freigabe ergänzen; während der Entwicklung bleibt sie auf ausdrücklichen Nutzerwunsch offen. Name, Kontakt und Admin-UUID sind bereits als Render-Konfiguration gespeichert, aber noch nicht durch Neustart übernommen.
2. Rechtstexte, Dienstleisterverträge, Hostingregionen, Übermittlungen und tatsächliche Lösch-/Backupfristen prüfen. Vollständige Haftungsbefreiung ist nicht zugesichert. Erst danach `CHS_LEGAL_REVIEWED=true` setzen.
3. Gateway-Token nach ausdrücklicher Freigabe auf Render konfigurieren und am eigenen Supabase-Endpunkt testen. Keine Schlüssel oder privaten Betreiberangaben ins öffentliche Repository aufnehmen. Gateway ist bereits bereitgestellt; anonymer Live-Zugriff liefert 401. Der authentifizierte Live-Test wurde durch automatische Freigabeprüfung vor Ausführung blockiert. Konfiguration in README.md.
4. Browser-/Geräteprüfung und Neustarttest auf dem tatsächlich verwendeten Server abschließen. Eine Serverinstanz beibehalten.
5. Gateway-Ergänzung nach Token-Konfiguration bereitstellen und den Entwickler-Testzugang aktivieren. Reguläre Nutzer bleiben bis vollständiger rechtlicher Freigabe gesperrt. Es werden keine Zustimmungen künstlich bestätigt. PR #21 ist bereits live; die Gateway-Ergänzung noch nicht.

## Separat bekannte Restpunkte

Die bisherige XP-RPC nimmt weiterhin vom Browser behauptete Ergebnisse an; ausschließlich serverbestätigte Gutschriften sind noch umzusetzen. Die Zustimmungsschranke schützt Spielserver-Aktionen und die reguläre App-Initialisierung, ersetzt jedoch keine konsolidierte Autorisierung aller bisherigen direkten Profil-/Social-RPCs. Werbung, PLUS/Payments, Apple-Anmeldung, Hintergrund-Push und große Mehrinstanz-Skalierung sind keine fertigen Funktionen dieser Erweiterung.

Die Codex-Meldung „Fehler beim Senden der Nachricht“ ist damit nicht als behoben ausgewiesen; sie ist von den App-Änderungen zu unterscheiden.
