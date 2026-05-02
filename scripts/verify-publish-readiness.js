import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  deferredPackageNames,
  expectedDeprecationMessage,
  expectedPackageNames,
  expectedProfileVersion,
  expectedVersion,
  listWorkspacePackages,
  phaseOnePackageNames,
} from './workspace-packages.js'

const packages = listWorkspacePackages()
const seen = new Set()

for (const { dir, manifest, manifestPath } of packages) {
  seen.add(manifest.name)

  if (!expectedPackageNames.has(manifest.name)) {
    throw new Error(`${manifestPath} has unexpected package name ${manifest.name}`)
  }
  if (manifest.version !== expectedVersion) {
    throw new Error(`${manifest.name} version must be ${expectedVersion}`)
  }
  if (manifest.private !== false) {
    throw new Error(`${manifest.name} must set private=false for publish readiness`)
  }
  if (manifest.publishConfig?.access !== 'public') {
    throw new Error(`${manifest.name} must publish with public access`)
  }
  if (manifest.license !== 'Apache-2.0') {
    throw new Error(`${manifest.name} must use Apache-2.0`)
  }
  if (manifest.type !== 'module') {
    throw new Error(`${manifest.name} must be an ES module package`)
  }
  if (manifest.sideEffects !== false) {
    throw new Error(`${manifest.name} must declare sideEffects=false`)
  }
  if (manifest.engines?.node !== '>=20') {
    throw new Error(`${manifest.name} must require Node >=20`)
  }
  if (manifest.exports?.['.']?.import !== './dist/index.js') {
    throw new Error(`${manifest.name} must export ./dist/index.js`)
  }
  if (manifest.exports?.['.']?.require !== './dist/index.cjs') {
    throw new Error(`${manifest.name} must export ./dist/index.cjs for CommonJS consumers`)
  }
  if (manifest.exports?.['.']?.types !== './dist/index.d.ts') {
    throw new Error(`${manifest.name} must export ./dist/index.d.ts types`)
  }
  if (manifest.types !== './dist/index.d.ts') {
    throw new Error(`${manifest.name} must set top-level types`)
  }
  if (!manifest.files?.includes('dist') || !manifest.files?.includes('README.md')) {
    throw new Error(`${manifest.name} must publish dist and README.md only`)
  }
  if (!existsSync(join(dir, 'README.md'))) {
    throw new Error(`${manifest.name} is missing README.md`)
  }
  if (
    !existsSync(join(dir, 'dist/index.js')) ||
    !existsSync(join(dir, 'dist/index.cjs')) ||
    !existsSync(join(dir, 'dist/index.d.ts')) ||
    !existsSync(join(dir, 'dist/index.d.cts'))
  ) {
    throw new Error(`${manifest.name} is missing built ESM, CJS, or type entrypoints`)
  }

  if (phaseOnePackageNames.has(manifest.name)) {
    if (manifest.dependencies?.['@ap2-travel/profile'] !== `^${expectedProfileVersion}`) {
      throw new Error(`${manifest.name} must depend on @ap2-travel/profile@^${expectedProfileVersion}`)
    }
    if ('deprecationMessage' in manifest) {
      throw new Error(`${manifest.name} must not carry deferred deprecation metadata`)
    }
  }

  if (deferredPackageNames.has(manifest.name)) {
    if (manifest.deprecationMessage !== expectedDeprecationMessage) {
      throw new Error(`${manifest.name} must carry the deferred deprecation message`)
    }
    if (manifest.dependencies?.['@ap2-travel/profile']) {
      throw new Error(`${manifest.name} must not present itself as a Phase-1 AP2 profile package`)
    }
  }

  console.log(`${manifest.name}@${manifest.version} publish metadata verified`)
}

for (const packageName of expectedPackageNames) {
  if (!seen.has(packageName)) {
    throw new Error(`missing workspace package ${packageName}`)
  }
}

if (seen.size !== expectedPackageNames.size) {
  throw new Error(`found ${seen.size} packages, expected ${expectedPackageNames.size}`)
}
