const fs = require('node:fs/promises');
const path = require('node:path');

// Bounded, non-following traversal. Symlinks and special files are never followed.
async function scanDirectory(root, { maxEntries = 60000, timeoutMs = 15000, signal } = {}) {
  const start = Date.now();
  const resolved = await fs.realpath(root);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) throw new Error('Choose a directory to inspect.');
  let count = 0, skipped = 0, partial = false;
  const groups = new Map();
  const seenFiles = new Set();
  const queue = [{ full: resolved, group: null }];
  for (let i = 0; i < queue.length; i++) {
    if (signal?.aborted) throw new Error('Inspection cancelled.');
    if (Date.now() - start > timeoutMs || count >= maxEntries) { partial = true; break; }
    const item = queue[i];
    let directory;
    try { directory = await fs.opendir(item.full); } catch { skipped++; continue; }
    for await (const entry of directory) {
      if (signal?.aborted) throw new Error('Inspection cancelled.');
      if (++count > maxEntries || Date.now() - start > timeoutMs) { partial = true; break; }
      const full = path.join(item.full, entry.name);
      const group = item.group || entry.name;
      if (!groups.has(group)) groups.set(group, { name: group, size: 0, files: 0, directory: entry.isDirectory() });
      if (entry.isSymbolicLink()) { skipped++; continue; }
      try {
        const s = await fs.lstat(full);
        if (s.isSymbolicLink() || s.dev !== stat.dev) { skipped++; continue; }
        if (s.isDirectory()) queue.push({ full, group });
        else if (s.isFile()) {
          const key = `${s.dev}:${s.ino}`;
          if (seenFiles.has(key)) continue;
          seenFiles.add(key);
          const target = groups.get(group);
          target.size += s.size;
          target.files++;
        } else skipped++;
      } catch { skipped++; }
    }
    if (partial) break;
  }
  const entries = [...groups.values()].sort((a,b) => b.size-a.size);
  return { root: resolved, entries, total: entries.reduce((n,e) => n+e.size,0), count, skipped, partial, duration: Date.now()-start };
}
module.exports = { scanDirectory };
