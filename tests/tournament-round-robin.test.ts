import assert from 'node:assert/strict'
import test from 'node:test'
import { players } from '../app/data/players.ts'
import {
  MAX_TEAM_PLAYERS, buildBracket, changeTournamentFormat, createTournament, getChampion, getStandings,
  getTournamentMatchCount, parseTournament, renameTeam, resetResults, resizeTournament, setMatchWinner,
  setTeamPlayers, shuffleTeams,
} from '../app/utils/tournament.ts'
import type { TournamentState } from '../app/utils/tournament.ts'

const matchesOf = (state: TournamentState) => buildBracket(state).flatMap(round => round.matches)

function finish(initial: TournamentState) {
  let state = initial
  for (let game = 0; !getChampion(state); game++) {
    assert.ok(game < 22, 'Every supported tournament has a finite completion bound')
    const match = matchesOf(state).find(match => match.status === 'ready')!
    assert.ok(match)
    state = setMatchWinner(state, match.id, match.teamIds[0])
  }
  return state
}

test('new six-team tournaments schedule every pair exactly once and every team in the first round', () => {
  const state = createTournament(6)
  assert.equal(state.version, 3)
  assert.equal(state.layout, 'round-robin')
  const groups = buildBracket(state).filter(round => round.bracket === 'group')
  assert.equal(groups.length, 5)
  const pairings = new Set<string>()
  const appearances = new Map(state.teams.map(team => [team.id, 0]))
  for (const round of groups) {
    assert.equal(round.matches.length, 3)
    const participants = round.matches.flatMap(match => match.teamIds)
    assert.equal(new Set(participants).size, 6, 'All six teams play once in every round')
    assert.ok(round.matches.every(match => match.status === 'ready' && match.teamIds.every(Boolean)))
    for (const match of round.matches) {
      pairings.add([...match.teamIds].sort().join(':'))
      for (const id of match.teamIds) appearances.set(id!, appearances.get(id!)! + 1)
    }
  }
  assert.equal(pairings.size, 15, 'Each unordered pair meets exactly once')
  assert.ok([...appearances.values()].every(count => count === 5))
  assert.deepEqual(groups[0]!.matches.map(match => match.teamIds), [
    ['team-1', 'team-6'], ['team-2', 'team-5'], ['team-3', 'team-4'],
  ])
  assert.ok(matchesOf(state).every(match => match.status !== 'bye'), 'New six-team tournaments have no automatic passes')
  assert.equal(getTournamentMatchCount(state), 21)
  assert.equal(getTournamentMatchCount(createTournament(6, 'single')), 18)
})

test('all fifteen group results are required before top-four playoff slots resolve', () => {
  let state = createTournament(6)
  const group = matchesOf(state).filter(match => match.bracket === 'group')
  for (const match of group.slice(0, -1)) state = setMatchWinner(state, match.id, match.teamIds[0])
  assert.ok(matchesOf(state).filter(match => match.bracket !== 'group').every(match => match.status === 'waiting'))
  assert.equal(getChampion(state), null)
  assert.equal(setMatchWinner(state, 'r0-m0', 'team-1'), state)
  const last = group.at(-1)!
  state = setMatchWinner(state, last.id, last.teamIds[0])
  const table = getStandings(state)
  assert.ok(table.every(standing => standing.played === 5 && standing.wins + standing.losses === 5))
  const upper = matchesOf(state).filter(match => match.bracket === 'upper')
  assert.deepEqual(upper.slice(0, 2).map(match => match.teamIds), [
    [table[0]!.teamId, table[3]!.teamId], [table[1]!.teamId, table[2]!.teamId],
  ])
  assert.ok(upper.slice(0, 2).every(match => match.status === 'ready'))
  assert.deepEqual(upper[0]!.sources, [{ type: 'standing', position: 1 }, { type: 'standing', position: 4 }])
})

