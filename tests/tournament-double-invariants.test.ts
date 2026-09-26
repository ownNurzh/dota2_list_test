import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBracket, createTournament, getChampion, parseTournament, setMatchWinner, shuffleTeams,
} from '../app/utils/tournament.ts'
import type { TournamentSize, TournamentState } from '../app/utils/tournament.ts'

/** Count actual head-to-head games, independently of the engine's advancement rules. */
function verifyState(state: TournamentState) {
  const matches = buildBracket(state).flatMap(round => round.matches)
  const ledger = new Map(state.teams.map(team => [team.id, { played: 0, losses: 0 }]))
  let played = 0

  for (const match of matches) {
    const participants = match.teamIds.filter((id): id is string => id !== null)
    assert.equal(new Set(participants).size, participants.length, `${match.id}: no team plays itself`)
    assert.ok(participants.every(id => ledger.has(id)), `${match.id}: all participants belong to this tournament`)
    if (match.status === 'bye') {
      assert.ok(participants.length <= 1, `${match.id}: byes are not head-to-head games`)
      assert.equal(match.loserId, null, `${match.id}: a bye never produces a loser`)
      assert.equal(state.results[match.id], undefined, `${match.id}: a bye never stores a result`)
    }
    if (match.status !== 'complete') continue

    assert.equal(participants.length, 2, `${match.id}: a completed game needs two real teams`)
    assert.ok(match.winnerId && participants.includes(match.winnerId))
    const loser = participants.find(id => id !== match.winnerId)!
    assert.equal(match.loserId, loser)
    for (const id of participants) ledger.get(id)!.played++
    ledger.get(loser)!.losses++
    played++
  }

  const active = new Set<string>()
  for (const match of matches.filter(match => match.status === 'ready')) {
    assert.equal(match.teamIds.filter(Boolean).length, 2)
    for (const id of match.teamIds) {
      assert.ok(id)
      assert.ok(!active.has(id), `${id} must not be ready in two simultaneous matches`)
      assert.ok(ledger.get(id)!.losses < 2, `${id} cannot play after elimination`)
      active.add(id)
    }
  }
  for (const [id, record] of ledger) assert.ok(record.losses <= 2, `${id} cannot lose a third game`)
  assert.equal(Object.keys(state.results).length, played, 'Only real completed games are stored')
  assert.ok(played <= 2 * state.size - 1, 'Double elimination always has a finite game bound')
  assert.deepEqual(parseTournament(JSON.parse(JSON.stringify(state))), state, 'Every intermediate state survives storage')

  const eliminated = [...ledger.values()].filter(record => record.losses === 2).length
  const champion = getChampion(state)
  assert.equal(Boolean(champion), eliminated === state.size - 1, 'Champion exists exactly when every opponent has two losses')
  if (champion) {
    for (const [id, record] of ledger) {
      assert.ok(record.played >= 2, `${id}: every team receives at least two actual games, including upper bye seeds`)
      if (id === champion.id) assert.ok(record.losses <= 1)
      else assert.equal(record.losses, 2)
    }
    assert.equal(played, 2 * state.size - 2 + ledger.get(champion.id)!.losses)
    assert.equal(matches.some(match => match.status === 'ready'), false, 'No playable game remains after a champion is crowned')
  } else {
    assert.ok(matches.some(match => match.status === 'ready'), 'Every unfinished valid state can make progress')
  }

  return { matches, champion, played }
}

function randomGenerator(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 2 ** 32
  }
}

test('all 96 four-team double-elimination outcomes satisfy actual-game and elimination invariants', () => {
  let finished = 0
  let resetFinals = 0
  function visit(state: TournamentState) {
    const { matches, champion, played } = verifyState(state)
    if (champion) {
      finished++
      if (played === 7) resetFinals++
      return
    }
    const match = matches.find(match => match.status === 'ready')!
    for (const winner of match.teamIds) visit(setMatchWinner(state, match.id, winner))
  }

  visit(createTournament(4, 'double'))
  assert.equal(finished, 96)
  assert.equal(resetFinals, 64)
})

test('six and eight teams finish with valid losses under shuffled seeding and arbitrary eligible-match order', () => {
  for (const size of [6, 8] as const) {
    const finalLengths = new Set<number>()
    for (let sample = 1; sample <= 96; sample++) {
      const random = randomGenerator(sample * 7919 + size)
      let state = shuffleTeams(createTournament(size, 'double'), random)
      for (let step = 0; step <= 2 * size - 1; step++) {
        const { matches, champion, played } = verifyState(state)
        if (champion) {
          finalLengths.add(played)
          break
        }
        assert.ok(step < 2 * size - 1, 'A legal match order cannot deadlock or loop')
        const ready = matches.filter(match => match.status === 'ready')
        // Exercise both ends of the ready list as well as arbitrary interleaving of upper/lower games.
        const index = sample % 3 === 0 ? ready.length - 1 : sample % 3 === 1 ? 0 : Math.floor(random() * ready.length)
        const match = ready[index]!
        state = setMatchWinner(state, match.id, match.teamIds[Math.floor(random() * 2)]!)
      }
    }
    assert.deepEqual([...finalLengths].sort((a, b) => a - b), [2 * size - 2, 2 * size - 1])
  }
})

function finishWithReset(size: TournamentSize) {
  let state = createTournament(size, 'double')
  for (let step = 0; step < 2 * size - 1; step++) {
    const matches = buildBracket(state).flatMap(round => round.matches)
    const match = matches.find(match => match.status === 'ready')
    assert.ok(match, 'Reset fixture must remain playable until its final game')
    // The first grand final must go to the lower-bracket finalist to activate a reset.
    const lowerIndex = match.id === 'gf-m0'
      ? match.sources.findIndex(source => source.type !== 'seed' && matches.find(item => item.id === source.matchId)?.bracket === 'lower')
      : -1
    assert.ok(match.id !== 'gf-m0' || lowerIndex !== -1, 'Grand final has a lower-bracket source')
    state = setMatchWinner(state, match.id, match.teamIds[lowerIndex === -1 ? 0 : lowerIndex]!)
  }
  assert.ok(getChampion(state))
  assert.ok(state.results['gf-reset'], 'Fixture includes a completed reset final')
  return state
}

test('correcting results invalidates both winner and loser descendants but preserves independent games', () => {
  for (const size of [4, 6, 8] as const) {
    const completed = finishWithReset(size)
    const matches = buildBracket(completed).flatMap(round => round.matches)
    const snapshot = structuredClone(completed)

    for (const changed of matches.filter(match => match.status === 'complete')) {
      const descendants = new Set([changed.id])
      let previousSize = -1
      while (previousSize !== descendants.size) {
        previousSize = descendants.size
        for (const match of matches) {
          if (match.sources.some(source => source.type !== 'seed' && descendants.has(source.matchId))) descendants.add(match.id)
        }
      }
      for (const newWinner of [null, changed.teamIds.find(id => id !== changed.winnerId)!]) {
        const revised = setMatchWinner(completed, changed.id, newWinner)
        assert.equal(revised.results[changed.id], newWinner ?? undefined)
        for (const [id, winner] of Object.entries(completed.results)) {
          if (id === changed.id) continue
          assert.equal(revised.results[id], descendants.has(id) ? undefined : winner, `${changed.id} correction: ${id} follows source-graph reachability`)
        }
        verifyState(revised)
        assert.deepEqual(completed, snapshot, 'Correction must leave previous state intact')
      }
    }
  }
})
