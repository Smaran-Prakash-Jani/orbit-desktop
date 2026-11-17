const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { memoryPercent, buildChecks, publicReport } = require('../desktop/metrics.cjs');
const { scanDirectory } = require('../desktop/storage.cjs');

test('available memory includes cache; zero and missing totals stay unknown', () => {
  assert.equal(memoryPercent({total:100,available:70,free:10}),30);
  assert.equal(memoryPercent({total:0,available:0}),null);
  assert.equal(memoryPercent(null),null);
  assert.equal(memoryPercent({total:100,available:200}),0);
});
test('health distinguishes pressure from unsupported measurements', () => {
  const checks = buildChecks({cpu:{load:96},memory:{total:100,available:5},disks:[{use:96}],network:{interfaces:[]}});
  assert.equal(checks.find(c=>c.id==='cpu').status,'warning');
  assert.equal(checks.find(c=>c.id==='memory').status,'warning');
  assert.equal(checks.find(c=>c.id==='disk').status,'warning');
  assert.equal(checks.find(c=>c.id==='services').status,'unknown');
  const unknown = buildChecks({});
  assert.ok(unknown.every(c=>c.status==='unknown'));
});
test('export allowlist strips identifiers from nested data and diagnostics', () => {
  const secret='PRIVATE_SENTINEL';
  const report=publicReport({platform:'linux',distro:'Test Linux',hostname:secret,username:secret},{cpu:{load:10},memory:{total:100},disks:[{mount:secret,fs:secret,size:500,used:100,use:20}],network:{interfaces:[{ip4:secret}]},processes:[secret]},[{id:'services',status:'warning',title:'Background services',summary:secret,detail:secret}]);
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.equal(report.storage[0].percent,20);
});
test('storage counts logical sizes, skips symlinks, deduplicates hard links and stops at bounds', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'orbit-test-'));
  try {
    await fs.mkdir(path.join(root,'a'));
    await fs.writeFile(path.join(root,'a','one'),Buffer.alloc(200));
    await fs.writeFile(path.join(root,'two'),Buffer.alloc(300));
    await fs.link(path.join(root,'two'),path.join(root,'hard-link'));
    if(process.platform!=='win32')await fs.symlink(root,path.join(root,'cycle'));
    const scan=await scanDirectory(root);
    assert.equal(scan.total,500);
    assert.equal(scan.partial,false);
    assert.equal(scan.entries.find(e=>e.name==='a').size,200);
    if(process.platform!=='win32')assert.ok(scan.skipped>=1);
    const bounded=await scanDirectory(root,{maxEntries:1});
    assert.equal(bounded.partial,true);
    const controller=new AbortController();controller.abort();
    await assert.rejects(scanDirectory(root,{signal:controller.signal}),/cancelled/);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
