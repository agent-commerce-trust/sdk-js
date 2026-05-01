import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const profileDir = resolve('../ap2-travel/packages/profile')
const profileManifest = resolve(profileDir, 'package.json')

if (existsSync(profileManifest)) {
  execFileSync('npm', ['run', 'build', '--prefix', profileDir], {
    stdio: 'inherit',
  })
}
