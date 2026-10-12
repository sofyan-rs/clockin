// Shared flat config for TypeScript workspaces (CODE_STRUCTURE §6).
// The admin app layers these rules on top of @nuxt/eslint instead of using `base` directly.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

/** Rules shared by every TS workspace, independent of parser setup. */
export const sharedRules = {
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
  'import-x/no-duplicates': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
};

export const importPlugin = importX;

/** Full config for plain TypeScript / NestJS workspaces. */
export const base = tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: { 'import-x': importX },
    rules: {
      ...sharedRules,
      // Nest modules are empty classes carrying a @Module() decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  prettier,
);

export default base;
