import { players } from './app/data/players'
import { env } from 'node:process'

const baseURL = `/${(env.NUXT_APP_BASE_URL || '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'DOTA қауым — свои лобби и турнирные катки',
      meta: [
        { name: 'description', content: 'Собираемся по 30 человек, делимся на пятёрки и играем друг против друга в лобби Dota 2. Наши игроки и турнирная сетка на 4, 6 или 8 команд.' },
        { name: 'theme-color', content: '#101114' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` }],
    },
  },
  typescript: { strict: true },
  nitro: {
    prerender: {
      crawlLinks: true,
      failOnError: true,
      routes: ['/', '/tournament', ...players.map(player => `/players/${player.id}`)],
    },
  },
})
