import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encrypt,
  decrypt
} from './index';

async function runDemo() {
  console.log('--- 🐬 E2E Cryptography Demo (Nepal Government Messaging Project) ---');

  // 1. Generate keys for Ram
  console.log('\n[1] Generating keypair for Ram...');
  const ramKeyPair = await generateKeyPair();
  const ramPublicStr = await exportPublicKey(ramKeyPair.publicKey);
  console.log(`Ram Public Key (SPKI Base64): ${ramPublicStr.slice(0, 50)}...`);

  // 2. Generate keys for Sita
  console.log('\n[2] Generating keypair for Sita...');
  const sitaKeyPair = await generateKeyPair();
  const sitaPublicStr = await exportPublicKey(sitaKeyPair.publicKey);
  console.log(`Sita Public Key (SPKI Base64): ${sitaPublicStr.slice(0, 50)}...`);

  // --- Network Exchange Simulation ---
  console.log('\n--- Simulating Network Exchange (Sending Public Keys) ---');

  // 3. Ram imports Sita's public key and derives shared key
  const ramImportedSitaPublic = await importPublicKey(sitaPublicStr);
  const ramSharedKey = await deriveSharedKey(ramKeyPair.privateKey, ramImportedSitaPublic);
  console.log('Ram derived the shared key successfully.');

  // 4. Sita imports Ram's public key and derives shared key
  const sitaImportedRamPublic = await importPublicKey(ramPublicStr);
  const sitaSharedKey = await deriveSharedKey(sitaKeyPair.privateKey, sitaImportedRamPublic);
  console.log('Sita derived the shared key successfully.');

  // --- E2EE Messaging Simulation ---
  console.log('\n--- Messaging: Ram -> Sita ---');
  const ramMessage = 'नमस्ते सीता! यो हाम्रो पहिलो गोप्य सरकारी म्यासेज हो। 🇳🇵';
  console.log(`Ram Plaintext: "${ramMessage}"`);

  // Ram encrypts
  const encryptedPayload = await encrypt(ramMessage, ramSharedKey);
  console.log('Encrypted Payload:', encryptedPayload);

  // Sita decrypts
  console.log('\nSita receives ciphertext and IV, decrypting...');
  const sitaDecrypted = await decrypt(encryptedPayload.ciphertext, encryptedPayload.iv, sitaSharedKey);
  console.log(`Sita Plaintext Output: "${sitaDecrypted}"`);

  if (sitaDecrypted === ramMessage) {
    console.log('\n🎉 SUCCESS: Decrypted message matches Ram\'s original plaintext!');
  } else {
    console.error('\n❌ ERROR: Plaintext mismatch!');
  }
}

runDemo().catch(console.error);
