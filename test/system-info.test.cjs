const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseOsRelease, linuxIdentity} = require('../desktop/system-info.cjs');

test('os-release parses distro fields without evaluating shell content', () => {
  const info = parseOsRelease('# Comment\nNAME="Test \\"Linux\\""\nPRETTY_NAME=\'Test Linux 25\'\nVERSION_ID="25"\nVERSION_CODENAME=crimson\nHOME_URL="https://example.test"\nID=$(do-not-run)');
  assert.equal(info.NAME, 'Test "Linux"');
  assert.equal(info.PRETTY_NAME, 'Test Linux 25');
  assert.equal(info.VERSION_ID, '25');
  assert.equal(info.ID, '$(do-not-run)');
  assert.equal(info.HOME_URL, undefined);
});
test('Flatpak identity reads the host, never the runtime os-release', async () => {
  const paths=[];
  const info = await linuxIdentity({sandboxed:true,readFile:async path=>{paths.push(path);return 'NAME="Deepin"\nPRETTY_NAME="Deepin 25"\nVERSION_ID=25\nVERSION_CODENAME=crimson';}});
  assert.deepEqual(paths,['/run/host/os-release']);
  assert.equal(info.distro,'Deepin 25');
  assert.equal(info.release,'25');
  assert.equal(info.codename,'crimson');
  assert.equal(info.osSource,'host');
});
test('inaccessible or malformed host identity stays unknown, rather than reporting the runtime', async () => {
  for(const readFile of [async()=>{throw new Error('EACCES');},async()=>'# no distro fields']) {
    const info=await linuxIdentity({sandboxed:true,readFile});
    assert.equal(info.osSource,'unavailable');
    assert.equal(info.release,'');
    assert.match(info.distro,/details unavailable/);
  }
});
test('native Linux tries the standard fallback and supports rolling distributions',async()=>{
  const paths=[];
  const info=await linuxIdentity({readFile:async path=>{paths.push(path);if(path==='/etc/os-release')throw new Error('ENOENT');return 'NAME="Arch Linux"';}});
  assert.deepEqual(paths,['/etc/os-release','/usr/lib/os-release']);
  assert.equal(info.distro,'Arch Linux');
  assert.equal(info.release,'');
  assert.equal(await linuxIdentity({readFile:async()=>{throw new Error('ENOENT');}}),null);
});
