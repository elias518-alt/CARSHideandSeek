# Fahrzeugauswahl BMW, MINI und Audi – 15.10.2026

145 neue Ansichten ergänzen die bisherigen 35 Studio-Illustrationen. Die Auswahl enthält damit 180 Kombinationen aus Baureihe und Karosserie: BMW 78, MINI 24, Audi 72 sowie die bisherigen 6 Mercedes-Ansichten.

## Bedienung

Garage → Fahrzeug hinzufügen/bearbeiten → Marke und Modell auswählen. Ein Baujahr oder eine ausdrückliche Baureihe bestimmt das Bild. Über die Suche funktionieren beispielsweise „BMW X5 E70 2009“, „Mini R59 2014“ und „Audi A4 Avant 2020“. Unter Fahrzeugdetails kann die Karosserie korrigiert werden. Eigene Fotos haben weiterhin Vorrang. Das aktive Fahrzeug nutzt dieselbe Darstellung in Garage, Profil und Lobby/Startansicht.

## Umfang und Grenzen

- BMW: 1er einschließlich Drei-/Fünftürer, Coupé und Cabrio; normaler 2er einschließlich Coupé, Cabrio, Gran Coupé, Active Tourer und Gran Tourer; 4er, 6er, 7er, 8er; X1–X7, XM und iX. Vorhandene 3er-, 5er- und M2-Generationen bleiben erhalten.
- MINI: Classic ab 1959, moderne Cooper-Generationen, elektrischer J01, Fünftürer, Cabrio, Clubman, Countryman, Coupé, Roadster, Paceman und Aceman.
- Audi: A1–A8, Q2–Q8, europäische e-tron-Baureihen, TT, R8, historische 50/80/90/100/200/V8/quattro und ausgewählte zusätzliche Karosserien.
- Eigenständige generierte Illustrationen, keine Herstellerfotos und keine maßstabsgetreuen Fahrzeugmodelle. Je Generation wird eine repräsentative Form gezeigt. Nicht jedes Facelift, Motorpaket, M-/S-/RS-/JCW-Derivat, jede Langversion oder internationale Sonderbaureihe hat ein eigenes Bild. Frühere Audi-Avant-Generationen, viele Touring-Varianten und historische MINI-Nutzfahrzeuge sind nicht als eigene Studio-Ansichten enthalten.
- Jahresbereiche sind europäische Bau-/Produktionsjahre auf Kalenderjahresbasis. Erstzulassung kann später sein. Übergangsjahre überschneiden sich; eine gültige ausdrücklich gewählte Baureihe gewinnt. Ohne ausdrückliche Auswahl wird die jüngere passende Generation dargestellt.
- Unpassende Karosserien, ungültige Jahre oder widersprüchliche Baureihen erhalten kein fremdes Studiofahrzeug; die bestehende allgemeine Fahrzeugillustration bleibt verfügbar.

## Umsetzung

Die gemeinsame Generationstabelle liefert Suchvorschläge, Karosserievorgaben, Baujahrprüfung und Bildzuordnung. Generationen werden zusammen mit ihrer Modellfamilie identifiziert, damit etwa Audi A3 8V als Schrägheck und Limousine unterschiedliche Bilder bekommen. Die rechteckigen Bildausschnitte sind pro Fahrzeug aus dem Alphakanal vermessen. Korrektur-Atlanten liefern nur die tatsächlich korrigierten Einzelansichten; die bereits geprüften anderen Modelle bleiben aus den ursprünglichen Dateien erhalten.

Die Lackierung nutzt weiterhin den Magenta-Materialkanal. Lacklicht und Schatten bleiben erhalten; Glas, Chrom, Reifen und Lampen werden nicht pauschal eingefärbt. Die WebP-Dateien laden nur, wenn eine dazugehörige Illustration verwendet wird. Keine Datenbankmigration, neuen Zugangsdaten oder externen Bilddienste erforderlich.

## Prüfung

- Node-Suite: 194 Prüfungen bestanden; Modell- und Karosseriezuordnung, Produktionslücken, Übergangsjahre, Suche, Formular und Speichern sowie bestehende Anwendungstests.
- Studio-Browserprüfung: 61 Prüfungen bestanden; alle 180 Darstellungen, vorhandene Dateien, Lackwechsel Schwarz/Weiß und unveränderte neutrale Glas-/Zierleistenflächen; Kontaktbögen zur visuellen Kontrolle.
- App-Browserprüfung: 173 Prüfungen bei 360, 390, 430 und 1000 Pixeln; reale Oberfläche mit lokalen Auth-/RPC-/GPS-Testdaten.
- Ein unvollständiger Karten-Testspielstand wird nur noch synchron gesetzt und wiederhergestellt, damit der Anwendungstimer ihn nicht versehentlich als vollständige Runde liest.

Ausführung:

