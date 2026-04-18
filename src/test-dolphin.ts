// test-dolphin.ts
import { createDolphinServer } from "./server/server";
import { createDolphinController } from "./controller/controller";
import { createDolphinAuthController } from "./authController/authController";

// Mock Database Connection (Replacing ./config.js)
const dbConnect = async () => {
  console.log("🛠️ Mock Database Connected");
};

// Mock Database Interface (Replacing ./auth/model.js)
const db: any = {
  createUser: async (data: any) => ({ id: "123", ...data }),
  findUserByEmail: async (email: string) => ({ id: "123", email, password: "hashed_password", role: "admin" }),
  findUserById: async (id: string) => ({ id, email: "user@example.com", role: "admin" }),
  updateUser: async (id: string, data: any) => ({ id, ...data }),
  saveRefreshToken: async () => {},
  findRefreshToken: async () => ({ userId: "123", expiresAt: new Date(Date.now() + 10000) }),
  deleteRefreshToken: async () => {},
  // For CRUD
  read: async () => [{ id: "123", name: "John Doe" }],
  create: async (data: any) => ({ id: "456", ...data }),
  update: async (id: string, data: any) => ({ id, ...data }),
  delete: async (id: string) => ({ id })
};

async function main() {
  const app = createDolphinServer();
  await dbConnect();

  // ============ SETUP AUTH ============
  const auth = createDolphinAuthController(db, {
    secret: process.env.JWT_SECRET || 'my-super-secret-key',
    cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    issuer: 'MyApp'
  });

  // ============ CRUD CONTROLLER ============
  const userController = createDolphinController(db, "User");

  // ============ PUBLIC ROUTES (No Auth) ============
  app.post("/auth/register", async (ctx) => {
    const result = await auth.register(ctx);
    return result; // Using the new auto-reply feature!
  });

  app.post("/auth/login", async (ctx) => {
    return await auth.login(ctx);
  });

  app.post("/auth/refresh", async (ctx) => {
    return await auth.refresh(ctx);
  });

  // ============ PROTECTED ROUTES (Auth Required) ============
  // ✅ NOW SUPPORTED: Multiple handlers (middleware + final handler)
  app.get("/auth/me", auth.requireAuth, async (ctx) => {
    const result = await auth.me(ctx);
    return result;
  });

  app.post("/auth/logout", auth.requireAuth, async (ctx) => {
    return await auth.logout(ctx);
  });

  // ============ PROTECTED CRUD ROUTES (Auth Required) ============
  app.get("/user", auth.requireAuth, async (ctx: any) => {
    const users = await userController.list(ctx, ctx.req.user?.id);
    return users.map((user: any) => auth.sanitize(user));
  });

  app.post("/user", auth.requireAuth, async (ctx: any) => {
    const user = await userController.create(ctx, ctx.req.user?.id);
    return auth.sanitize(user);
  });

  // ============ ADMIN ROUTES ============
  app.get("/admin/users", auth.requireAdmin, async (ctx: any) => {
    const users = await userController.list(ctx);
    return users.map(auth.sanitize);
  });

  // ============ START SERVER ============
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`
  🚀 Dolphin Server running on port ${PORT}
  
  📋 Available Routes:
  
  🔓 PUBLIC ROUTES:
  ┌─────────────────────────────────────────────┐
  │ POST   /auth/register                       │
  │ POST   /auth/login                          │
  │ POST   /auth/refresh                        │
  ├─────────────────────────────────────────────┤
  │ 🔒 PROTECTED ROUTES (Auth Required):        │
  │ GET    /auth/me                             │
  │ POST   /auth/logout                         │
  ├─────────────────────────────────────────────┤
  │ 👤 USER CRUD (Protected):                   │
  │ GET    /user                                │
  │ POST   /user                                │
  ├─────────────────────────────────────────────┤
  │ 👑 ADMIN ROUTES:                            │
  │ GET    /admin/users                         │
  └─────────────────────────────────────────────┘
    `);
  });
}

main().catch(console.error);
