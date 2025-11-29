import { base64pad } from 'multiformats/bases/base64'
import { base58btc } from 'multiformats/bases/base58'

const key = process.argv[2]
if (!key) {
  console.error('Usage: node scripts/normalize-agent-key.mjs <agent-key>')
  process.exit(1)
}

const trimmed = key.trim()

// Already multibase
if (/^[zm]/i.test(trimmed)) {
  console.log(trimmed)
  process.exit(0)
}

const payload = trimmed.startsWith('Ed25519PrivateKey:')
  ? trimmed.split(':').pop() || ''
  : trimmed

const tryBase64 = () => {
  let bytes = Buffer.from(payload, 'base64')
  if (bytes.length > 68) bytes = bytes.slice(bytes.length - 68)
  if (bytes.length !== 68) throw new Error(`Expected 68 bytes, got ${bytes.length}`)
  // base64pad encode (includes lowercase m prefix)
  return base64pad.encode(bytes)
}

const tryBase58 = () => {
  const decoded = base58btc.decode(`z${payload}`)
  return `z${base58btc.encode(decoded)}`
}

try {
  const normalized = tryBase64()
  console.log(normalized)
  process.exit(0)
} catch (e) {
  // fall back to base58
}

try {
  const normalized = tryBase58()
  console.log(normalized)
  process.exit(0)
} catch (e) {
  console.error('Failed to normalize key as base64pad or base58btc')
  process.exit(1)
}
