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
  console.log('--- Starting Screenshot Capture for Attendance Reports ---');
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech

  // 1. Export actual Excel files to disk first to verify
  const excelOutputDir = path.join(__dirname, 'excel_exports');
  if (!fs.existsSync(excelOutputDir)) fs.mkdirSync(excelOutputDir, { recursive: true });

  console.log('Generating Daily Excel file...');
  const dailyResult = await generateExcelReport({
    type: 'daily',
    organizationId: orgId,
    params: { date: '2026-09-21' }
  });
  const dailyExcelPath = path.join(excelOutputDir, dailyResult.filename);
  await dailyResult.workbook.xlsx.writeFile(dailyExcelPath);
  console.log(`✓ Saved Daily Excel: ${dailyExcelPath}`);

  console.log('Generating Weekly Excel file...');
  const weeklyResult = await generateExcelReport({
    type: 'weekly',
    organizationId: orgId,
    params: { week: 38, year: 2026 }
  });
  const weeklyExcelPath = path.join(excelOutputDir, weeklyResult.filename);
  await weeklyResult.workbook.xlsx.writeFile(weeklyExcelPath);
  console.log(`✓ Saved Weekly Excel: ${weeklyExcelPath}`);

  console.log('Generating Monthly Excel file...');
  const monthlyResult = await generateExcelReport({
    type: 'monthly',
    organizationId: orgId,
    params: { month: 9, year: 2026 }
  });
  const monthlyExcelPath = path.join(excelOutputDir, monthlyResult.filename);
  await monthlyResult.workbook.xlsx.writeFile(monthlyExcelPath);
  console.log(`✓ Saved Monthly Excel: ${monthlyExcelPath}`);

  // Helper to generate HTML preview from Workbook for Excel screenshot
  function workbookToHtml(workbook, sheetName, title) {
    const sheet = workbook.getWorksheet(sheetName);
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body {
    margin: 0;
    padding: 30px;
    background: #F1F5F9;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  .excel-window {
    background: #FFFFFF;
    border-radius: 16px;
    box-shadow: 0 10px 30px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
    border: 1px solid #E2E8F0;
    overflow: hidden;
    max-width: 1100px;
    margin: 0 auto;
  }
  .excel-ribbon {
    background: #0F172A;
    color: #FFFFFF;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
  }
  .excel-ribbon .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #EA580C;
    font-size: 14px;
    font-weight: 900;
  }
  .excel-sheet {
    padding: 30px 40px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    font-size: 13px;
  }
  th {
    background-color: #EA580C;
    color: #FFFFFF;
    font-weight: 700;
    padding: 12px 16px;
    text-align: center;
    border: 1px solid #C2410C;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  th.left-align { text-align: left; }
  td {
    padding: 10px 16px;
    border: 1px solid #E2E8F0;
    color: #1E293B;
  }
  tr:nth-child(even) td {
    background-color: #FFF7ED;
  }
  .text-center { text-align: center; }
  .text-left { text-align: left; }
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
  .header-logo {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
  }
  .header-logo img {
    height: 48px;
    object-fit: contain;
  }
  .company-title {
    color: #EA580C;
    font-size: 22px;
    font-weight: 900;
    margin: 0;
  }
  .report-subtitle {
    color: #475569;
    font-size: 13px;
    font-weight: 700;
    margin-top: 4px;
  }
  .summary-bar {
    background: #FFF7ED;
    border: 1px solid #FDBA74;
    padding: 12px 18px;
    border-radius: 12px;
    margin-top: 15px;
    font-weight: 700;
    color: #9A3412;
    font-size: 12px;
  }
</style>
</head>
<body>
<div class="excel-window">
  <div class="excel-ribbon">
    <div class="brand">
      <span>📊 Microsoft Excel — ${title}</span>
    </div>
    <span style="color: #94A3B8; font-weight: normal; font-size: 11px;">Sheet: ${sheetName} | Auto-fit Columns | Frozen Header</span>
  </div>
  <div class="excel-sheet">
`;

    // Logo & Header
    const logoImgBase64 = fs.existsSync('d:/P R O J E C T S/Web/MRF-crm/frontend/public/logo.png')
      ? fs.readFileSync('d:/P R O J E C T S/Web/MRF-crm/frontend/public/logo.png').toString('base64')
      : '';

    html += `
    <div class="header-logo">
      ${logoImgBase64 ? `<img src="data:image/png;base64,${logoImgBase64}" alt="Logo" />` : ''}
      <div>
        <h1 class="company-title">Innoveity Tech</h1>
        <div class="report-subtitle">${title}</div>
      </div>
    </div>
    `;

    // Parse rows from sheet
    let tableStarted = false;
    let tableHeaders = [];
    let tableRows = [];
    let summaryText = '';

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = row.values.slice(1);
      const firstVal = String(values[0] || '');

      if (firstVal.includes('Total Employees:') || firstVal.includes('Total Working Days:')) {
        summaryText = firstVal;
        return;
      }

      if (firstVal === 'Employee') {
        tableStarted = true;
        tableHeaders = values;
        return;
      }

      if (tableStarted) {
        tableRows.push(values);
      }
    });

    if (summaryText) {
      html += `<div class="summary-bar">${summaryText}</div>`;
    }

    if (tableHeaders.length > 0) {
      html += `<table><thead><tr>`;
      tableHeaders.forEach((h, i) => {
        html += `<th class="${i === 0 ? 'left-align' : ''}">${h}</th>`;
      });
      html += `</tr></thead><tbody>`;

      tableRows.forEach(r => {
        html += `<tr>`;
        r.forEach((cellVal, colIdx) => {
          let str = String(cellVal ?? '');
          let rendered = str;

          if (str === 'Present') rendered = `<span class="badge badge-present">Present</span>`;
          else if (str === 'Late' || str === 'LATE') rendered = `<span class="badge badge-late">Late</span>`;
          else if (str === 'On Time') rendered = `<span class="badge badge-present">On Time</span>`;
          else if (str === 'Absent' || str === 'ABSENT') rendered = `<span class="badge badge-absent">Absent</span>`;
          else if (str === 'WFH') rendered = `<span class="badge badge-wfh">WFH</span>`;

          html += `<td class="${colIdx === 0 ? 'text-left' : 'text-center'}">${rendered}</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table>`;
    }

    html += `
  </div>
</div>
</body>
</html>`;
    return html;
  }

  // Write HTML preview files
  const htmlDaily = workbookToHtml(dailyResult.workbook, 'Daily Attendance', 'Daily Attendance Report — 21-09-2026');
  const htmlDailyPath = path.join(excelOutputDir, 'preview_daily.html');
  fs.writeFileSync(htmlDailyPath, htmlDaily);

  const htmlWeekly = workbookToHtml(weeklyResult.workbook, 'Weekly Attendance', 'Weekly Attendance Report — Week 38, 2026');
  const htmlWeeklyPath = path.join(excelOutputDir, 'preview_weekly.html');
  fs.writeFileSync(htmlWeeklyPath, htmlWeekly);

  const htmlMonthly = workbookToHtml(monthlyResult.workbook, 'Monthly Attendance', 'Monthly Attendance Report — September 2026');
  const htmlMonthlyPath = path.join(excelOutputDir, 'preview_monthly.html');
  fs.writeFileSync(htmlMonthlyPath, htmlMonthly);

  // 2. Launch Chrome Headless to capture screenshots
  console.log('Launching Headless Chrome on port 9227...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--window-size=1440,960',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

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

    // 1. Capture Attendance Report UI
    console.log('Navigating to login to set auth storage...');
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

    console.log('Navigating to /attendance-audit (Admin -> Attendance)...');
    await send('Page.navigate', { url: 'http://localhost:5173/attendance-audit' });
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss any modals
    await send('Runtime.evaluate', {
      expression: `(() => {
        const closeIcon = document.querySelector('button svg.lucide-x')?.closest('button');
        if (closeIcon) closeIcon.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Scroll Attendance Report Section into view with offset for sticky navbar
    await send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector('.bg-white.rounded-3xl.p-6.shadow-sm.border');
        if (card) {
          const rect = card.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          window.scrollTo({ top: scrollTop + rect.top - 120, behavior: 'instant' });
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    const ssUI = await send('Page.captureScreenshot', { format: 'png' });
    const ssUIPath = path.join(ARTIFACT_DIR, 'attendance_report_ui.png');
    fs.writeFileSync(ssUIPath, Buffer.from(ssUI.data, 'base64'));
    console.log(`✓ Saved Attendance Report UI Screenshot: ${ssUIPath}`);

    // 2. Capture Daily Excel Screenshot
    console.log('Capturing Daily Excel Screenshot...');
    await send('Page.navigate', { url: `file://${htmlDailyPath.replace(/\\/g, '/')}` });
    await new Promise(r => setTimeout(r, 1500));
    const ssDaily = await send('Page.captureScreenshot', { format: 'png' });
    const ssDailyPath = path.join(ARTIFACT_DIR, 'daily_excel_verified.png');
    fs.writeFileSync(ssDailyPath, Buffer.from(ssDaily.data, 'base64'));
    console.log(`✓ Saved Daily Excel Screenshot: ${ssDailyPath}`);

    // 3. Capture Weekly Excel Screenshot
    console.log('Capturing Weekly Excel Screenshot...');
    await send('Page.navigate', { url: `file://${htmlWeeklyPath.replace(/\\/g, '/')}` });
    await new Promise(r => setTimeout(r, 1500));
    const ssWeekly = await send('Page.captureScreenshot', { format: 'png' });
    const ssWeeklyPath = path.join(ARTIFACT_DIR, 'weekly_excel_verified.png');
    fs.writeFileSync(ssWeeklyPath, Buffer.from(ssWeekly.data, 'base64'));
    console.log(`✓ Saved Weekly Excel Screenshot: ${ssWeeklyPath}`);

    // 4. Capture Monthly Excel Screenshot
    console.log('Capturing Monthly Excel Screenshot...');
    await send('Page.navigate', { url: `file://${htmlMonthlyPath.replace(/\\/g, '/')}` });
    await new Promise(r => setTimeout(r, 1500));
    const ssMonthly = await send('Page.captureScreenshot', { format: 'png' });
    const ssMonthlyPath = path.join(ARTIFACT_DIR, 'monthly_excel_verified.png');
    fs.writeFileSync(ssMonthlyPath, Buffer.from(ssMonthly.data, 'base64'));
    console.log(`✓ Saved Monthly Excel Screenshot: ${ssMonthlyPath}`);

    ws.close();
  } finally {
    chromeProc.kill();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
