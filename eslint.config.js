const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

/**
 * Expo SDK 53+ flat config (ESLint 9 + eslint-config-expo/flat).
 * Requires: eslint ^9, eslint-config-expo (match Expo SDK, e.g. ~57),
 * eslint-config-prettier ^10.
 */
module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    'web-build/*',
    '.expo/*',
    'coverage/*',
    'android/*',
    'ios/*',
    'node_modules/*',
  ]),
  expoConfig,
  eslintConfigPrettier,
  {
    files: ['**/__tests__/**/*.[jt]s?(x)', '**/*.{test,spec}.[jt]s?(x)'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    // Feature hydrate/load-from-SQLite patterns legitimately set state in effects.
    // Keep as follow-up to migrate toward derived state / external stores.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
