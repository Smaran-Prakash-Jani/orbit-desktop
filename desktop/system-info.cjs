const fs = require('node:fs/promises');

// os-release is data, never a shell script. Only read the fields used by the UI.
function parseOsRelease(source) {
  const result = {};
  const fields = new Set(['NAME', 'PRETTY_NAME', 'VERSION', 'VERSION_ID', 'VERSION_CODENAME', 'ID', 'VARIANT']);
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || !fields.has(match[1])) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    result[match[1]] = value.slice(0, 256);
  }
  return result;
}

async function linuxIdentity({ sandboxed = false, readFile = fs.readFile } = {}) {
  const paths = sandboxed ? ['/run/host/os-release'] : ['/etc/os-release', '/usr/lib/os-release'];
  for (const path of paths) {
    try {
      const release = parseOsRelease(await readFile(path, 'utf8'));
      if (!release.NAME && !release.PRETTY_NAME) continue;
      return {
        distro: release.PRETTY_NAME || [release.NAME, release.VERSION || release.VERSION_ID].filter(Boolean).join(' '),
        distroName: release.NAME || release.PRETTY_NAME,
        release: release.VERSION_ID || release.VERSION || '',
        codename: release.VERSION_CODENAME || '',
        variant: release.VARIANT || '',
        osSource: sandboxed ? 'host' : 'system'
      };
    } catch { /* Try the documented fallback, keeping unavailable host details honest. */ }
  }
  return sandboxed ? { distro: 'Linux host · details unavailable', distroName: 'Linux host', release: '', codename: '', variant: '', osSource: 'unavailable' } : null;
}

module.exports = { parseOsRelease, linuxIdentity };
