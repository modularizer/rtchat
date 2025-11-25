# UI Abstract Base Classes Guide

## Overview

This document explains the abstract base class architecture for UI components in the `ui/` folder. The goal is to ensure every UI class extends an appropriate abstract base class while maintaining compatibility with `HTMLElement` extension.

## Can You Extend an Abstract Class While Also Extending HTMLElement?

**Yes!** In JavaScript, you can create an abstract base class that extends `HTMLElement`. This allows you to:

1. **Extend HTMLElement** (for Web Components)
2. **Implement interface contracts** (via abstract base classes)
3. **Share common functionality** across components

The pattern is:
```javascript
// Abstract base class extends HTMLElement
class UIComponentBase extends HTMLElement {
  // Common functionality
}

// Concrete class extends the abstract base
class MyComponent extends UIComponentBase {
  // Specific implementation
}
```

## Architecture

### Base Classes Created

1. **`UIComponentBase`** - Base class for all UI components extending HTMLElement
   - Provides shadow DOM setup
   - Configuration management
   - Lifecycle hooks
   - Event handling utilities

2. **`StreamDisplayBase`** - Base class for stream display components
   - Extends `UIComponentBase`
   - Implements `StreamDisplayInterface`
   - Provides stream management utilities

### Current UI Classes and Their Base Classes

| Class | Current Base | Recommended Base | Notes |
|-------|-------------|------------------|-------|
| `ChatBox` | `HTMLElement` | `UIComponentBase` | Main chat component |
| `BasicVideoChat` | `HTMLElement` | `UIComponentBase` | Video chat component |
| `ActiveUsersList` | `HTMLElement` | `UIComponentBase` | User list component |
| `ChatHeader` | `HTMLElement` | `UIComponentBase` | Header component |
| `MessageInput` | `HTMLElement` | `UIComponentBase` | Input component |
| `MessagesComponent` | `HTMLElement` | `UIComponentBase` | Messages display |
| `VideoStreamDisplay` | None | `StreamDisplayBase` | Video streams |
| `AudioStreamDisplay` | None | `StreamDisplayBase` | Audio streams |
| `CallManagement` | None | `UIComponentBase` | Call controls |
| `VideoElement` | `VideoInterface` | Keep as-is | Interface implementation |
| `CallRinger` | `RingerInterface` | Keep as-is | Interface implementation |
| `NotificationSound` | `NotificationInterface` | Keep as-is | Interface implementation |

## Migration Guide

### Step 1: Update Imports

```javascript
// Before
class MyComponent extends HTMLElement {
  // ...
}

// After
import { UIComponentBase } from './base/ui-component-base.js';

class MyComponent extends UIComponentBase {
  // ...
}
```

### Step 2: Update Constructor

```javascript
// Before
constructor(config = {}) {
  super();
  this.config = config;
  this.attachShadow({ mode: 'open' });
  // ...
}

// After
constructor(config = {}) {
  super(config); // Pass config to base class
  // Shadow DOM is already set up by base class
  // ...
}
```

### Step 3: Use Base Class Utilities

```javascript
// Before
this.shadowRoot.querySelector('#my-element');

// After
this.queryRoot('#my-element'); // Works with or without shadow DOM
```

### Step 4: Update Lifecycle Methods

```javascript
// Before
connectedCallback() {
  // initialization
}

// After
connectedCallback() {
  super.connectedCallback(); // Call base class method
  // additional initialization
}
```

## Example: Refactoring ActiveUsersList

### Before

```javascript
class ActiveUsersList extends HTMLElement {
  constructor(config = {}) {
    super();
    
    this.config = {
      userColors: config.userColors || [...],
      ...config
    };
    
    this.attachShadow({ mode: 'open' });
    // ...
  }
  
  connectedCallback() {
    // initialization
  }
}
```

### After

