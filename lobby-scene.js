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
      const positions = count === 1 ? [[25, 47, 1]]
        : count === 2 ? [[25, 47, 1], [75, 47, 1]]
        : count === 3 ? [[25, 47, 1], [75, 47, 1], [23, 23, 0]]
        : [[23, 23, 0], [77, 23, 0], [25, 47, 1], [75, 47, 1]];
      const [localX, ground, row] = positions[position];
      return { player, page, row, x: (page * 100 + localX) / pages, width: (row ? 46 : 40) / pages, ground };
    }) };
  }
  return { backgrounds, validBackground, background, layout };
});
