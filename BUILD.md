# Build System

This document explains how to build standalone bundle files for RTChat.

## Available Bundles

The build system creates the following standalone files in the `bundles/` directory:

### 1. Core Logic Bundle
- **File**: `bundles/rtchat-core.min.js` (minified)
- **File**: `bundles/rtchat-core.js` (development, with sourcemap)
- **Contains**: Core networking, MQTT, WebRTC, configuration, storage adapters, crypto
- **Use case**: When you only need the core logic and will build your own UI
- **Global name**: `RTChatCore`

### 2. UI Bundle
- **File**: `bundles/rtchat-ui.min.js` (minified)
- **File**: `bundles/rtchat-ui.js` (development, with sourcemap)
- **Contains**: UI components (ChatBox, BasicVideoChat) + core logic
- **Use case**: When you want the UI components but will integrate them yourself
- **Global name**: `RTChatUI`

### 3. Full Bundle (Recommended for Quick Start)
- **File**: `bundles/rtchat.min.js` (minified)
- **File**: `bundles/rtchat.js` (development, with sourcemap)
- **Contains**: Everything - core + UI + vanilla adapter (complete chat widget)
- **Use case**: Drop-in chat widget that automatically adds to your page
- **Global name**: `RTChat`

## Building

### Build All Bundles
```bash
npm run build:bundles
```

This creates both minified (`.min.js`) and development (`.js`) versions of all bundles.

### Build Everything (npm + bundles)
```bash
npm run build:all
```

This runs both the npm build (for `dist/`) and the bundle build (for `bundles/`).

## Usage

### Using the Full Bundle (Easiest)

Add this to your HTML:
```html
<script src="https://modularizer.github.io/rtchat/bundles/rtchat.min.js"></script>
<script>
  // The chat widget will automatically appear
  // Or create it manually:
  const chat = new RTChat.RTChat({
    topic: { room: 'myroom' }
  });
</script>
```

### Using Core + UI Separately

```html
<!-- Load core first -->
<script src="https://modularizer.github.io/rtchat/bundles/rtchat-core.min.js"></script>
<!-- Then load UI -->
<script src="https://modularizer.github.io/rtchat/bundles/rtchat-ui.min.js"></script>
<script>
  // Use RTChatCore for core functionality
  const client = new RTChatCore.MQTTRTCClient({
    name: 'MyName',
    topic: { room: 'myroom' }
  });
  
  // Use RTChatUI for UI components
  const chatBox = new RTChatUI.ChatBox();
  document.body.appendChild(chatBox);
</script>
```

## GitHub Actions

Bundles are automatically built and committed to the repository on:
- Push to `master` or `main` branch (when `src/` files change)
- Manual trigger via GitHub Actions UI

**Note**: Bundles are committed to the repo so they can be served via GitHub Pages. The workflow uses `[skip ci]` to prevent infinite build loops.

## Pre-commit Hook (Optional)

To build bundles automatically before committing locally:

```bash
# Install husky (optional)
npm install --save-dev husky

# Create pre-commit hook
echo "npm run build:bundles" > .husky/pre-commit
chmod +x .husky/pre-commit
```

Or use a simple git hook:
```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run build:bundles
git add bundles/
```

## File Structure

```
bundles/
├── rtchat-core.js          # Core (dev)
├── rtchat-core.js.map      # Sourcemap
├── rtchat-core.min.js      # Core (minified)
├── rtchat-ui.js            # UI (dev)
├── rtchat-ui.js.map        # Sourcemap
├── rtchat-ui.min.js        # UI (minified)
├── rtchat.js               # Full (dev)
├── rtchat.js.map           # Sourcemap
└── rtchat.min.js           # Full (minified)
```

## Notes

- All bundles are IIFE (Immediately Invoked Function Expression) format for direct `<script>` tag usage
- Minified versions use terser for compression
- Development versions include sourcemaps for debugging
- The full bundle (`rtchat.min.js`) is the recommended starting point for most users
- **Bundles are committed to the repo** to enable GitHub Pages hosting and direct URL access
