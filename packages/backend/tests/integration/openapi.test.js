const fs = require('fs');
const path = require('path');
const request = require('supertest');
const YAML = require('yaml');
const app = require('../../src/app');
const apiRouter = require('../../src/routes');

const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '../../openapi/openapi.yaml'), 'utf8'));

// Every router mounted under /api/v1 is either in the spec or waiting for Phase 10
const DOCUMENTED = {
  '/auth': require('../../src/routes/auth.routes'),
  '/users': require('../../src/routes/user.routes'),
  '/inventory': require('../../src/routes/inventory.routes'),
  '/suppliers': require('../../src/routes/supplier.routes'),
  '/withdrawals': require('../../src/routes/withdrawal.routes'),
  '/activities': require('../../src/routes/activity.routes'),
  '/enterprises': require('../../src/routes/enterprise.routes'),
  '/audit-log': require('../../src/routes/audit-log.routes'),
  '/attachments': require('../../src/routes/attachment.routes'),
  '/settings': require('../../src/routes/settings.routes'),
};
const PENDING = {
  '/crops': require('../../src/routes/crop.routes'),
  '/animals': require('../../src/routes/animal.routes'),
};
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'];

// "GET /users/{id}" for each route a router defines itself, under a prefix
const routesOf = (router, prefix = '') =>
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => {
      const routePath = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
      return Object.keys(layer.route.methods)
        .filter((method) => HTTP_METHODS.includes(method))
        .map((method) => `${method.toUpperCase()} ${routePath || '/'}`);
    });

const specOperations = () =>
  Object.entries(spec.paths).flatMap(([specPath, item]) =>
    HTTP_METHODS.filter((method) => item[method]).map((method) => `${method.toUpperCase()} ${specPath}`)
  );

describe('OpenAPI spec', () => {
  it('knows every router mounted under /api/v1', () => {
    const known = [...Object.values(DOCUMENTED), ...Object.values(PENDING)];
    const mounted = apiRouter.stack.filter((layer) => layer.name === 'router').map((layer) => layer.handle);
    expect(mounted.filter((router) => !known.includes(router))).toEqual([]);
  });

  it('documents every route of the documented routers, and nothing else', () => {
    const implemented = [
      ...routesOf(apiRouter),
      ...Object.entries(DOCUMENTED).flatMap(([prefix, router]) => routesOf(router, prefix)),
    ].sort();
    expect(specOperations().sort()).toEqual(implemented);
  });

  it('gives every operation a unique operationId', () => {
    const ids = Object.values(spec.paths).flatMap((item) =>
      HTTP_METHODS.filter((method) => item[method]).map((method) => item[method].operationId)
    );
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('GET /api/v1/docs', () => {
  it('serves the spec as JSON', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths)).toContain('/activities');
  });

  it('serves Swagger UI without signing in', async () => {
    const res = await request(app).get('/api/v1/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('swagger-ui');
    expect(res.headers['content-security-policy']).not.toMatch(/upgrade-insecure-requests/);
  });
});
