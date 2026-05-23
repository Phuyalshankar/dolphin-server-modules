export const authGuard = (ctx) => {
  const token = ctx.headers['authorization'];
  if (!token) {
    ctx.status(401);
    return { success: false, message: 'Unauthorized' };
  }
  // In a real scenario, dolphin-server-modules handles session/token decoding,
  // here we ensure the context has user data populated by the server
  if (!ctx.user) {
    ctx.status(401);
    return { success: false, message: 'Invalid Session' };
  }
  return true;
};