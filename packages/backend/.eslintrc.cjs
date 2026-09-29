/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$', caughtErrors: 'none', ignoreRestSiblings: true }],
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'error',
  },
  overrides: [
    {
      // Services and repositories must throw typed errors so the API returns the right status
      files: ['src/services/**/*.js', 'src/repositories/**/*.js'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "ThrowStatement > NewExpression[callee.name='Error']",
            message: 'Throw a typed error from utils/errors (NotFoundError, ValidationError, ConflictError, ...).',
          },
        ],
      },
    },
    {
      files: ['tests/**/*.js'],
      env: { jest: true },
    },
  ],
};
