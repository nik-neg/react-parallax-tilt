/** @type {import('@types/eslint').Linter.BaseConfig} */
const eslintConfig = {
  parser: '@typescript-eslint/parser',

  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react/recommended',
    'plugin:no-array-reduce/recommended',
    'plugin:testing-library/react',
    'plugin:jest-dom/recommended',
  ],

  plugins: ['@typescript-eslint', 'testing-library', 'jest-dom', 'jest', 'import'],

  rules: {
    'react/prop-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],

    // Import
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
  },

  overrides: [
    {
      files: ['stories/**/*'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],

  // ESlint default behaviour ignoring file/folders starting with "." - https://github.com/eslint/eslint/issues/10341
  // Lint ".storybook" folder
  ignorePatterns: ['!.*', 'dist', 'node_modules', 'd'],

  settings: {
    react: {
      version: 'detect',
    },
  },
};

module.exports = eslintConfig;
