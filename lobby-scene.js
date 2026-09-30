/* Presentation settings shared by the browser and server. */
(function(root, factory) {
  const scene = factory();
  if (typeof module === 'object' && module.exports) module.exports = scene;
  else root.lobbyScene = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const backgrounds = Object.freeze([
    { id: 'violet', name: 'Violettes Parkdeck', image: 'assets/lobby-meetup.webp' },
    { id: 'wet', name: 'Nasses Parkdeck', image: 'assets/lobby-meetup.webp' },
    { id: 'garage', name: 'Neon-Halle', image: 'lobby-bg.png' }
  ]);
  const validBackground = value => backgrounds.some(background => background.id === value);
  const background = value => validBackground(value) ? value : 'violet';
  function layout(players) {
    const pages = Math.max(1, Math.ceil(players.length / 4));
    return { pages, slots: players.map((player, index) => {
      const page = Math.floor(index / 4), position = index % 4;
      const count = Math.min(4, players.length - page * 4);
      // Incomplete sections stay balanced rather than filling only the left side.
      const positions = count === 1 ? [[50, 50, 0]]
        : count === 2 ? [[26, 50, 0], [74, 50, 0]]
        : count === 3 ? [[50, 61, 0], [26, 35, 1], [74, 35, 1]]
        : [[26, 54, 0], [74, 54, 0], [26, 34, 1], [74, 34, 1]];
      const [localX, ground, row] = positions[position];
      return { player, page, row, x: (page * 100 + localX) / pages, width: (row ? 46 : 40) / pages, ground };
    }) };
  }
  return { backgrounds, validBackground, background, layout };
});
