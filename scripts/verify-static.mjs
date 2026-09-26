import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { players } from '../app/data/players.ts'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const outputDirectory = resolve(projectDirectory, '.output/public')
const configuredBase = process.env.NUXT_APP_BASE_URL || '/'
const basePath = configuredBase.split('/').filter(Boolean).join('/')
const baseURL = basePath ? `/${basePath}/` : '/'
assert.ok(!configuredBase.includes('://'), 'NUXT_APP_BASE_URL must be a path, such as /dota2_list_test/')

async function requireFile(path) {
  const details = await stat(resolve(outputDirectory, path)).catch(() => null)
  assert.ok(details?.isFile(), `Missing generated file: ${path}`)
  return details
}

function attributes(html) {
  return [...html.matchAll(/\b(src|href)\s*=\s*(["'])(.*?)\2/gi)]
    .map(match => ({ name: match[1], value: match[3] }))
}

function localFile(url) {
  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0])
  assert.ok(pathname.startsWith(baseURL), `Local URL escapes deployment base ${baseURL}: ${url}`)
  const file = resolve(outputDirectory, pathname.slice(baseURL.length))
  const relativePath = relative(outputDirectory, file)
  assert.ok(!relativePath.startsWith(`..${sep}`) && relativePath !== '..', `Asset escapes public output: ${url}`)
  return relativePath
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

await requireFile('.nojekyll')
await requireFile('favicon.svg')
assert.ok((await requireFile('images/hero-fallback.svg')).size > 0, 'Image fallback must not be empty')
await requireFile('404.html')

const indexHtml = await readFile(resolve(outputDirectory, 'index.html'), 'utf8')
const rosterCards = [...indexHtml.matchAll(/<article\b[^>]*\bclass=["']([^"']*)["'][^>]*>/gi)]
  .filter(match => match[1].split(/\s+/).includes('player-card'))
assert.equal(rosterCards.length, players.length, 'The static homepage must render the complete player roster')
const indexAttributes = attributes(indexHtml)
assert.ok(indexAttributes.some(item => item.name === 'href' && item.value === `${baseURL}favicon.svg`), 'Favicon must use the deployment base')

assert.equal(new Set(players.map(player => player.id)).size, players.length, 'Player routes must have unique IDs')
const profileDirectories = await readdir(resolve(outputDirectory, 'players'), { withFileTypes: true })
assert.equal(profileDirectories.filter(item => item.isDirectory()).length, players.length, 'Generate exactly one directory for every player')

const documents = [{ path: 'index.html', html: indexHtml }]
for (const player of players) {
  const path = `players/${player.id}/index.html`
  await requireFile(path)
  const html = await readFile(resolve(outputDirectory, path), 'utf8')
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  assert.ok(heading?.includes(escapeHtml(player.nickname)), `${path} must prerender ${player.nickname}, not the generic application shell`)
  const expectedLink = `${baseURL}players/${player.id}`
  assert.ok(indexAttributes.some(item => item.name === 'href' && item.value.replace(/\/$/, '') === expectedLink.replace(/\/$/, '')), `Homepage must link to ${expectedLink}`)
  documents.push({ path, html })
}

const checkedAssets = new Set()
const stylesheetPaths = new Set()
let nuxtScriptCount = 0
for (const document of documents) {
  for (const { name, value } of attributes(document.html)) {
    if (!value.startsWith('/') || value.startsWith('//')) continue
    const file = localFile(value)
    if (value.includes('/_nuxt/') && name === 'src') nuxtScriptCount++
    if (value.split(/[?#]/, 1)[0].endsWith('.css')) stylesheetPaths.add(file)
    if (!/\.(?:js|mjs|css|svg|png|webp|avif|ico|woff2?)(?:[?#]|$)/i.test(value)) continue
    if (checkedAssets.has(file)) continue
    assert.ok((await requireFile(file)).size > 0, `Generated asset is empty: ${file}`)
    if (baseURL !== '/' && /\.(?:m?js)$/.test(file)) {
      const script = await readFile(resolve(outputDirectory, file), 'utf8')
      assert.ok(!/["'`]\/images\/hero-fallback\.svg["'`]/.test(script), `Image fallback still points at the domain root in ${file}`)
    }
    checkedAssets.add(file)
  }
}
assert.ok(nuxtScriptCount > 0, 'Prerendered pages must load base-prefixed Nuxt scripts')
assert.ok(stylesheetPaths.size > 0, 'Prerendered pages must load generated CSS')

let stylesheetSize = 0
for (const path of stylesheetPaths) {
  const css = await readFile(resolve(outputDirectory, path), 'utf8')
  stylesheetSize += Buffer.byteLength(css)
  for (const match of css.matchAll(/url\(\s*["']?(\/[^)\s"']+)["']?\s*\)/gi)) {
    if (match[1].startsWith('//')) continue
    await requireFile(localFile(match[1]))
  }
}
assert.ok(stylesheetSize > 1000, 'Generated CSS must contain the application styles')

console.log(`Static output verified: ${players.length} prerendered profiles, ${checkedAssets.size} assets, ${stylesheetPaths.size} stylesheets; base ${baseURL}`)
