import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

/**
 * Build configuration for standalone bundle files
 * Creates single-file bundles that can be used directly via script tags
 */

export default [
  // ============================================================================
  // 1. CORE LOGIC BUNDLE (minified)
  // ============================================================================
  {
    input: 'src/core/index.js',
    output: {
      file: 'bundles/rtchat-core.min.js',
      format: 'iife',
      name: 'RTChatCore',
      sourcemap: false,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: false,
        preferBuiltins: false
      }),
      terser({
        compress: {
          drop_console: false, // Keep console logs for debugging
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },

  // ============================================================================
  // 2. UI BUNDLE (minified)
  // ============================================================================
  {
    input: 'src/ui/index.js',
    output: {
      file: 'bundles/rtchat-ui.min.js',
      format: 'iife',
      name: 'RTChatUI',
      sourcemap: false,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },

  // ============================================================================
  // 2b. UI BUNDLE - ESM format (minified)
  // ============================================================================
  {
    input: 'src/ui/index.js',
    output: {
      file: 'bundles/rtchat-ui.esm.min.js',
      format: 'esm',
      sourcemap: false
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },

  // ============================================================================
  // 1b. CORE LOGIC BUNDLE - ESM format (minified)
  // ============================================================================
  {
    input: 'src/core/index.js',
    output: {
      file: 'bundles/rtchat-core.esm.min.js',
      format: 'esm',
      sourcemap: false
    },
    plugins: [
      nodeResolve({
        browser: false,
        preferBuiltins: false
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },

  // ============================================================================
  // 3. FULL BUNDLE - Everything combined (vanilla adapter, minified)
  // ============================================================================
  {
    input: 'src/adapters/vanilla/rtchat.js',
    output: {
      file: 'bundles/rtchat.min.js',
      format: 'iife',
      name: 'RTChat',
      sourcemap: false,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },

  // ============================================================================
  // 3b. FULL BUNDLE - ESM format (minified)
  // ============================================================================
  {
    input: 'src/index.js',
    output: {
      file: 'bundles/rtchat.esm.min.js',
      format: 'esm',
      sourcemap: false
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },

  // ============================================================================
  // 4. DEVELOPMENT VERSIONS (unminified, with sourcemaps)
  // ============================================================================
  
  // Core (unminified)
  {
    input: 'src/core/index.js',
    output: {
      file: 'bundles/rtchat-core.js',
      format: 'iife',
      name: 'RTChatCore',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: false,
        preferBuiltins: false
      })
    ]
  },

  // UI (unminified)
  {
    input: 'src/ui/index.js',
    output: {
      file: 'bundles/rtchat-ui.js',
      format: 'iife',
      name: 'RTChatUI',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      })
    ]
  },

  // Full (unminified)
  {
    input: 'src/adapters/vanilla/rtchat.js',
    output: {
      file: 'bundles/rtchat.js',
      format: 'iife',
      name: 'RTChat',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      })
    ]
  },

  // Full ESM (unminified)
  {
    input: 'src/index.js',
    output: {
      file: 'bundles/rtchat.esm.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      })
    ]
  }
];

