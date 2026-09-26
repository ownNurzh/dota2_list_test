import { roleDefinitions, statDefinitions } from '../data/players.ts'
import type { Player, Role, Tier } from '../data/players.ts'

export type PlayerSort = 'rating-desc' | 'mmr-desc' | 'mmr-asc' | 'name-asc'

export interface PlayerFilters {
  search?: string
  role?: Role | 'all'
  tier?: Tier | 'all'
  sort?: PlayerSort
}

/** Rounded weighted score on a 0–100 scale, based on the example characteristics. */
export function calculateRating(stats: Player['stats']): number {
  return Math.round(statDefinitions.reduce((score, stat) => score + stats[stat.key] * stat.weight, 0))
}

export function formatRole(role: Role): string {
  return `${role} · ${roleDefinitions[role].label}`
}

const heroSlugs: Record<string, string> = {
  'drow ranger': 'drow_ranger',
  lifestealer: 'life_stealer',
  juggernaut: 'juggernaut',
  terrorblade: 'terrorblade',
  spectre: 'spectre',
  sven: 'sven',
  medusa: 'medusa',
  luna: 'luna',
  morphling: 'morphling',
  'phantom lancer': 'phantom_lancer',
  'phantom assassin': 'phantom_assassin',
  bloodseeker: 'bloodseeker',
  marci: 'marci',
  axe: 'axe',
  tidehunter: 'tidehunter',
  lion: 'lion',
  'witch doctor': 'witch_doctor',
  'dark willow': 'dark_willow',
  techies: 'techies',
  undying: 'undying',
  necrophos: 'necrolyte',
  'arc warden': 'arc_warden',
  beastmaster: 'beastmaster',
  'templar assassin': 'templar_assassin',
  puck: 'puck',
  'lone druid': 'lone_druid',
  'ogre magi': 'ogre_magi',
  'centaur warrunner': 'centaur',
  rubick: 'rubick',
  pudge: 'pudge',
  tinker: 'tinker',
  disruptor: 'disruptor',
  phoenix: 'phoenix',
  mars: 'mars',
  timbersaw: 'shredder',
  largo: 'largo',
  ursa: 'ursa',
  lina: 'lina',
  earthshaker: 'earthshaker',
  hoodwink: 'hoodwink',
  invoker: 'invoker',
  magnus: 'magnataur',
  'queen of pain': 'queenofpain',
}

export function getHeroSlug(hero: string): string {
  return heroSlugs[hero.trim().toLowerCase()] ?? 'phantom_assassin'
}

export function getHeroImage(hero: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${getHeroSlug(hero)}.png`
}

const numberFormatter = new Intl.NumberFormat('ru-RU')

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Combines all filters without mutating the original player list. */
export function filterPlayers(source: Player[], filters: PlayerFilters = {}): Player[] {
  const query = filters.search?.trim().toLocaleLowerCase('ru-RU') ?? ''
  const filtered = source.filter((player) => {
    if (filters.role && filters.role !== 'all' && player.role !== filters.role) return false
    if (filters.tier && filters.tier !== 'all' && player.tier !== filters.tier) return false
    if (!query) return true

    const searchable = [
      player.nickname,
      player.fullName,
      formatRole(player.role),
      roleDefinitions[player.role].englishLabel,
      `Позиция ${player.role}`,
      player.tier,
      String(player.mmr),
      player.notes,
      ...player.tags,
      ...player.signatureHeroes,
    ].join(' ').toLocaleLowerCase('ru-RU')

    return searchable.includes(query)
  })

  return filtered.sort((left, right) => {
    switch (filters.sort ?? 'rating-desc') {
      case 'rating-desc':
        return calculateRating(right.stats) - calculateRating(left.stats)
          || right.mmr - left.mmr
          || left.nickname.localeCompare(right.nickname, 'ru')
      case 'mmr-desc':
        return right.mmr - left.mmr || left.nickname.localeCompare(right.nickname, 'ru')
      case 'mmr-asc':
        return left.mmr - right.mmr || left.nickname.localeCompare(right.nickname, 'ru')
      case 'name-asc':
        return left.nickname.localeCompare(right.nickname, 'ru')
    }
  })
}
