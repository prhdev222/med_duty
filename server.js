/**
 * เซิร์ฟเวอร์เล็กสำหรับระบบถามเวร
 * อ่าน APPS_SCRIPT_URL จาก .env แล้วแทนที่ __APPS_SCRIPT_URL__ ใน duty.html
 */
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });

// อ่าน URL จาก env (รองรับ APPS_SCRIPT_URL และ APPS_SCRIPT_WEB_APP_URL)
let ENV_URL = (process.env.APPS_SCRIPT_URL || process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();
if (!ENV_URL) {
  try {
    let raw = fs.readFileSync(envPath, 'utf8');
    raw = raw.replace(/^\uFEFF/, ''); // ลบ BOM
    const line = raw.split(/\r?\n/).find(l => /^\s*(APPS_SCRIPT_URL|APPS_SCRIPT_WEB_APP_URL)\s*=/.test(l));
    if (line) {
      let val = line.replace(/^[^=]+=/, '').replace(/\s*#.*$/, '').trim().replace(/^["']|["']$/g, '');
      if (val) ENV_URL = val;
    }
  } catch (e) { /* ignore */ }
}

const http = require('http');

const PORT = process.env.PORT || 3780;

const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webp':'image/webp' };

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/duty.html') {
    const filePath = path.join(__dirname, 'duty.html');
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ไม่พบไฟล์ duty.html');
        return;
      }
      const url = ENV_URL || '__APPS_SCRIPT_URL__';
      const placeholder = /const\s+APPS_SCRIPT_URL\s*=\s*['"]__APPS_SCRIPT_URL__['"]\s*;/;
      const injected = html.replace(placeholder, 'const APPS_SCRIPT_URL = ' + JSON.stringify(url) + ';');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(injected);
    });
    return;
  }

  if (req.url.startsWith('/images/')) {
    const filePath = path.join(__dirname, req.url);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`🩺 ระบบถามเวร: http://localhost:${PORT}`);
  if (ENV_URL) {
    console.log('✅ โหลด APPS_SCRIPT_URL จาก .env แล้ว');
  } else {
    console.warn('⚠️  ไม่พบ APPS_SCRIPT_URL ใน .env — จะใช้โหมด demo');
    console.warn('   ตรวจสอบ: ไฟล์ .env มีบรรทัด APPS_SCRIPT_URL=https://script.google.com/...');
  }
});
