export interface RefreshTokenRecord {
    token: string;
    userId: string;
    expiresAt: Date;
    twoFactorVerified: boolean;
}
export interface DatabaseAdapter {
    createUser(data: any): Promise<any>;
    findUserByEmail(email: string): Promise<any>;
    findUserById(id: string): Promise<any>;
    updateUser(id: string, data: any): Promise<any>;
    saveRefreshToken(data: RefreshTokenRecord): Promise<void>;
    findRefreshToken(token: string): Promise<RefreshTokenRecord | null>;
    deleteRefreshToken(token: string): Promise<void>;
}
export declare function createAuth(config: {
    secret: string;
    redisClient?: any;
    cookieMaxAge?: number;
    issuer?: string;
    rateLimit?: {
        max: number;
        window: number;
    };
    secureCookies?: boolean;
}): {
    register(db: DatabaseAdapter, data: {
        email: string;
        password: string;
    }): Promise<{
        id: any;
        email: any;
        role: any;
    }>;
    login(db: DatabaseAdapter, input: {
        email: string;
        password: string;
        totp?: string;
        recovery?: string;
    }, res?: {
        cookie: (name: string, value: string, options: any) => void;
    }): Promise<{
        accessToken: string;
        user: {
            id: any;
            email: any;
            role: any;
            twoFactorEnabled: any;
        };
    }>;
    enable2FA(db: DatabaseAdapter, userId: string): Promise<{
        secret: string;
        uri: string;
    }>;
    verify2FA(db: DatabaseAdapter, userId: string, totp: string): Promise<{
        recoveryCodes: string[];
    }>;
    refresh(db: DatabaseAdapter, refreshToken: string, res?: {
        cookie: (name: string, value: string, options: any) => void;
    }): Promise<{
        accessToken: string;
        user: {
            id: any;
            email: any;
            role: any;
            twoFactorEnabled: any;
        };
    }>;
    logout(db: DatabaseAdapter, refreshToken: string): Promise<{
        success: boolean;
    }>;
    disable2FA(db: DatabaseAdapter, userId: string, totp: string): Promise<{
        success: boolean;
    }>;
    regenerateRecoveryCodes(db: DatabaseAdapter, userId: string, totp: string): Promise<{
        recoveryCodes: string[];
    }>;
    middleware(opts?: {
        require2FA?: boolean;
    }): (req: any, res: any, next?: Function) => Promise<any>;
    verifyToken: (token: string) => Promise<any>;
};
