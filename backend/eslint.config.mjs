import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['dist/**', 'generated/**'] }, js.configs.recommended, ...tseslint.configs.recommended, {
  files: ['tests/*.cjs'],
  languageOptions: { globals: { require: 'readonly', process: 'readonly', URL: 'readonly', fetch: 'readonly', global: 'readonly', Response: 'readonly' } },
  rules: { '@typescript-eslint/no-require-imports': 'off' },
});
