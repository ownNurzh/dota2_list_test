import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_TEAM_NAME_LENGTH, buildBracket, changeTournamentFormat, createTournament, getChampion, getTournamentMatchCount, parseTournament,
  renameTeam, resetResults, resizeTournament, setMatchWinner, shuffleTeams,
} from '../app/utils/tournament.ts'
import type { Match, TournamentState } from '../app/utils/tournament.ts'

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

test('all supported single brackets crown a champion after exactly N−1 played matches', () => {
  for (const size of [4, 6, 8] as const) {
    const state = createTournament(size, 'single')
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
  const state = createTournament(6, 'single')
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
  let state = createTournament(8, 'single')
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
  let state = finishTournament(createTournament(8, 'single')).state
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
  const completed = finishTournament(createTournament(4, 'single')).state
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
  let state = finishTournament(createTournament(4, 'single')).state
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
  const state = finishTournament(createTournament(4, 'single')).state
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
    null, [], 'invalid', {}, { ...good, version: 3 }, { ...good, size: 5 }, { ...good, format: 'triple' },
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
  const complete = finishTournament(createTournament(6, 'single')).state
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
  assert.deepEqual(parseTournament({ ...createTournament(4, 'single'), results: { 'r1-m0': 'team-1' } })?.results, {})
})

function allMatches(state: TournamentState): Match[] {
  return buildBracket(state).flatMap(round => round.matches)
}

function playDouble(size: 4 | 6 | 8, reset: boolean, resetWinner: 0 | 1 = 0) {
  let state = createTournament(size, 'double')
  const snapshots: TournamentState[] = [state]
  while (!getChampion(state)) {
    const match = allMatches(state).find(item => item.status === 'ready')
    assert.ok(match, 'Double elimination cannot deadlock before its champion is decided')
    const chosen = match.id === 'gf-m0' ? Number(reset) : match.id === 'gf-reset' ? resetWinner : 0
    state = setMatchWinner(state, match.id, match.teamIds[chosen]!)
    snapshots.push(state)
  }
  return { state, snapshots }
}

test('new tournaments default to double while version-one saves migrate losslessly to single', () => {
  assert.equal(createTournament().format, 'double')
  assert.equal(createTournament().version, 2)
  const completed = finishTournament(renameTeam(createTournament(6, 'single'), 'team-1', 'Our Stack')).state
  const legacy = { version: 1, size: completed.size, teams: completed.teams, results: completed.results }
  assert.deepEqual(parseTournament(legacy), completed)
  assert.equal(getChampion(parseTournament(legacy)!)?.name, 'Our Stack')
  assert.equal(parseTournament({ ...legacy, format: 'single' }), null, 'Legacy records must retain their exact schema')
})

test('double brackets complete in both grand-final paths and eliminate every nonchampion at two losses', () => {
  for (const size of [4, 6, 8] as const) {
    for (const reset of [false, true]) {
      for (const resetWinner of reset ? [0, 1] as const : [0] as const) {
        const { state, snapshots } = playDouble(size, reset, resetWinner)
        const matches = allMatches(state)
        const completed = matches.filter(match => match.status === 'complete')
        const expectedCount = size * 2 - 2 + Number(reset)
        assert.equal(completed.length, expectedCount)
        assert.equal(getTournamentMatchCount(state), expectedCount)
        assert.equal(Object.keys(state.results).length, expectedCount)
        assert.equal(matches.some(match => match.id === 'gf-reset'), reset)
        const champion = getChampion(state)!
        for (const team of state.teams) {
          const appearances = completed.filter(match => match.teamIds.includes(team.id)).length
          const losses = completed.filter(match => match.loserId === team.id).length
          assert.ok(appearances >= 2, `${size}: ${team.id} must get at least two real games`)
          assert.equal(losses, team.id === champion.id ? Number(reset) : 2)
        }
        for (const match of matches) {
          if (match.status === 'ready' || match.status === 'complete') {
            assert.ok(match.teamIds[0] && match.teamIds[1])
            assert.notEqual(match.teamIds[0], match.teamIds[1])
          }
          if (match.status === 'bye') assert.equal(match.loserId, null)
        }
        for (const snapshot of snapshots) {
          assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(snapshot))), snapshot, 'Every intermediate progression must survive storage')
        }
      }
    }
  }
})

test('six-team lower byes resolve only after their real feeder and never create losses', () => {
  const initial = createTournament(6, 'double')
  const before = allMatches(initial)
  assert.equal(before.filter(match => match.status === 'bye').length, 2)
  assert.equal(before.find(match => match.id === 'l0-m0')?.status, 'waiting')
  assert.equal(before.find(match => match.id === 'l0-m0')?.winnerId, null)
  assert.equal(setMatchWinner(initial, 'l0-m0', 'team-4'), initial)

  const advanced = setMatchWinner(initial, 'r0-m1', 'team-4')
  const lowerBye = allMatches(advanced).find(match => match.id === 'l0-m0')!
  assert.deepEqual(lowerBye.teamIds, [null, 'team-5'])
  assert.equal(lowerBye.status, 'bye')
  assert.equal(lowerBye.winnerId, 'team-5')
  assert.equal(lowerBye.loserId, null)
  assert.equal(setMatchWinner(advanced, 'l0-m0', 'team-5'), advanced)
  assert.equal(allMatches(advanced).find(match => match.id === 'l1-m0')?.status, 'waiting', 'A known lower winner must wait for the opposite upper loser')
  assert.equal(Object.keys(advanced.results).length, 1)
})

