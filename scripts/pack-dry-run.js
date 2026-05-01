import { execFileSync } from 'node:child_process'

import { expectedPackageNames, listWorkspacePackages } from './workspace-packages.js'

const packages = listWorkspacePackages()
const seen = new Set()

for (const { dir, manifest } of packages) {
  const output = execFileSync('npm', ['publish', '--dry-run', '--access', 'public', '--tag', 'rc', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const result = JSON.parse(output)
  const packument = Array.isArray(result) ? result[0] : result.name ? result : result[manifest.name]

  if (!packument) {
    throw new Error(`${dir} did not produce a publish dry-run result`)
  }

  if (packument.name !== manifest.name) {
    throw new Error(`${dir} prepared ${packument.name}, expected ${manifest.name}`)
  }
  if (packument.version !== manifest.version) {
    throw new Error(`${manifest.name} prepared version ${packument.version}, expected ${manifest.version}`)
  }
  if (packument.filename.includes('/')) {
    throw new Error(`${manifest.name} produced unexpected nested tarball path ${packument.filename}`)
  }
  const files = new Set((packument.files ?? []).map((file) => file.path))
  for (const required of ['package.json', 'README.md', 'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts']) {
    if (!files.has(required)) {
      throw new Error(`${manifest.name} publish dry-run is missing ${required}`)
    }
  }
  for (const forbidden of ['src/index.js', 'src/index.d.ts', 'src/index.ts']) {
    if (files.has(forbidden)) {
      throw new Error(`${manifest.name} pack dry-run unexpectedly includes ${forbidden}`)
    }
  }

  seen.add(packument.name)
  console.log(`${packument.name}@${packument.version} publish dry-run verified`)
}

for (const packageName of expectedPackageNames) {
  if (!seen.has(packageName)) {
    throw new Error(`missing dry-run pack check for ${packageName}`)
  }
}

if (seen.size !== expectedPackageNames.size) {
  throw new Error(`publish dry-run checked ${seen.size} packages, expected ${expectedPackageNames.size}`)
}
