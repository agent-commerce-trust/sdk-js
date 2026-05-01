import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const packageRoot = 'packages'

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function listWorkspacePackages() {
  return readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(packageRoot, entry.name)
      return {
        dir,
        manifestPath: join(dir, 'package.json'),
        manifest: readJson(join(dir, 'package.json')),
      }
    })
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
}

export const phaseOnePackageNames = new Set([
  '@agent-commerce-trust/agent',
  '@agent-commerce-trust/commerce-mcp',
  '@agent-commerce-trust/core',
  '@agent-commerce-trust/supplier',
  '@agent-commerce-trust/verifier',
])

export const deferredPackageNames = new Set([
  '@agent-commerce-trust/agent-mcp',
  '@agent-commerce-trust/witness',
])

export const expectedPackageNames = new Set([
  ...phaseOnePackageNames,
  ...deferredPackageNames,
])

export const expectedVersion = '0.1.0-rc.0'
export const expectedDeprecationMessage = 'Namespace reserved — package not yet published'
