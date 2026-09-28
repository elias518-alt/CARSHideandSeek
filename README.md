# CAR HIDE & SEEK – Playable Alpha 0.5

## Start
1. Node.js 18+ installieren.
2. Ordner öffnen.
3. `npm start`
4. Browser: `http://localhost:3000`

Für einen echten GPS-Test auf Smartphones muss die Seite über HTTPS erreichbar sein (Browser-Sicherheitsvorgabe). Auf localhost funktioniert Geolocation ebenfalls.

## In dieser Version wirklich implementiert
- Spielerprofil (Name, Fahrzeug, Farbe, Fahrer/Beifahrer)
- Private Lobby + 5-stelliger Code
- Mehrspieler-Lobby
- Ready-System
- Host + Host-Wechsel
- konfigurierbarer Radius, Spielzeit, Headstart, Escape-Zeit
- GPS-Streaming über Browser-Geolocation
- Startpunkt setzen
- Countdown, Headstart, ACTIVE, RESULT
- automatische Rollenverteilung
- Näherungsstufen
- Escape-Timer für Verstecker
- Fundversuch mit serverseitiger GPS-/Accuracy-/Freshness-/Plausibilitätsprüfung
- gestaffelter Fehlversuch-Cooldown
- Ergebnis + XP/Level-Grundlogik
- Reconnect über lokale Session
- Rematch
- Fahrer-Modus-Warnung

## Noch NICHT produktiv angebunden
Apple/Google Login, persistente SQL-Datenbank, öffentliches Matchmaking, echte Straßenkarte, Push, Freunde/Freundeschat, Moderations-Backend, Payments/PLUS, Ads, lizenzierte Fahrzeugdaten/3D-Modelle und App-Store-Signing benötigen externe Dienste/Accounts und sind nicht als funktionierend zu betrachten.
