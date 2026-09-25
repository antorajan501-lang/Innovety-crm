const { execSync } = require('child_process');

const script = `
const btn = document.querySelector('button[type="submit"]');
const cs = window.getComputedStyle(btn);
console.log('COMPUTED_BG:' + cs.backgroundColor);
console.log('COMPUTED_COLOR:' + cs.color);
console.log('BUTTON_HTML:' + btn.outerHTML);
`;

// Let's create an html file that tests this or use Chrome DevTools Protocol / evaluation
console.log('Testing computed style...');
