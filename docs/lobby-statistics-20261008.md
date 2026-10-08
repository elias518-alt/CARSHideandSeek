# Lobby und Spielerstatistik – 08.10.2026

Basis: 81987165e09dc9c9c55d4bf39f653fcff4cdb32e; Branch codex/crew-progression-20261007, vor Änderung sauber. Remote main vorab abgeglichen.

Lobby: Titel, Wartebereich, Sichtbarkeit, Code-Gruppe, Spielerstatus, Einstellungen und Aktionsbuttons zentriert. Symbole bleiben unmittelbar links neben ihren Beschriftungen in der mittigen Gruppe. Chat-Symbol und Text stehen nun nebeneinander. Gemessener Abstand: 6px; Abweichung vom Buttonmittelpunkt 0–0,008px bei 375 und 430px Displaybreite.

Statistik: neue Performance-Karten mit bestehenden SVG-Symbolen, markanten Kennzahlen, Akzenten für Siege/Gesamt-XP, überarbeitetem Level-Badge und opakem Sheet-Header. Alle neun Kennzahlen, XP-Berechnung, Rundendaten, Rankings, Belohnungen und ihre bestehenden Aktionen bleiben erhalten. Profil-Kennzahlen passen optisch dazu.

Änderungen beschränken sich auf crew-hub.css, die Statistik-Ausgabe in crew-hub.js und Cache-Versionen in index.html. Kein Backend, keine Datenbankmigration, keine Änderung an Lobby-Ereignissen, Authentifizierung oder Spielregeln.

Prüfung: 165/165 bestehende Tests bestanden; JavaScript-Syntax und git diff --check erfolgreich. Browser mit isolierten Testdaten: Lobby, Einstellungen und Chat geöffnet; Statistik und Ranglisten-Link funktionieren. Responsive bei 375×667, 390×844 und 430×932 ohne horizontales Überlaufen der Statistik. Screenshots der lokalen Testansichten in outputs/Lobby-20261008.png und outputs/Statistik-20261008.png. Der frühere GPS-Feldtest bleibt außerhalb dieser reinen Darstellungsänderung.
