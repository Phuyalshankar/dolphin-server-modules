export declare const createDolphinAuthController: (db: any, authConfig: any) => {
    sanitize: (user: any) => any;
    requireAuth: (ctx: any, next?: Function) => Promise<void>;
    require2FA: (ctx: any, next?: Function) => Promise<void>;
    requireAdmin: (ctx: any, next?: Function) => Promise<void>;
    register: (ctx: any) => Promise<{
        success: boolean;
        data: {
            id: any;
            email: any;
            role: any;
        };
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: any;
        data?: undefined;
    }>;
    login: (ctx: any) => Promise<{
        accessToken: string;
        user: {
            id: any;
            email: any;
            role: any;
            twoFactorEnabled: any;
        };
        success: boolean;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: any;
    }>;
    refresh: (ctx: any) => Promise<{
        accessToken: string;
        user: {
            id: any;
            email: any;
            role: any;
            twoFactorEnabled: any;
        };
        success: boolean;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: number;
    }>;
    logout: (ctx: any) => Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    me: (ctx: any) => Promise<{
        success: boolean;
        data: any;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: number;
        data?: undefined;
    }>;
    changePassword: (ctx: any) => Promise<{
        success: boolean;
        message: string;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: number;
        message?: undefined;
    }>;
    forgotPassword: (ctx: any) => Promise<{
        resetLink?: string | undefined;
        success: boolean;
        message: string;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: number;
    }>;
    resetPassword: (ctx: any) => Promise<{
        success: boolean;
        message: string;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: number;
        message?: undefined;
    }>;
    resendResetLink: (ctx: any) => Promise<{
        resetLink?: string | undefined;
        success: boolean;
        message: string;
        error?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        error: any;
        status: number;
    }>;
    enable2FA: (ctx: any) => Promise<{
        secret: string;
        uri: string;
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    verify2FA: (ctx: any) => Promise<{
        recoveryCodes: string[];
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    disable2FA: (ctx: any) => Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
};
export default createDolphinAuthController;
