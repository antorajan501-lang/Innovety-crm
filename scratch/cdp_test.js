const { spawn } = require('child_process');
const http = require('http');

async function main() {
  // 1. Launch Chrome with remote debugging
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://localhost:5173/login'
  ]);

  // Wait 1.5s for Chrome to bind port 9222
  await new Promise(r => setTimeout(r, 1500));

  // 2. Get the WebSocket debugger URL from http://127.0.0.1:9222/json
  const list = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = list.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('No page target found!');
    chromeProc.kill();
    return;
  }

  console.log('Connecting to WebSocket:', pageTarget.webSocketDebuggerUrl);
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

  // Enable Console and Runtime
  await send('Console.enable');
  await send('Runtime.enable');

  // Wait 2s for page to settle and theme to load
  await new Promise(r => setTimeout(r, 2000));

  // Evaluate button style and console logs
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('button[type="submit"]');
      const h2 = document.querySelector('h2');
      const csBtn = btn ? window.getComputedStyle(btn) : null;
      const csH2 = h2 ? window.getComputedStyle(h2) : null;
      return {
        btnFound: !!btn,
        btnBg: csBtn ? csBtn.backgroundColor : null,
        btnColor: csBtn ? csBtn.color : null,
        btnBoxShadow: csBtn ? csBtn.boxShadow : null,
        h2Color: csH2 ? csH2.color : null,
        localStorageTheme: localStorage.getItem('mrf_login_primary_color'),
        themeCookieOrStorage: Object.keys(localStorage)
      };
    })()`,
    returnByValue: true
  });

  console.log('Page Evaluation Result:', JSON.stringify(result.result.value, null, 2));

  // Take screenshot
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.data) {
    const fs = require('fs');
    fs.writeFileSync('C:/Users/Luffy/.gemini/antigravity-ide/brain/5152619e-02b8-493f-9022-61e8862f9ed2/cdp_login_screenshot.png', Buffer.from(screenshotRes.data, 'base64'));
    console.log('Saved cdp_login_screenshot.png successfully!');
  }

  ws.close();
  chromeProc.kill();
}

main().catch(err => console.error('CDP Error:', err));
