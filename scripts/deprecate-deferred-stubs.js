import { execFileSync } from 'node:child_process'

import { expectedDeprecationMessage } from './workspace-packages.js'

const deferredSpecs = [
  '@agent-commerce-trust/agent-mcp@0.1.0-rc.0',
  '@agent-commerce-trust/witness@0.1.0-rc.0',
]

for (const spec of deferredSpecs) {
  execFileSync('npm', ['deprecate', spec, expectedDeprecationMessage], {
    stdio: 'inherit',
  })
}
