import { execFileSync } from 'node:child_process'

import { expectedPackageNames, listWorkspacePackages } from './workspace-packages.js'

const packages = listWorkspacePackages()
const seen = new Set()

for (const { dir, manifest } of packages) {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const [packument] = JSON.parse(output)

  if (packument.name !== manifest.name) {
    throw new Error(`${dir} packed ${packument.name}, expected ${manifest.name}`)
  }
  if (packument.version !== manifest.version) {
    throw new Error(`${manifest.name} packed version ${packument.version}, expected ${manifest.version}`)
  }
  if (packument.filename.includes('/')) {
    throw new Error(`${manifest.name} produced unexpected nested tarball path ${packument.filename}`)
  }
  const files = new Set((packument.files ?? []).map((file) => file.path))
  for (const required of ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts']) {
    if (!files.has(required)) {
      throw new Error(`${manifest.name} pack dry-run is missing ${required}`)
    }
  }
  for (const forbidden of ['src/index.js', 'src/index.d.ts', 'src/index.ts']) {
    if (files.has(forbidden)) {
      throw new Error(`${manifest.name} pack dry-run unexpectedly includes ${forbidden}`)
    }
  }

  seen.add(packument.name)
  console.log(`${packument.name}@${packument.version} dry-run pack verified`)
}

for (const packageName of expectedPackageNames) {
  if (!seen.has(packageName)) {
    throw new Error(`missing dry-run pack check for ${packageName}`)
  }
}

if (seen.size !== expectedPackageNames.size) {
  throw new Error(`checked ${seen.size} packages, expected ${expectedPackageNames.size}`)
}
