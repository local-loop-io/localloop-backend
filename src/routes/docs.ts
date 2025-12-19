import type { FastifyInstance } from 'fastify';

export async function registerDocsRoutes(app: FastifyInstance) {
  app.get('/openapi.json', async (request, reply) => {
    const doc = app.swagger();
    reply.send(doc);
  });

  app.get('/docs', async (request, reply) => {
    reply.type('text/html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>LocalLoop API Docs</title>
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
  });
}
