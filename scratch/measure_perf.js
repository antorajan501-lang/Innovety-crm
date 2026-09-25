const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testPerformanceAndInteraction() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
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
  await send('DOM.enable');

  console.log('Navigating to http://localhost:5173/login...');
  const t0 = Date.now();
  await send('Page.navigate', { url: 'http://localhost:5173/login' });

  // Measure time until the email/user input is in DOM and clickable
  let inputReadyTime = null;
  for (let i = 0; i < 50; i++) {
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const inp = document.querySelector('input[placeholder*="Mail or User ID"]');
        return inp !== null && !inp.disabled;
      })()`,
      returnByValue: true
    });
    if (check.result?.value === true) {
      inputReadyTime = Date.now() - t0;
      break;
    }
    await new Promise(r => setTimeout(r, 10));
  }

  console.log(`[PERFORMANCE] Time to interactive input ready: ${inputReadyTime}ms`);

  // Focus and type into input
  await send('Runtime.evaluate', {
    expression: `(() => {
      const inp = document.querySelector('input[placeholder*="Mail or User ID"]');
      inp.focus();
      inp.value = 'superadmin@enterprise-crm.com';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      const pwd = document.querySelector('input[type="password"]');
      pwd.value = 'SuperAdmin123!';
      pwd.dispatchEvent(new Event('input', { bubbles: true }));
    })()`
  });

  await new Promise(r => setTimeout(r, 200));

  // Take screenshot with focused & filled inputs
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.data) {
    fs.writeFileSync('C:/Users/Luffy/.gemini/antigravity-ide/brain/5152619e-02b8-493f-9022-61e8862f9ed2/cdp_login_interactive.png', Buffer.from(screenshotRes.data, 'base64'));
    console.log('Saved cdp_login_interactive.png successfully!');
  }

  ws.close();
  chromeProc.kill();
}

testPerformanceAndInteraction().catch(console.error);
