import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_TEAM_NAME_LENGTH, buildBracket, createTournament, getChampion, parseTournament,
  renameTeam, resetResults, resizeTournament, setMatchWinner, shuffleTeams,
} from '../app/utils/tournament.ts'
import type { TournamentState } from '../app/utils/tournament.ts'

function finishTournament(initial: TournamentState) {
  let state = initial
  let played = 0
  while (!getChampion(state)) {
    const match = buildBracket(state).flatMap(round => round.matches).find(item => item.status === 'ready')
    assert.ok(match, 'An unfinished tournament must have a playable match')
    state = setMatchWinner(state, match.id, match.teamIds[0])
    played++
  }
  return { state, played }
}

test('all supported brackets crown a champion after exactly N−1 played matches', () => {
  for (const size of [4, 6, 8] as const) {
    const state = createTournament(size)
    assert.equal(state.teams.length, size)
    assert.equal(new Set(state.teams.map(team => team.id)).size, size)
    assert.equal(getChampion(state), null)
    const rounds = buildBracket(state)
    assert.deepEqual(rounds.map(round => round.matches.length), size === 4 ? [2, 1] : [4, 2, 1])
    const { state: completed, played } = finishTournament(state)
    assert.equal(played, size - 1)
    assert.equal(Object.keys(completed.results).length, size - 1)
    assert.equal(getChampion(completed)?.id, 'team-1')
    assert.deepEqual(state.results, {}, 'Completing a bracket must not mutate the input')
  }
})

test('six teams receive two fair first-round byes on opposite halves', () => {
  const state = createTournament()
  const rounds = buildBracket(state)
  assert.deepEqual(rounds[0]!.matches.map(match => match.teamIds), [
    ['team-1', null], ['team-4', 'team-5'], ['team-2', null], ['team-3', 'team-6'],
  ])
  assert.deepEqual(rounds[0]!.matches.filter(match => match.status === 'bye').map(match => match.winnerId), ['team-1', 'team-2'])
  assert.deepEqual(rounds[1]!.matches.map(match => match.teamIds), [['team-1', null], ['team-2', null]])
  assert.ok(rounds[1]!.matches.every(match => match.status === 'waiting' && match.winnerId === null))
  assert.equal(setMatchWinner(state, 'r0-m0', null), state, 'Automatic byes cannot be cleared')
  assert.equal(setMatchWinner(state, 'r1-m0', 'team-1'), state, 'A bye team must wait for its semifinal opponent')
})

test('feeder results unlock the next round, and only eligible teams can win', () => {
  let state = createTournament(8)
  assert.deepEqual(buildBracket(state)[0]!.matches.map(match => match.teamIds), [
    ['team-1', 'team-8'], ['team-4', 'team-5'], ['team-2', 'team-7'], ['team-3', 'team-6'],
  ])
  assert.equal(setMatchWinner(state, 'unknown', 'team-1'), state)
  assert.equal(setMatchWinner(state, 'r0-m0', 'team-4'), state)
  state = setMatchWinner(state, 'r0-m0', 'team-8')
  assert.equal(buildBracket(state)[1]!.matches[0]!.status, 'waiting')
  state = setMatchWinner(state, 'r0-m1', 'team-5')
  assert.deepEqual(buildBracket(state)[1]!.matches[0]!.teamIds, ['team-8', 'team-5'])
  assert.equal(buildBracket(state)[1]!.matches[0]!.status, 'ready')
  state = setMatchWinner(state, 'r1-m0', 'team-5')
  assert.equal(buildBracket(state)[2]!.matches[0]!.status, 'waiting')
  assert.equal(getChampion(state), null)
  assert.equal(setMatchWinner(state, 'r1-m0', 'team-5'), state, 'Selecting the same winner is a no-op')
})

test('changing an upstream winner clears every descendant, including an unaffected eligible final winner', () => {
  let state = finishTournament(createTournament(8)).state
  state = setMatchWinner(state, 'r2-m0', 'team-2')
  assert.equal(getChampion(state)?.id, 'team-2')
  const original = structuredClone(state)
  const revised = setMatchWinner(state, 'r0-m0', 'team-8')
  assert.equal(revised.results['r0-m0'], 'team-8')
  assert.equal(revised.results['r1-m0'], undefined)
  assert.equal(revised.results['r2-m0'], undefined, 'Final must reset even though team-2 remains eligible')
  for (const id of ['r0-m1', 'r0-m2', 'r0-m3', 'r1-m1']) assert.equal(revised.results[id], original.results[id])
  assert.equal(getChampion(revised), null)
  assert.deepEqual(state, original, 'Rollback must not mutate previous history')

  const cleared = setMatchWinner(state, 'r0-m0', null)
  assert.equal(cleared.results['r0-m0'], undefined)
  assert.equal(cleared.results['r1-m0'], undefined)
  assert.equal(cleared.results['r2-m0'], undefined)
  assert.equal(buildBracket(cleared)[1]!.matches[0]!.status, 'waiting')
})

