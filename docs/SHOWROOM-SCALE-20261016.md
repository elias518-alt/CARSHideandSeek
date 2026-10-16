# Vehicle scale and ground alignment

Home and profile now use a common visible-vehicle fit. Previously, own photos were contained within fixed-height boxes while character size depended on viewport width. Transparent extraction margins also separated tires from the contact shadow. This made a front-facing own car look much smaller than the adjacent character, especially on a phone.

`showroom.js` measures saved photos in a small local canvas (maximum 512 pixels on the longest side) and uses their visible alpha bounds as the SVG viewBox. Original images and storage records remain unchanged. No image-generation, background-removal call, upload or new provider is involved. Opaque photos retain the full frame. If cross-origin pixel access is unavailable, the image retains its full dimensions instead of disappearing. Measurements are cached for up to 32 sources.

The same layout calculation sizes both catalog images and photos, derives character height from vehicle height, and positions tires and shadows on one baseline. The home stage grows when a front-facing photograph needs more height. Character feet sit slightly behind the front bumper's contact line. Profile shadows follow the displayed car width rather than spanning the whole card. Resize and vehicle-change observers update the composition without changing saved appearance or garage data.

Validation:

- Node suite, including alpha-padding and view-aspect regression checks.
- `scripts/showroom-browser-qa.cjs`: real browser at 360, 390, 568 and 1000 px; catalog art, padded side/front views and opaque photos; bounds, greeting, person scale, tire plane, profile progress and page overflow. Mobile screenshots inspected against Alpine, Hangar and Skyline backgrounds.
- Existing `scripts/home-garage-browser-qa.cjs`: active vehicles, Mini Cooper S years, empty states, background choice and preservation of own-photo sources.

The regression photos are local fixtures derived from shipped illustrations. The user's exact uploaded BMW photo was not accessed; the reported padding/scale failure is reproduced with saved-image fixtures. This remains a 2D composition: arbitrary photo camera angles cannot be converted into a true 3D camera view.

Results: 203 Node tests, 172 showroom browser checks and 100 existing home/garage browser checks passed. No production data was written during verification.
