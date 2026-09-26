import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBracket, createTournament, getChampion, renameTeam, setMatchWinner, setTeamPlayers,
} from '../app/utils/tournament.ts'
import type { TournamentFormat, TournamentState } from '../app/utils/tournament.ts'
import {
  MAX_ARCHIVED_TOURNAMENTS, createTournamentEntry, formatTournamentDate, isTournamentDate,
  parseTournamentEntry, parseTournamentHistory, tournamentFingerprint, tournamentFormatLabel,
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

function rawEntry(state: unknown = completed(), id = 'cup-first') {
  return { id, title: 'Кубок друзей', date: '2026-09-26', state }
}

test('archive snapshots detach nested team names, rosters and match results from the editable tournament', () => {
  const state = completed()
  const before = structuredClone(state)
  const entry = createTournamentEntry(state, '  Кубок друзей  ', '2026-09-26', 'cup-snapshot')!
  assert.ok(entry)
  assert.equal(entry.title, 'Кубок друзей')
  assert.deepEqual(entry.state, before)
  assert.notEqual(entry.state, state)
  assert.notEqual(entry.state.teams, state.teams)
  assert.notEqual(entry.state.teams[0]!.playerIds, state.teams[0]!.playerIds)
  assert.notEqual(entry.state.results, state.results)

  state.teams[0]!.name = 'Новое название'
  state.teams[0]!.playerIds.push('p4')
  delete state.results['r0-m0']
  assert.deepEqual(entry.state, before, 'Later live changes must not rewrite history')
  const changedLive = structuredClone(state)
  entry.state.teams[0]!.playerIds.pop()
  delete entry.state.results['r1-m0']
  assert.deepEqual(state, changedLive, 'An archive edit must not mutate the live bracket either')
})

test('only genuinely completed tournaments can enter history, including a pending reset final', () => {
  const initial = createTournament(4, 'single')
  assert.equal(parseTournamentEntry(rawEntry(initial)), null)
  const partial = setMatchWinner(initial, 'r0-m0', 'team-1')
  assert.equal(parseTournamentEntry(rawEntry(partial)), null)
  assert.equal(parseTournamentEntry(rawEntry({ ...initial, results: { 'r1-m0': 'team-1' } })), null)
  const finishedDouble = completed('double')
  const grandFinal = buildBracket(finishedDouble).flatMap(round => round.matches).find(match => match.id === 'gf-m0')!
  const needsReset = setMatchWinner(finishedDouble, grandFinal.id, grandFinal.teamIds[1])
  assert.equal(getChampion(needsReset), null)
  assert.equal(parseTournamentEntry(rawEntry(needsReset)), null)
  const reset = buildBracket(needsReset).flatMap(round => round.matches).find(match => match.id === 'gf-reset')!
  assert.ok(parseTournamentEntry(rawEntry(setMatchWinner(needsReset, reset.id, reset.teamIds[0]))))
})

test('version-one and version-two archive states migrate without losing completed results or team names', () => {
  for (const size of [4, 6] as const) {
    for (const version of [1, 2] as const) {
      const format = version === 1 ? 'single' : 'double'
      const state = finish({
        ...renameTeam(createTournament(size, format), 'team-2', 'Старые друзья'),
        layout: size === 6 ? 'legacy-six-byes' : 'standard',
      })
      const legacy = {
        version,
        size,
        ...(version === 2 ? { format } : {}),
        teams: state.teams.map(({ id, name }) => ({ id, name })),
        results: state.results,
      }
      const entry = parseTournamentEntry(rawEntry(legacy))!
      assert.ok(entry)
      assert.equal(entry.state.version, 3)
      assert.equal(entry.state.format, format)
      assert.equal(entry.state.layout, size === 6 ? 'legacy-six-byes' : 'standard')
      assert.deepEqual(entry.state.teams, state.teams)
      assert.deepEqual(entry.state.results, state.results)
      assert.equal(getChampion(entry.state)?.id, getChampion(state)?.id)
    }
  }
})

test('current six-team round-robin archives retain standings, rosters and playoff results', () => {
  let state = createTournament(6, 'double')
  state = setTeamPlayers(state, 'team-1', ['p1', 'p2', 'p3', 'p4', 'p5'])
  state = finish(state)
  const restored = parseTournamentEntry(JSON.parse(JSON.stringify(rawEntry(state))))!
  assert.ok(restored)
  assert.deepEqual(restored.state, state)
  assert.equal(Object.keys(restored.state.results).filter(id => id.startsWith('g') && !id.startsWith('gf')).length, 15)
  assert.equal(tournamentFormatLabel(restored.state), 'Круговой этап + двойная сетка')
})

test('archive dates validate the actual calendar and format independently of the browser timezone', () => {
  for (const date of ['2024-02-29', '2000-02-29', '2026-09-26', '2026-12-31']) assert.ok(isTournamentDate(date), date)
  for (const date of [null, 20260926, '', '2026-2-01', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-09-26T00:00:00Z', ' 2026-09-26']) assert.equal(isTournamentDate(date), false)
  assert.equal(formatTournamentDate('2026-09-26'), '26 сентября 2026 г.')
  assert.equal(parseTournamentEntry({ ...rawEntry(), date: '2026-02-30' }), null)
})

test('corrupt archive metadata and state are rejected while valid records remain recoverable', () => {
  const valid = rawEntry()
  const invalid: unknown[] = [
    null, false, [], 'entry', {},
    { ...valid, id: '' }, { ...valid, id: 'Cup-One' }, { ...valid, id: '../cup' }, { ...valid, id: 'x'.repeat(81) },
    { ...valid, title: '' }, { ...valid, title: '   ' }, { ...valid, title: '🏆'.repeat(81) },
    { ...valid, date: 'yesterday' }, { ...valid, state: null }, { ...valid, state: { ...valid.state as TournamentState, version: 999 } },
  ]
  for (const value of invalid) assert.equal(parseTournamentEntry(value), null)
  const recovered = parseTournamentHistory([invalid[0], valid, invalid[4], { ...valid, id: 'cup-second' }])
  assert.deepEqual(recovered.map(entry => entry.id), ['cup-first', 'cup-second'])
  assert.ok(parseTournamentEntry({ ...valid, title: '🏆'.repeat(80) }), 'Length limit counts Unicode characters rather than UTF-16 units')
})

test('unknown result keys are sanitized but corruption of a required result rejects the archive', () => {
  const valid = rawEntry()
  const state = valid.state as TournamentState
  const extras = parseTournamentEntry({ ...valid, state: { ...state, results: { ...state.results, bad: 'team-1', 'gf-reset': 'team-1' } } })!
  assert.deepEqual(extras.state.results, state.results)
  const badResult = { ...state, results: { ...state.results, 'r0-m0': 'team-2' } }
  assert.equal(parseTournamentEntry({ ...valid, state: badResult }), null)
})

test('history deduplicates IDs deterministically and invalid entries cannot claim an ID', () => {
  const valid = rawEntry()
  const history = parseTournamentHistory([
    { ...valid, date: 'invalid' },
    valid,
    { ...valid, title: 'Duplicate cup' },
    { ...valid, id: 'cup-second' },
  ])
  assert.equal(history.length, 2)
  assert.equal(history[0]!.title, valid.title)
  assert.deepEqual(history.map(entry => entry.id), ['cup-first', 'cup-second'])
  assert.notEqual(history[0]!.state, history[1]!.state)
})

test('the 100-entry save limit does not discard larger valid histories or published archives', () => {
  const valid = rawEntry()
  const full = Array.from({ length: MAX_ARCHIVED_TOURNAMENTS }, (_, index) => ({ ...valid, id: `cup-${index}` }))
  assert.equal(MAX_ARCHIVED_TOURNAMENTS, 100)
  assert.equal(parseTournamentHistory(full).length, 100)
  const larger = parseTournamentHistory([...full, { ...valid, id: 'cup-overflow' }])
  assert.equal(larger.length, 101)
  assert.equal(larger[100]!.id, 'cup-overflow')
  assert.deepEqual(parseTournamentHistory({ entries: full }), [])
  assert.deepEqual(parseTournamentHistory(null), [])
})

test('fingerprints ignore ID and results insertion order but distinguish meaningful archive changes', () => {
  const entry = parseTournamentEntry(rawEntry())!
  const reordered = { ...entry, id: 'cup-copy', state: { ...entry.state, results: Object.fromEntries(Object.entries(entry.state.results).reverse()) } }
  assert.equal(tournamentFingerprint(entry), tournamentFingerprint(reordered))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, date: '2026-09-27' }))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, title: 'Другой кубок' }))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, state: renameTeam(entry.state, 'team-1', 'Другие друзья') }))
  assert.notEqual(tournamentFingerprint(entry), tournamentFingerprint({ ...entry, state: setTeamPlayers(entry.state, 'team-1', ['p1']) }))
  assert.equal(tournamentFormatLabel(createTournament(4, 'single')), 'Одиночная сетка')
  assert.equal(tournamentFormatLabel(createTournament(4, 'double')), 'Двойная сетка')
})
