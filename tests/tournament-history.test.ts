import assert from 'node:assert/strict'
import test from 'node:test'
import { tournaments } from '../app/data/tournaments.ts'
import {
  buildBracket, createTournament, getChampion, renameTeam, setMatchWinner, setTeamPlayers,
} from '../app/utils/tournament.ts'
import type { TournamentFormat, TournamentState } from '../app/utils/tournament.ts'
import {
  MAX_ARCHIVED_TOURNAMENTS, createTournamentEntry, formatTournamentDate, isTournamentDate,
  parseTournamentEntry, parseTournamentHistory, tournamentFingerprint,
} from '../app/utils/tournament-history.ts'

function finish(initial: TournamentState): TournamentState {
  let state = initial
  for (let played = 0; !getChampion(state); played++) {
    assert.ok(played < 50, 'A supported tournament must finish in fewer than 50 real games')
    const match = buildBracket(state).flatMap(round => round.matches).find(item => item.status === 'ready')
    assert.ok(match, 'An unfinished tournament must have an eligible match')
    state = setMatchWinner(state, match.id, match.teamIds[0])
  }
  return state
}

function completed(format: TournamentFormat = 'single'): TournamentState {
  let state = createTournament(4, format)
  state = renameTeam(state, 'team-1', 'Наш стак')
  state = setTeamPlayers(state, 'team-1', ['p1', 'p2'])
  state = setTeamPlayers(state, 'team-2', ['p3'])
  return finish(state)
}

function legacyEntry(state: unknown = completed(), id = 'cup-first') {
  return { id, title: 'Кубок друзей', date: '2026-09-26', state }
}

function simpleEntry(id = 'cup-first') {
  return { id, date: '2026-09-26', champion: { name: 'Наш стак', playerIds: ['p1', 'p2'] } }
}

test('a saved champion contains only the date, winning team and detached roster', () => {
  const state = completed()
  const entry = createTournamentEntry(state, '2026-09-26', 'cup-first')!
  assert.deepEqual(entry, simpleEntry())
  assert.notEqual(entry.champion.playerIds, getChampion(state)!.playerIds)

  state.teams[0]!.name = 'Новое название'
  state.teams[0]!.playerIds.push('p4')
  delete state.results['r0-m0']
  assert.deepEqual(entry, simpleEntry(), 'Editing the live tournament must not rewrite history')
  const changedLive = structuredClone(state)
  entry.champion.playerIds.pop()
  assert.deepEqual(state, changedLive, 'Editing an archived roster must not mutate the live tournament')
})

test('only completed brackets can be saved or migrated, including a pending reset final', () => {
  const initial = createTournament(4, 'single')
  assert.equal(createTournamentEntry(initial, '2026-09-26', 'cup-first'), null)
  const partial = setMatchWinner(initial, 'r0-m0', 'team-1')
  assert.equal(parseTournamentEntry(legacyEntry(partial)), null)
  assert.equal(parseTournamentEntry(legacyEntry({ ...initial, results: { 'r1-m0': 'team-1' } })), null)
  const finishedDouble = completed('double')
  const grandFinal = buildBracket(finishedDouble).flatMap(round => round.matches).find(match => match.id === 'gf-m0')!
  const needsReset = setMatchWinner(finishedDouble, grandFinal.id, grandFinal.teamIds[1])
  assert.equal(getChampion(needsReset), null)
  assert.equal(parseTournamentEntry(legacyEntry(needsReset)), null)
  const reset = buildBracket(needsReset).flatMap(round => round.matches).find(match => match.id === 'gf-reset')!
  assert.ok(parseTournamentEntry(legacyEntry(setMatchWinner(needsReset, reset.id, reset.teamIds[0]))))
})

test('version-one and version-two browser archives migrate to the correct champion', () => {
  for (const size of [4, 6] as const) {
    for (const version of [1, 2] as const) {
      const format = version === 1 ? 'single' : 'double'
      const state = finish({
        ...renameTeam(createTournament(size, format), 'team-1', 'Старые друзья'),
        layout: size === 6 ? 'legacy-six-byes' : 'standard',
      })
      const legacy = {
        version, size,
        ...(version === 2 ? { format } : {}),
        teams: state.teams.map(({ id, name }) => ({ id, name })),
        results: state.results,
      }
      const entry = parseTournamentEntry(legacyEntry(legacy))!
      assert.ok(entry)
      assert.deepEqual(entry, { id: 'cup-first', date: '2026-09-26', champion: { name: getChampion(state)!.name, playerIds: [] } })
    }
  }
})

test('current round-robin archives retain the champion and its full roster during migration', () => {
  for (const format of ['single', 'double'] as const) {
    let state = createTournament(6, format)
    state = setTeamPlayers(state, 'team-1', ['p1', 'p2', 'p3', 'p4', 'p5'])
    state = finish(state)
    const restored = parseTournamentEntry(JSON.parse(JSON.stringify(legacyEntry(state))))!
    const champion = getChampion(state)!
    assert.deepEqual(restored.champion, { name: champion.name, playerIds: champion.playerIds })
    assert.deepEqual(Object.keys(restored).sort(), ['champion', 'date', 'id'])
  }
})

