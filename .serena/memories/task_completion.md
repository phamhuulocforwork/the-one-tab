# Task Completion Guidelines

When a coding task is completed in this project:

- **Build & basic check**
  - Run `npm run build` to ensure the extension bundles correctly.

- **Manual extension test**
  - Load the built extension from `dist/` into Chrome via `chrome://extensions/` (Developer Mode → Load unpacked → select `dist/`).
  - Verify popup UI (`src/popup`), content scripts (`src/content`), and side panel (`src/sidepanel`) behaviours relevant to the changes.

- **Code style**
  - Follow Svelte + TypeScript idioms; keep components small and readable.
  - Prefer clear naming for components and content scripts (e.g., `MainContent`, `initContentScript`).

- **Future improvements (not yet configured)**
  - Consider adding linting (ESLint) and formatting (Prettier) and wiring them into npm scripts.
  - Consider adding a test runner (Vitest) for logic tests.