```sh
npm test
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright CHS_QA_CHROMIUM=/usr/bin/chromium node scripts/vehicle-studio-browser-qa.mjs
CHS_QA_PLAYWRIGHT=/workspace/chs-qa/node_modules/playwright CHS_QA_MAPLIBRE=/workspace/chs-qa/node_modules/maplibre-gl/dist/maplibre-gl.js CHS_QA_CHROMIUM=/usr/bin/chromium node scripts/social-map-browser-qa.mjs
```

## Generationen

| Marke | Modell / Karosserie | Baureihen und Baujahre |
| --- | --- | --- |
| BMW | 3er | E21 (1975–1983), E30 (1982–1994), E36 (1990–2000), E46 (1997–2006), E90 (2005–2013), F30 (2011–2019), G20 (2019–heute) |
| BMW | 5er | E12 (1972–1981), E28 (1981–1988), E34 (1987–1996), E39 (1995–2004), E60 (2003–2010), F10 (2010–2017), G30 (2017–2023), G60 (2023–heute) |
| BMW | M2 | F87 (2016–2021), G87 (2023–heute) |
| Mercedes-Benz | C-Klasse | W202 (1993–2000), W203 (2000–2007), W204 (2007–2014), W205 (2014–2021), W206 (2021–heute) |
| Mercedes-Benz | 190 | W201 (1982–1993) |
| Audi | A4 | B5 (1994–2001), B6 (2000–2004), B7 (2004–2008), B8 (2007–2015), B9 (2015–2024) |
| Audi | A6 | C4 (1994–1997), C5 (1997–2004), C6 (2004–2011), C7 (2011–2018), C8 (2018–2025), C9 (2025–heute) |
| Audi | 80 | B4 (1991–1996) |
| BMW | 1er | E87 (2004–2011), F20 (2011–2019), F40 (2019–2024), F70 (2024–heute) |
| BMW | 1er 3-Türer | E81 (2007–2012), F21 (2012–2019) |
| BMW | 1er Coupé | E82 (2007–2013) |
| BMW | 1er Cabrio | E88 (2008–2013) |
| BMW | 2er | F22 (2013–2021), G42 (2021–heute) |
| BMW | 2er Gran Coupé | F44 (2019–2024), F74 (2024–heute) |
| BMW | 2er Active Tourer | F45 (2014–2021), U06 (2021–heute) |
| BMW | 2er Gran Tourer | F46 (2015–2022) |
| BMW | 2er Cabrio | F23 (2014–2021) |
| BMW | 4er | F32 (2013–2020), G22 (2020–heute) |
| BMW | 4er Gran Coupé | F36 (2014–2021), G26 (2021–heute) |
| BMW | 4er Cabrio | F33 (2013–2020), G23 (2020–heute) |
| BMW | 6er | E24 (1976–1989), E63 (2003–2010), F13 (2011–2018) |
| BMW | 6er Gran Coupé | F06 (2012–2018) |
| BMW | 6er Gran Turismo | G32 (2017–2023) |
| BMW | 6er Cabrio | E64 (2004–2010), F12 (2011–2018) |
| BMW | 7er | E23 (1977–1986), E32 (1986–1994), E38 (1994–2001), E65 (2001–2008), F01 (2008–2015), G11 (2015–2022), G70 (2022–heute) |
| BMW | 8er | E31 (1989–1999), G15 (2018–heute) |
| BMW | 8er Gran Coupé | G16 (2019–heute) |
| BMW | 8er Cabrio | G14 (2018–heute) |
| BMW | X1 | E84 (2009–2015), F48 (2015–2022), U11 (2022–heute) |
| BMW | X2 | F39 (2018–2023), U10 (2023–heute) |
| BMW | X3 | E83 (2003–2010), F25 (2010–2017), G01 (2017–2024), G45 (2024–heute) |
| BMW | X4 | F26 (2014–2018), G02 (2018–2025) |
| BMW | X5 | E53 (1999–2006), E70 (2006–2013), F15 (2013–2018), G05 (2018–heute) |
| BMW | X6 | E71 (2008–2014), F16 (2014–2019), G06 (2019–heute) |
| BMW | X7 | G07 (2018–heute) |
| BMW | XM | G09 (2022–heute) |
| BMW | iX | I20 (2021–heute) |
| Mini | Classic | Mk I (1959–1967), Mk II (1967–1969), Mk III–VI (1969–1996), Mk VII (1996–2000) |
| Mini | Cooper | R50 (2001–2006), R56 (2006–2013), F56 (2013–2024), F66 (2024–heute) |
| Mini | Cooper Electric | J01 (2023–heute) |
| Mini | Cooper 5-Türer | F55 (2014–2024), F65 (2024–heute) |
| Mini | Cabrio | R52 (2004–2008), R57 (2009–2015), F57 (2015–2024), F67 (2024–heute) |
| Mini | Clubman | R55 (2007–2014), F54 (2015–2024) |
| Mini | Countryman | R60 (2010–2016), F60 (2016–2023), U25 (2023–heute) |
| Mini | Coupé | R58 (2011–2015) |
| Mini | Roadster | R59 (2012–2015) |
| Mini | Paceman | R61 (2013–2016) |
| Mini | Aceman | J05 (2024–heute) |
| Audi | A1 | 8X (2010–2018), GB (2018–heute) |
| Audi | A2 | 8Z (1999–2005) |
| Audi | A3 | 8L (1996–2003), 8P (2003–2013), 8V (2012–2020), 8Y (2020–heute) |
| Audi | A5 | 8T (2007–2016), F5 (2016–2024) |
| Audi | A5 Limousine | B10 (2024–heute) |
| Audi | A7 | 4G (2010–2018), 4K (2018–2025) |
| Audi | A8 | D2 (1994–2002), D3 (2002–2010), D4 (2010–2017), D5 (2017–heute) |
| Audi | Q2 | GA (2016–heute) |
| Audi | Q3 | 8U (2011–2018), F3 (2018–2025), FJ (2025–heute) |
| Audi | Q4 e-tron | F4 (2021–heute) |
| Audi | Q5 | 8R (2008–2017), FY (2017–2024), GU (2024–heute) |
| Audi | Q6 e-tron | GF (2024–heute) |
| Audi | Q7 | 4L (2005–2015), 4M (2015–heute) |
| Audi | Q8 | 4M8 (2018–heute) |
| Audi | e-tron | GE (2018–2022) |
| Audi | Q8 e-tron | GE (2022–2025) |
| Audi | TT | 8N (1998–2006), 8J (2006–2014), 8S (2014–2023) |
| Audi | R8 | 42 (2006–2015), 4S (2015–2024) |
| Audi | e-tron GT | FW (2021–heute) |
| Audi | A6 e-tron | GH (2024–heute) |
| Audi | 50 | 86 (1974–1978) |
| Audi | 80 Classic | B1 (1972–1978), B2 (1978–1986), B3 (1986–1991) |
| Audi | 90 | 81 (1984–1986), 89 (1987–1991) |
| Audi | 100 | C1 (1968–1976), C2 (1976–1982), C3 (1982–1991), C4 (1990–1994) |
| Audi | 200 | 43 (1979–1982), 44 (1983–1991) |
| Audi | V8 | D1 (1988–1994) |
| Audi | quattro | 85 (1980–1991) |
| Audi | A3 Limousine | 8V (2013–2020), 8Y (2020–heute) |
| Audi | A5 Sportback | 8T (2009–2016), F5 (2016–2024) |
| Audi | A4 Avant | B9 (2015–2024) |
| Audi | A6 Avant | C8 (2018–2025) |
| Audi | Q3 Sportback | F3 (2019–2025) |
| Audi | Q5 Sportback | FY (2020–2024) |
| Audi | A5 Cabrio | F5 (2016–2024) |

