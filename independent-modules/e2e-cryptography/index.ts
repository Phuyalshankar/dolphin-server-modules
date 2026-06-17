const getSubtleCrypto = (): SubtleCrypto => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
    return (globalThis as any).crypto.subtle;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { webcrypto } = require('node:crypto');
    return webcrypto.subtle;
  } catch {
    throw new Error('Web Crypto API is not supported in this environment.');
  }
};

/**
 * Generate a new secure ECDH (P-256) Key Pair for key exchange.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  const subtle = getSubtleCrypto();
  return subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Export a Public CryptoKey to a portable Base64-encoded string (SPKI format).
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const exported = await subtle.exportKey('spki', key);
  return Buffer.from(exported).toString('base64');
}

/**
 * Export a Private CryptoKey to a portable Base64-encoded string (PKCS#8 format).
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const exported = await subtle.exportKey('pkcs8', key);
  return Buffer.from(exported).toString('base64');
}

/**
 * Import a portable Base64 SPKI public key string back to a CryptoKey.
 */
export async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const binaryDer = Buffer.from(spkiBase64, 'base64');
  return subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  );
}

/**
 * Import a portable Base64 PKCS#8 private key string back to a CryptoKey.
 */
export async function importPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const binaryDer = Buffer.from(pkcs8Base64, 'base64');
  return subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derive a shared symmetric AES-GCM (256-bit) encryption key from
 * a local private key and a remote public key.
 */
export async function deriveSharedKey(
  localPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.deriveKey(
    {
      name: 'ECDH',
      public: remotePublicKey
    },
    localPrivateKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable (can be exported if needed, though usually kept in memory)
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext message using AES-GCM (256-bit) with the derived shared key.
 * Returns the Base64 encoded ciphertext and the random IV used.
 */
export async function encrypt(
  plaintext: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate a cryptographically secure random 12-byte IV (96 bits is recommended for GCM)
  const iv = typeof window !== 'undefined'
    ? window.crypto.getRandomValues(new Uint8Array(12))
    : Buffer.from(require('node:crypto').randomBytes(12));

  const encrypted = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    sharedKey,
    data
  );

  return {
    ciphertext: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };
}

/**
 * Decrypt an AES-GCM encrypted message using the shared key and the IV.
 */
export async function decrypt(
  ciphertextBase64: string,
  ivBase64: string,
  sharedKey: CryptoKey
): Promise<string> {
  const subtle = getSubtleCrypto();
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    sharedKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
