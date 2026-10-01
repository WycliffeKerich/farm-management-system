const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const SPEC_PATH = path.join(__dirname, '../../openapi/openapi.yaml');

const router = express.Router();
const spec = YAML.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

// Swagger UI loads its assets over plain http in development; don't upgrade them
router.use(helmet.contentSecurityPolicy({ directives: { upgradeInsecureRequests: null } }));

/**
 * @route GET /api/v1/docs/openapi.json
 * @desc The OpenAPI spec, for tools that generate clients
 */
router.get('/openapi.json', (req, res) => res.json(spec));

/**
 * @route GET /api/v1/docs
 * @desc Swagger UI over the spec
 */
router.use('/', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Farm Management API' }));

module.exports = router;
