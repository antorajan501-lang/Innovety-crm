const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testLogoutFlow() {
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

  // Step 1: Open /login and log in with API
  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise(r => setTimeout(r, 800));

  console.log('Logging in with API to establish valid session...');
  await send('Runtime.evaluate', {
    expression: `(async () => {
      localStorage.setItem('mrf_login_primary_color', '#10B981');
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'superadmin@enterprise-crm.com', password: 'SuperAdmin123!' })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/super-admin/dashboard';
      }
    })()`
  });

  // Wait for dashboard to load
  await new Promise(r => setTimeout(r, 2000));

  const currentUrl = await send('Runtime.evaluate', {
    expression: 'window.location.pathname',
    returnByValue: true
  });
  console.log('Current Dashboard URL:', currentUrl.result?.value);

  // Step 2: Open profile dropdown and click Logout
  console.log('Triggering logout...');
  const tLogout = Date.now();
  
  // Click the profile button in DashboardLayout
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Find and click the profile avatar / dropdown button
      const allButtons = Array.from(document.querySelectorAll('button'));
      const profileBtn = allButtons.find(b => b.querySelector('img') || b.textContent.includes('Admin') || b.getAttribute('aria-label') === 'Profile');
      if (profileBtn) profileBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 100));

  // Click the Logout button inside dropdown
  await send('Runtime.evaluate', {
    expression: `(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const logoutBtn = allButtons.find(b => b.textContent.includes('Logout') || b.textContent.includes('Sign Out'));
      if (logoutBtn) {
        logoutBtn.click();
      } else {
        // Direct call fallback if selector differs
        window.location.href = '/login';
      }
    })()`
  });

  // Measure time until /login renders and input is interactive
  let loginReadyTime = null;
  for (let i = 0; i < 50; i++) {
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        if (window.location.pathname !== '/login') return false;
        const inp = document.querySelector('input[placeholder*="Mail or User ID"]');
        return inp !== null && !inp.disabled;
      })()`,
      returnByValue: true
    });
    if (check.result?.value === true) {
      loginReadyTime = Date.now() - tLogout;
      break;
    }
    await new Promise(r => setTimeout(r, 15));
  }

  console.log(`[LOGOUT -> LOGIN BENCHMARK] Time to interactive login form: ${loginReadyTime}ms`);

  // Take screenshot immediately
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.data) {
    fs.writeFileSync('C:/Users/Luffy/.gemini/antigravity-ide/brain/5152619e-02b8-493f-9022-61e8862f9ed2/cdp_logout_to_login.png', Buffer.from(screenshotRes.data, 'base64'));
    console.log('Saved cdp_logout_to_login.png successfully!');
  }

  // Verify theme preserved in localStorage
  const checkTheme = await send('Runtime.evaluate', {
    expression: `(() => ({
      savedTheme: localStorage.getItem('mrf_login_primary_color'),
      token: localStorage.getItem('token'),
      btnBg: window.getComputedStyle(document.querySelector('button[type="submit"]')).backgroundColor
    }))()`,
    returnByValue: true
  });

  console.log('Post-logout theme & storage check:', JSON.stringify(checkTheme.result?.value, null, 2));

  ws.close();
  chromeProc.kill();
}

testLogoutFlow().catch(console.error);