```javascript
import { UIComponentBase } from './base/ui-component-base.js';

class ActiveUsersList extends UIComponentBase {
  constructor(config = {}) {
    super({
      userColors: config.userColors || [...],
      ...config
    });
    
    // Shadow DOM already set up by base class
    // ...
  }
  
  connectedCallback() {
    super.connectedCallback();
    // additional initialization
  }
  
  _initialize() {
    // Initialization logic (called automatically)
    // ...
  }
}
```

## Example: Refactoring VideoStreamDisplay

### Before

```javascript
class VideoStreamDisplay {
  constructor(container, options = {}) {
    this.container = container;
    this.activeStreams = {};
    // ...
  }
  
  setStreams(peerName, { localStream, remoteStream }) {
    // implementation
  }
  
  removeStreams(peerName) {
    // implementation
  }
}
```

### After (Option 1: Keep as Regular Class)

If `VideoStreamDisplay` doesn't need to be a Web Component, you can make it extend `StreamDisplayBase` but not register it as a custom element:

```javascript
import { StreamDisplayBase } from './base/stream-display-base.js';

class VideoStreamDisplay extends StreamDisplayBase {
  constructor(container, options = {}) {
    super(container, options);
    // ...
  }
  
  setStreams(peerName, { localStream, remoteStream }) {
    // implementation using this.activeStreams, this._setupTrackEndHandlers, etc.
  }
  
  removeStreams(peerName) {
    // implementation using this._stopStreamTracks, etc.
  }
}
```

### After (Option 2: Make it a Web Component)

If you want `VideoStreamDisplay` to be a Web Component:

```javascript
import { StreamDisplayBase } from './base/stream-display-base.js';

class VideoStreamDisplay extends StreamDisplayBase {
  constructor(container = null, options = {}) {
    super(container, options);
    // ...
  }
  
  // ... same methods
}

customElements.define('video-stream-display', VideoStreamDisplay);
```

## Benefits

1. **Consistency** - All UI components follow the same patterns
2. **Code Reuse** - Common functionality in base classes
3. **Type Safety** - Abstract methods enforce contracts
4. **Maintainability** - Changes to base classes benefit all components
5. **Testing** - Easier to test with consistent interfaces

## Interface Implementation

Classes that implement interfaces (like `VideoElement`, `CallRinger`, `NotificationSound`) should continue extending the interface classes directly. These are not Web Components, so they don't need `HTMLElement`.

For Web Components that need to implement interfaces, use composition:

```javascript
class MyComponent extends UIComponentBase {
  constructor(config = {}) {
    super(config);
    // Compose with interface implementation
    this.streamDisplay = new StreamDisplayImpl();
  }
  
  // Delegate to composed object
  setStreams(user, streams) {
    return this.streamDisplay.setStreams(user, streams);
  }
}
```

## Next Steps

1. ✅ Create `UIComponentBase` and `StreamDisplayBase`
2. ⏳ Refactor `ActiveUsersList` to extend `UIComponentBase`
3. ⏳ Refactor `ChatHeader` to extend `UIComponentBase`
4. ⏳ Refactor `MessageInput` to extend `UIComponentBase`
5. ⏳ Refactor `MessagesComponent` to extend `UIComponentBase`
6. ⏳ Refactor `VideoStreamDisplay` to extend `StreamDisplayBase`
7. ⏳ Refactor `AudioStreamDisplay` to extend `StreamDisplayBase`
8. ⏳ Refactor `CallManagement` to extend `UIComponentBase` (if it should be a Web Component)
9. ⏳ Refactor `ChatBox` to extend `UIComponentBase`
10. ⏳ Refactor `BasicVideoChat` to extend `UIComponentBase`

## Notes

- Classes that are already interface implementations (`VideoElement`, `CallRinger`, `NotificationSound`) should remain as-is
- The base classes provide default implementations for optional methods
- Abstract methods (throwing errors) must be implemented by subclasses
- All base classes are in `src/ui/base/`

