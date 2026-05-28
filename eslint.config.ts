import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            '.next/**',
            '.vercel/**',
            '.wrangler/**',
            '.open-next/**',
            'coverage/**',
            'docs/**',
            'next-env.d.ts',
        ],
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
    tseslint.configs.recommended,
    prettier,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            curly: ['error', 'all'],
            'brace-style': ['error', '1tbs', { allowSingleLine: false }],
            'padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: '*',
                    next: ['if', 'for', 'while', 'do', 'switch', 'try', 'return'],
                },
                {
                    blankLine: 'any',
                    prev: ['if', 'for', 'while', 'do', 'switch', 'try'],
                    next: ['if', 'for', 'while', 'do', 'switch', 'try'],
                },
                { blankLine: 'never', prev: ['case', 'default'], next: '*' },
            ],
        },
    },
]);
