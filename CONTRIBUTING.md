# Contributing to Orbit

Use Node.js 22.12 or newer, run `npm ci`, then `npm start`.

For a useful bug report, include OS/distribution, package format, app version, the action you took, and what you expected. A redacted Orbit report can help, but inspect it before attaching. Screenshots may contain local addresses or process names; remove anything private yourself.

For code changes:

1. Keep system collection in `desktop/`; never expose arbitrary commands or filesystem paths through the preload bridge.
2. Return unknown when a sensor or command is unavailable. Never invent a successful result.
3. Keep all interface assets local. Respect reduced motion and the low-effects preference.
4. Add focused tests for diagnostic rules, privacy boundaries, traversal, or IPC behavior when those change.
5. Run `npm run check`, `npm test`, and the relevant UI/desktop check.
6. Describe the user-visible change and list which operating systems you actually tested.

Before a public release, replace the package metadata placeholders, test installers on their target operating systems, and attach checksums with the artifacts. Generated packages, tool caches, and test screenshots are ignored.
