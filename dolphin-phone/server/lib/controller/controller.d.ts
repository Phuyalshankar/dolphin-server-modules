export interface DolphinController<T = any> {
    list(req: any, userId?: string): Promise<any>;
    get(req: any, userId?: string): Promise<T | null>;
    create(req: any, userId?: string): Promise<T>;
    update(req: any, userId?: string): Promise<T | null>;
    delete(req: any, userId?: string): Promise<T | null>;
    restore?(req: any, userId?: string): Promise<T | null>;
    bulkUpdate?(req: any, userId?: string): Promise<number>;
    bulkDelete?(req: any, userId?: string): Promise<number>;
}
export declare const createDolphinController: (crud: any, collection: string, options?: {
    softDelete?: boolean;
    bulkOps?: boolean;
}) => DolphinController;
export declare const createNextPagesHandler: (controller: DolphinController, options?: {
    requireAuth?: boolean;
    require2FA?: boolean;
}) => (req: any, res: any) => Promise<any>;
export declare const createNextAppRoute: (controller: DolphinController) => {
    GET: (req: Request, context: {
        params: any;
    }) => Promise<Response>;
    POST: (req: Request, context: {
        params: any;
    }) => Promise<Response>;
    PUT: (req: Request, context: {
        params: any;
    }) => Promise<Response>;
    PATCH: (req: Request, context: {
        params: any;
    }) => Promise<Response>;
    DELETE: (req: Request, context: {
        params: any;
    }) => Promise<Response>;
};
export declare const createNextDynamicHandler: (controller: DolphinController) => (req: any, res: any) => Promise<any>;
