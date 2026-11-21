import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** 프로젝트와 타깃 이름을 바꾸면서 소스 경로, 타깃 ID, 서명 설정을 유지한다. */
export function renameIosProject(iosRoot, from, to) {
  const source = path.join(iosRoot, `${from}.xcodeproj`)
  const destination = path.join(iosRoot, `${to}.xcodeproj`)
  if (!existsSync(source)) return false
  if (existsSync(destination)) throw new Error(`Xcode 프로젝트가 이미 있습니다: ${destination}`)

  const replace = (file, transform) => {
    if (!existsSync(file)) return
    const contents = readFileSync(file, 'utf8')
    const updated = transform(contents)
    if (contents !== updated) writeFileSync(file, updated)
  }
  replace(path.join(source, 'project.pbxproj'), contents => contents
    .replaceAll(/((?:name|productName) = )("[^"]+"|[^;]+);/g, (entry, prefix, name) =>
      name === from || name === `"${from}"` ? `${prefix}"${to}";` : entry)
    .replaceAll(`"${from}" */`, `"${to}" */`)
    // Expo autolinking은 provider 경로로 기존 소스 참조를 찾는다.
    .replaceAll(`/Pods-${from}/ExpoModulesProvider.swift`, `/Pods-${to}/ExpoModulesProvider.swift`))
  const schemesRoot = path.join(source, 'xcshareddata/xcschemes')
  if (existsSync(schemesRoot)) {
    for (const file of readdirSync(schemesRoot).filter(file => file.endsWith('.xcscheme'))) {
      replace(path.join(schemesRoot, file), contents => contents
        .replaceAll(`BlueprintName = "${from}"`, `BlueprintName = "${to}"`)
        .replaceAll(`container:${from}.xcodeproj`, `container:${to}.xcodeproj`))
    }
  }
  replace(path.join(iosRoot, 'Podfile'), contents => contents.replaceAll(`target '${from}' do`, `target '${to}' do`))
  replace(path.join(iosRoot, 'closet.xcworkspace/contents.xcworkspacedata'), contents => contents
    .replaceAll(`group:${from}.xcodeproj`, `group:${to}.xcodeproj`))
  renameSync(source, destination)
  return true
}

/** Expo가 다른 환경의 워크스페이스를 선택하지 않도록 사용자 설정과 함께 보관한다. */
export function selectNamedIosWorkspace(iosRoot, activeName) {
  const inactiveRoot = path.join(iosRoot, '.inactive-workspaces')
  for (const name of ['wearroomT', '웨어룸(T)', '웨어룸']) {
    const fileName = `${name}.xcworkspace`
    const active = path.join(iosRoot, fileName)
    const inactive = path.join(inactiveRoot, fileName)
    const [source, destination] = name === activeName ? [inactive, active] : [active, inactive]
    if (!existsSync(source)) continue
    if (existsSync(destination)) {
      if (name === activeName) continue
      // 열려 있던 Xcode에서 같은 경로에 워크스페이스를 다시 저장했을 수 있다.
      const previous = mkdtempSync(path.join(inactiveRoot, 'previous-'))
      renameSync(destination, path.join(previous, fileName))
    }
    mkdirSync(inactiveRoot, { recursive: true })
    renameSync(source, destination)
  }
}
