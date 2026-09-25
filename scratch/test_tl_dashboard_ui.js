const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\5152619e-02b8-493f-9022-61e8862f9ed2';

async function testTeamLeaderDashboardUI() {
  console.log('--- Starting Chrome Headless for UI Verification ---');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json', (res) => {
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

    console.log('Navigating to login page...');
    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1000));

    // 1. Authenticate as Team Leader in localStorage
    console.log('Setting Team Leader auth in localStorage...');
    await send('Runtime.evaluate', {
      expression: `(async () => {
        const res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'paulrenine9487@gmail.com', password: '01012000' })
        });
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      })()`,
      awaitPromise: true
    });

    // 2. Navigate to Dashboard
    console.log('Navigating to Team Leader Dashboard (/dashboard)...');
    await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
    await new Promise(r => setTimeout(r, 2500));

    // 3. Dismiss Welcome Modal if present
    console.log('Dismissing welcome modal if present...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const exploreBtn = btns.find(b => b.innerText.includes('Explore Innoveity') || b.innerText.includes('Explore'));
        if (exploreBtn) {
          exploreBtn.click();
        } else {
          const closeIcon = document.querySelector('button svg.lucide-x')?.closest('button');
          if (closeIcon) closeIcon.click();
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Scroll to Leave Balances card
    await send('Runtime.evaluate', {
      expression: `(() => {
        const heading = Array.from(document.querySelectorAll('h3, h2, div, span')).find(el => el.innerText && el.innerText.trim() === 'Leave Balances');
        if (heading) {
          heading.scrollIntoView({ behavior: 'instant', block: 'center' });
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // 4. Inspect Leave Balances Card DOM values
    console.log('Checking DOM content on Team Leader Dashboard...');
    const domRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const card = Array.from(document.querySelectorAll('div')).find(d => d.innerText && d.innerText.includes('Leave Balances') && d.innerText.includes('Casual Leave'));
        return card ? card.innerText : document.body.innerText;
      })()`
    });

    console.log('Leave Balances Card Text:\n', domRes.result?.value);

    // 5. Capture Dashboard Screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const ssPath = path.join(ARTIFACT_DIR, 'tl_dashboard_leave_balances.png');
    fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
    console.log(`✓ Saved Team Leader dashboard screenshot to ${ssPath}`);

    // 5. Test Super Admin Leave Policy UI
    console.log('\nSetting Super Admin auth in localStorage...');
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

    console.log('Navigating to Super Admin Leave Policy Settings...');
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

    const ssAdmin = await send('Page.captureScreenshot', { format: 'png' });
    const ssAdminPath = path.join(ARTIFACT_DIR, 'tl_leave_policy_settings.png');
    fs.writeFileSync(ssAdminPath, Buffer.from(ssAdmin.data, 'base64'));
    console.log(`✓ Saved Super Admin TL policy settings screenshot to ${ssAdminPath}`);

    ws.close();
  } finally {
    chromeProc.kill();
  }
  console.log('--- UI Verification Complete ---');
}

testTeamLeaderDashboardUI().catch(err => {
  console.error('UI Test Error:', err);
  process.exit(1);
});
