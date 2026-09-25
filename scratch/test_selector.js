const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\5152619e-02b8-493f-9022-61e8862f9ed2';

async function testSelector() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9226/json', (res) => {
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
    await new Promise(r => setTimeout(r, 800));

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
      })()`,
      awaitPromise: true
    });

    await send('Page.navigate', { url: 'http://localhost:5173/super-admin/leave-policy' });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll main
    await send('Runtime.evaluate', {
      expression: `document.querySelector('main').scrollTop = 500;`
    });
    await new Promise(r => setTimeout(r, 500));

    // 1. Test clicking delete on Casual Leave (assigned)
    console.log('Testing click on Casual Leave delete button...');
    const clickCL = await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button[title*="Delete"]'));
        const clBtn = btns.find(b => {
          const card = b.closest('.rounded-3xl');
          return card && card.innerText.includes('Casual Leave');
        });
        if (clBtn) {
          clBtn.click();
          return true;
        }
        return false;
      })()`
    });
    console.log('Clicked CL delete button:', clickCL.result?.value);
    await new Promise(r => setTimeout(r, 1000));

    // Check modal open
    const modalCheck = await send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('Delete Leave Policy')`
    });
    console.log('Is Delete Confirm Modal open?:', modalCheck.result?.value);

    // Confirm deletion
    const confirmClick = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Delete Policy'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()`
    });
    console.log('Clicked Delete Policy confirm button:', confirmClick.result?.value);
    await new Promise(r => setTimeout(r, 1500));

    // Check alert banner
    const alertBanner = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        return {
          hasAssignedError: text.includes('This leave policy is currently assigned to users'),
          fullText: text.slice(0, 1000)
        };
      })()`
    });
    console.log('Alert banner result:', alertBanner.result?.value?.hasAssignedError);

    // Scroll to top to capture screenshot
    await send('Runtime.evaluate', {
      expression: `document.querySelector('main').scrollTop = 0;`
    });
    await new Promise(r => setTimeout(r, 500));

    const ssAssigned = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'assigned_policy_delete_validation.png'), Buffer.from(ssAssigned.data, 'base64'));
    console.log('✓ Captured assigned_policy_delete_validation.png');

    // 2. Test clicking delete on Volunteer Leave (unassigned)
    console.log('\nTesting click on Volunteer Leave delete button...');
    await send('Runtime.evaluate', {
      expression: `document.querySelector('main').scrollTop = 600;`
    });
    await new Promise(r => setTimeout(r, 500));

    const clickVL = await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button[title*="Delete"]'));
        const vlBtn = btns.find(b => {
          const card = b.closest('.rounded-3xl');
          return card && card.innerText.includes('Volunteer Leave');
        });
        if (vlBtn) {
          vlBtn.click();
          return true;
        }
        return false;
      })()`
    });
    console.log('Clicked Volunteer Leave delete button:', clickVL.result?.value);
    await new Promise(r => setTimeout(r, 1000));

    // Capture modal screenshot
    const ssModal = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'delete_confirm_dialog.png'), Buffer.from(ssModal.data, 'base64'));
    console.log('✓ Captured delete_confirm_dialog.png');

    // Click confirm delete on Volunteer Leave
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Delete Policy'));
        if (btn) btn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Check if Volunteer Leave is removed from DOM immediately
    const immediateCheck = await send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('Volunteer Leave')`
    });
    console.log('Is Volunteer Leave still in DOM immediately?:', immediateCheck.result?.value);

    // Scroll to top of main to capture success banner
    await send('Runtime.evaluate', {
      expression: `document.querySelector('main').scrollTop = 0;`
    });
    await new Promise(r => setTimeout(r, 500));

    const ssDeleted = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'unassigned_policy_deleted_success.png'), Buffer.from(ssDeleted.data, 'base64'));
    console.log('✓ Captured unassigned_policy_deleted_success.png');

    // 3. Reload page to verify persistence
    console.log('\nReloading page to verify persistence...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `document.querySelector('main').scrollTop = 500;`
    });
    await new Promise(r => setTimeout(r, 500));

    const refreshCheck = await send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('Volunteer Leave')`
    });
    console.log('Is Volunteer Leave present after page refresh?:', refreshCheck.result?.value);

    const ssRefreshed = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'page_refreshed_policy_gone.png'), Buffer.from(ssRefreshed.data, 'base64'));
    console.log('✓ Captured page_refreshed_policy_gone.png');

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

testSelector().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
