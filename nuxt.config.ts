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
      title: 'DOTA қауым — наш вечер, наша пати',
      meta: [
        { name: 'description', content: 'Наша компания, которая каждый вечер собирается поиграть в Доту. Знакомые ники, любимые герои, байки из пати и ещё одна катка.' },
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
      routes: ['/', ...players.map(player => `/players/${player.id}`)],
    },
  },
})
