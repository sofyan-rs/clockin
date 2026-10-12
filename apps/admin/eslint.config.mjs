import { importPlugin, sharedRules } from '@clockin/eslint-config';

import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  plugins: { 'import-x': importPlugin },
  rules: sharedRules,
});
