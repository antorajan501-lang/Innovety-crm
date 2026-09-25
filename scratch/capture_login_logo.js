const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\75ea4882-487b-4396-9efa-d94c041b3aeb';

async function main() {
  console.log('--- Capturing Login Page with new login_logo.png ---');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9229/json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageTarget = list.find(t => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
    };

    const send = (method, params = {}) => {
      const msgId = id++;
      return new Promise((resolve) => {
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    await new Promise(r => ws.onopen = r);
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('Navigating to http://localhost:5173/login ...');
    await send('Page.navigate', { url: 'http://localhost:5173/login' });

    // Wait for page to render and decorative elements to lazy-load
    await new Promise(r => setTimeout(r, 3000));

    // Capture desktop full page screenshot
    console.log('Capturing desktop screenshot...');
    const ssDesktop = await send('Page.captureScreenshot', { format: 'png' });
    const ssDesktopPath = path.join(ARTIFACT_DIR, 'login_page_new_logo_verified.png');
    fs.writeFileSync(ssDesktopPath, Buffer.from(ssDesktop.data, 'base64'));
    console.log(`✓ Saved Desktop Screenshot: ${ssDesktopPath}`);

    // Capture zoomed in hero illustration screenshot
    console.log('Capturing zoomed hero illustration screenshot...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const hero = document.querySelector('.relative.h-72.w-72') || document.querySelector('.login-theme-container');
        if (hero) hero.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    // Also test mobile viewport (375x812)
    console.log('Setting viewport to mobile (375x812)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 1200));

    const ssMobile = await send('Page.captureScreenshot', { format: 'png' });
    const ssMobilePath = path.join(ARTIFACT_DIR, 'login_page_mobile_verified.png');
    fs.writeFileSync(ssMobilePath, Buffer.from(ssMobile.data, 'base64'));
    console.log(`✓ Saved Mobile Screenshot: ${ssMobilePath}`);

    ws.close();
  } finally {
    chromeProc.kill();
  }
  console.log('--- Login Logo capture completed! ---');
}

main().catch(console.error);
