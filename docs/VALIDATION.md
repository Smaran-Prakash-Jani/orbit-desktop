# Validation — 0.1.0

Validated on Deepin 25, x86-64, AMD Ryzen 7 5800H. The translucent dashboard, measured gauges, and Linux identity were checked on 2026-11-20. Earlier release checks are dated below.

| Check | Result |
| --- | --- |
| JavaScript syntax | Passed |
| Core behavior tests | Passed: available-memory calculation, unknown/warning health states, report privacy allowlist, bounded filesystem traversal |
| UI smoke test | Passed: navigation, search and empty state, inspection, evidence details, keyboard palette, transparency slider and preference persistence, 1366×768 overview fit, 390px overflow, scrolled header readability, no theme picker |
| Host OS collector tests | Passed: quoted os-release fields, no shell evaluation, Flatpak host identity, unavailable host fallback, native fallback and rolling distributions |
| Interface refinement checks | Passed: machine details, menu keyboard sorting, refresh interval persistence, transparency range, 880px and 390px layouts |
| Source desktop integration | Passed with real system readings |
| Packaged Linux integration | Passed: live CPU, process list, health, native folder bridge, report export, isolated renderer |
| Flatpak installed runtime | Passed after reinstall: Zypak launch, real CPU, host distro/version match Deepin 25, machine details, transparency control, explicit sandbox service limits |
| Debian package metadata | Parsed successfully with dpkg-deb |
| Flatpak desktop entry | Passed desktop-file-validate |
| Windows portable executable (2026-11-20) | Rebuilt from the updated UI; x64 archive integrity passed, current gauges and transparency controls verified in the packaged payload; **not run on Windows** |
| Shipped dependency audit (2026-11-17) | No known advisories reported by npm audit --omit=dev at build time |

The Windows setup/NSIS target is configured for the Windows CI runner. A local installer attempt reached NSIS but could not finish because Wine is not installed on this Linux machine; the incomplete file was removed. The locally delivered Windows artifact is the portable executable. Windows artifacts are unsigned. The `.deb` installer itself was not installed during testing; its packaged Linux application was launch-tested. GitHub Actions is configured but has not run on a remote repository.

The reference-inspired screenshot in this repository uses visibly labelled example data. Runtime test screenshots are local under ignored `test-results/` and may contain details about the test machine. The clear window corners and translucent main panel were confirmed from the Electron screenshot alpha channel.

SHA-256 checksums for delivered packages are in `release/SHA256SUMS.txt`. From the release directory, run `sha256sum -c SHA256SUMS.txt`.

To repeat the installed Flatpak test after installing the local bundle, run `node scripts/flatpak-smoke.cjs`. It starts a temporary localhost debugging endpoint, verifies the interface, and closes the test window.

The 2026-11-20 Flatpak and Windows portable build include the warmer translucent interface, measured overview gauges with clarified labels, adjustable transparency, a readable scrolled header, larger window controls, and the compact laptop layout. The old theme, wallpaper, sidebar, and 3D scene sources and assets were removed from both packages. The Windows executable still needs runtime testing on Windows.
