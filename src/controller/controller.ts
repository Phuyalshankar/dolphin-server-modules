// packages/core/controller.ts

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

export const createDolphinController = (
  crud: any,
  collection: string,
  options?: {
    softDelete?: boolean;
    bulkOps?: boolean;
  }
): DolphinController => {
  
  const controller: DolphinController = {
    
    async list(req: any, userId?: string) {
      const { page, limit, ...filter } = req.query || {};
      
      if (page !== undefined || limit !== undefined) {
        return await crud.paginate(
          collection,
          filter,
          Number(page) || 1,
          Number(limit) || 100,
          userId
        );
      }
      
      return await crud.read(collection, filter, {}, userId);
    },
    
    async get(req: any, userId?: string) {
      const id = req.params?.id || req.query?.id;
      return await crud.readOne(collection, id, userId);
    },
    
    async create(req: any, userId?: string) {
      const data = req.body || {};
      return await crud.create(collection, data, userId);
    },
    
    async update(req: any, userId?: string) {
      const id = req.params?.id || req.query?.id;
      const data = req.body || {};
      return await crud.updateOne(collection, id, data, userId);
    },
    
    async delete(req: any, userId?: string) {
      const id = req.params?.id || req.query?.id;
      return await crud.deleteOne(collection, id, userId);
    },
  };
  
  if (options?.softDelete) {
    controller.restore = async (req: any, userId?: string) => {
      const id = req.params?.id || req.query?.id;
      return await crud.restore(collection, id, userId);
    };
  }
  
  if (options?.bulkOps) {
    controller.bulkUpdate = async (req: any, userId?: string) => {
      const { filter, data } = req.body || {};
      return await crud.updateMany(collection, filter, data, userId);
    };
    
    controller.bulkDelete = async (req: any, userId?: string) => {
      const { filter } = req.body || {};
      return await crud.deleteMany(collection, filter, userId);
    };
  }
  
  return controller;
};

// ===== PAGES ROUTER HANDLER (req, res) =====
export const createNextPagesHandler = (
  controller: DolphinController,
  options?: { requireAuth?: boolean; require2FA?: boolean }
) => {
  return async (req: any, res: any) => {
    try {
      const { method } = req;
      let result;
      
      const userId = req.user?.id;
      
      switch (method) {
        case 'GET':
          if (req.query?.id) {
            result = await controller.get(req, userId);
          } else {
            result = await controller.list(req, userId);
          }
          break;
          
        case 'POST':
          result = await controller.create(req, userId);
          break;
          
        case 'PUT':
        case 'PATCH':
          result = await controller.update(req, userId);
          break;
          
        case 'DELETE':
          result = await controller.delete(req, userId);
          break;
          
        default:
          return res.status(405).json({ error: 'Method not allowed' });
      }
      
      return res.status(200).json(result);
      
    } catch (error: any) {
      const status = error.status || 500;
      return res.status(status).json({ error: error.message });
    }
  };
};

// ===== APP ROUTER HANDLER (Request, Response) =====
export const createNextAppRoute = (controller: DolphinController) => {
  
  const handler = async (req: Request, context: { params: any }) => {
    try {
      const url = new URL(req.url);
      const method = req.method;
      
      // Query params parse
      const query = Object.fromEntries(url.searchParams.entries());
      
      // JSON body handle — safe parsing
      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      }
      
      // Mock request object for controller
      const mockReq = {
        query,
        params: context.params || {},
        body,
        headers: Object.fromEntries(req.headers.entries()),
      };
      
      // User from header (auth middleware le set gareko)
      const userId = req.headers.get('x-user-id') || undefined;
      
      let result;
      
      switch (method) {
        case 'GET':
          if (context.params?.id || query.id) {
            result = await controller.get(mockReq, userId);
          } else {
            result = await controller.list(mockReq, userId);
          }
          break;
          
        case 'POST':
          result = await controller.create(mockReq, userId);
          break;
          
        case 'PUT':
        case 'PATCH':
          result = await controller.update(mockReq, userId);
          break;
          
        case 'DELETE':
          result = await controller.delete(mockReq, userId);
          break;
          
        default:
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
          );
      }
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      
    } catch (error: any) {
      const status = error.status || 500;
      return new Response(
        JSON.stringify({ error: error.message }),
        { status, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
  
  // Return route handlers for App Router
  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
};

// ===== DYNAMIC ROUTE HANDLER (for [id].ts) =====
export const createNextDynamicHandler = (controller: DolphinController) => {
  return async (req: any, res: any) => {
    try {
      const { method } = req;
      const userId = req.user?.id;
      let result;
      
      switch (method) {
        case 'GET':
          result = await controller.get(req, userId);
          break;
        case 'PUT':
        case 'PATCH':
          result = await controller.update(req, userId);
          break;
        case 'DELETE':
          result = await controller.delete(req, userId);
          break;
        default:
          return res.status(405).json({ error: 'Method not allowed' });
      }
      
      return res.status(200).json(result);
      
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  };
};