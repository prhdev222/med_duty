/**
 * Build-time: สร้าง index.html จาก duty.html โดยแทนที่ __APPS_SCRIPT_URL__
 * ใช้กับ Vercel — ตั้ง APPS_SCRIPT_URL ใน Vercel Environment Variables
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'duty.html');
const outDir = path.join(root, 'out');
const dest = path.join(outDir, 'index.html');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const url = (process.env.APPS_SCRIPT_URL || process.env.APPS_SCRIPT_WEB_APP_URL || '').trim() || '__APPS_SCRIPT_URL__';

let html = fs.readFileSync(src, 'utf8');
html = html.replace(
  /const\s+APPS_SCRIPT_URL\s*=\s*['"]__APPS_SCRIPT_URL__['"]\s*;/,
  'const APPS_SCRIPT_URL = ' + JSON.stringify(url) + ';'
);
fs.writeFileSync(dest, html, 'utf8');
console.log('Wrote out/index.html with APPS_SCRIPT_URL from env');
