// Quick script to check delegation and key DIDs
const delegation = process.env.WEB3_STORAGE_DELEGATION_PROOF;
const agentKey = process.env.WEB3_STORAGE_AGENT_KEY;

// The delegation proof base64 contains visible DIDs
// Let's find all did:key references in it
const decoded = Buffer.from(delegation, 'base64').toString('utf8');
const didMatches = decoded.match(/did:key:z[a-zA-Z0-9]+/g);
console.log('DIDs found in delegation proof:');
console.log([...new Set(didMatches)]);

// Check the key's DID comment in server_identity.key
// From error: server presents as z6MkkyyDBUtx5jc9wMJRSJy99oVrW99o9g1fUTTq6TSyxDaS
// From file comment: z6MkhWRADLSSDS924dBCpMqSc5gixrerSEhqRLCBWfgC7XSf
