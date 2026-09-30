'use strict';

function seekerCountFor(playerCount) {
  const count = Math.max(0, Math.trunc(Number(playerCount) || 0));
  if (count < 2) return 0;
  return Math.min(count - 1, Math.max(1, Math.floor(count / 5)));
}

function shuffledCopy(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const value = Number(random());
    const safe = Number.isFinite(value) ? Math.min(0.999999999999, Math.max(0, value)) : 0;
    const j = Math.floor(safe * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignRoundRoles(players, random = Math.random) {
  const seekerCount = seekerCountFor(players.length);
  const shuffled = shuffledCopy(players, random);
  const seekerIds = new Set(shuffled.slice(0, seekerCount).map(player => player.id));

  for (const player of players) {
    player.role = seekerIds.has(player.id) ? 'SEEKER' : 'HIDER';
    player.found = false;
  }

  return seekerCount;
}

module.exports = { seekerCountFor, shuffledCopy, assignRoundRoles };
