const fs = require('node:fs')
const path = require('node:path')
const { withXcodeProject } = require('expo/config-plugins')

/** 앱 산출물 이름과 버전을 갱신하고, 현재 환경의 공유 scheme만 남긴다. 프로젝트와 서명 타깃은 유지한다. */
function syncIosBuildIdentity(project, { platformProjectRoot, schemeName, productName, version }) {
  const configurations = project.pbxXCBuildConfigurationSection()
  const lists = project.pbxXCConfigurationList()
  for (const target of Object.values(project.pbxNativeTargetSection())) {
    if (!target || typeof target !== 'object' || String(target.productType).replaceAll('"', '') !== 'com.apple.product-type.application') continue
    for (const reference of lists[target.buildConfigurationList]?.buildConfigurations ?? []) {
      const settings = configurations[reference.value]?.buildSettings
      if (!settings) continue
      settings.PRODUCT_NAME = `"${productName}"`
      settings.MARKETING_VERSION = version
    }
  }
  const projectDirectories = fs.readdirSync(platformProjectRoot).filter(name => name.endsWith('.xcodeproj'))
  if (projectDirectories.length !== 1) throw new Error('앱 Xcode 프로젝트를 하나로 확인할 수 없습니다.')
  const projectName = projectDirectories[0].slice(0, -'.xcodeproj'.length)
  const schemesRoot = path.join(platformProjectRoot, projectDirectories[0], 'xcshareddata', 'xcschemes')
  const schemePath = name => path.join(schemesRoot, `${name}.xcscheme`)
  const destination = schemePath(schemeName)
  const knownSchemes = [...new Set([schemeName, projectName, 'wearroomT', 'wearroom', 'wearroomL', '웨어룸(T)', '웨어룸'])]
  // 최초에는 Expo 기본 scheme을 쓰고, 이후에는 직전 환경의 scheme을 이어받는다.
  const source = knownSchemes.map(schemePath).find(file => fs.existsSync(file))
  if (!source) throw new Error('기준 Xcode scheme을 찾지 못했습니다.')
  const scheme = fs.readFileSync(source, 'utf8').replace(/BuildableName\s*=\s*"[^"\n]+\.app"/g, `BuildableName = "${productName}.app"`)
  fs.writeFileSync(destination, scheme)
  for (const file of knownSchemes.map(schemePath)) {
    if (file !== destination && fs.existsSync(file)) fs.unlinkSync(file)
  }
  return project
}

module.exports = (config, options) => withXcodeProject(config, mod => {
  mod.modResults = syncIosBuildIdentity(mod.modResults, { ...options, platformProjectRoot: mod.modRequest.platformProjectRoot })
  return mod
})
module.exports.syncIosBuildIdentity = syncIosBuildIdentity
