import { spawnSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { constrainNativeDocument } from './native-document.mjs'

const nativeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const webRoot = path.resolve(nativeRoot, '../web')
const webDist = path.join(webRoot, 'dist')
const generatedFile = path.join(nativeRoot, 'src/generated/webBundle.ts')
const shouldSkipBuild = process.argv.includes('--skip-build')
const webBundleBaseUrl = 'https://closet.native/'
const moduleSpecifierPrefix = '@closet-web/'
let webBundleVersion = ''

function createWebBundleVersion() {
  const [date, time] = new Date().toISOString().split('T')
  return `${date.replaceAll('-', '')}.${time.slice(0, 8).replaceAll(':', '')}`
}

async function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  const contents = await readFile(filePath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue

    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

function buildWeb() {
  const nativeApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim()
  const result = spawnSync('pnpm', ['run', 'build'], {
    cwd: webRoot,
    env: {
      ...process.env,
      CLOSET_NATIVE_WEB_BUNDLE: '1',
      ...(nativeApiUrl ? { VITE_API_URL: nativeApiUrl } : {}),
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

await loadEnvFile(path.join(nativeRoot, '.env'))
webBundleVersion =
  process.env.CLOSET_WEB_BUNDLE_VERSION?.trim() || createWebBundleVersion()

if (!shouldSkipBuild) {
  buildWeb()
}

if (!existsSync(path.join(webDist, 'index.html'))) {
  throw new Error(
    '웹 빌드가 없습니다. pnpm native:bundle을 먼저 실행해주세요.',
  )
}

function normalizeAssetPath(assetPath) {
  return assetPath.trim().split(/[?#]/)[0].replace(/^\/+/, '').replace(/^\.\//, '')
}

function resolveAssetPath(assetPath, fromAssetPath = '') {
  if (!assetPath || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(assetPath)) {
    return null
  }

  if (assetPath.startsWith('/')) {
    return normalizeAssetPath(assetPath)
  }

  return path.posix
    .normalize(path.posix.join(path.posix.dirname(fromAssetPath), assetPath))
    .replace(/^\.\//, '')
}

function toDistPath(assetPath) {
  const resolvedPath = path.resolve(webDist, normalizeAssetPath(assetPath))
  if (
    resolvedPath !== webDist &&
    !resolvedPath.startsWith(`${webDist}${path.sep}`)
  ) {
    throw new Error(`Invalid web asset path: ${assetPath}`)
  }

  return resolvedPath
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  const mimeTypes = {
    '.avif': 'image/avif',
    '.css': 'text/css',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }

  return mimeTypes[extension] ?? 'application/octet-stream'
}

async function toDataUrl(assetPath) {
  const filePath = toDistPath(assetPath)
  const file = await readFile(filePath)
  return `data:${getMimeType(filePath)};base64,${file.toString('base64')}`
}

async function inlineCssAssetUrls(css, stylesheetPath) {
  let result = css
  const matches = [...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)]

  for (const match of matches) {
    const assetPath = resolveAssetPath(match[2], stylesheetPath)
    if (!assetPath) continue

    const dataUrl = await toDataUrl(assetPath)
    result = result.replace(match[0], `url("${dataUrl}")`)
  }

  return result
}

async function inlineStylesheets(html) {
  let result = html
  const matches = [
    ...html.matchAll(/<link\s+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi),
  ]

  for (const match of matches) {
    const stylesheetPath = normalizeAssetPath(match[1])
    const css = await readFile(toDistPath(stylesheetPath), 'utf8')
    const inlinedCss = await inlineCssAssetUrls(css, stylesheetPath)
    result = result.replace(
      match[0],
      `<style data-closet-href="${match[1]}">\n${inlinedCss}\n</style>`,
    )
  }

  return result
}

function getTagAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'))
  return match?.[1] ?? null
}

function getEntryModuleScripts(html) {
  return [...html.matchAll(/<script\b[^>]*><\/script>/gi)]
    .map((match) => match[0])
    .filter((tag) => getTagAttribute(tag, 'type') === 'module')
    .map((tag) => getTagAttribute(tag, 'src'))
    .filter((source) => typeof source === 'string')
    .map(normalizeAssetPath)
}

function prepareHtmlDocument(html) {
  const runtimeConfig = {
    isNativeWebView: true,
    routerMode: 'hash',
    webBundleVersion,
  }

  return constrainNativeDocument(html)
    .replace(/<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>\s*/gi, '')
    .replace(
      /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=)[^>]*><\/script>\s*/gi,
      '',
    )
    .replace(
      '<head>',
      `<head>
    <base href="${webBundleBaseUrl}" />
    <script data-closet-runtime-config>
      window.ClosetRuntimeConfig = Object.assign({}, window.ClosetRuntimeConfig, ${JSON.stringify(runtimeConfig)});
    </script>`,
    )
}

async function collectDistFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectDistFiles(entryPath)))
    } else if (entry.isFile()) {
      files.push(
        path.relative(webDist, entryPath).split(path.sep).join(path.posix.sep),
      )
    }
  }

  return files
}

function toModuleSpecifier(assetPath) {
  return `${moduleSpecifierPrefix}${normalizeAssetPath(assetPath)}`
}

function resolveJsImportPath(importPath, fromAssetPath) {
  return path.posix
    .normalize(path.posix.join(path.posix.dirname(fromAssetPath), importPath))
    .replace(/^\.\//, '')
}

function rewriteJsImports(source, assetPath) {
  const rewrite = (importPath) =>
    toModuleSpecifier(resolveJsImportPath(importPath, assetPath))

  return source
    .replace(
      /\bfrom\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1/g,
      (_, quote, specifier) => `from${quote}${rewrite(specifier)}${quote}`,
    )
    .replace(
      /\bimport\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1/g,
      (_, quote, specifier) => `import${quote}${rewrite(specifier)}${quote}`,
    )
    .replace(
      /\bimport\s*\(\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1\s*\)/g,
      (_, quote, specifier) => `import(${quote}${rewrite(specifier)}${quote})`,
    )
}

async function rewriteJsAssets(source, assetPaths) {
  let result = source

  for (const assetPath of assetPaths) {
    const references = [`/${assetPath}`, `./${assetPath}`]
    if (!references.some((reference) => result.includes(reference))) continue

    const dataUrl = await toDataUrl(assetPath)
    for (const reference of references) {
      result = result.replaceAll(reference, dataUrl)
    }
  }

  return result
}

async function createNativeModuleScripts(entryScriptPaths) {
  const distFiles = await collectDistFiles(webDist)
  const jsFiles = distFiles.filter((file) => file.endsWith('.js')).sort()
  const staticAssetFiles = distFiles.filter(
    (file) => !/\.(?:html|css|js)$/i.test(file),
  )
  const imports = {}

  for (const assetPath of jsFiles) {
    const source = await readFile(toDistPath(assetPath), 'utf8')
    const withAssets = await rewriteJsAssets(source, staticAssetFiles)
    const rewrittenSource = rewriteJsImports(withAssets, assetPath)

    imports[toModuleSpecifier(assetPath)] =
      `data:text/javascript;base64,${Buffer.from(rewrittenSource).toString('base64')}`
  }

  for (const entryScriptPath of entryScriptPaths) {
    if (!imports[toModuleSpecifier(entryScriptPath)]) {
      throw new Error(`Missing native entry module: ${entryScriptPath}`)
    }
  }

  const entryImports = entryScriptPaths
    .map((entryScriptPath) => `import ${JSON.stringify(toModuleSpecifier(entryScriptPath))};`)
    .join('\n')

  return `<script type="importmap" data-closet-native-modules>${JSON.stringify({ imports })}</script>
    <script type="module" data-closet-native-entry>
${entryImports}
    </script>`
}

let html = await readFile(path.join(webDist, 'index.html'), 'utf8')
const entryScriptPaths = getEntryModuleScripts(html)
if (entryScriptPaths.length === 0) {
  throw new Error('Vite 웹 엔트리 모듈을 찾지 못했습니다.')
}

html = prepareHtmlDocument(html)
html = await inlineStylesheets(html)
html = html.replace(
  '</head>',
  `${await createNativeModuleScripts(entryScriptPaths)}\n  </head>`,
)

await mkdir(path.dirname(generatedFile), { recursive: true })
await writeFile(
  generatedFile,
  `/* Generated by scripts/sync-web-build.mjs. */\nexport const WEB_BUNDLE_BASE_URL = ${JSON.stringify(webBundleBaseUrl)}\nexport const WEB_BUNDLE_HTML = ${JSON.stringify(html)}\n`,
)

console.log(`Generated ${path.relative(nativeRoot, generatedFile)}`)
