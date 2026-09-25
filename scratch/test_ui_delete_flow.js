const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\5152619e-02b8-493f-9022-61e8862f9ed2';

async function testUIDeleteFlow() {
  console.log('--- Starting Chrome Headless for UI Delete Flow ---');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

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

    console.log('1. Navigating to login...');
    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 800));

    console.log('2. Setting Super Admin auth...');
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

    console.log('3. Navigating to Super Admin Leave Policy Settings...');
    await send('Page.navigate', { url: 'http://localhost:5173/super-admin/leave-policy' });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll main element down to leave types
    await send('Runtime.evaluate', {
      expression: `(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 500;
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    // 4. Test clicking Delete on an ASSIGNED policy (e.g. Casual Leave)
    console.log('4. Testing deletion rejection on assigned policy...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const cards = Array.from(document.querySelectorAll('div')).filter(d => d.innerText && d.innerText.includes('Casual Leave') && d.innerText.includes('CL'));
        const clCard = cards[cards.length - 1];
        if (clCard) {
          const trashBtn = clCard.querySelector('button[title*="Delete"]');
          if (trashBtn) trashBtn.click();
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    // Confirm deletion dialog
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.innerText.includes('Delete Policy'));
        if (confirmBtn) confirmBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    // Scroll to top of main to capture error banner
    await send('Runtime.evaluate', {
      expression: `(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
      })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const ssAssigned = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'assigned_policy_delete_validation.png'), Buffer.from(ssAssigned.data, 'base64'));
    console.log('✓ Captured assigned_policy_delete_validation.png');

    // 5. Test deleting the UNASSIGNED policy "Volunteer Leave 7369"
    console.log('5. Testing deletion of unassigned policy "Volunteer Leave 7369"...');
    // Scroll down to find Volunteer Leave
    await send('Runtime.evaluate', {
      expression: `(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 600;
        const cards = Array.from(document.querySelectorAll('div')).filter(d => d.innerText && d.innerText.includes('Volunteer Leave'));
        const vlCard = cards[cards.length - 1];
        if (vlCard) {
          vlCard.scrollIntoView({ behavior: 'instant', block: 'center' });
          const trashBtn = vlCard.querySelector('button[title*="Delete"]');
          if (trashBtn) trashBtn.click();
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    // Capture confirm dialog screenshot
    const ssConfirm = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'delete_confirm_dialog.png'), Buffer.from(ssConfirm.data, 'base64'));
    console.log('✓ Captured delete_confirm_dialog.png');

    // Click confirm delete
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.innerText.includes('Delete Policy'));
        if (confirmBtn) confirmBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll top of main to capture success toast
    await send('Runtime.evaluate', {
      expression: `(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
      })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const ssDeleted = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'unassigned_policy_deleted_success.png'), Buffer.from(ssDeleted.data, 'base64'));
    console.log('✓ Captured unassigned_policy_deleted_success.png');

    // 6. Test Page Refresh
    console.log('6. Reloading page to verify persistence...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 500;
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    const checkTextRes = await send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('Volunteer Leave')`
    });
    console.log('Does Volunteer Leave appear after refresh?:', checkTextRes.result?.value);

    const ssRefreshed = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'page_refreshed_policy_gone.png'), Buffer.from(ssRefreshed.data, 'base64'));
    console.log('✓ Captured page_refreshed_policy_gone.png');

    ws.close();
  } finally {
    chromeProc.kill();
  }
  console.log('--- UI Delete Flow Verification Finished ---');
}

testUIDeleteFlow().catch(err => {
  console.error('UI Test Error:', err);
  process.exit(1);
});
