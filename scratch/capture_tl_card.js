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

  const token = jwt.sign(
    { id: tl.id, role: tl.role, organizationId: tl.organizationId },
    process.env.JWT_SECRET
  );

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--disable-gpu',
    '--window-size=1440,1200',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

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

    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1000));

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

    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 3000));

    // Get Leave Balances container coordinates
    const boxEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const headings = Array.from(document.querySelectorAll('h3, h2, h4, span, div'));
        const el = headings.find(e => e.textContent?.trim() === 'Leave Balances');
        if (el) {
          const container = el.closest('div.rounded-3xl, div.bg-card, div.border') || el.parentElement.parentElement;
          container.scrollIntoView({ behavior: 'instant', block: 'center' });
          const rect = container.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
        return null;
      })()`,
      returnByValue: true
    });
    console.log('Box rect:', boxEval.result?.value);
    await new Promise(r => setTimeout(r, 600));

    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: boxEval.result?.value ? {
        x: Math.max(0, boxEval.result.value.x - 5),
        y: Math.max(0, boxEval.result.value.y - 5),
        width: boxEval.result.value.width + 10,
        height: boxEval.result.value.height + 10,
        scale: 1
      } : undefined
    });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'tl_leave_balances_card_verified.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved tl_leave_balances_card_verified.png');

    ws.close();
  } finally {
    chromeProc.kill();
    await prisma.$disconnect();
  }
}
main().catch(console.error);