test('cyclic head-to-head ties use initial seed consistently and survive shuffled identities', () => {
  let state = shuffleTeams(createTournament(6), () => 0.25)
  const seededIds = state.teams.map(team => team.id)
  const seed = new Map(seededIds.map((id, index) => [id, index + 1]))
  for (const match of matchesOf(state).filter(match => match.bracket === 'group')) {
    const ordered = [...match.teamIds].sort((a, b) => seed.get(a!)! - seed.get(b!)!) as string[]
    const first = seed.get(ordered[0]!)!
    const second = seed.get(ordered[1]!)!
    // 1>2>3>1 and 4>5>6>4 produce three-way equal wins, with every top-three team beating the bottom three.
    const winner = (first === 1 && second === 3) || (first === 4 && second === 6) ? ordered[1]! : ordered[0]!
    state = setMatchWinner(state, match.id, winner)
  }
  const table = getStandings(state)
  assert.deepEqual(table.map(standing => standing.teamId), seededIds)
  assert.deepEqual(table.map(standing => standing.wins), [4, 4, 4, 1, 1, 1])
  assert.deepEqual(table.map(standing => standing.rank), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(getStandings(parseTournament(JSON.parse(JSON.stringify(state)))!), table)
})

test('group corrections preserve other group games while invalidating every playoff result', () => {
  const completed = finish(createTournament(6))
  const group = matchesOf(completed).filter(match => match.bracket === 'group')
  const revised = setMatchWinner(completed, group[0]!.id, null)
  assert.equal(getChampion(revised), null)
  assert.equal(Object.keys(revised.results).length, 14)
  for (const match of group.slice(1)) assert.equal(revised.results[match.id], completed.results[match.id])
  assert.ok(matchesOf(revised).filter(match => match.bracket !== 'group').every(match => match.status === 'waiting'))
  assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(revised))), revised)
  assert.equal(Object.keys(completed.results).length, 21, 'The previous tournament remains unchanged')
})

test('rosters accept up to five actual players and reject duplicate or unavailable assignments', () => {
  const original = createTournament(6)
  const roster = players.slice(0, MAX_TEAM_PLAYERS).map(player => player.id)
  const updated = setTeamPlayers(original, 'team-1', roster)
  assert.deepEqual(updated.teams[0]!.playerIds, roster)
  assert.deepEqual(original.teams[0]!.playerIds, [])
  roster.pop()
  assert.equal(updated.teams[0]!.playerIds.length, 5, 'Input arrays must not remain aliased')
  assert.equal(setTeamPlayers(updated, 'team-2', [players[0]!.id]), updated)
  assert.equal(setTeamPlayers(updated, 'team-2', ['not-a-player']), updated)
  assert.equal(setTeamPlayers(updated, 'team-2', [players[5]!.id, players[5]!.id]), updated)
  assert.equal(setTeamPlayers(updated, 'team-2', players.slice(5, 11).map(player => player.id)), updated)
  assert.equal(setTeamPlayers(updated, 'unknown', []), updated)
  assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(updated))), updated)
  const released = setTeamPlayers(updated, 'team-1', [])
  assert.deepEqual(setTeamPlayers(released, 'team-2', [players[0]!.id]).teams[1]!.playerIds, [players[0]!.id])

  const corrupt: unknown[] = [
    { ...updated, layout: 'standard' },
    { ...updated, teams: updated.teams.map((team, index) => index === 1 ? { ...team, playerIds: [players[0]!.id] } : team) },
    { ...updated, teams: updated.teams.map((team, index) => index === 1 ? { ...team, playerIds: ['missing'] } : team) },
    { ...updated, teams: updated.teams.map((team, index) => index === 1 ? { ...team, playerIds: [players[5]!.id, players[5]!.id] } : team) },
    { ...updated, teams: updated.teams.map((team, index) => index === 1 ? { ...team, playerIds: players.slice(5, 11).map(player => player.id) } : team) },
    { ...updated, teams: updated.teams.map((team, index) => index === 1 ? { id: team.id, name: team.name } : team) },
  ]
  for (const state of corrupt) assert.equal(parseTournament(state), null)
})

