/**
 * Vercel Serverless Function — เสิร์ฟ duty.html และใส่ URL จาก Environment Variable
 * ตั้งค่า APPS_SCRIPT_WEB_APP_URL ใน Vercel Project Settings
 */
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const url = (process.env.APPS_SCRIPT_WEB_APP_URL || '').trim() || 'YOUR_APPS_SCRIPT_WEB_APP_URL';
  const filePath = path.join(process.cwd(), 'duty.html');

  try {
    let html = fs.readFileSync(filePath, 'utf8');
    const placeholder = /const\s+APPS_SCRIPT_URL\s*=\s*['"]__APPS_SCRIPT_URL__['"]\s*;/;
    html = html.replace(placeholder, 'const APPS_SCRIPT_URL = ' + JSON.stringify(url) + ';');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(html);
  } catch (err) {
    res.status(500).send('ไม่พบไฟล์ duty.html');
  }
};
