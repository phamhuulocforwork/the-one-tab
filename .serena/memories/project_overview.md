# Project Overview

- **Name**: the-one-tab
- **Purpose**: Chrome extension built with Svelte + TypeScript + Vite, using CRXJS for manifest v3 packaging.
- **Manifest**: Defined in `manifest.config.ts` via `@crxjs/vite-plugin`, manifest_version 3, popup UI (`src/popup/index.html`), content script (`src/content/main.ts`), side panel (`src/sidepanel/index.html`).
- **Tech Stack**:
  - Svelte (frontend/components)
  - TypeScript
  - Vite (build tool)
  - CRXJS Vite plugin for Chrome extension
- **Entry points**:
  - Popup: `src/popup/index.html` → `main.ts`
  - Content script: `src/content/main.ts`
  - Side panel: `src/sidepanel/index.html`
