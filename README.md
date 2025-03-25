# Dev Screen Logger

A customizable React component that displays console logs directly on the screen, perfect for development and debugging. This component provides a floating window that can be positioned anywhere on the screen and includes features like throttling, pausing, and searching logs.

## Features

- 🖥️ Floating console window with customizable position and size
- ⌨️ Keyboard shortcuts for quick access to all features
- 🔍 Real-time log searching
- ⚡ Throttling controls to manage log frequency
- ⏸️ Pause/Resume functionality
- 📋 Copy logs to clipboard
- 🎨 Customizable styling (colors, size, position)
- 🌙 Dark mode compatible
- 📱 Responsive design

## Requirements

- React 18+ and TypeScript 5.0+
- Tailwind CSS 3.0+ (optional, can be removed with minimal changes)
- Works with any modern React framework (Next.js, Remix, Vite, etc.)

## Installation

```bash
npm install dev-screen-logger
# or
yarn add dev-screen-logger
```

## Usage

```tsx
import { ScreenLogger } from 'dev-screen-logger';

function App() {
  return (
    <div>
      <ScreenLogger />
      {/* Your app content */}
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | string | "oklch(0.967 0.001 286.375)" | Text color for logs |
| `fontSize` | string | "1em" | Font size for logs |
| `bgColor` | string | "rgb(26, 26, 26)" | Background color |
| `position` | "top" \| "bottom" | "bottom" | Default position |
| `width` | string | "50%" | Width of the logger window |
| `height` | string | "100vh" | Height of the logger window |
| `buttonPosition` | "top-left" \| "top-right" \| "bottom-left" \| "bottom-right" | "bottom-right" | Position of control buttons |
| `opacity` | number | 0.9 | Window opacity |
| `shortcutKey` | string | "k" | Key for toggling visibility (used with Ctrl/Cmd) |
| `showButton` | boolean | true | Show/hide control buttons |
| `initiallyVisible` | boolean | true | Initial visibility state |
| `enableTesting` | boolean | true | Enable test signal generation |
| `initialPosition` | "top" \| "bottom" \| "left" \| "right" \| "center" \| "top-left" \| "top-right" \| "bottom-left" \| "bottom-right" | "bottom" | Initial position |
| `listenToKeystrokes` | boolean | true | Enable/disable keyboard shortcuts |

## Keyboard Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Ctrl/Cmd + K` | Toggle visibility |
| `Ctrl/Cmd + T` | Toggle throttling |
| `Ctrl/Cmd + X` | Clear logs |
| `Ctrl/Cmd + Shift + C` | Copy logs to clipboard |
| `Ctrl/Cmd + F` | Focus search input |
| `Ctrl/Cmd + P` | Pause/Resume logging |
| `Ctrl/Cmd + [u,i,o,j,l,m,,0]` | Change panel position |

## Position Shortcuts

| Key | Position |
|-----|----------|
| `u` | Top-left |
| `i` | Top |
| `o` | Top-right |
| `j` | Left |
| `l` | Right |
| `m` | Bottom-left |
| `,` | Bottom |
| `0` | Center |

## Throttling States

The throttling feature cycles through the following states:

1. Off (normal logging)
2. 250ms delay
3. 500ms delay
4. 1000ms delay
5. Paused

## Example

```tsx
import { ScreenLogger } from 'dev-screen-logger';

function App() {
  return (
    <div>
      <ScreenLogger
        color="#ffffff"
        bgColor="rgba(0, 0, 0, 0.8)"
        position="bottom"
        width="60%"
        height="40vh"
        buttonPosition="bottom-right"
        opacity={0.9}
        shortcutKey="k"
        showButton={true}
        initiallyVisible={true}
        enableTesting={true}
        initialPosition="bottom"
        listenToKeystrokes={true}
      />
      
      {/* Your app content */}
      <button onClick={() => console.log('Test log message')}>
        Log Something
      </button>
    </div>
  );
}
```

## License

MIT
