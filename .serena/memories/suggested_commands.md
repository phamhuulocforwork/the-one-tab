# Suggested Commands

- **Install dependencies**:
  - `npm install`

- **Run dev (Vite + CRXJS)**:
  - `npm run dev`
  - Used for development; CRXJS will build the extension and provide instructions/URL for loading the unpacked extension.

- **Build production extension**:
  - `npm run build`
  - Outputs built extension into `dist/` for loading as an unpacked extension in Chrome (`chrome://extensions`).

- **Load extension in Chrome for manual testing**:
  - Build: `npm run build`
  - Open Chrome → `chrome://extensions/` → enable Developer Mode → "Load unpacked" → select `dist/`.
