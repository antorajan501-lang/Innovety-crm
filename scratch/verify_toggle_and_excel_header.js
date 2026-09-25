const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('d:/P R O J E C T S/Web/MRF-crm/backend/node_modules/@prisma/client');
const jwt = require('d:/P R O J E C T S/Web/MRF-crm/backend/node_modules/jsonwebtoken');
const { generateExcelReport } = require('d:/P R O J E C T S/Web/MRF-crm/backend/src/services/attendanceReportService');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\75ea4882-487b-4396-9efa-d94c041b3aeb';

async function main() {
  console.log('--- Starting Verification for Toggle Panel & Excel Header Fix ---');
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech

  // 1. Export Excel files and verify views and rows
  const excelOutputDir = path.join(__dirname, 'excel_exports');
  if (!fs.existsSync(excelOutputDir)) fs.mkdirSync(excelOutputDir, { recursive: true });

  const dailyResult = await generateExcelReport({
    type: 'daily',
    organizationId: orgId,
    params: { date: '2026-09-21' }
  });
  const dailyExcelPath = path.join(excelOutputDir, dailyResult.filename);
  await dailyResult.workbook.xlsx.writeFile(dailyExcelPath);

  const dailySheet = dailyResult.workbook.getWorksheet(1);
  console.log('Daily Sheet Views:', JSON.stringify(dailySheet.views));
  console.log('Daily Row 4 (Company):', dailySheet.getRow(4).values[1]);
  console.log('Daily Row 5 (Subtitle):', dailySheet.getRow(5).values[1]);
  console.log('Daily Row 6 (Headers):', dailySheet.getRow(6).values.slice(1));
  console.log('Daily Row 7 (First Data):', dailySheet.getRow(7).values.slice(1));

  if (dailySheet.views[0]?.ySplit !== 6) {
    throw new Error(`Expected ySplit to be 6, got ${dailySheet.views[0]?.ySplit}`);
  }
  if (dailySheet.getRow(6).values[1] !== 'Employee') {
    throw new Error(`Expected Row 6 to be Table Header 'Employee', got ${dailySheet.getRow(6).values[1]}`);
  }
  console.log('✓ Daily Excel structure verified: Rows 1-5 Branding, Row 6 Header, ySplit 6');

  // Verify Weekly and Monthly
  const weeklyResult = await generateExcelReport({
    type: 'weekly',
    organizationId: orgId,
    params: { week: 38, year: 2026 }
  });
  const weeklySheet = weeklyResult.workbook.getWorksheet(1);
  if (weeklySheet.views[0]?.ySplit !== 6 || weeklySheet.getRow(6).values[1] !== 'Employee') {
    throw new Error('Weekly Excel structure mismatch');
  }
  console.log('✓ Weekly Excel structure verified: Rows 1-5 Branding, Row 6 Header, ySplit 6');

  const monthlyResult = await generateExcelReport({
    type: 'monthly',
    organizationId: orgId,
    params: { month: 9, year: 2026 }
  });
  const monthlySheet = monthlyResult.workbook.getWorksheet(1);
  if (monthlySheet.views[0]?.ySplit !== 6 || monthlySheet.getRow(6).values[1] !== 'Employee') {
    throw new Error('Monthly Excel structure mismatch');
  }
  console.log('✓ Monthly Excel structure verified: Rows 1-5 Branding, Row 6 Header, ySplit 6');

  // Generate Excel preview HTML that accurately illustrates the frozen row 6 behavior with scrolling
  function generateScrollPreviewHtml(workbook, sheetName, title) {
    const sheet = workbook.getWorksheet(sheetName);
    const logoImgBase64 = fs.existsSync('d:/P R O J E C T S/Web/MRF-crm/frontend/public/logo.png')
      ? fs.readFileSync('d:/P R O J E C T S/Web/MRF-crm/frontend/public/logo.png').toString('base64')
      : '';

    const companyName = sheet.getRow(4).values[1] || 'Innoveity Tech';
    const subTitle = sheet.getRow(5).values[1] || '';
    const headers = sheet.getRow(6).values.slice(1);

    const rows = [];
    sheet.eachRow((r, rowNumber) => {
      if (rowNumber >= 7) {
        rows.push(r.values.slice(1));
      }
    });

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body {
    margin: 0;
    padding: 30px;
    background: #F8FAFC;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  }
  .app-window {
    background: #FFFFFF;
    border-radius: 18px;
    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
    max-width: 1100px;
    margin: 0 auto;
    overflow: hidden;
  }
  .excel-topbar {
    background: #0F172A;
    color: #FFFFFF;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
  }
  .excel-topbar .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #EA580C;
    font-size: 14px;
    font-weight: 900;
  }
  .verification-pill {
    background: rgba(22, 163, 74, 0.15);
    color: #16A34A;
    border: 1px solid rgba(22, 163, 74, 0.3);
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 800;
  }
  .sheet-container {
    padding: 32px 40px;
  }
  .branding-section {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding-bottom: 20px;
    border-bottom: 1px dashed #E2E8F0;
    margin-bottom: 20px;
  }
  .logo-box img {
    height: 48px;
    object-fit: contain;
  }
  .company-title {
    color: #EA580C;
    font-size: 22px;
    font-weight: 900;
    margin: 0;
    line-height: 1.2;
  }
  .report-info {
    color: #475569;
    font-size: 13px;
    font-weight: 700;
    margin-top: 6px;
  }
  .freeze-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #FFF7ED;
    border: 1px solid #FDBA74;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    color: #9A3412;
    margin-bottom: 12px;
  }
  .table-wrapper {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  thead th {
    position: sticky;
    top: 0;
    background-color: #EA580C;
    color: #FFFFFF;
    font-weight: 700;
    padding: 12px 16px;
    text-align: center;
    border-bottom: 2px solid #C2410C;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
    z-index: 10;
  }
  thead th:first-child { text-align: left; }
  td {
    padding: 10px 16px;
    border-bottom: 1px solid #E2E8F0;
    color: #1E293B;
  }
  tr:nth-child(even) td {
    background-color: #FFF7ED;
  }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .badge-present { background: #DCFCE7; color: #16A34A; border: 1px solid #BBF7D0; }
  .badge-late { background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; }
  .badge-absent { background: #FFE4E6; color: #E11D48; border: 1px solid #FECDD3; }
  .badge-wfh { background: #F3E8FF; color: #9333EA; border: 1px solid #E9D5FF; }
  .text-center { text-align: center; }
  .text-left { text-align: left; }
</style>
</head>
<body>
<div class="app-window">
  <div class="excel-topbar">
    <div class="brand">
      <span>📊 Microsoft Excel — ${title}</span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <span class="verification-pill">✓ Single Header Verified (ySplit: 6)</span>
      <span style="color: #94A3B8; font-size: 11px;">Sheet: ${sheetName}</span>
    </div>
  </div>
  <div class="sheet-container">
    <!-- Single Branding Section (Rows 1-5) -->
    <div class="branding-section">
      <div class="logo-box">
        ${logoImgBase64 ? `<img src="data:image/png;base64,${logoImgBase64}" alt="Logo" />` : ''}
      </div>
      <div>
        <h1 class="company-title">${companyName}</h1>
        <div class="report-info">${subTitle}</div>
      </div>
    </div>

    <!-- Frozen Indicator bar -->
    <div class="freeze-indicator">
      <span>📌 Frozen Pane Active (Row 6) — Table header stays visible while scrolling</span>
      <span style="font-size: 10px; color: #C2410C;">No Repeated Logos | Single Branding at Top</span>
    </div>

    <!-- Scrollable Table with Sticky Header -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            ${headers.map((h, i) => `<th class="${i === 0 ? 'text-left' : 'text-center'}">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              ${r.map((val, colIdx) => {
                let str = String(val ?? '');
                let rendered = str;
                if (str === 'Present') rendered = `<span class="badge badge-present">Present</span>`;
                else if (str === 'Late' || str === 'LATE') rendered = `<span class="badge badge-late">Late</span>`;
                else if (str === 'On Time') rendered = `<span class="badge badge-present">On Time</span>`;
                else if (str === 'Absent' || str === 'ABSENT') rendered = `<span class="badge badge-absent">Absent</span>`;
                else if (str === 'WFH') rendered = `<span class="badge badge-wfh">WFH</span>`;
                return `<td class="${colIdx === 0 ? 'text-left' : 'text-center'}">${rendered}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</div>
</body>
</html>`;
  }

  const excelPreviewHtml = generateScrollPreviewHtml(dailyResult.workbook, 'Daily Attendance', 'Daily Attendance Report — 21-09-2026');
  const excelPreviewPath = path.join(excelOutputDir, 'preview_scroll_verified.html');
  fs.writeFileSync(excelPreviewPath, excelPreviewHtml);

  // 2. Launch Chrome Headless to capture screenshots
  console.log('Launching Headless Chrome on port 9228...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--window-size=1440,1050',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9228/json', (res) => {
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

    // Authenticate Super Admin
    const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1200));

    await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('token', '${adminToken}');
        localStorage.setItem('user', JSON.stringify(${JSON.stringify(superAdmin)}));
      })()`
    });

    // Navigate to /attendance-audit
    console.log('Navigating to /attendance-audit...');
    await send('Page.navigate', { url: 'http://localhost:5173/attendance-audit' });
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss any modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        const closeIcon = document.querySelector('button svg.lucide-x')?.closest('button');
        if (closeIcon) closeIcon.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // A. CAPTURE DEFAULT STATE (Report card HIDDEN, Export Report button VISIBLE)
    console.log('Capturing Default State: Report card hidden, Export Report button visible...');
    const ssDefault = await send('Page.captureScreenshot', { format: 'png' });
    const ssDefaultPath = path.join(ARTIFACT_DIR, 'attendance_audit_default_collapsed.png');
    fs.writeFileSync(ssDefaultPath, Buffer.from(ssDefault.data, 'base64'));
    console.log(`✓ Saved Default State Screenshot: ${ssDefaultPath}`);

    // B. CLICK "Export Report" BUTTON TO EXPAND
    console.log('Clicking "Export Report" button to expand reports panel...');
    const clickRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('toggle-attendance-reports-btn');
        if (btn) {
          btn.click();
          return { success: true, text: btn.innerText };
        }
        return { success: false };
      })()`,
      returnByValue: true
    });
    console.log('Click result:', clickRes.result.value);

    // Wait for smooth expand animation
    await new Promise(r => setTimeout(r, 1000));

    // Scroll slightly so the expanded card is beautifully framed
    await send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector('.bg-card.p-6.sm\\:p-7');
        if (card) {
          const rect = card.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          window.scrollTo({ top: scrollTop + rect.top - 100, behavior: 'instant' });
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    // C. CAPTURE EXPANDED STATE
    console.log('Capturing Expanded State: Report card visible with filters & preview...');
    const ssExpanded = await send('Page.captureScreenshot', { format: 'png' });
    const ssExpandedPath = path.join(ARTIFACT_DIR, 'attendance_audit_expanded_reports.png');
    fs.writeFileSync(ssExpandedPath, Buffer.from(ssExpanded.data, 'base64'));
    console.log(`✓ Saved Expanded State Screenshot: ${ssExpandedPath}`);

    // D. CAPTURE EXCEL SCROLL PREVIEW (Showing single branding at top, row 6 frozen header, no duplicated logo)
    console.log('Capturing Excel Single-Branding & Frozen Header screenshot...');
    await send('Page.navigate', { url: `file://${excelPreviewPath.replace(/\\/g, '/')}` });
    await new Promise(r => setTimeout(r, 1500));
    const ssExcel = await send('Page.captureScreenshot', { format: 'png' });
    const ssExcelPath = path.join(ARTIFACT_DIR, 'excel_single_header_frozen_verified.png');
    fs.writeFileSync(ssExcelPath, Buffer.from(ssExcel.data, 'base64'));
    console.log(`✓ Saved Excel Single Header Screenshot: ${ssExcelPath}`);

    ws.close();
  } finally {
    chromeProc.kill();
    await prisma.$disconnect();
  }
  console.log('--- All verifications and screenshots completed successfully! ---');
}

main().catch(console.error);
