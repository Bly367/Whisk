/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'web-build/',
    '.expo/',
    'coverage/',
    'android/',
    'ios/',
  ],
  overrides: [
    {
      files: ['**/__tests__/**/*.[jt]s?(x)', '**/*.{test,spec}.[jt]s?(x)'],
      env: { jest: true },
    },
  ],
};
