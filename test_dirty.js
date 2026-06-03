const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to root to set localStorage...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    localStorage.setItem("commute_schedule", "{}");
  });

  console.log('Navigating to schedule page...');
  await page.goto('http://localhost:3000/schedule', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded. Checking for loading text...');
  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes('データを読み込んでいます')) {
    console.log('STILL LOADING');
  } else {
    console.log('NOT LOADING ANYMORE');
  }

  await browser.close();
})();