test('the published Daiteris result remains visible without fabricating a full bracket', () => {
  const history = parseTournamentHistory(tournaments)
  assert.deepEqual(history.find(entry => entry.id === 't1'), {
    id: 't1', date: '2026-09-26', champion: { name: 'Daiteris', playerIds: ['p1', 'p2', 'p3'] },
  })
})

test('archive dates validate the actual calendar and format independently of browser timezone', () => {
  for (const date of ['2024-02-29', '2000-02-29', '2026-09-26', '2026-12-31']) assert.ok(isTournamentDate(date), date)
  for (const date of [null, 20260926, '', '2026-2-01', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-09-26T00:00:00Z', ' 2026-09-26']) assert.equal(isTournamentDate(date), false)
  assert.equal(formatTournamentDate('2026-09-26'), '26 сентября 2026 г.')
  assert.equal(parseTournamentEntry({ ...simpleEntry(), date: '2026-02-30' }), null)
})

test('invalid metadata and champions are rejected while other records remain recoverable', () => {
  const valid = simpleEntry()
  const invalid: unknown[] = [
    null, false, [], 'entry', {},
    ...['', 'Cup-One', '../cup', 'x'.repeat(81)].map(id => ({ ...valid, id })),
    ...['', '   ', '🏆'.repeat(41)].map(name => ({ ...valid, champion: { ...valid.champion, name } })),
    ...[null, [], {}, { name: 'Наш стак' }].map(champion => ({ ...valid, champion })),
    ...[null, ['p1', 'p1'], ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], ['../p1'], [123], [''], ['p 1']].map(playerIds => ({ ...valid, champion: { ...valid.champion, playerIds } })),
    { ...valid, date: 'yesterday' },
    legacyEntry(null), legacyEntry({ ...completed(), version: 999 }),
    { ...legacyEntry(), champion: null },
  ]
  for (const value of invalid) assert.equal(parseTournamentEntry(value), null, JSON.stringify(value))
  const recovered = parseTournamentHistory([invalid[0], valid, invalid[4], simpleEntry('cup-second')])
  assert.deepEqual(recovered.map(entry => entry.id), ['cup-first', 'cup-second'])
  assert.equal(parseTournamentEntry({ ...valid, champion: { ...valid.champion, name: `  ${'🏆'.repeat(40)}  ` } })!.champion.name, '🏆'.repeat(40))
})

test('empty rosters and historical player IDs remain readable and are independently copied', () => {
  const raw = simpleEntry()
  raw.champion.playerIds = ['retired-player']
  const restored = parseTournamentEntry(raw)!
  assert.deepEqual(restored.champion.playerIds, ['retired-player'])
  assert.notEqual(restored.champion, raw.champion)
  assert.notEqual(restored.champion.playerIds, raw.champion.playerIds)
  assert.ok(parseTournamentEntry({ ...raw, champion: { name: 'Наш стак', playerIds: [] } }))
})

test('legacy result sanitization cannot invent a champion from a corrupt bracket', () => {
  const valid = legacyEntry()
  const state = valid.state as TournamentState
  const extras = parseTournamentEntry({ ...valid, state: { ...state, results: { ...state.results, bad: 'team-1', 'gf-reset': 'team-1' } } })!
  assert.deepEqual(extras, simpleEntry())
  const badResult = { ...state, results: { ...state.results, 'r0-m0': 'team-2' } }
  assert.equal(parseTournamentEntry({ ...valid, state: badResult }), null)
  assert.equal(parseTournamentEntry(legacyEntry({ ...state, teams: [state.teams[0]], results: {} })), null)
})

test('mixed old and new archives deduplicate IDs without letting invalid entries claim them', () => {
  const history = parseTournamentHistory([
    { ...simpleEntry(), date: 'invalid' },
    legacyEntry(),
    { ...simpleEntry(), champion: { name: 'Duplicate cup', playerIds: [] } },
    simpleEntry('cup-second'),
  ])
  assert.deepEqual(history, [simpleEntry(), simpleEntry('cup-second')])
  assert.notEqual(history[0]!.champion.playerIds, history[1]!.champion.playerIds)
})

test('the 100-entry save limit does not discard larger valid histories or published archives', () => {
  const full = Array.from({ length: MAX_ARCHIVED_TOURNAMENTS }, (_, index) => simpleEntry(`cup-${index}`))
  assert.equal(MAX_ARCHIVED_TOURNAMENTS, 100)
  assert.equal(parseTournamentHistory(full).length, 100)
  const larger = parseTournamentHistory([...full, simpleEntry('cup-overflow')])
  assert.equal(larger.length, 101)
  assert.equal(larger[100]!.id, 'cup-overflow')
  assert.deepEqual(parseTournamentHistory({ entries: full }), [])
  assert.deepEqual(parseTournamentHistory(null), [])
})

test('fingerprints ignore IDs and roster order but distinguish dates, champions and players', () => {
  const entry = simpleEntry()
  const reordered = { ...entry, id: 'cup-copy', champion: { ...entry.champion, playerIds: [...entry.champion.playerIds].reverse() } }
  assert.equal(tournamentFingerprint(entry), tournamentFingerprint(reordered))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, date: '2026-09-27' }))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, champion: { ...entry.champion, name: 'Другие друзья' } }))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, champion: { ...entry.champion, playerIds: ['p1'] } }))
  assert.equal(tournamentFingerprint(entry), tournamentFingerprint(parseTournamentEntry(legacyEntry())!))
})
