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
    const system = await page.evaluate(()=>window.orbit.system());
    const {parseOsRelease} = require('../desktop/system-info.cjs');
    const host = parseOsRelease(await fs.readFile('/etc/os-release','utf8'));
    assert.equal(system.osSource,'host');
    assert.equal(system.distro,host.PRETTY_NAME);
    assert.equal(system.release,host.VERSION_ID);
    assert.equal(await page.locator('#hero-system').innerText(),host.PRETTY_NAME);
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    assert.equal(await page.locator('[data-theme-choice]').count(),0);
    assert.equal(await page.locator('html').getAttribute('data-theme'),null);
    assert.match(await page.locator('#system-details').innerText(),new RegExp(system.kernel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','installed clear glass leaves the window background transparent');
    const backing=await page.locator('.app-shell').evaluate(el=>getComputedStyle(el,'::before').backgroundColor);
    assert.match(backing,/rgba\(/,'installed reading surface stays translucent');
    assert.equal(await page.locator('.app-shell').evaluate(el=>getComputedStyle(el,'::before').backgroundImage),'none');
    await page.getByRole('button',{name:'Adjust transparency'}).click();
    assert.equal(await page.locator('#transparency-popover [data-transparency-slider]').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.screenshot({path:'test-results/flatpak-preferences.png',animations:'disabled'});
    await page.getByRole('button',{name:'Overview',exact:true}).click();
    assert.equal(await page.locator('.landscape-banner').count(),0);
    await page.screenshot({path:'test-results/flatpak-overview.png',animations:'disabled'});
    const layout=await page.evaluate(()=>{
      const main=document.querySelector('main');
      const topbar=document.querySelector('.topbar');
      const before=topbar.getBoundingClientRect().top;
      main.scrollTop=350;
      return {scroll:main.scrollTop,pageScroll:document.scrollingElement.scrollTop,before,after:topbar.getBoundingClientRect().top};
    });
    assert.ok(layout.scroll>0,'installed overview scrolls inside the frame');
    assert.equal(layout.pageScroll,0);
    assert.equal(layout.after,layout.before,'installed topbar remains fixed');
    await page.screenshot({path:'test-results/flatpak-scrolled.png',animations:'disabled'});
    await page.getByRole('button',{name:'Health check',exact:true}).click();
    await page.locator('#view-health').getByRole('button',{name:'Run health check',exact:true}).click();
    await page.getByText('Host services are outside this sandbox').waitFor({timeout:20000});
    await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/flatpak-live.png',animations:'disabled'});
    console.log('PASS: Flatpak launches with Zypak, desktop bridge is present, real CPU data loads, host OS and version match the machine, the transparency control and machine details are present, and host service limits are shown honestly.');
    await page.evaluate(()=>window.orbit.windowControl('close')).catch(()=>{});
  } finally {if(browser)await browser.close().catch(()=>{});child.kill('SIGTERM');child.stdout.destroy();child.stderr.destroy();child.unref();}
})().catch(e=>{console.error(e);process.exitCode=1;});
