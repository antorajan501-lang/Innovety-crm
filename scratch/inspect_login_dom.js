const { execSync } = require('child_process');
const fs = require('fs');

const cmd = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless=new --disable-gpu --virtual-time-budget=2000 --dump-dom http://localhost:5173/login';
const html = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const buttonMatch = html.match(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/i);
console.log('--- BUTTON ---');
console.log(buttonMatch ? buttonMatch[0].substring(0, 300) : 'Not found');

const headingMatch = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
console.log('--- HEADING ---');
console.log(headingMatch ? headingMatch[0] : 'Not found');

const styleMatch = html.match(/<style>[\s\S]*?<\/style>/i);
console.log('--- STYLE ---');
console.log(styleMatch ? styleMatch[0].substring(0, 300) : 'Not found');
