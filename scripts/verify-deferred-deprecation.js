import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const deferredPackages = [
  { name: '@agent-commerce-trust/agent-mcp', dir: 'agent-mcp' },
  { name: '@agent-commerce-trust/witness', dir: 'witness' },
]

const expected = 'Namespace reserved — package not yet published'

for (const { name: packageName, dir } of deferredPackages) {
  const manifestPath = join('packages', dir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const spec = `${packageName}@0.1.0-rc.0`

  if (manifest.name !== packageName || manifest.version !== '0.1.0-rc.0') {
    throw new Error(`${manifestPath} does not match deferred package spec ${spec}`)
  }
  if (manifest.deprecationMessage !== expected) {
    throw new Error(
      `${manifestPath} deprecationMessage mismatch: expected "${expected}", got "${manifest.deprecationMessage ?? ''}"`,
    )
  }

  let actual = ''
  try {
    actual = execFileSync('npm', ['view', spec, 'deprecated'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    const stderr = String(error?.stderr ?? '')
    if (stderr.includes('E404') || stderr.includes('404 Not Found')) {
      console.log(`${spec} is not published yet; local deprecation intent verified`)
      continue
    }
    throw error
  }

  if (actual !== expected) {
    throw new Error(`${spec} deprecated metadata mismatch: expected "${expected}", got "${actual}"`)
  }

  console.log(`${spec} registry deprecation metadata verified`)
}
