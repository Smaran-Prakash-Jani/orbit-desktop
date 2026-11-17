# Validation — 0.1.0

Validated on Deepin 25, x86-64, AMD Ryzen 7 5800H, on 2026-11-17.

| Check | Result |
| --- | --- |
| JavaScript syntax | Passed |
| Four core behavior tests | Passed: available-memory calculation, unknown/warning health states, report privacy allowlist, bounded filesystem traversal |
| UI smoke test | Passed: navigation, search and empty state, inspection, evidence details, keyboard palette, preferences, themes, mobile overflow |
| Source desktop integration | Passed with real system readings |
| Packaged Linux integration | Passed: live CPU, process list, health, native folder bridge, report export, isolated renderer |
| Flatpak installed runtime | Passed: Zypak launch, desktop bridge, live CPU, explicit sandbox service limits |
| Debian package metadata | Parsed successfully with dpkg-deb |
| Flatpak desktop entry | Passed desktop-file-validate |
| Windows portable executable | Built with x64 payload, icon and metadata; **not run on Windows** |
| Shipped dependency audit | No known advisories reported by npm audit --omit=dev at build time |

The Windows setup/NSIS target is configured for the Windows CI runner; the locally delivered Windows artifact is the portable executable. Windows artifacts are unsigned. The `.deb` installer itself was not installed during testing; its packaged Linux application was launch-tested. GitHub Actions is configured but has not run on a remote repository.

Reference-inspired screenshots in this repository use visibly labelled example data. Runtime test screenshots are local under ignored `test-results/` and may contain details about the test machine.

SHA-256 checksums for delivered packages are in `release/SHA256SUMS.txt`. From the release directory, run `sha256sum -c SHA256SUMS.txt`.

To repeat the installed Flatpak test after installing the local bundle, run `node scripts/flatpak-smoke.cjs`. It starts a temporary localhost debugging endpoint, verifies the interface, and closes the test window.
