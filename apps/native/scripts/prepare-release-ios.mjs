import { cpSync, existsSync, mkdtempSync, readdirSync, renameSync, rmSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { renameIosProject } from './rename-ios-project.mjs'

/** Expo prebuild에는 별도 프로젝트 루트를 전달해 local의 ios 폴더를 건드리지 않는다. */
export function prebuildReleaseIos({ nativeRoot, iosRoot, localIosRoot, prebuild }) {
  const stagingRoot = mkdtempSync(path.join(path.dirname(nativeRoot), '.native-ios-prebuild-'))
  const stagingIos = path.join(stagingRoot, 'ios')
  try {
    for (const name of ['app.config.js', 'app.json', 'package.json']) {
      cpSync(path.join(nativeRoot, name), path.join(stagingRoot, name))
    }
    for (const name of ['app-versions.json', 'assets', 'config', 'node_modules', 'plugins']) {
      symlinkSync(path.join(nativeRoot, name), path.join(stagingRoot, name))
    }

    if (existsSync(iosRoot)) {
      symlinkSync(iosRoot, stagingIos)
    } else if (existsSync(localIosRoot)) {
      // 첫 생성에서는 기존 타깃의 버전과 서명 설정을 이어받고 Pods는 새 위치에서 설치한다.
      const omitted = new Set(['Pods', 'build', '.inactive-workspaces', '.xcode.env.local'])
      cpSync(localIosRoot, stagingIos, {
        recursive: true,
        filter: (source) => !omitted.has(path.basename(source)),
      })
    }

    if (existsSync(stagingIos)) {
      const project = readdirSync(stagingIos).find(name => name.endsWith('.xcodeproj'))
      if (project && project !== 'closet.xcodeproj') renameIosProject(stagingIos, path.basename(project, '.xcodeproj').normalize('NFC'), 'closet')
    }

    prebuild(stagingRoot)
    if (!existsSync(iosRoot)) renameSync(stagingIos, iosRoot)
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}
