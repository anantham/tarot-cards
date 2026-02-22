// Verify which DID the agent key actually derives to
import * as Signer from '@ucanto/principal/ed25519';

const rawInput = process.argv[2] || process.env.WEB3_STORAGE_AGENT_KEY || '';
if (!rawInput) {
  console.error('Provide key via argv or WEB3_STORAGE_AGENT_KEY env var');
  process.exit(1);
}

const keyPayload = rawInput.startsWith('Ed25519PrivateKey:')
  ? rawInput.split(':').pop()
  : rawInput;

try {
  const principal = Signer.parse(String(keyPayload));
  console.log('Key derives to DID:', principal.did());
  console.log('');
  console.log('Expected (from server_identity.key comment):');
  console.log('  did:key:z6MkhWRADLSSDS924dBCpMqSc5gixrerSEhqRLCBWfgC7XSf');
  console.log('');
  console.log('Expected (from delegation proof):');
  console.log('  did:key:z6MkkyyDBUtx5jc9wMJRSJy99oVrW99o9g1fUTTq6TSyxDaS');
} catch (err) {
  console.error('Parse error:', err.message);
}
