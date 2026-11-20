const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}, globals = {}) {
  const source = readFileSync(join(__dirname, '..', file), 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  const exports = {}
  vm.runInNewContext(result.outputText, {
    exports, URL, AbortController, setTimeout, clearTimeout, Uint8Array, ArrayBuffer,
    console: { warn() {} }, __DEV__: false,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`)
      return dependencies[name]
    }, ...globals,
  })
  return exports
}
module.exports = { load }
