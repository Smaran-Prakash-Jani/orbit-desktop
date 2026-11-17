const { _electron: electron }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'orbit-desktop-test-'));
  await fs.writeFile(path.join(root,'fixture.txt'),'Orbit live storage fixture');
  const launch=process.env.ORBIT_EXECUTABLE?{executablePath:process.env.ORBIT_EXECUTABLE,args:[]}:{args:[path.resolve(__dirname,'..')]};
  const app=await electron.launch({...launch,env:{...process.env,ELECTRON_DISABLE_SECURITY_WARNINGS:'true'},timeout:30000});
  try {
    const window=await app.firstWindow();
    const errors=[];window.on('pageerror',e=>errors.push(e.message));
    await window.waitForFunction(()=>document.getElementById('cpu-value').textContent!=='—',{},{timeout:20000});
    assert.equal(await window.locator('#preview-banner').isVisible(),false);
    assert.equal(await window.evaluate(()=>typeof window.require),'undefined');
    const config=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(config.contextIsolation,true);assert.equal(config.sandbox,true);assert.equal(config.nodeIntegration,false);
    await window.getByRole('button',{name:'Processes',exact:true}).click();
    await window.waitForFunction(()=>document.querySelectorAll('#process-rows tr').length>1,{},{timeout:20000});
    await window.getByRole('button',{name:'Health check',exact:true}).click();
    await window.locator('#view-health').getByRole('button',{name:'Run health check',exact:true}).click();
    await window.locator('.check-card').first().waitFor({timeout:20000});
    await app.evaluate(({dialog},{root,reportPath})=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});dialog.showSaveDialog=async()=>({canceled:false,filePath:reportPath});},{root,reportPath:path.join(root,'report.json')});
    await window.getByRole('button',{name:'Storage',exact:true}).click();
    await window.getByRole('button',{name:'Inspect a folder',exact:true}).click();
    await window.getByText('fixture.txt',{exact:true}).waitFor();
    await window.getByRole('button',{name:'Health check',exact:true}).click();
    await window.getByRole('button',{name:'Export report',exact:true}).click();
    await window.getByText('Report saved. Personal identifiers were omitted.').waitFor();
    const report=JSON.parse(await fs.readFile(path.join(root,'report.json'),'utf8'));
    assert.equal(report.app,'Orbit');assert.ok(report.checks.length>=5);assert.ok(!JSON.stringify(report).includes(root));
    await window.getByRole('button',{name:'Overview',exact:true}).click();
    await fs.mkdir('test-results',{recursive:true});
    await window.screenshot({path:'test-results/desktop-live.png',animations:'disabled'});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({result:'PASS',platform:report.system.distro,checks:report.checks.length,verified:['live metrics','real process list','health scan','native folder bridge','report export','context isolation','sandboxed renderer','no Node in renderer']},null,2));
  } finally {await app.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
