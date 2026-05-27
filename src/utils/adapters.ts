/**
 * HTTP Adapters for Express and Fastify
 * Maps native requests/responses to Dolphin's standard ctx structure.
 */

/**
 * Express Adapter
 * Maps (req, res, next) to Dolphin's standard ctx structure.
 */
export function toExpress(handler: Function) {
  return async (req: any, res: any, next: any) => {
    let pendingStatus = 200;

    const ctx: any = {
      req,
      res,
      params: req.params || {},
      query: req.query || {},
      body: req.body || {},
      state: res.locals || {},

      json: (data: any, status?: number) => {
        const finalStatus = status !== undefined ? status : pendingStatus;
        res.status(finalStatus).json(data);
        return ctx;
      },

      text: (data: any, status?: number) => {
        const finalStatus = status !== undefined ? status : pendingStatus;
        res.status(finalStatus).send(String(data));
        return ctx;
      },

      html: (data: any, status?: number) => {
        const finalStatus = status !== undefined ? status : pendingStatus;
        res.status(finalStatus).send(String(data));
        return ctx;
      },

      status: (code: number) => {
        pendingStatus = code;
        return ctx;
      },

      setHeader: (name: string, value: string) => {
        res.setHeader(name, value);
        return ctx;
      },

      getHeader: (name: string) => {
        return req.headers[name.toLowerCase()];
      }
    };

    try {
      // If the handler is a middleware and takes next
      if (handler.length >= 2) {
        await handler(ctx, next);
      } else {
        const result = await handler(ctx);
        // If the handler returned a response directly instead of calling ctx.json()
        if (result !== undefined && result !== null && !res.headersSent) {
          ctx.json(result);
        }
      }
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Fastify Adapter
 * Maps (request, reply) to Dolphin's standard ctx structure.
 */
export function toFastify(handler: Function) {
  return async (request: any, reply: any) => {
    let pendingStatus = 200;

    const ctx: any = {
      req: request.raw,
      res: reply.raw,
      params: request.params || {},
      query: request.query || {},
      body: request.body || {},
      state: request.state || {},

      json: (data: any, status?: number) => {
        const finalStatus = status !== undefined ? status : pendingStatus;
        reply.status(finalStatus).send(data);
        return ctx;
      },

      text: (data: any, status?: number) => {
        const finalStatus = status !== undefined ? status : pendingStatus;
        reply.status(finalStatus).type('text/plain').send(String(data));
        return ctx;
      },

      html: (data: any, status?: number) => {
        const finalStatus = status !== undefined ? status : pendingStatus;
        reply.status(finalStatus).type('text/html').send(String(data));
        return ctx;
      },

      status: (code: number) => {
        pendingStatus = code;
        return ctx;
      },

      setHeader: (name: string, value: string) => {
        reply.header(name, value);
        return ctx;
      },

      getHeader: (name: string) => {
        return request.headers[name.toLowerCase()];
      }
    };

    try {
      const result = await handler(ctx);
      if (result !== undefined && result !== null && !reply.sent) {
        ctx.json(result);
      }
    } catch (err) {
      reply.send(err);
    }
  };
}
