// test-2fa-real.ts
import { createAuth } from "./auth/auth";
import crypto from "node:crypto";
import argon2 from "argon2";

// Helper to simulate a TOTP app (reusing logic from auth.ts)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32Decode = (str: string): Buffer => {
  str = str.replace(/=/g, '').toUpperCase();
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const idx = BASE32_CHARS.indexOf(str[i]);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const generateTOTP = (secretBase32: string, timestamp: number = Date.now()): string => {
  const counter = Math.floor(timestamp / 30000);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter), 0);
  const secret = base32Decode(secretBase32);
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(counterBuf);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code = (hash.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6, '0');
};

async function run2FATest() {
  console.log("🔐 Starting 'Real' 2FA Flow Test...\n");

  const auth = createAuth({ secret: 'test-secret' });
  
  // 1. Mock DB state
  let mockUser: any = {
    id: "user123",
    email: "test@example.com",
    password: await argon2.hash("password123"),
    twoFactorEnabled: false,
    twoFactorSecret: null,
    pending2FASecret: null,
    recoveryCodes: []
  };

  const db: any = {
    findUserById: async () => mockUser,
    findUserByEmail: async () => mockUser,
    updateUser: async (id: string, data: any) => {
       mockUser = { ...mockUser, ...data };
       return mockUser;
    },
    saveRefreshToken: async () => {},
    findRefreshToken: async () => null,
    deleteRefreshToken: async () => {}
  };

  // --- STEP 1: Enable 2FA ---
  console.log("Step 1: Enabling 2FA (Generating Secret)...");
  const setup = await auth.enable2FA(db, mockUser.id);
  console.log("✅ Secret Generated:", setup.secret);
  console.log("✅ URI:", setup.uri);

  // --- STEP 2: Verify 2FA ---
  console.log("\nStep 2: Verifying 2FA with TOTP Token...");
  const realToken = generateTOTP(setup.secret);
  console.log("📱 Simulated App Token:", realToken);
  
  const verifyResult = await auth.verify2FA(db, mockUser.id, realToken);
  console.log("✅ 2FA Verified! Recovery Codes:", verifyResult.recoveryCodes);
  console.log("✅ User 2FA Status:", mockUser.twoFactorEnabled ? "ENABLED" : "FAILED");

  // --- STEP 3: Login without TOTP (Should fail) ---
  console.log("\nStep 3: Attempting Login WITHOUT TOTP...");
  try {
    await auth.login(db, { email: mockUser.email, password: "password123" });
    console.log("❌ FAILED: Login succeeded without TOTP!");
  } catch (err: any) {
    console.log("✅ SUCCESS: Login denied as expected:", err.message);
  }

  // --- STEP 4: Login with correct TOTP ---
  console.log("\nStep 4: Attempting Login WITH correct TOTP...");
  const loginToken = generateTOTP(setup.secret);
  const loginResult = await auth.login(db, { email: mockUser.email, password: "password123", totp: loginToken });
  console.log("✅ SUCCESS: Logged in! Access Token length:", loginResult.accessToken.length);

  // --- STEP 5: Test Recovery Codes ---
  console.log("\nStep 5: Testing Recovery Code Login...");
  const backupCode = verifyResult.recoveryCodes[0];
  const recoveryResult = await auth.login(db, { 
    email: mockUser.email, 
    password: "password123", 
    recovery: backupCode 
  });
  console.log("✅ SUCCESS: Logged in using recovery code!");
  console.log("✅ Remaining recovery codes count:", mockUser.recoveryCodes.length);

  // --- STEP 6: Disable 2FA ---
  console.log("\nStep 6: Disabling 2FA...");
  const disableToken = generateTOTP(setup.secret);
  await auth.disable2FA(db, mockUser.id, disableToken);
  console.log("✅ SUCCESS: 2FA Disabled. Status:", mockUser.twoFactorEnabled ? "ENABLED (Error)" : "DISABLED");

  console.log("\n🎊 ALL 2FA FLOWS COMPLETED SUCCESSFULLY! 🎊");
}

run2FATest().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
