# Community-Ergänzung und Beta-Zugang

Auftrag: vorhandene App fortführen, beigefügten Community-Prompt integrieren; anschließend am 4. Oktober den vorläufigen Zugang für weitere Spieler nach eigener Bestätigung ermöglichen.

## Neu

- Eigene Glockenansicht mit Update, echten Einladungen, Freundschaftsanfragen und ungelesenen Direktnachrichten. Das Öffnen setzt nicht den Nachrichten-Lesestatus zurück. Untere Crew-Navigation behält ihren separaten Zähler.
- Home-Karte: eigene laufende Sitzung vor Einladung vor nächster tatsächlich gelisteter öffentlicher Lobby. Ohne Standort/Ergebnis gibt es einen ausdrücklichen Leerzustand. Eine Startzeit wird nicht erfunden: offene Lobbys starten durch den Host.
- Persönlicher Crew-Link, Kopieren/Teilen, bestätigte Anfrage über den vorhandenen RPC. Einladungsabsicht bleibt über Anmeldung erhalten; kein automatisches Versenden.
- Host-Einstellungen für Sichtbarkeit und Spielerlimit 2–20; Grenze kann nicht unter aktuelle Belegung gesetzt werden. Daten und Beitrittslimit werden serverseitig geprüft.
- Erfolgsdetails zeigen bestehende Bedingungen und echten Profilfortschritt. Keine neuen erfundenen Freischaltungen.
- Explizite Konfiguration `CHS_BETA_ACCESS=true`: auch normale Konten können vorläufige Hinweise persönlich bestätigen. `legal.ready` bleibt bei unvollständiger Freigabe falsch. Keine fingierte Rechtsprüfung. Zustimmung bleibt kontogebunden, versioniert, gehasht, serverzeitgestempelt; Beta-Kennzeichnung liegt im Dokument-Snapshot. Sperren, Alters-/Sicherheitsangaben und Onboarding bleiben erhalten.

## Angepasst

- Kleinerer Home-Hero, größeres Profil, überlappende Einladungs-Karte und Neon-CHS-Schnellbeitritt; Erstellen/Code nebeneinander. Echter Level-/XP-/Rundenfortschritt ist wieder sichtbar.
- Lobby und Profil ohne darübergelegten App-Header; eigenes Auto größer im Vordergrund, auch als Nicht-Host. Die Krone bleibt beim tatsächlichen Host. Andere Spieler bleiben in seitlich wechselbaren Vierergruppen sichtbar.
- Lobby-Eckdaten, Einladung und Chat verbinden die bestehenden Aktionen. Profil zeigt kompakte Crew-Zeilen mit Avatar, Namen, Status sowie getrennten Profil-/Chat-Aktionen.
- Garage sortiert aktives Fahrzeug zuerst und zeigt Marke/Baureihe/Modell/Jahr/Farbe vor Upload-Bedienung. Maskierte Lackdarstellung ersetzt globale Bildfilter. Glas, Räder, Leuchten und Front-Zierbereiche werden ausgenommen; manuell gemessene Masken sind weiterhin nur Näherungen, keine materialgetrennten 3D-Modelle. Eigene Fotos haben Vorrang und werden nicht umgefärbt.
- Einladung wird erst nach erfolgreichem Beitritt verworfen. Keine erzwungene Karten-Scrollbewegung beim Lobbybeitritt.

## Admin

- Frisch servergeprüfte Rolle `admin`/`super_admin`, private Einzel-Lobby und authentifizierter Host sind Voraussetzung.
- Sucher/Verstecker-Test, Countdown überspringen, direkt zur Suchphase, Test beenden. Normale Spieler und Moderatoren dürfen das nicht; andere Konten können keinen Test betreten.
- Aktuelles GPS und Fahrer-Sicherheitsprüfung bleiben erforderlich. Tests vergeben keine XP, zählen nicht in Rundenauswertung/Match-Metriken und erzeugen keine künstlichen Mitspieler.

## Erhalten

Google-Anmeldung, Profil-/Fahrzeugdaten, bestehende Supabase-RPCs und RLS, Rejoin, Host-Migration, Chat, Fund-/GPS-/Fahrerregeln, Sucher-Wartehinweise, echte Erfolgsvergabe, Moderation, persistierte Runden und vorhandene Charakter-/Fahrzeugassets.

## Prüfungen und Grenzen

- `npm test`: 159 Tests, einschließlich Beta-Zustimmung und realem lokalen HTTP-Admin-Test mit Widerruf von Rollen.
- `scripts/community-ui-qa.mjs`: 142 erfolgreiche Prüfungen; mobile Ansichten 360/390/430 und Desktop 1000 px; Benachrichtigungen, Identität, Code, Einladungen, Profile, Erfolge, Adminsichtbarkeit, Lackmasken und neuer Beta-Erstzugang. Auth/API-Daten sind lokale Fixtures; kein echtes Konto und keine Nachricht wird dadurch verändert.
- Supabase-Zustimmungstabelle samt JSONB-Snapshot und aktivem RLS geprüft; keine Schemaänderung erforderlich.
- Offen: Betreiberanschrift und endgültige Rechtsprüfung; echter Google-Erstzugang eines weiteren Menschen, physische GPS-/Temperatur-Abnahme mit 2/5/10 Geräten und externe Kartenkacheln. Ein generisches Coupé ist kein exaktes BMW-E36-Modell; eine neue Anlehn-Pose wurde nicht erstellt. Keine Behauptung vollständiger Produktionsreife.
