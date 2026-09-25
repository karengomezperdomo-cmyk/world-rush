import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Math functions whose exact results are NOT fixed by the ECMAScript spec and differ between engines
 * (V8/SpiderMonkey use fdlibm ports, JavaScriptCore uses the system libm). The deterministic core must
 * never call them: the server re-simulates runs and has to obtain bit-identical results.
 * (+, -, *, / and Math.sqrt are IEEE-754 exact and stay allowed.)
 */
const NON_DETERMINISTIC_MATH = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'hypot',
  'cbrt',
  'random',
];

const DETERMINISM_MESSAGE =
  'game-core must be deterministic across JS engines (see docs/phase-0/02-architecture-proposal.md §5)';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.data/**',
    '**/migrations/**',
    // Emscripten output copied out of node_modules by scripts/copy-box2d.mjs — vendor code, not ours.
    'apps/web/public/box2d/**',
    '**/next-env.d.ts',
    'docs/**',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-alert': 'error', // alert() is not supported by the iOS World App WebView
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // --- Design mocks: icons.js runs inside the page, and the screenshot tools pass callbacks to page.evaluate ---
  {
    files: ['design/**/*.js', 'tools/design/**/*.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // --- Mini App shell (Next.js) ---
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Only meaningful for the legacy Pages Router; this app uses the App Router (no pages/ directory).
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // --- game-core: pure, deterministic, dependency-free ---
  {
    files: ['packages/game-core/src/**/*.ts'],
    ignores: ['packages/game-core/src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...NON_DETERMINISTIC_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Math.${property} is not guaranteed to give identical results on every JS engine. ${DETERMINISM_MESSAGE}`,
        })),
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'performance',
          'window',
          'document',
          'navigator',
          'process',
          'fetch',
          'localStorage',
          'sessionStorage',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
        ].map((name) => ({
          name,
          message: `${name} is not allowed here: simulation time comes from ticks, never from the host. ${DETERMINISM_MESSAGE}`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: `The ** operator maps to Math.pow, which is engine-approximated. ${DETERMINISM_MESSAGE}`,
        },
        {
          selector: "AssignmentExpression[operator='**=']",
          message: `The **= operator maps to Math.pow, which is engine-approximated. ${DETERMINISM_MESSAGE}`,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'next', 'next/*', '@worldrush/*', 'node:*'],
              message: 'game-core must stay pure: no framework, server, DB or Node imports.',
            },
          ],
        },
      ],
    },
  },
]);
