const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const prisma = require('../backend/src/utils/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\75ea4882-487b-4396-9efa-d94c041b3aeb';

async function capture() {
  console.log('--- Starting Chrome Headless for Deliverables Screenshot Capture ---');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9225/json', (res) => {
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

    const orgId = 'cmteaqlih0000sj52wckjbgci';
    const tlUser = await prisma.user.findFirst({
      where: { organizationId: orgId, role: 'TEAM_LEADER' }
    });
    const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

    // 1. Team Leader Dashboard
    console.log('Navigating to Team Leader Dashboard (/login first)...');
    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('token', '${tlToken}');
        localStorage.setItem('user', JSON.stringify(${JSON.stringify(tlUser)}));
      })()`
    });

    console.log('Navigating to /dashboard as Team Leader...');
    await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
    await new Promise(r => setTimeout(r, 2500));

    // Dismiss any modals
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const exploreBtn = btns.find(b => b.innerText && (b.innerText.includes('Explore') || b.innerText.includes('Get Started')));
        if (exploreBtn) exploreBtn.click();
        const closeIcon = document.querySelector('button svg.lucide-x')?.closest('button');
        if (closeIcon) closeIcon.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll Leave Balances card into view
    await send('Runtime.evaluate', {
      expression: `(() => {
        const h = Array.from(document.querySelectorAll('h3, span, div')).find(el => el.innerText && el.innerText.trim() === 'Leave Balances');
        if (h) h.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    const ssTL = await send('Page.captureScreenshot', { format: 'png' });
    const ssTLPath = path.join(ARTIFACT_DIR, 'tl_dashboard_verified_leaves.png');
    fs.writeFileSync(ssTLPath, Buffer.from(ssTL.data, 'base64'));
    console.log(`✓ Saved Team Leader dashboard screenshot: ${ssTLPath}`);

    // 2. Super Admin Leave Policy Settings
    const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

    await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('token', '${adminToken}');
        localStorage.setItem('user', JSON.stringify(${JSON.stringify(superAdmin)}));
      })()`
    });

    console.log('Navigating to Super Admin Leave Policy Settings (/super-admin/leave-policy)...');
    await send('Page.navigate', { url: 'http://localhost:5173/super-admin/leave-policy' });
    await new Promise(r => setTimeout(r, 2500));

    // Click Team Leader role tab
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const tlBtn = btns.find(b => b.innerText && b.innerText.trim() === 'Team Leader');
        if (tlBtn) tlBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll Leave Types section into view
    await send('Runtime.evaluate', {
      expression: `(() => {
        const h = Array.from(document.querySelectorAll('h3, h4')).find(el => el.innerText && el.innerText.trim() === 'Leave Types');
        if (h) h.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    const ssAdmin = await send('Page.captureScreenshot', { format: 'png' });
    const ssAdminPath = path.join(ARTIFACT_DIR, 'super_admin_leave_policy_verified.png');
    fs.writeFileSync(ssAdminPath, Buffer.from(ssAdmin.data, 'base64'));
    console.log(`✓ Saved Super Admin policy screenshot: ${ssAdminPath}`);

    ws.close();
  } finally {
    chromeProc.kill();
    await prisma.$disconnect();
  }
}

capture().catch(console.error);
