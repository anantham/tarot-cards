// Verify which DID the agent key actually derives to
import * as Signer from '@ucanto/principal/ed25519';

const keyPayload = 'MgCYKF6FJFYXUnicB2mckXh5aS0cP6TPhhfCcvIs8igSYW+0BLWIbz7okywyIatpJXkTIpH4+pcMLS/ucaRgP/Qs0Ogg=';

try {
  const principal = Signer.parse(keyPayload);
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
