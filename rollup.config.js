import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from '@rollup/plugin-terser';

export default [
  // ============================================================================
  // CORE BUNDLE - Cross-platform compatible (no window dependencies)
  // ============================================================================
  
  // Core ESM build
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/rtchat-core.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: false, // Don't assume browser environment
        preferBuiltins: false
      })
    ],
    external: [] // All dependencies will be bundled
  },
  
  // Core UMD build
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/rtchat-core.umd.js',
      format: 'umd',
      name: 'RTChatCore',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: false,
        preferBuiltins: false
      }),
      terser()
    ]
  },
  
  // Core IIFE build (for script tags, but still cross-platform)
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/rtchat-core.js',
      format: 'iife',
      name: 'RTChatCore',
      sourcemap: true,
      exports: 'named',
      globals: {}
    },
    plugins: [
      nodeResolve({
        browser: false,
        preferBuiltins: false
      }),
      terser()
    ]
  },
  
  // ============================================================================
  // UI BUNDLE - Browser-specific (includes window/DOM dependencies)
  // ============================================================================
  
  // UI ESM build
  {
    input: 'src/ui/index.js',
    output: {
      file: 'dist/rtchat-ui.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true, // Browser environment
        preferBuiltins: false
      })
    ],
    external: [] // All dependencies will be bundled
  },
  
  // UI UMD build
  {
    input: 'src/ui/index.js',
    output: {
      file: 'dist/rtchat-ui.umd.js',
      format: 'umd',
      name: 'RTChatUI',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser()
    ]
  },
  
  // UI IIFE build (for script tags)
  {
    input: 'src/ui/index.js',
    output: {
      file: 'dist/rtchat-ui.js',
      format: 'iife',
      name: 'RTChatUI',
      sourcemap: true,
      exports: 'named',
      globals: {}
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser()
    ]
  },
  
  // ============================================================================
  // FULL BUNDLE - Everything combined (backward compatibility)
  // ============================================================================
  
  // Full ESM build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/rtchat.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      })
    ],
    external: [] // All dependencies will be bundled
  },
  
  // Full UMD build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/rtchat.umd.js',
      format: 'umd',
      name: 'RTChat',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser()
    ]
  },
  
  // Full IIFE build (backward compatibility - vanilla adapter)
  {
    input: 'src/adapters/vanilla/rtchat.js',
    output: {
      file: 'dist/rtchat.iife.js',
      format: 'iife',
      name: 'RTChat',
      sourcemap: true,
      exports: 'named',
      globals: {}
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser()
    ]
  }
];

