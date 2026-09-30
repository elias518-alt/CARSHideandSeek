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
  const shuffled = shuffledCopy(players, random).sort((a,b)=>(a.seekerRounds||0)-(b.seekerRounds||0) || (b.roundsSinceSeeker||0)-(a.roundsSinceSeeker||0));
  const seekerIds = new Set(shuffled.slice(0, seekerCount).map(player => player.id));

  for (const player of players) {
    player.role = seekerIds.has(player.id) ? 'SEEKER' : 'HIDER';
    if(player.role==='SEEKER'){player.seekerRounds=(player.seekerRounds||0)+1;player.roundsSinceSeeker=0;}
    else player.roundsSinceSeeker=(player.roundsSinceSeeker||0)+1;
    player.found = false;
    player.roundFinds = 0;
  }

  return seekerCount;
}

function roundRewardFor(player, result) {
  if (!player || !result || !['SEEKER','HIDER'].includes(player.role)) return null;

  const role = player.role;
  const finds = role === 'SEEKER'
    ? Math.max(0, Math.min(20, Math.trunc(Number(player.roundFinds) || 0)))
    : 0;
  const survived = role === 'HIDER' && !player.found;
  const won = role === 'SEEKER'
    ? !!result.seekersWin
    : !result.seekersWin && survived;
  const baseXp = role === 'SEEKER'
    ? 100 + finds * 80
    : survived ? 280 : 140;

  return { role, won, finds, survived, baseXp };
}

module.exports = { seekerCountFor, shuffledCopy, assignRoundRoles, roundRewardFor };