test('reset and team renaming preserve identities while bounding names', () => {
  const completed = finishTournament(createTournament(4)).state
  const renamed = renameTeam(completed, 'team-1', '  Radiant Friends  ')
  assert.equal(renamed.teams[0]!.name, 'Radiant Friends')
  assert.deepEqual(renamed.results, completed.results)
  assert.equal(getChampion(renamed)?.name, 'Radiant Friends')
  assert.equal(completed.teams[0]!.name, 'Команда 01')
  const longName = renameTeam(renamed, 'team-1', '🎮'.repeat(50))
  assert.equal(Array.from(longName.teams[0]!.name).length, MAX_TEAM_NAME_LENGTH)
  assert.equal(renameTeam(renamed, 'team-1', '   ').teams[0]!.name, 'Команда 01')
  assert.equal(renameTeam(renamed, 'unknown', 'Name'), renamed)
  const reset = resetResults(renamed)
  assert.deepEqual(reset.results, {})
  assert.deepEqual(reset.teams, renamed.teams)
  assert.equal(getChampion(reset), null)
})

test('resize preserves names in current seed order and gives new teams default names', () => {
  let state = finishTournament(createTournament(4)).state
  state = renameTeam(state, 'team-2', 'Dire Friends')
  const grown = resizeTournament(state, 8)
  assert.deepEqual(grown.teams.slice(0, 4), state.teams)
  assert.equal(grown.teams[7]!.name, 'Команда 08')
  assert.deepEqual(grown.results, {})
  const shuffled = shuffleTeams(grown, () => 0)
  const shrunk = resizeTournament(shuffled, 4)
  assert.deepEqual(shrunk.teams.map(team => team.name), shuffled.teams.slice(0, 4).map(team => team.name))
  assert.deepEqual(shrunk.teams.map(team => team.id), ['team-1', 'team-2', 'team-3', 'team-4'])
  assert.ok(parseTournament(shrunk))
})

test('shuffle uses deterministic Fisher–Yates, preserves each team, and clears results', () => {
  const state = finishTournament(createTournament(4)).state
  const shuffled = shuffleTeams(state, () => 0)
  assert.deepEqual(shuffled.teams.map(team => team.id), ['team-2', 'team-3', 'team-4', 'team-1'])
  assert.deepEqual([...shuffled.teams].sort((a, b) => a.id.localeCompare(b.id)), state.teams)
  assert.deepEqual(shuffled.results, {})
  assert.deepEqual(state.teams.map(team => team.id), ['team-1', 'team-2', 'team-3', 'team-4'])
  assert.ok(parseTournament(shuffled), 'Shuffled identities must survive storage')
  assert.throws(() => shuffleTeams(state, () => 1), RangeError)
})

test('storage parser rejects corrupt schemas, unsupported sizes and duplicate or invalid identities', () => {
  const good = createTournament()
  const corrupt: unknown[] = [
    null, [], 'invalid', {}, { ...good, version: 2 }, { ...good, size: 5 },
    { ...good, teams: good.teams.slice(1) }, { ...good, results: [] },
    { ...good, unexpected: true },
    { ...good, teams: good.teams.map((team, index) => index === 0 ? { ...team, id: 'team-2' } : team) },
    { ...good, teams: good.teams.map((team, index) => index === 0 ? { ...team, id: 'team-9' } : team) },
    { ...good, teams: good.teams.map((team, index) => index === 0 ? { ...team, name: '' } : team) },
    { ...good, teams: good.teams.map((team, index) => index === 0 ? { ...team, name: ' leading space' } : team) },
    { ...good, teams: good.teams.map((team, index) => index === 0 ? { ...team, name: 'x'.repeat(41) } : team) },
    { ...good, teams: good.teams.map((team, index) => index === 0 ? { ...team, extra: true } : team) },
  ]
  for (const value of corrupt) assert.equal(parseTournament(value), null)
  assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(good))), good)
})

test('storage parser keeps valid progression and sanitizes invalid, premature and bye results', () => {
  const complete = finishTournament(createTournament(6)).state
  assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(complete))), complete)
  const corrupted = {
    ...complete,
    results: { ...complete.results, 'r0-m0': 'team-1', 'r0-m1': 'team-2', 'r0-m9': 'team-1', nonsense: {}, 'r9-m0': 'team-6' },
  }
  const restored = parseTournament(corrupted)!
  assert.ok(restored)
  assert.equal(restored.results['r0-m0'], undefined, 'Byes are derived and never stored')
  assert.equal(restored.results['r0-m1'], undefined, 'A team cannot win someone else’s match')
  assert.equal(restored.results['r1-m0'], undefined, 'Missing feeder invalidates semifinal result')
  assert.equal(restored.results['r2-m0'], undefined, 'Missing semifinal invalidates final result')
  assert.equal(restored.results['r0-m3'], complete.results['r0-m3'])
  assert.equal(restored.results['r1-m1'], complete.results['r1-m1'])
  assert.ok(Object.keys(restored.results).every(key => ['r0-m3', 'r1-m1'].includes(key)))
  assert.deepEqual(parseTournament({ ...createTournament(4), results: { 'r1-m0': 'team-1' } })?.results, {})
})
