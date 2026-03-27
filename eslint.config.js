import js from '@eslint/js';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';
import svelte from 'eslint-plugin-svelte';

export default [
    js.configs.recommended,
    ...svelte.configs.recommended,
    {
        ignores: ['build/**', '.svelte-kit/**', 'node_modules/**']
    },
    {
        plugins: {
            'unused-imports': unusedImports
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        rules: {
            "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
            "unused-imports/no-unused-imports": "error",
            "no-empty": "off",
            "svelte/require-each-key": "off",
            "svelte/no-navigation-without-resolve": "off"
        }
    }
];