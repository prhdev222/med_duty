/**
 * Vercel Serverless Function — เสิร์ฟ duty.html และใส่ URL จาก Environment Variable
 * ตั้งค่า APPS_SCRIPT_WEB_APP_URL ใน Vercel Project Settings
 */
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const url = (process.env.APPS_SCRIPT_WEB_APP_URL || '').trim() || 'YOUR_APPS_SCRIPT_WEB_APP_URL';
  // ลองหลาย path (Vercel กับ local อาจต่างกัน)
  const candidates = [
    path.join(__dirname, '..', 'duty.html'),
    path.join(process.cwd(), 'duty.html'),
    path.join(__dirname, 'duty.html')
  ];
  let filePath = candidates.find(p => { try { fs.accessSync(p); return true; } catch { return false; } }) || candidates[0];

  try {
    let html = fs.readFileSync(filePath, 'utf8');
    const placeholder = /const\s+APPS_SCRIPT_URL\s*=\s*['"]__APPS_SCRIPT_URL__['"]\s*;/;
    html = html.replace(placeholder, 'const APPS_SCRIPT_URL = ' + JSON.stringify(url) + ';');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.status(200).end(html);
  } catch (err) {
    console.error('serve error:', err.message);
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8').end('ไม่พบไฟล์ duty.html: ' + err.message);
  }
};
