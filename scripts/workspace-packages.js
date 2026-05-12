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

/**
 * Default workspace version for packages that have not yet reached their
 * own rc.1 public-surface milestone. Phase-1 packages still at rc.0 stub
 * state declare this.
 */
export const expectedVersion = '0.1.0-rc.0'

/**
 * Per-package version overrides for packages whose surface has been
 * promoted past the workspace default. Each entry below is one promotion
 * step; entries are removed (rolling back to `expectedVersion`) only on
 * deprecation.
 */
export const packageVersionOverrides = Object.freeze({
  '@agent-commerce-trust/core': '0.1.0-rc.1',
})

/**
 * Return the expected `version` field for a given package manifest. Uses
 * the override map for promoted packages and the default for everyone else.
 */
export function expectedVersionFor(packageName) {
  return packageVersionOverrides[packageName] ?? expectedVersion
}

export const expectedProfileVersion = '0.1.0-rc.1'
export const expectedDeprecationMessage = 'Namespace reserved — package not yet published'
