const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\5152619e-02b8-493f-9022-61e8862f9ed2';

async function testSuperAdminTableUI() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9224/json', (res) => {
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

    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `(async () => {
        const res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'superadmin@enterprise-crm.com', password: 'SuperAdmin123!' })
        });
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      })()`,
      awaitPromise: true
    });

    await send('Page.navigate', { url: 'http://localhost:5173/super-admin/leave-policy' });
    await new Promise(r => setTimeout(r, 2000));

    // Click TEAM_LEADER role tab
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tlBtn = buttons.find(b => b.innerText.includes('Team Leader'));
        if (tlBtn) tlBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll main element down to leave types table
    await send('Runtime.evaluate', {
      expression: `(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 500;
        const table = document.querySelector('table');
        if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    const ssAdmin = await send('Page.captureScreenshot', { format: 'png' });
    const ssAdminPath = path.join(ARTIFACT_DIR, 'tl_leave_types_table.png');
    fs.writeFileSync(ssAdminPath, Buffer.from(ssAdmin.data, 'base64'));
    console.log(`✓ Saved Super Admin TL leave types table screenshot to ${ssAdminPath}`);

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

testSuperAdminTableUI().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
