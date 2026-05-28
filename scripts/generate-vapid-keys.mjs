#!/usr/bin/env node
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('# VAPID keypair generated. Add to Vercel env vars (and local .env):');
console.log('');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('');
console.log('# Set VAPID_SUBJECT to your contact mailto: URL, e.g.:');
console.log('# VAPID_SUBJECT=mailto:macarena@roxom.tv');
console.log('');
console.log('# ⚠️  NEVER commit the private key. Store in Vercel env (encrypted) only.');
