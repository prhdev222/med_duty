/**
 * Vercel Serverless Function — เสิร์ฟ duty.html และใส่ URL จาก Environment Variable
 * ตั้งค่า APPS_SCRIPT_WEB_APP_URL ใน Vercel Project Settings
 */
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const url = (process.env.APPS_SCRIPT_WEB_APP_URL || '').trim() || 'YOUR_APPS_SCRIPT_WEB_APP_URL';
  // โฟลเดอร์ api/ อยู่ระดับเดียวกับ duty.html → อ่านจาก parent ของ __dirname
  const filePath = path.join(__dirname, '..', 'duty.html');

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
