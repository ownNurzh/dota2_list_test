import assert from 'node:assert/strict'
import test from 'node:test'
import { players, roleDefinitions, roles, statDefinitions } from '../app/data/players.ts'
import { calculateRating, filterPlayers, formatNumber, formatRole, getHeroImage, getHeroSlug } from '../app/utils/players.ts'

test('player catalog has unique route IDs and valid numeric positions', () => {
  assert.ok(players.length > 0)
  assert.equal(new Set(players.map(player => player.id)).size, players.length, 'Every player needs a unique route ID')
  assert.equal(players.find(player => player.id === 'p22')?.fullName, 'Чина')
  assert.equal(players.find(player => player.id === 'p31')?.nickname, 'Z')
  assert.equal(players.find(player => player.nickname === 'Nrjn')?.role, 4)
  assert.deepEqual(roles, [1, 2, 3, 4, 5])
  for (const player of players) {
    assert.match(player.id, /^p\d+$/)
    assert.ok(roles.includes(player.role))
  }
})

test('Daiteris retains the supplied profile data under a route distinct from Z and bl1zzard', () => {
  assert.equal(players.find(player => player.id === 'p31')?.nickname, 'Z')
  assert.equal(players.find(player => player.id === 'p32')?.nickname, 'bl1zzard')
  assert.deepEqual(players.find(player => player.id === 'p34'), {
    id: 'p34', nickname: 'Daiteris', fullName: 'Искандер', role: 3, tier: 'Tier 1', mmr: 5000,
    tags: [], notes: 'Чилл', avatar: null, signatureHeroes: ['Queen of Pain', 'Magnus'],
    stats: { mechanics: 80, farming: 86, teamwork: 70, gameSense: 85, versatility: 70 },
  })
})

test('numeric positions map to readable role names and remain searchable in both languages', () => {
  assert.equal(formatRole(3), '3 · Оффлейнер')
  assert.equal(roleDefinitions[4].englishLabel, 'Soft Support')
  assert.equal(roleDefinitions[5].englishLabel, 'Hard Support')
  for (const role of roles) {
    const expected = filterPlayers(players, { role }).map(player => player.id)
    assert.deepEqual(filterPlayers(players, { search: roleDefinitions[role].englishLabel }).map(player => player.id), expected)
    assert.deepEqual(filterPlayers(players, { search: roleDefinitions[role].label }).map(player => player.id), expected)
    assert.deepEqual(filterPlayers(players, { search: `Позиция ${role}` }).map(player => player.id), expected)
  }
})

test('each player has five complete characteristics on a 0–100 scale', () => {
  assert.equal(statDefinitions.length, 5)
  assert.equal(statDefinitions.reduce((total, stat) => total + stat.weight, 0), 1)
  for (const player of players) {
    assert.equal(Object.keys(player.stats).length, 5)
    for (const definition of statDefinitions) {
      const value = player.stats[definition.key]
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `${player.id}: ${definition.key}`)
    }
  }
})

test('characteristic definitions retain readable Cyrillic labels and descriptions', () => {
  assert.deepEqual(statDefinitions.map(stat => stat.label), ['Механика', 'Фарм', 'Командная игра', 'Понимание игры', 'Универсальность'])
  for (const definition of statDefinitions) {
    assert.match(definition.description, /[А-Яа-я]/)
    assert.doesNotMatch(definition.description, /\?{2,}/)
  }
})

test('rating uses the defined weights and rounds the final result', () => {
  assert.equal(calculateRating({ mechanics: 0, farming: 0, teamwork: 0, gameSense: 0, versatility: 0 }), 0)
  assert.equal(calculateRating({ mechanics: 100, farming: 100, teamwork: 100, gameSense: 100, versatility: 100 }), 100)
  assert.equal(calculateRating({ mechanics: 100, farming: 0, teamwork: 0, gameSense: 0, versatility: 0 }), 25)
  assert.equal(calculateRating({ mechanics: 90, farming: 80, teamwork: 70, gameSense: 60, versatility: 50 }), 73)
})

test('search, role and tier combine and include hero names, names, notes and tags', () => {
  assert.deepEqual(filterPlayers(players, { search: '  LION  ', role: 4, tier: 'Tier 2' }).map(player => player.id).sort(), ['p10', 'p26'])
  assert.deepEqual(filterPlayers(players, { search: 'liON', role: 1, tier: 'Tier 2' }), [])
  assert.equal(filterPlayers(players, { search: 'Мәдіна' })[0]?.nickname, 'Medievh')
  assert.ok(filterPlayers(players, { search: 'Аррррр' }).some(player => player.id === 'p6'))
  assert.equal(filterPlayers(players, { search: 'Микрофоны жох' })[0]?.nickname, 'TOfu')
  assert.ok(filterPlayers(players, { search: 'Tier 3' }).every(player => player.tier === 'Tier 3'))
  assert.equal(filterPlayers(players, { role: 'all', tier: 'all', search: '   ' }).length, players.length)
  assert.deepEqual(filterPlayers(players, { search: 'no-such-player' }), [])
})

test('sorts by rating, MMR and name without changing the source order', () => {
  const originalOrder = players.map(player => player.id)
  for (const sort of ['rating-desc', 'mmr-desc', 'mmr-asc', 'name-asc'] as const) {
    const result = filterPlayers(players, { sort })
    assert.equal(result.length, players.length)
    for (let index = 1; index < result.length; index++) {
      const left = result[index - 1]!
      const right = result[index]!
      if (sort === 'rating-desc') assert.ok(calculateRating(left.stats) >= calculateRating(right.stats))
      if (sort === 'mmr-desc') assert.ok(left.mmr >= right.mmr)
      if (sort === 'mmr-asc') assert.ok(left.mmr <= right.mmr)
      if (sort === 'name-asc') assert.ok(left.nickname.localeCompare(right.nickname, 'ru') <= 0)
    }
  }
  assert.deepEqual(players.map(player => player.id), originalOrder)
})

test('hero names use canonical CDN asset paths and unknown heroes have a fallback', () => {
  assert.deepEqual(players[0]?.signatureHeroes, ['Drow Ranger', 'Lifestealer'])
  assert.equal(getHeroSlug('  CENTAUR WARRUNNER '), 'centaur')
  assert.equal(getHeroSlug('Lifestealer'), 'life_stealer')
  assert.equal(getHeroSlug('Necrophos'), 'necrolyte')
  assert.equal(getHeroSlug('Queen of Pain'), 'queenofpain')
  assert.equal(getHeroImage('Timbersaw'), 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/shredder.png')
  assert.equal(getHeroImage('Unknown'), 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/phantom_assassin.png')
  for (const player of players) {
    for (const hero of player.signatureHeroes) assert.notEqual(getHeroSlug(hero), 'phantom_assassin')
  }
})

test('MMR uses Russian locale number formatting', () => {
  assert.equal(formatNumber(7800), '7\u00a0800')
})
