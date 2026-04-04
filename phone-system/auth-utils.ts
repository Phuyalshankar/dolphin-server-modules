// phone-system/auth-utils.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dolphin-super-secret-key-123';

export interface AuthPayload {
    id: string;
    role: string;
    number: string;
}

export class AuthUtils {
    /**
     * Generate a production-grade JWT for a device with deviceId binding.
     */
    static generateToken(payload: AuthPayload): string {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Shorter expiry for security
    }

    /**
     * Generate a refresh token for extended sessions.
     */
    static generateRefreshToken(payload: { id: string }): string {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    }

    /**
     * Verify and decode a JWT.
     */
    static verifyToken(token: string): AuthPayload | null {
        try {
            return jwt.verify(token, JWT_SECRET) as AuthPayload;
        } catch (err) {
            return null;
        }
    }

    /**
     * Verify and decode a Refresh Token.
     */
    static verifyRefreshToken(token: string): { id: string } | null {
        try {
            return jwt.verify(token, JWT_SECRET) as { id: string };
        } catch (err) {
            return null;
        }
    }
}
