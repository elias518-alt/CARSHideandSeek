'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seekerCountFor, assignRoundRoles, roundRewardFor } = require('./game-rules');

test('seeker count follows the agreed 2–20 player ratio', () => {
  assert.equal(seekerCountFor(1), 0);
  assert.equal(seekerCountFor(2), 1);
  assert.equal(seekerCountFor(5), 1);
  assert.equal(seekerCountFor(9), 1);
  assert.equal(seekerCountFor(10), 2);
  assert.equal(seekerCountFor(15), 3);
  assert.equal(seekerCountFor(20), 4);
});

test('role assignment creates exactly the expected number of seekers', () => {
  for (const count of [2, 5, 10, 15, 20]) {
    const players = Array.from({length: count}, (_, index) => ({id: 'p'+index, role: null, found: true}));
    const seekers = assignRoundRoles(players, () => 0.37);
    assert.equal(seekers, seekerCountFor(count));
    assert.equal(players.filter(player => player.role === 'SEEKER').length, seekers);
    assert.equal(players.filter(player => player.role === 'HIDER').length, count - seekers);
    assert.ok(players.every(player => player.found === false));
  }
});

test('host identity is not part of role assignment', () => {
  const players = Array.from({length: 10}, (_, index) => ({id: 'p'+index}));
  assignRoundRoles(players, () => 0);
  assert.equal(players.filter(player => player.role === 'SEEKER').length, 2);
  assert.notEqual(players[0].role === 'SEEKER' && players.slice(1).every(p => p.role === 'HIDER'), true);
});


test('round reward uses personal finds and survival state', () => {
  assert.deepEqual(
    roundRewardFor({ role: 'SEEKER', roundFinds: 3, found: false }, { seekersWin: true }),
    { role: 'SEEKER', won: true, finds: 3, survived: false, baseXp: 340 }
  );
  assert.deepEqual(
    roundRewardFor({ role: 'HIDER', roundFinds: 4, found: false }, { seekersWin: false }),
    { role: 'HIDER', won: true, finds: 0, survived: true, baseXp: 280 }
  );
  assert.deepEqual(
    roundRewardFor({ role: 'HIDER', found: true }, { seekersWin: false }),
    { role: 'HIDER', won: false, finds: 0, survived: false, baseXp: 140 }
  );
});
