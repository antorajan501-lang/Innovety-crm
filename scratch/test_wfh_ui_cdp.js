const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testWfhUI() {
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
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/super-admin/leave-policy';
      }
    })()`
  });

  // Wait for /super-admin/leave-policy to fully render
  console.log('Waiting for leave policy cards...');
  for (let i = 0; i < 30; i++) {
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        return text.includes('Leave Types') && text.includes('WFH');
      })()`,
      returnByValue: true
    });
    if (check.result?.value === true) {
      console.log('Leave Policy cards loaded!');
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Scroll down slightly so the leave types section is clearly centered in view
  await send('Runtime.evaluate', {
    expression: `window.scrollBy(0, 350)`
  });
  await new Promise(r => setTimeout(r, 500));

  const pageData = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.rounded-3xl.border')).map(card => {
        const title = card.querySelector('h3')?.textContent;
        const code = card.querySelector('.font-mono')?.textContent;
        const badges = Array.from(card.querySelectorAll('span')).map(s => s.textContent.trim());
        const hasSystemBadge = badges.some(b => b.includes('System'));
        const deleteBtn = card.querySelector('button[title*="Delete"]');
        const deleteDisabled = deleteBtn?.disabled || false;
        const text = card.innerText;
        return {
          title,
          code,
          hasSystemBadge,
          deleteDisabled,
          text: text.replace(/\\n+/g, ' | ')
        };
      }).filter(c => c.title);

      return {
        url: window.location.pathname,
        cards
      };
    })()`,
    returnByValue: true
  });

  console.log('UI Leave Policy Cards:\n', JSON.stringify(pageData.result?.value, null, 2));

  // Wait for rendering to settle
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot of Leave Policy page
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.data) {
    fs.writeFileSync('C:/Users/Luffy/.gemini/antigravity-ide/brain/5152619e-02b8-493f-9022-61e8862f9ed2/wfh_leave_policy_ui.png', Buffer.from(screenshotRes.data, 'base64'));
    console.log('Saved wfh_leave_policy_ui.png successfully!');
  }

  // Now click Edit on WFH to test the modal values
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.rounded-3xl.border'));
      const wfhCard = cards.find(c => {
        const mono = c.querySelector('.font-mono');
        return mono && mono.textContent.trim() === 'WFH';
      });
      if (wfhCard) {
        const editBtn = wfhCard.querySelector('button[title*="Edit"]');
        if (editBtn) {
          editBtn.click();
          return 'clicked edit button';
        }
        return 'no edit button';
      }
      return 'no wfhCard';
    })()`,
    returnByValue: true
  });
  console.log('Edit Click Result:', clickRes.result?.value);

  await new Promise(r => setTimeout(r, 1000));

  const modalCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return {
        hasFixedModal: !!document.querySelector('.fixed.inset-0'),
        bodyTextSnippet: document.body.innerText.slice(0, 500),
        allInputs: inputs.map(i => ({ type: i.type, name: i.name, value: i.value, step: i.step, placeholder: i.placeholder }))
      };
    })()`,
    returnByValue: true
  });

  console.log('Modal Check after click:\n', JSON.stringify(modalCheck.result?.value, null, 2));

  // Take screenshot of Edit modal
  const modalScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  if (modalScreenshot?.data) {
    fs.writeFileSync('C:/Users/Luffy/.gemini/antigravity-ide/brain/5152619e-02b8-493f-9022-61e8862f9ed2/wfh_edit_modal_ui.png', Buffer.from(modalScreenshot.data, 'base64'));
    console.log('Saved wfh_edit_modal_ui.png successfully!');
  }

  ws.close();
  chromeProc.kill();
}

testWfhUI().catch(console.error);
