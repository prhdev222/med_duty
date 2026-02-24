# Deploy code.gs ขึ้น Google Apps Script

## มี 2 ไฟล์ — ใช้ไฟล์ไหน?

| ไฟล์ | เวอร์ชัน | ใช้เมื่อ |
|------|----------|----------|
| **code.gs** (ในโฟลเดอร์ MEDJOB) | V3 | ใช้กับ duty.html แบบถามเวรธรรมดา (ไม่มีปุ่ม Login / Wizard แลกเวร) |
| **.vercel/code.gs** | V4 | ใช้กับ duty.html แบบมี Login + ปุ่ม 🔄 แลกเวร (Wizard 5 ขั้น) |

ตอนนี้ **duty.html ใช้แบบ V4** (มี Login + แลกเวร) → ให้ **copy เนื้อหาทั้งหมดจาก `.vercel/code.gs`** ไปวางใน Google Apps Script

---

## ทำไมยังเห็น error "openById" อยู่?

ข้อความ **"Unexpected error while getting the method or property openById..."** ยังโผล่เพราะ **Web App บน Google ยังรันโค้ดชุดเก่า** ที่ยังไม่ได้แก้

**ต้องทำ:** อัปเดตโค้ดใน Google Apps Script แล้ว **Deploy ใหม่**

1. เปิด [Google Apps Script](https://script.google.com) → เปิดโปรเจกต์ที่ใช้กับระบบถามเวร
2. ลบหรือแทนที่เนื้อหาในไฟล์ `Code.gs` ด้วยเนื้อหาจากไฟล์ที่เลือกด้านบน:
   - ถ้าใช้หน้าเว็บแบบมี Login + แลกเวร: ใช้ **.vercel/code.gs**
   - ถ้าใช้หน้าเว็บแบบถามอย่างเดียว: ใช้ **code.gs** (ในโฟลเดอร์ MEDJOB)
3. **แก้ SPREADSHEET_ID** ในบรรทัดต้นไฟล์ ให้เป็น ID ของ Google Sheet จริง (จาก URL ของ Sheet)
4. บันทึก (Ctrl+S) แล้วไปที่ **Deploy** → **Manage deployments** → **แก้** (ดินสอ) → **Version** เลือก **New version** → **Deploy**
5. ไม่ต้องเปลี่ยน URL ก็ได้ (ใช้ของเดิมได้) แล้วลองเปิด localhost / เว็บอีกรอบ

หลัง deploy ใหม่ ถ้าเปิด Sheet ไม่ได้จะเห็นข้อความภาษาไทยแทน:

**"ไม่สามารถเปิด Google Sheet ได้ — กรุณาตรวจสอบ SPREADSHEET_ID ใน code.gs และสิทธิ์การแชร์ Sheet ให้บัญชีที่ deploy Web App"**

และต้องแก้ **SPREADSHEET_ID** กับ **สิทธิ์แชร์ Sheet** ตามข้อความนั้นจนเปิด Sheet ได้