test('upper-semifinal losers cross into the opposite lower half', () => {
  const matches = allMatches(createTournament(8))
  assert.deepEqual(matches.find(match => match.id === 'l1-m0')?.sources, [
    { type: 'winner', matchId: 'l0-m0' }, { type: 'loser', matchId: 'r1-m1' },
  ])
  assert.deepEqual(matches.find(match => match.id === 'l1-m1')?.sources, [
    { type: 'winner', matchId: 'l0-m1' }, { type: 'loser', matchId: 'r1-m0' },
  ])
})

test('upper corrections invalidate winner and loser descendants across both brackets and finals', () => {
  const completed = playDouble(8, true).state
  const original = structuredClone(completed)
  const revised = setMatchWinner(completed, 'r0-m0', 'team-8')
  const invalidated = ['r1-m0', 'r2-m0', 'l0-m0', 'l1-m0', 'l1-m1', 'l2-m0', 'l3-m0', 'gf-m0', 'gf-reset']
  for (const id of invalidated) assert.equal(revised.results[id], undefined, `${id} depends on the changed upper match`)
  for (const id of ['r0-m1', 'r0-m2', 'r0-m3', 'r1-m1', 'l0-m1']) assert.equal(revised.results[id], completed.results[id], `${id} is unrelated`)
  assert.equal(getChampion(revised), null)
  assert.deepEqual(completed, original)
})

test('lower corrections preserve upper results and clear downstream finals; upper grand-final win removes reset', () => {
  const completed = playDouble(8, true).state
  const lower = allMatches(completed).find(match => match.id === 'l1-m0')!
  const revised = setMatchWinner(completed, lower.id, lower.loserId)
  for (const id of ['l2-m0', 'l3-m0', 'gf-m0', 'gf-reset']) assert.equal(revised.results[id], undefined)
  for (const [id, result] of Object.entries(completed.results)) {
    if (id.startsWith('r') || id === 'l1-m1' || id.startsWith('l0-')) assert.equal(revised.results[id], result)
  }
  const grandFinal = allMatches(completed).find(match => match.id === 'gf-m0')!
  const upperWins = setMatchWinner(completed, 'gf-m0', grandFinal.teamIds[0])
  assert.equal(upperWins.results['gf-reset'], undefined)
  assert.equal(allMatches(upperWins).some(match => match.id === 'gf-reset'), false)
  assert.equal(getChampion(upperWins)?.id, grandFinal.teamIds[0])
  assert.equal(getTournamentMatchCount(upperWins), 14)
})

test('a lower-bracket grand-final win activates a reset without declaring a champion early', () => {
  const completed = playDouble(4, false).state
  const grandFinal = allMatches(completed).find(match => match.id === 'gf-m0')!
  const resetNeeded = setMatchWinner(completed, 'gf-m0', grandFinal.teamIds[1])
  const reset = allMatches(resetNeeded).find(match => match.id === 'gf-reset')!
  assert.equal(reset.status, 'ready')
  assert.equal(getChampion(resetNeeded), null)
  assert.equal(getTournamentMatchCount(resetNeeded), 7)
  assert.deepEqual(reset.sources, [{ type: 'winner', matchId: 'gf-m0' }, { type: 'loser', matchId: 'gf-m0' }])
  assert.ok(getChampion(setMatchWinner(resetNeeded, reset.id, reset.teamIds[1])))
})

test('format changes preserve seeded teams and clear results while other edits preserve format', () => {
  const completed = playDouble(6, false).state
  const single = changeTournamentFormat(completed, 'single')
  assert.equal(single.format, 'single')
  assert.deepEqual(single.teams, completed.teams)
  assert.deepEqual(single.results, {})
  assert.equal(getTournamentMatchCount(single), 5)
  const double = changeTournamentFormat(single, 'double')
  assert.deepEqual(double.teams, single.teams)
  for (const state of [resizeTournament(double, 4), shuffleTeams(double, () => 0.2), resetResults(completed), renameTeam(double, 'team-2', 'Friends')]) {
    assert.equal(state.format, 'double')
    assert.equal(state.version, 2)
    assert.ok(parseTournament(state))
  }
})

test('double storage drops premature lower/final/reset winners and obsolete reset results', () => {
  const initial = createTournament(6)
  assert.deepEqual(parseTournament({ ...initial, results: { 'l0-m0': 'team-4', 'l1-m0': 'team-4', 'gf-m0': 'team-1', 'gf-reset': 'team-1' } })?.results, {})
  const completed = playDouble(6, false).state
  const corrupted = { ...completed, results: { ...completed.results, 'gf-reset': 'team-1', 'l0-m0': 'team-5' } }
  assert.deepEqual(parseTournament(corrupted), completed)
})