test('renaming, shuffling and resizing preserve roster identity or visible seed order', () => {
  let state = setTeamPlayers(createTournament(6), 'team-1', [players[0]!.id, players[1]!.id])
  state = setTeamPlayers(state, 'team-4', [players[2]!.id])
  state = renameTeam(state, 'team-1', 'First Stack')
  const shuffled = shuffleTeams(state, () => 0)
  for (const team of shuffled.teams) assert.deepEqual(team, state.teams.find(original => original.id === team.id))
  const resized = resizeTournament(shuffled, 4)
  assert.deepEqual(resized.teams.map(({ name, playerIds }) => ({ name, playerIds })), shuffled.teams.slice(0, 4).map(({ name, playerIds }) => ({ name, playerIds })))
  assert.equal(resized.layout, 'standard')
  assert.equal(resizeTournament(resized, 6).layout, 'round-robin')
  assert.ok(parseTournament(resized))
})

test('legacy version-two results retain their exact old topology until explicitly reset or reformatted', () => {
  for (const size of [4, 6, 8] as const) {
    const current = createTournament(size)
    const oldTopology: TournamentState = size === 6 ? { ...current, layout: 'legacy-six-byes' } : current
    const complete = finish(oldTopology)
    const legacy = { version: 2, size, format: complete.format, teams: complete.teams.map(({ id, name }) => ({ id, name })), results: complete.results }
    const restored = parseTournament(legacy)!
    assert.deepEqual(restored, complete)
    assert.equal(getChampion(restored)?.id, getChampion(complete)?.id)
    if (size !== 6) continue
    const roster = setTeamPlayers(restored, 'team-1', [players[0]!.id])
    for (const reset of [resetResults(roster), resizeTournament(roster, 6), changeTournamentFormat(roster, 'single')]) {
      assert.equal(reset.layout, 'round-robin')
      assert.deepEqual(reset.results, {})
      assert.deepEqual(reset.teams, roster.teams)
    }
    const shuffled = shuffleTeams(roster, () => 0)
    assert.equal(shuffled.layout, 'round-robin', 'A fresh seeding immediately uses the current layout')
    assert.deepEqual(shuffled.results, {})
    for (const team of shuffled.teams) assert.deepEqual(team, roster.teams.find(original => original.id === team.id))
    assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(shuffled))), shuffled, 'Reload must not change the shuffled layout')
    assert.equal(resetResults({ ...roster, results: {} }).layout, 'round-robin', 'Even an empty legacy bracket upgrades on an explicit reset')
  }
})

test('unplayed six-team saves upgrade after result sanitization without losing names, format or rosters', () => {
  const original = renameTeam(setTeamPlayers(createTournament(6), 'team-1', [players[0]!.id]), 'team-1', 'Saved Stack')
  for (const version of [1, 2, 3]) {
    const format = version === 1 ? 'single' : 'double'
    const teams = version === 3 ? original.teams : original.teams.map(({ id, name }) => ({ id, name }))
    const base = {
      version, size: 6, teams,
      ...(version === 1 ? {} : { format }),
      ...(version === 3 ? { layout: 'legacy-six-byes' } : {}),
    }
    for (const results of [{}, { 'r0-m0': 'team-1', 'r0-m1': 'team-1', unknown: 'team-2', 'gf-reset': 'team-2' }]) {
      const restored = parseTournament({ ...base, results })!
      assert.ok(restored)
      assert.equal(restored.version, 3)
      assert.equal(restored.layout, 'round-robin')
      assert.equal(restored.format, format)
      assert.deepEqual(restored.results, {})
      assert.deepEqual(restored.teams.map(({ id, name }) => ({ id, name })), original.teams.map(({ id, name }) => ({ id, name })))
      assert.deepEqual(restored.teams[0]!.playerIds, version === 3 ? [players[0]!.id] : [])
      assert.equal(buildBracket(restored)[0]!.matches.length, 3)
      assert.ok(buildBracket(restored)[0]!.matches.every(match => match.status === 'ready'))
    }
    const played = parseTournament({ ...base, results: { 'r0-m1': 'team-4' } })!
    assert.equal(played.layout, 'legacy-six-byes', 'Even one valid played match protects the original topology')
    assert.deepEqual(played.results, { 'r0-m1': 'team-4' })
  }
})
