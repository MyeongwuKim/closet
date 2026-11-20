const fs = require('node:fs')
const path = require('node:path')
const { withXcodeProject } = require('expo/config-plugins')

/** Generate an environment-named scheme while keeping the existing project and signing target. */
function syncIosBuildIdentity(project, { platformProjectRoot, schemeName, version }) {
  const configurations = project.pbxXCBuildConfigurationSection()
  const lists = project.pbxXCConfigurationList()
  for (const target of Object.values(project.pbxNativeTargetSection())) {
    if (!target || typeof target !== 'object' || String(target.productType).replaceAll('"', '') !== 'com.apple.product-type.application') continue
    for (const reference of lists[target.buildConfigurationList]?.buildConfigurations ?? []) {
      const settings = configurations[reference.value]?.buildSettings
      if (!settings) continue
      settings.PRODUCT_NAME = `"${schemeName}"`
      settings.MARKETING_VERSION = version
    }
  }
  const projectDirectories = fs.readdirSync(platformProjectRoot).filter(name => name.endsWith('.xcodeproj'))
  if (projectDirectories.length !== 1) throw new Error('앱 Xcode 프로젝트를 하나로 확인할 수 없습니다.')
  const projectName = projectDirectories[0].slice(0, -'.xcodeproj'.length)
  const schemesRoot = path.join(platformProjectRoot, projectDirectories[0], 'xcshareddata', 'xcschemes')
  const source = path.join(schemesRoot, `${projectName}.xcscheme`)
  if (!fs.existsSync(source)) throw new Error('기준 Xcode scheme을 찾지 못했습니다.')
  const scheme = fs.readFileSync(source, 'utf8').replace(/BuildableName\s*=\s*"[^"\n]+\.app"/g, `BuildableName = "${schemeName}.app"`)
  for (const name of ['wearroomT', 'wearroom', 'wearroomL']) {
    const file = path.join(schemesRoot, `${name}.xcscheme`)
    if (name !== schemeName && file !== source && fs.existsSync(file)) fs.unlinkSync(file)
  }
  fs.writeFileSync(path.join(schemesRoot, `${schemeName}.xcscheme`), scheme)
  return project
}

module.exports = (config, options) => withXcodeProject(config, mod => {
  mod.modResults = syncIosBuildIdentity(mod.modResults, { ...options, platformProjectRoot: mod.modRequest.platformProjectRoot })
  return mod
})
module.exports.syncIosBuildIdentity = syncIosBuildIdentity
