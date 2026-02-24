# ลง GitHub + Deploy บน Vercel

## 1. สร้าง Repo บน GitHub

1. ไปที่ [github.com/new](https://github.com/new)
2. ตั้งชื่อ repo (เช่น `medjob-duty`)
3. เลือก Public แล้วกด **Create repository**

---

## 2. Push โปรเจกต์ขึ้น GitHub

เปิด Terminal ในโฟลเดอร์โปรเจกต์ (MEDJOB) แล้วรัน:

```powershell
cd "c:\Users\urare\OneDrive\Documents\MEDJOB"

# ถ้ายังไม่ได้ init git
git init

# เพิ่ม remote (แทน YOUR_USERNAME และ YOUR_REPO ด้วยของจริง)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# add และ commit (ไม่มี code.gs — เก็บใน .gitignore)
git add duty.html server.js package.json vercel.json .env.example .gitignore scripts/ DEPLOY.md APPS_SCRIPT_DEPLOY.md
git commit -m "Add duty roster app + Vercel config"

# push (สาขา main หรือ master)
git branch -M main
git push -u origin main
```

**หมายเหตุ:** ไฟล์ `.env` ไม่ถูก push (อยู่ใน .gitignore) — ต้องไปตั้งค่าใน Vercel แทน

---

## 3. Deploy บน Vercel

1. ไปที่ [vercel.com](https://vercel.com) แล้วล็อกอิน (ใช้ GitHub ได้)
2. กด **Add New** → **Project**
3. **Import** repo ที่ push ไว้จาก GitHub
4. ตั้งค่าโปรเจกต์:
   - **Framework Preset:** Other
   - **Root Directory:** (เว้นว่าง)
   - กด **Deploy** ได้เลย

---

## 4. ตั้งค่า Environment Variable บน Vercel

หลัง deploy เสร็จ:

1. เปิด **Project** → แท็บ **Settings** → **Environment Variables**
2. เพิ่มตัวแปร:
   - **Name:** `APPS_SCRIPT_URL`
   - **Value:** ใส่ URL ของ Google Apps Script Web App (ค่าเดียวกับใน .env)
3. กด **Save**
4. ไปที่ **Deployments** → กด **⋯** ที่ deployment ล่าสุด → **Redeploy** เพื่อให้ใช้ค่า env ใหม่

---

## 5. เปิดใช้เว็บ

หลัง redeploy เสร็จ เปิดลิงก์ที่ Vercel ให้ (เช่น `https://medjob-duty.vercel.app`) จะได้หน้า **ระบบถามเวร** ที่ใช้ URL จาก Environment Variable แล้ว

---

## สรุป

| ขั้นตอน | ทำอะไร |
|--------|--------|
| GitHub | สร้าง repo แล้ว push โค้ด (ไม่มี .env) |
| Vercel | Import repo → Deploy |
| Vercel Env | ตั้งค่า `APPS_SCRIPT_URL` แล้ว Redeploy |

แก้โค้ดแล้ว push ขึ้น GitHub ใหม่ Vercel จะ deploy ใหม่ให้อัตโนมัติ (ถ้าเชื่อม GitHub ไว้)
