const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
  // Test the installed app: `flatpak build` omits runtime D-Bus proxies required by Zypak.
  const child=spawn('flatpak',['run','--user','io.github.orbitdesktop.Orbit','--remote-debugging-port=19327'],{stdio:['ignore','pipe','pipe']});
  let logs='';child.stderr.on('data',b=>{logs+=b.toString();});
  let browser;
  try {
    for(let i=0;i<60;i++){
      if(child.exitCode!==null)throw new Error(`Flatpak exited ${child.exitCode}: ${logs}`);
      try{browser=await chromium.connectOverCDP('http://127.0.0.1:19327',{timeout:1000});break;}catch{await new Promise(r=>setTimeout(r,500));}
    }
    if(!browser)throw new Error(`Flatpak did not open its test connection: ${logs}`);
    const context=browser.contexts()[0];let page;
    for(let i=0;i<30;i++){page=context.pages().find(p=>p.url().includes('index.html'));if(page)break;await new Promise(r=>setTimeout(r,200));}
    if(!page)throw new Error('No Orbit window in Flatpak.');
    await page.locator('#scope-banner').waitFor({timeout:20000});
    assert.equal(await page.locator('#preview-banner').isVisible(),false);
    await page.waitForFunction(()=>document.getElementById('cpu-value').textContent!=='—',{}, {timeout:20000});
    await page.getByRole('button',{name:'Open health',exact:true}).click();
    await page.locator('#view-health').getByRole('button',{name:'Run health check',exact:true}).click();
    await page.getByText('Host services are outside this sandbox').waitFor({timeout:20000});
    await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/flatpak-live.png',animations:'disabled'});
    console.log('PASS: Flatpak launches with Zypak, desktop bridge is present, real CPU data loads, and host service limits are shown honestly.');
    await page.evaluate(()=>window.orbit.windowControl('close')).catch(()=>{});
  } finally {if(browser)await browser.close().catch(()=>{});child.kill('SIGTERM');child.stdout.destroy();child.stderr.destroy();child.unref();}
})().catch(e=>{console.error(e);process.exitCode=1;});
