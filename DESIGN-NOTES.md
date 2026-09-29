# Garage and interface refresh

The local WebP images are generated illustrations. Vehicle examples represent six body shapes, not a specific manufacturer model or paint colour. Uploaded vehicle photos take priority.

The small generation catalogue is deliberately limited to verified examples. Other vehicles support a manually entered generation and production year. Ranges cover European generations across body variants; individual engines, countries and derivatives can differ. “ab” indicates a known starting year, not a claim that production continues today.

Sources checked 2026-09-29:

- Ford Focus I–III: https://media.ford.com/content/fordmedia/feu/de/de/news/2014/09/11/_auto-der-vernunft---die-erfolgsgeschichte-des-ford-focus.html
- Ford Focus IV introduction: https://media.ford.com/content/fordmedia/feu/gb/en/news/2018/04/10/ford-unveils-all-new-focus--most-innovative--dynamic-and-excitin.html
- Golf VI: https://www.volkswagen-newsroom.com/en/golf-6-20082012-19484
- Golf VII and VIII: https://www.volkswagen-newsroom.com/en/the-new-golf-international-vehicle-presentation-5609/download
- BMW E36 production: https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-4-1.bmw-3-series-e36.html
- BMW E46 production (December 1997–November 2006; market introduction 1998): https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-5-1.bmw-3-series-e46.html

No database migration is required. Existing vehicle ownership policies cover insert/update/delete, and the active-vehicle foreign key uses ON DELETE SET NULL. Lobby friendship actions reuse the existing authenticated RPCs. Test fixtures and preview controls are local only and must not be deployed.
