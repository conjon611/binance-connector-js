import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.commonjs,
            },
        },
        rules: {
            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowShortCircuit: true,
                    allowTernary: true,
                },
            ],
            // Formatting is owned by Prettier; ESLint rules that duplicate it
            // (`quotes`, `indent`) contradicted the Prettier config and are
            // deliberately not enabled here.
            semi: ['error', 'always'],
        },
    },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
    {
        ignores: ['node_modules/', 'dist/'],
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
];