## Neue Bildquellen

Mit dem Bildgenerator in dieser Sitzung erstellt und als WebP mit Qualität 95 konvertiert. Originaldateien bleiben unter `/workspace/generated_images` erhalten.

| Asset | Generiertes Original |
| --- | --- |
| bmw-compact.webp | exec-26f99f47-2ed1-40eb-b072-61c3db6cc72b.png |
| bmw-grand.webp | exec-8caff23a-3467-4400-bf9c-71664366c0dc.png |
| bmw-luxury.webp | exec-4fe600d7-999c-403b-ad3a-680ff118866d.png |
| bmw-x-compact.webp | exec-ab03df34-421c-462f-9ca0-6b0647d0680c.png |
| bmw-x-grand.webp | exec-36d2d50c-b858-41e4-8630-b433eec58e4d.png |
| bmw-one-cabrio.webp | exec-8f712607-05f5-472c-9ca6-9b9370904e56.png |
| mini-hatch.webp | exec-5c988af5-9e39-45ff-be05-142df0f57e57.png |
| mini-range.webp | exec-c04d4cd4-b4fd-4ce3-ba60-3f32c31711f9.png |
| audi-small.webp | exec-78ff2572-dee0-4201-a10a-0d1956bb5e4c.png |
| audi-suv.webp | exec-644e29e9-6b77-4bff-9ea1-236a7943e949.png |
| audi-grand.webp | exec-5d36b842-36df-490f-abe2-065643f37512.png |
| audi-classic.webp | exec-0ae75770-f798-4871-86b8-0c56baaf903b.png |
| audi-more.webp | exec-3bf68931-a0ce-4f33-b8ee-f18eb8e5d7e5.png |
| audi-grand-detail.webp | exec-1b2593cf-bba1-42ab-8952-c47a313f143f.png |
| audi-small-detail.webp | exec-0f1691f6-8b88-4f84-b6b0-64a688e2bbbb.png |
| audi-more-detail.webp | exec-91d2742c-23f1-425c-ba83-b8a06a9895cc.png |
