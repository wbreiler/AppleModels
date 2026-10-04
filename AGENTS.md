# Repository Guidelines

## Project Structure & Module Organization

Apple Spatial Lab is a static Vite website with Three.js and Quest WebXR support. Run commands from the repository root.

- `index.html` defines the interface. `src/main.js` handles models, navigation, and VR controls. `src/style.css` defines styles.
- `public/catalog.json` describes devices. `public/models/` contains prepared model ZIPs with textures.
- `scripts/` contains download, conversion, material verification, and browser verification tools.
- `.openai/hosting.json` identifies the existing Sites project. `dist/` contains generated output and is ignored.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from the lockfile.
- `npm run dev`: start the local viewer at `http://127.0.0.1:5173/`.
- `npm run build`: generate `dist/` for a static server. Quest WebXR requires HTTPS.
- `npm test`: verify materials, texture files, and browser behavior. Keep the development server running in another terminal.
- `npm run sync`: stage official Apple downloads under `.model-refresh/`.

After synchronization, run `.venv/bin/python scripts/prepare-models.py`. Create the environment with Python 3.13 and install `usd-core==26.8` first. Complete conversion before publishing.

## Coding Style & Naming Conventions

Use JavaScript ES modules, single quotes, semicolons, and camelCase identifiers. Follow surrounding indentation. Use two spaces for new JavaScript blocks and four spaces for Python. Use kebab-case device IDs and filenames, such as `mac-pro-2019`. No formatter or linter is configured. Avoid unrelated formatting changes.

## Testing Guidelines

Checks use Node assertions and Playwright. Extend `scripts/check-materials.mjs` or `scripts/check.mjs` for relevant regressions. Browser checks cover model geometry, decoded textures, navigation, sizing, mobile layout, and VR denial handling. No percentage coverage threshold is configured.

Set `CHROME_PATH` if Chrome is outside the default macOS location. Use `node scripts/check.mjs mac-pro-2019` for focused verification. Verify actual immersive sessions and controller tracking on a Quest headset.

## Commit & Pull Request Guidelines

Use the existing `feat:` and `chore:` conventions. Use `fix:` for corrections. Keep commits focused by section. Describe the problem, resulting behavior, and validation in pull requests. Link relevant issues and include screenshots for visible changes.

## Assets & Configuration

Preserve Apple source URLs, attribution, textures, and physical units. Assets remain Apple's property. Keep credentials, dependencies, temporary downloads, and build output out of commits. Reuse the existing Sites project ID. Change its audience only when explicitly requested.
