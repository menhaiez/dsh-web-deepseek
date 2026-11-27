/**
 * Offline checks for the dsh-web-deepseek bundle. No dependencies, no build:
 * loads the client bundle against a tiny React stub, then inspects the manifest,
 * patch, locale files and icon. Run with `node verify.cjs`.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = __dirname
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const fail = (message) => {
  throw new Error(message)
}

const source = read('client.js')

let captured
globalThis.window = {
  __ModuleLoader__: {
    load(spec) { captured = spec },
  },
}
const react = {
  createElement: () => null,
  Fragment: 'fragment',
  useState: () => fail('hooks must not run during apply'),
  useEffect: () => fail('hooks must not run during apply'),
  useLayoutEffect: () => fail('hooks must not run during apply'),
  useRef: () => fail('hooks must not run during apply'),
}
globalThis.dshDesktop = undefined

// The bundle is a classic script that registers itself with the page module loader.
new Function('module', 'exports', 'require', source)(
  { exports: {} },
  {},
  (id) => {
    if (id === 'react') return react
    throw new Error('unexpected require: ' + id)
  },
)

if (captured === undefined) fail('client.js did not call window.__ModuleLoader__.load')
if (captured.id !== 'dsh-web-deepseek') fail('unexpected client module id: ' + captured.id)

const api = captured.factory((id) => {
  if (id === 'react') return react
  throw new Error('unexpected require: ' + id)
})
if (!Array.isArray(api.inject) || !api.inject.includes('slots') || !api.inject.includes('locale')) {
  fail('client module must inject slots and locale')
}

let registered
let localeListener
api.apply({
  locale: { getSnapshot: () => ({ active: 'en' }) },
  effect: (factory) => factory(),
  on: (_name, listener) => {
    localeListener = listener
    return () => true
  },
  slots: {
    inject(key, callback) {
      if (key !== 'sidebar.footer.action') fail('unexpected slot: ' + key)
      callback()
    },
    register(options, component) {
      registered = { options, component }
      return () => {}
    },
  },
})
if (registered === undefined) fail('the plugin registered no sidebar row')
if (registered.options.name !== 'sidebar.footer.action') fail('wrong slot name')
if (registered.options.id !== 'dsh-web-deepseek') fail('wrong registration id')
if (registered.options.order !== 5) fail('the row must order above the balance chip (order 10)')
if (typeof registered.component !== 'function') fail('the slot registration has no component')
if (typeof localeListener !== 'function') fail('no locale/change listener was registered')

for (const file of ['package.json', 'locale/en.json', 'locale/ru.json']) {
  JSON.parse(read(file))
}

const pkg = JSON.parse(read('package.json'))
if (pkg.name !== 'dsh-web-deepseek') fail('unexpected package name')
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('bundle patch path missing')
if (pkg.dsh?.client?.platform !== 'web') fail('client platform missing')
if (!pkg.exports?.['./client']) fail('client export missing')
if (!pkg.exports?.['./icon']) fail('icon export missing')
if (!fs.existsSync(path.join(root, pkg.dsh.bundle.patch))) fail('bundle patch does not exist')
for (const entry of pkg.files) {
  if (entry.includes('*')) continue
  if (!fs.existsSync(path.join(root, entry))) fail('files entry does not exist: ' + entry)
}

const patch = read('cordis.patch.yml')
if (!patch.includes("name: 'dsh-web-deepseek'")) fail('the patch does not insert the bundle row')

const icon = read('icon.svg')
if (!icon.trimStart().startsWith('<svg') || !icon.trimEnd().endsWith('</svg>')) fail('icon is not an SVG document')
if (Buffer.byteLength(icon) > 256 * 1024) fail('icon exceeds the 256 KiB limit')

console.log('ok: client module, slot registration, locale listener')
console.log('ok: manifest, patch, locale JSON, icon')
console.log('ok: files list resolves')
