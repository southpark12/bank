# AGENTS.md - Developer & AI Agent Guide for Ozon Finance SPA

Welcome to the **Ozon Finance SPA Replica** project! This repository contains a high-fidelity, mobile-responsive Single Page Application (SPA) mimicking the Ozon Finance banking app interface.

---

## 1. Project Overview & Purpose

This application is built for educational and demonstration purposes. It replicates the UI/UX design of Ozon Finance's mobile web portal with interactive mock data, smooth tab navigation, light/dark theme toggles, and payment simulation workflows.

Key Goals:
- **High Visual Fidelity**: Strict visual alignment with production Ozon Finance UI screenshots (`screenshots/`).
- **Natural Responsive Web Layout**: Clean web application layout centered at `max-width: 440px` on desktop viewports and 100% fluid on mobile screens. No phone mockups or frame borders.
- **Zero Framework Overhead**: Built using standard HTML5, Vanilla CSS3 with CSS variables, and pure client-side JavaScript (`app.js`).

---

## 2. File Structure

```
/home/aiuser/bank/
├── index.html            # Main HTML entry point containing shell container (#app) & bottom tab bar
├── data.js               # Initial data configuration: account balances & payment history definitions
├── app.js                # Core JS logic: state management, SPA router, dynamic view renderers, mock APIs
├── style.css             # Custom application layout, theme CSS variables, and component overrides
├── assets/               # Production icons, avatar assets (avatar_dark.png, avatar_light.png), and CSS bundles
├── screenshots/          # High-priority visual design reference screenshots (Home, Chat, Payments, etc.)
├── ozonfinance/          # Original production HTML export (Dark mode reference code)
├── ozonfinancelight/     # Original production HTML export (Light mode reference code)
└── AGENTS.md             # This guide for future developer/agent sessions
```

---

## 3. Architecture & Technical Design

### A. View Rendering Engine (`app.js`)
The application uses a lightweight state-driven rendering loop.
- **Global State (`appState`)**:
  - `activeTab`: Currently selected view (`'home'`, `'history'`, `'payments'`, `'chat'`, `'services'`).
  - `theme`: `'dark'` or `'light'`. System default is auto-detected via `prefers-color-scheme` or read from `localStorage.getItem('theme-preference')`.
  - `balanceBusiness`, `balancePersonal`: Reactive monetary account balances updated during transaction flows.
  - `transactions`: Array of transaction records.
  - `chatMessages`: Chat message history including support requisites card data.

- **Navigation & Routing**:
  - Switching tabs calls `navigateToTab(tabName)`, which updates `appState.activeTab`, highlights the active bottom tab bar item, and invokes `renderActiveView()`.
  - View renderers (`renderHomeView`, `renderHistoryView`, `renderPaymentsView`, `renderChatView`, `renderServicesView`) inject dynamic HTML templates into `#view-container`.

---

## 4. Design System & Theme Rules

1. **Theme Attributes**:
   - Light mode attribute: `<html data-ob-theme="light">`
   - Dark mode attribute: `<html data-ob-theme="dark">`
   - Theme variables (`--layerFloor0`, `--layerFloor1`, `--textPrimary`, `--textSecondary`, `--border-dark`) control all component colors seamlessly.

2. **Visual Hierarchy & Layout Constraints**:
   - **Main Outer Container (`#app`)**: Centered layout with `max-width: 440px`.
   - **Scroll Container (`#view-container`)**: Fills height with `padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px))` so bottom fixed navigation never hides content.
   - **Cards under "Счета и карты"**: Rendered using `.ozon-cards-box` and `.ozon-account-card` to ensure 100% full-width expansion within the container.
   - **Quick Action Cards**: Styled with official Ozon Finance blue background tinting (`rgba(0, 91, 255, 0.14)` for dark mode, `#e8f2ff` for light mode).
   - **Header Profile**: Vertical stacking of Name (`ИП Фон Берг...`) and INN (`ИНН 233803342844`).

---

## 5. Guidelines for Future AI Agents & Developers

When making modifications or adding new features:

1. **Visual Priority**:
   - Always refer to `screenshots/` directory files for visual design decisions. Screenshots take priority over legacy CSS files.

2. **Modifying DOM & Style Classes**:
   - Keep `.ozon-cards-box` and `.ozon-account-card` full-width styles intact. Avoid re-introducing phone frames or top dock/status bar imitations.
   - Do not edit CSS bundle files inside `assets/`. Put all custom rules and overrides in `style.css`.

3. **Event Listeners**:
   - Use event delegation on `#app-tabbar` (`e.target.closest('.tab')`) when attaching bottom navigation handlers to prevent lost clicks during dynamic re-renders.

4. **Testing & Verification**:
   - The application is served locally. Use Chrome/Browser agent to test visually after applying HTML/CSS/JS edits.
