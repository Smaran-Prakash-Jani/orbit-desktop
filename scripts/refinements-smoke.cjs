const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async()=>{
  const browser = await chromium.launch({headless:true,...(process.env.ORBIT_BROWSER_PATH?{executablePath:process.env.ORBIT_BROWSER_PATH}:{})});
  const page = await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname,'../ui/index.html')).href);
    await page.locator('#hero-system').filter({hasText:'Ubuntu'}).waitFor();
    await page.locator('.machine-identity').click();
    assert.match(await page.locator('#system-details').innerText(),/6.8.0/);
    assert.match(await page.locator('#system-details').innerText(),/GNOME/);

    const interval=page.getByRole('combobox',{name:'Refresh interval'});
    await interval.click();
    await page.getByRole('option',{name:'Every 5 seconds'}).click();
    await page.reload();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    assert.equal(await interval.innerText(),'Every 5 seconds');

    await page.getByRole('button',{name:'Processes',exact:true}).click();
    await page.locator('#process-rows tr').first().waitFor();
    const sort=page.getByRole('combobox',{name:'Sort processes'});
    await sort.click();
    await page.getByRole('option',{name:'Memory',exact:true}).click();
    assert.match(await page.locator('#process-rows tr').first().innerText(),/Firefox/);
    await sort.press('ArrowDown'); await sort.press('End'); await sort.press('Enter');
    assert.match(await page.locator('#process-rows tr').first().innerText(),/code/);
    assert.equal(await sort.getAttribute('aria-expanded'),'false');

    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByLabel('Reduce motion').check();
    const transparency=page.locator('#view-settings [data-transparency-slider]');
    await transparency.focus();await transparency.press('Home');
    assert.equal(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--window-alpha')),'1');
    await transparency.press('End');
    assert.equal(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--window-alpha')),'0.2');
    for(const width of [880,390]) {
      await page.setViewportSize({width,height:900});
      for(const name of ['Settings','Processes','Overview']) {
        await page.getByRole('button',{name,exact:true}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: no overflow at ${width}`);
      }
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: machine details, accessible selects, refresh persistence, adjustable transparency, responsive layouts, no renderer errors.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
