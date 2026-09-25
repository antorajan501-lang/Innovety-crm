const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('../backend/node_modules/jsonwebtoken');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const prisma = require('../backend/src/utils/db');

const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\5152619e-02b8-493f-9022-61e8862f9ed2';

async function main() {
  const tl = await prisma.user.findFirst({
    where: { role: 'TEAM_LEADER', organizationId: 'cmteaqlih0000sj52wckjbgci' }
  });
  console.log('TL found:', tl?.name, tl?.email, tl?.organizationId);

  const token = jwt.sign(
    { id: tl.id, role: tl.role, organizationId: tl.organizationId },
    process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!'
  );

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9227/json', (res) => {
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

    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1000));

    // Set localStorage
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('token', ${JSON.stringify(token)});
        localStorage.setItem('user', JSON.stringify({
          id: '${tl.id}',
          name: '${tl.name}',
          email: '${tl.email}',
          role: '${tl.role}',
          organizationId: '${tl.organizationId}'
        }));
      `
    });

    // Navigate to dashboard
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll down to reveal leave balances
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 900);` });
    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'tl_dashboard_monthly_balances.png'), Buffer.from(shot1.data, 'base64'));
    console.log('Saved tl_dashboard_monthly_balances.png');

    // Read cards text
    const cardsEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const idx = text.indexOf('Leave Balances');
        if (idx !== -1) {
          return text.substring(idx, idx + 400);
        }
        return 'Leave Balances not found on page';
      })()`,
      returnByValue: true
    });
    console.log('Detected Leave Balance cards on page:\n' + cardsEval.result?.value);

    // Refresh page to verify persistence
    console.log('Refreshing page to test persistence...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 3000));

    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 900);` });
    await new Promise(r => setTimeout(r, 1000));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'tl_dashboard_after_refresh.png'), Buffer.from(shot2.data, 'base64'));
    console.log('Saved tl_dashboard_after_refresh.png');

    const cardsEval2 = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const idx = text.indexOf('Leave Balances');
        if (idx !== -1) {
          return text.substring(idx, idx + 400);
        }
        return 'Leave Balances not found on page';
      })()`,
      returnByValue: true
    });
    console.log('Leave Balance cards after refresh:\n' + cardsEval2.result?.value);

    ws.close();
  } finally {
    chromeProc.kill();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
