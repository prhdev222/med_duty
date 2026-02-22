// ============================================================
// 📋 ระบบถามเวร V3 — พร้อมแลกเวรผ่าน Chat
// ============================================================
//
// ⭐ ใหม่ใน V3:
//   - แลกเวรผ่าน Chat → เขียนลง Sheet อัตโนมัติ
//   - มีระบบ Confirm ก่อนบันทึก
//   - ยกเลิกแลกเวรผ่าน Chat ได้
//   - บันทึก timestamp + "บันทึกโดย Chat"
//
// ============================================================

// ===================== CONFIG =====================
const SPREADSHEET_ID = '11pnUQklnGRHtdY32bUdP-2Lyed1XbgJ8prnQ3TTGUNE';
const HF_API_KEY = 'Yhf_pRoCosoJEQoLsbuepWEQoMHRXrpVvWMsId';
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

const SHEET = {
  ICU: 'เวร ICU',
  CONSULT_WEEKDAY: 'เวร Consult วันธรรมดา',
  CONSULT_WEEKEND: 'เวร Consult เสาร์-อาทิตย์',
  HOLIDAYS: 'วันหยุดพิเศษ',
  SWAP: 'แลกเวร'
};
// ==================================================

// =====================================================
// 📊 Sheet "แลกเวร" header (7 columns):
// วันที่ | ประเภทเวร | แพทย์เดิม | แพทย์แทน | เหตุผล | บันทึกโดย | เวลาบันทึก
// =====================================================


function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'ask';
    let result;

    switch (action) {
      case 'confirm_swap':
        result = executeSwap(data.swapData);
        break;
      case 'confirm_cancel':
        result = executeCancelSwap(data.cancelData);
        break;
      default:
        result = processQuestion(data.question);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Duty Roster API v3' }))
    .setMimeType(ContentService.MimeType.JSON);
}


// =====================================================
// 🧠 MAIN
// =====================================================

function processQuestion(question) {
  const q = question.toLowerCase().trim();

  // ⭐ คำขอแลกเวร
  if (isSwapRequest(q)) return parseSwapRequest(question);

  // ⭐ คำขอยกเลิกแลก
  if (isCancelSwapRequest(q)) return parseCancelSwapRequest(question);

  const targetDate = detectDate(q);
  const allPeople = getAllPeople();
  const targetPerson = detectPerson(q, allPeople);
  const targetType = detectDutyType(q);

  if (targetDate && !targetPerson) return r(getDutyForDate(targetDate, targetType));
  if (targetPerson && targetDate) return r(getPersonDutyOnDate(targetPerson, targetDate));
  if (targetPerson) return r(getPersonSchedule(targetPerson));
  if (q.includes('สัปดาห์') || q.includes('ทั้งหมด')) return r(getWeekSchedule());
  if (q.includes('icu') && (q.includes('เดือน') || !targetDate)) return r(getCurrentICU());
  if (q.includes('แลก') || q.includes('สลับ') || q.includes('swap')) return r(getSwapInfo(targetDate));
  if (q.includes('ใครเวร') || q.includes('เวรใคร') || q.includes('วันนี้')) return r(getDutyForDate(new Date(), null));

  return r(askHuggingFace(question));
}

function r(answer) { return { success: true, answer: answer }; }


// =====================================================
// ⭐ แลกเวรผ่าน Chat
// =====================================================

function isSwapRequest(q) {
  return ['ขอแลกเวร','แลกเวร','สลับเวร','ขอสลับ','เปลี่ยนเวร','ฝากเวร','ขอเปลี่ยน','ให้แทน','อยู่แทน','เวรแทน','ขอฝาก']
    .some(kw => q.includes(kw));
}

function isCancelSwapRequest(q) {
  return ['ยกเลิกแลก','ยกเลิกสลับ','ยกเลิกเปลี่ยน','ลบแลกเวร','ไม่แลกแล้ว']
    .some(kw => q.includes(kw));
}

function parseSwapRequest(question) {
  const q = question.toLowerCase();
  const allPeople = getAllPeople();

  let dutyType = q.includes('icu') ? 'ICU' : 'Consult';

  const targetDate = detectDate(q);
  if (!targetDate) {
    return r('⚠️ กรุณาระบุวันที่ค่ะ เช่น:\n"ขอแลกเวร Consult <b>วันที่ 5/3</b> หมอก้อง ให้หมอแอนแทน เหตุผลไปประชุม"');
  }

  // หาชื่อ 2 คน
  const foundPeople = allPeople.filter(name => q.includes(name.toLowerCase()));

  if (foundPeople.length < 2) {
    let msg = '⚠️ กรุณาระบุชื่อแพทย์ 2 คน (คนเดิม + คนแทน) ค่ะ\n\n';
    msg += '📝 ตัวอย่าง:\n"ขอแลกเวร Consult วันที่ 5/3 <b>หมอก้อง</b> ให้<b>หมอแอน</b>แทน เหตุผลไปประชุม"';
    if (allPeople.length > 0) msg += '\n\n👥 รายชื่อในระบบ: ' + allPeople.join(', ');
    return r(msg);
  }

  // หาคนแทนจาก "ให้ XXX แทน"
  let original = foundPeople[0];
  let replacement = foundPeople[1];
  const replaceMatch = question.match(/ให้\s*(.+?)\s*แทน/);
  if (replaceMatch) {
    for (const name of allPeople) {
      if (replaceMatch[1].includes(name)) {
        replacement = name;
        original = foundPeople.find(p => p !== replacement) || foundPeople[0];
        break;
      }
    }
  }

  // หาเหตุผล
  let reason = 'แลกเวร';
  for (const pattern of [/เหตุผล\s*[:：]?\s*(.+)/i, /เพราะ\s*(.+)/i, /เนื่องจาก\s*(.+)/i]) {
    const match = question.match(pattern);
    if (match) { reason = match[1].trim(); break; }
  }

  // เช็คซ้ำ
  const dateStr = formatDate(targetDate);
  const existing = checkSwap(dateStr, dutyType);
  if (existing) {
    return r(
      `⚠️ วันที่ ${formatDateThai(targetDate)} มีการแลกเวร ${dutyType} อยู่แล้วค่ะ\n\n` +
      `📋 ${existing.original} → ${existing.replacement} (${existing.reason})\n\n` +
      `ถ้าต้องการเปลี่ยน พิมพ์ "ยกเลิกแลกเวร ${dutyType} วันที่ ${targetDate.getDate()}/${targetDate.getMonth()+1}" ก่อนค่ะ`
    );
  }

  // ส่งกลับให้ confirm
  return {
    success: true,
    needConfirm: true,
    swapData: {
      date: dateStr,
      dateThai: formatDateThai(targetDate),
      dayName: getThaiDayName(targetDate),
      dutyType, original, replacement, reason
    },
    answer: `🔄 ยืนยันการแลกเวรนี้ไหมคะ?\n\n` +
      `<div class="duty-card">` +
      `<div class="duty-row"><span class="duty-label">📅 วันที่</span><span class="duty-name">${formatDateThai(targetDate)} (${getThaiDayName(targetDate)})</span></div>` +
      `<div class="duty-row"><span class="duty-label">📋 ประเภท</span><span class="duty-name">${dutyType}</span></div>` +
      `<div class="duty-row"><span class="duty-label">👤 เดิม</span><span class="duty-name">${original}</span></div>` +
      `<div class="duty-row"><span class="duty-label">🔄 แทนโดย</span><span class="duty-name">${replacement}</span></div>` +
      `<div class="duty-row"><span class="duty-label">💬 เหตุผล</span><span class="duty-name">${reason}</span></div>` +
      `</div>`
  };
}


// ⭐ เขียนลง Sheet!
function executeSwap(swapData) {
  try {
    const sheet = getSheet(SHEET.SWAP);
    if (!sheet) return { success: false, error: 'ไม่พบ sheet "แลกเวร"' };

    // เช็คซ้ำ
    if (checkSwap(swapData.date, swapData.dutyType)) {
      return r('⚠️ มีการแลกเวรนี้อยู่แล้วค่ะ ไม่ได้บันทึกซ้ำ');
    }

    const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');

    sheet.appendRow([
      swapData.date,
      swapData.dutyType,
      swapData.original,
      swapData.replacement,
      swapData.reason,
      'Chat',
      timestamp
    ]);

    return {
      success: true,
      answer: `✅ บันทึกแลกเวรเรียบร้อยแล้วค่ะ!\n\n` +
        `<div class="duty-card">` +
        `<div class="duty-row"><span class="duty-label">📅 วันที่</span><span class="duty-name">${swapData.dateThai} (${swapData.dayName})</span></div>` +
        `<div class="duty-row"><span class="duty-label">📋 ประเภท</span><span class="duty-name">${swapData.dutyType}</span></div>` +
        `<div class="duty-row"><span class="duty-label">👤 เดิม</span><span class="duty-name">${swapData.original}</span></div>` +
        `<div class="duty-row"><span class="duty-label">🔄 แทน</span><span class="duty-name">${swapData.replacement}</span></div>` +
        `<div class="duty-row"><span class="duty-label">💬 เหตุผล</span><span class="duty-name">${swapData.reason}</span></div>` +
        `<div class="duty-row"><span class="duty-label">🕐 บันทึก</span><span class="duty-name">${timestamp}</span></div>` +
        `</div>`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ⭐ ยกเลิกแลกเวร
function parseCancelSwapRequest(question) {
  const q = question.toLowerCase();
  const targetDate = detectDate(q);
  const dutyType = detectDutyType(q) || 'Consult';

  if (!targetDate) return r('⚠️ กรุณาระบุวันที่ค่ะ เช่น:\n"ยกเลิกแลกเวร Consult วันที่ 5/3"');

  const dateStr = formatDate(targetDate);
  const sheet = getSheet(SHEET.SWAP);
  if (!sheet) return r('ไม่พบ sheet แลกเวร');

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const d = data[i][0];
    const cellDate = (d instanceof Date) ? formatDate(d) : d?.toString().trim();
    const type = data[i][1]?.toString().trim();

    if (cellDate === dateStr && type.toLowerCase().includes(dutyType.toLowerCase())) {
      return {
        success: true,
        needConfirmCancel: true,
        cancelData: {
          rowIndex: i + 1,
          date: dateStr,
          dateThai: formatDateThai(targetDate),
          dutyType: type,
          original: data[i][2]?.toString().trim(),
          replacement: data[i][3]?.toString().trim()
        },
        answer: `🗑️ ยืนยันยกเลิกแลกเวรนี้ไหมคะ?\n\n` +
          `<div class="duty-card">` +
          `<div class="duty-row"><span class="duty-label">📅 วันที่</span><span class="duty-name">${formatDateThai(targetDate)}</span></div>` +
          `<div class="duty-row"><span class="duty-label">📋 ประเภท</span><span class="duty-name">${type}</span></div>` +
          `<div class="duty-row"><span class="duty-label">👤 ${data[i][2]} → ${data[i][3]}</span><span class="duty-name" style="color:#f87171">จะถูกยกเลิก</span></div>` +
          `</div>`
      };
    }
  }

  return r(`✅ ไม่พบการแลกเวร ${dutyType} วันที่ ${formatDateThai(targetDate)} ค่ะ`);
}

function executeCancelSwap(cancelData) {
  try {
    const sheet = getSheet(SHEET.SWAP);
    if (!sheet) return { success: false, error: 'ไม่พบ sheet แลกเวร' };

    sheet.deleteRow(cancelData.rowIndex);

    return r(`✅ ยกเลิกแลกเวร ${cancelData.dutyType} วันที่ ${cancelData.dateThai} เรียบร้อยแล้วค่ะ\n\nเวรกลับไปใช้ตารางปกติ (${cancelData.original})`);
  } catch (err) {
    return { success: false, error: err.message };
  }
}


// =====================================================
// 📅 ดึงเวรของวัน
// =====================================================

function getDutyForDate(date, filterType) {
  const dateStr = formatDate(date);
  const dayName = getThaiDayName(date);
  const isHoliday = checkHoliday(date);
  const isWeekend = (date.getDay() === 0 || date.getDay() === 6);

  let result = `📋 เวรวัน${dayName}ที่ ${formatDateThai(date)}`;
  if (isHoliday) result += ` 🔴 (${isHoliday})`;
  result += '\n<div class="duty-card">';

  if (!filterType || filterType === 'ICU') {
    let icuDoc = getICUDoctor(date);
    const icuSwap = checkSwap(dateStr, 'ICU');
    if (icuSwap) {
      result += row('🏥 ICU', `${icuSwap.replacement} <small style="color:#fbbf24">(แทน${icuSwap.original})</small>`);
    } else if (icuDoc) {
      result += row('🏥 ICU', icuDoc);
    }
  }

  if (!filterType || filterType === 'Consult') {
    let consultDoc = null, consultSrc = '';
    if (isWeekend || isHoliday) {
      consultDoc = getWeekendConsult(dateStr);
      consultSrc = isHoliday || (date.getDay() === 0 ? 'อาทิตย์' : 'เสาร์');
    } else {
      consultDoc = getWeekdayConsult(dayName);
      consultSrc = 'ประจำ';
    }

    const cSwap = checkSwap(dateStr, 'Consult');
    if (cSwap) {
      result += row('📞 Consult', `${cSwap.replacement} <small style="color:#fbbf24">(แทน${cSwap.original}: ${cSwap.reason})</small>`);
    } else if (consultDoc) {
      result += row('📞 Consult', `${consultDoc} <small style="color:#8494ad">(${consultSrc})</small>`);
    } else {
      result += row('📞 Consult', 'ยังไม่ได้กำหนด');
    }
  }

  result += '</div>';
  return result;
}

function row(label, value) {
  return `<div class="duty-row"><span class="duty-label">${label}</span><span class="duty-name">${value}</span></div>`;
}


// =====================================================
// 👤 เวรของคน + 📆 สัปดาห์ + 🏥 ICU
// =====================================================

function getPersonSchedule(name) {
  const today = new Date();
  let result = `👨‍⚕️ ตารางเวรของ <b>${name}</b> เดือนนี้\n<div class="duty-card">`;
  const icuDoc = getICUDoctor(today);
  if (icuDoc === name) result += row('🏥 ICU', `ประจำเดือน ${today.getMonth()+1}/${today.getFullYear()}`);
  const wc = getWeekdayConsultAll();
  for (const [day, doc] of Object.entries(wc)) { if (doc === name) result += row('📞 Consult', `${day} (ประจำ)`); }
  const we = getWeekendConsultByPerson(name);
  we.forEach(d => { result += row(`↳ ${d.date}`, d.note); });
  const swaps = getSwapsByPerson(name);
  swaps.forEach(s => { result += row(`🔄 ${s.date}`, s.detail); });
  result += '</div>';
  return result;
}

function getPersonDutyOnDate(name, date) {
  const dateStr = formatDate(date);
  const dayName = getThaiDayName(date);
  const duties = [];
  const icuDoc = getICUDoctor(date);
  const icuSwap = checkSwap(dateStr, 'ICU');
  if (icuSwap && icuSwap.replacement === name) duties.push('🏥 ICU (แทน)');
  else if (icuDoc === name && !icuSwap) duties.push('🏥 ICU');
  const isH = checkHoliday(date); const isW = (date.getDay()===0||date.getDay()===6);
  const cSwap = checkSwap(dateStr, 'Consult');
  if (cSwap && cSwap.replacement === name) duties.push('📞 Consult (แทน)');
  else if (!cSwap) {
    if (isW||isH) { if (getWeekendConsult(dateStr)===name) duties.push('📞 Consult'); }
    else { if (getWeekdayConsult(dayName)===name) duties.push('📞 Consult'); }
  }
  if (!duties.length) return `👨‍⚕️ ${name} ไม่มีเวรวัน${dayName}ที่ ${formatDateThai(date)} ค่ะ`;
  return `👨‍⚕️ ${name} เวรวัน${dayName}ที่ ${formatDateThai(date)}: ${duties.join(', ')}`;
}

function getWeekSchedule() {
  const today = new Date();
  const mon = new Date(today);
  const dow = today.getDay();
  mon.setDate(today.getDate() + (dow===0?-6:1-dow));
  let result = '📋 ตารางเวรสัปดาห์นี้\n<div class="duty-card">';
  for (let i=0;i<7;i++) {
    const d = new Date(mon); d.setDate(mon.getDate()+i);
    const dn = getThaiDayName(d); const ds = formatDate(d);
    const isH = checkHoliday(d); const isT = ds===formatDate(today);
    const isW = (d.getDay()===0||d.getDay()===6);
    let icu = getICUDoctor(d); const iSwap = checkSwap(ds,'ICU');
    if(iSwap) icu=iSwap.replacement+'⇄';
    let con=''; const cSwap = checkSwap(ds,'Consult');
    if(cSwap) con=cSwap.replacement+'⇄';
    else if(isW||isH) con=getWeekendConsult(ds)||'-';
    else con=getWeekdayConsult(dn)||'-';
    result += row(`${dn} ${d.getDate()}/${d.getMonth()+1}${isH?' 🔴':''}${isT?' 👈':''}`, `ICU:${icu||'-'} | C:${con}`);
  }
  result += '</div>\n<small style="color:#8494ad">⇄ = แลกเวร</small>';
  return result;
}

function getCurrentICU() {
  const t=new Date(); const doc=getICUDoctor(t);
  if(doc) return `🏥 เวร ICU ประจำเดือน ${t.getMonth()+1}/${t.getFullYear()}: <b>${doc}</b>`;
  return `🏥 ยังไม่ได้กำหนดเวร ICU เดือน ${t.getMonth()+1}/${t.getFullYear()}`;
}


// =====================================================
// 📊 Sheet readers
// =====================================================

function getICUDoctor(date) {
  const s=getSheet(SHEET.ICU); if(!s) return null;
  const d=s.getDataRange().getValues();
  for(let i=1;i<d.length;i++) if(parseInt(d[i][0])===date.getMonth()+1 && parseInt(d[i][1])===date.getFullYear()) return d[i][2]?.toString().trim();
  return null;
}

function getWeekdayConsult(dayName) {
  const s=getSheet(SHEET.CONSULT_WEEKDAY); if(!s) return null;
  const d=s.getDataRange().getValues();
  for(let i=1;i<d.length;i++) if(d[i][0]?.toString().trim()===dayName) return d[i][1]?.toString().trim();
  return null;
}

function getWeekdayConsultAll() {
  const s=getSheet(SHEET.CONSULT_WEEKDAY); if(!s) return {};
  const d=s.getDataRange().getValues(); const r={};
  for(let i=1;i<d.length;i++){const day=d[i][0]?.toString().trim();const doc=d[i][1]?.toString().trim();if(day&&doc) r[day]=doc;}
  return r;
}

function getWeekendConsult(dateStr) {
  const s=getSheet(SHEET.CONSULT_WEEKEND); if(!s) return null;
  const d=s.getDataRange().getValues();
  for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?formatDate(c):c?.toString().trim();if(cd===dateStr) return d[i][1]?.toString().trim();}
  return null;
}

function getWeekendConsultByPerson(name) {
  const s=getSheet(SHEET.CONSULT_WEEKEND); if(!s) return [];
  const d=s.getDataRange().getValues(); const t=new Date(); const r=[];
  for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?c:new Date(c);const doc=d[i][1]?.toString().trim();const n=d[i][2]?.toString().trim()||'';
    if(doc===name&&cd>=t&&Math.floor((cd-t)/864e5)<=30) r.push({date:formatDateThai(cd),note:n||getThaiDayName(cd)});}
  return r;
}

function checkHoliday(date) {
  const ds=formatDate(date); const s=getSheet(SHEET.HOLIDAYS); if(!s) return null;
  const d=s.getDataRange().getValues();
  for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?formatDate(c):c?.toString().trim();if(cd===ds) return d[i][1]?.toString().trim()||'วันหยุดพิเศษ';}
  return null;
}

function checkSwap(dateStr, dutyType) {
  const s=getSheet(SHEET.SWAP); if(!s) return null;
  const d=s.getDataRange().getValues();
  for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?formatDate(c):c?.toString().trim();const tp=d[i][1]?.toString().trim();
    if(cd===dateStr&&tp.toLowerCase().includes(dutyType.toLowerCase())) return{original:d[i][2]?.toString().trim(),replacement:d[i][3]?.toString().trim(),reason:d[i][4]?.toString().trim()||'แลกเวร'};}
  return null;
}

function getSwapInfo(targetDate) {
  const s=getSheet(SHEET.SWAP); if(!s) return '📋 ไม่มีข้อมูลแลกเวรค่ะ';
  const d=s.getDataRange().getValues();
  if(targetDate){const ds=formatDate(targetDate);let f=false;let r=`🔄 แลกเวรวันที่ ${formatDateThai(targetDate)}\n<div class="duty-card">`;
    for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?formatDate(c):c?.toString().trim();if(cd===ds){f=true;r+=row(d[i][1],`${d[i][2]} → ${d[i][3]} (${d[i][4]||'-'})`);}}
    r+='</div>';return f?r:`✅ วันที่ ${formatDateThai(targetDate)} ไม่มีการแลกเวรค่ะ`;}
  const t=new Date();let r='🔄 รายการแลกเวรที่กำลังจะถึง\n<div class="duty-card">';let f=false;
  for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?c:new Date(c);if(cd>=t){f=true;r+=row(`${formatDateThai(cd)} [${d[i][1]}]`,`${d[i][2]} → ${d[i][3]}`);}}
  r+='</div>';return f?r:'✅ ไม่มีการแลกเวรที่กำลังจะมาถึงค่ะ';
}

function getSwapsByPerson(name) {
  const s=getSheet(SHEET.SWAP); if(!s) return [];
  const d=s.getDataRange().getValues(); const t=new Date(); const r=[];
  for(let i=1;i<d.length;i++){const c=d[i][0];const cd=(c instanceof Date)?c:new Date(c);const o=d[i][2]?.toString().trim();const rp=d[i][3]?.toString().trim();const tp=d[i][1]?.toString().trim();const rs=d[i][4]?.toString().trim()||'';
    if(cd>=t&&(o===name||rp===name)){let dt=o===name?`${tp}: ให้ ${rp} แทน`:`${tp}: แทน ${o}`;if(rs) dt+=` (${rs})`;r.push({date:formatDateThai(cd),detail:dt});}}
  return r;
}


// =====================================================
// 🔍 Detect
// =====================================================

function detectDate(q) {
  const t=new Date();
  if(q.includes('วันนี้')||q.includes('today')) return t;
  if(q.includes('พรุ่งนี้')||q.includes('tomorrow')){const d=new Date(t);d.setDate(d.getDate()+1);return d;}
  if(q.includes('มะรืน')){const d=new Date(t);d.setDate(d.getDate()+2);return d;}
  if(q.includes('เมื่อวาน')){const d=new Date(t);d.setDate(d.getDate()-1);return d;}
  const dk={'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัส':4,'พฤหัสบดี':4,'ศุกร์':5,'เสาร์':6,'อาทิตย์':0};
  for(const[kw,td] of Object.entries(dk)){if(q.includes(kw)){const d=new Date(t);let du=td-d.getDay();if(du<0)du+=7;if(du===0)return t;d.setDate(d.getDate()+du);return d;}}
  const m1=q.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if(m1){const dy=parseInt(m1[1]);const mo=parseInt(m1[2])-1;const yr=m1[3]?parseInt(m1[3]):t.getFullYear();return new Date(yr>100?yr:yr+2000,mo,dy);}
  const m2=q.match(/(\d{4})-(\d{2})-(\d{2})/);
  if(m2) return new Date(parseInt(m2[1]),parseInt(m2[2])-1,parseInt(m2[3]));
  return null;
}

function detectPerson(q, people) { for(const n of people) if(q.includes(n.toLowerCase())) return n; return null; }

function detectDutyType(q) {
  if(q.includes('icu')) return 'ICU';
  if(q.includes('consult')||q.includes('คอนซัลท์')) return 'Consult';
  return null;
}


// =====================================================
// 🛠️ Helpers
// =====================================================

function getSheet(name) { return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); }
function formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDateThai(d) { return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; }
function getThaiDayName(d) { return ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][d.getDay()]; }

function getAllPeople() {
  const p=new Set();
  [{n:SHEET.ICU,c:2},{n:SHEET.CONSULT_WEEKDAY,c:1},{n:SHEET.CONSULT_WEEKEND,c:1}].forEach(s=>{
    const sh=getSheet(s.n);if(sh){const d=sh.getDataRange().getValues();for(let i=1;i<d.length;i++){const nm=d[i][s.c]?.toString().trim();if(nm) p.add(nm);}}});
  return Array.from(p);
}


// =====================================================
// 🤖 HF fallback
// =====================================================

function askHuggingFace(question) {
  const t=new Date(); const sc={icu:getICUDoctor(t),consult:getWeekdayConsultAll(),today:getThaiDayName(t),date:formatDateThai(t)};
  let ctx=`วันนี้คือวัน${sc.today} ${sc.date}\nICU: ${sc.icu||'ไม่ทราบ'}\nConsult:\n`;
  for(const[d,doc] of Object.entries(sc.consult)) ctx+=`  ${d}: ${doc}\n`;
  const prompt=`<s>[INST] คุณเป็นผู้ช่วยตอบคำถามเรื่องตารางเวรแพทย์ ตอบสั้นกระชับเป็นภาษาไทย\n\n${ctx}\n\nคำถาม: ${question}\n[/INST]`;
  try{const res=UrlFetchApp.fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`,{method:'POST',headers:{'Authorization':`Bearer ${HF_API_KEY}`,'Content-Type':'application/json'},payload:JSON.stringify({inputs:prompt,parameters:{max_new_tokens:300,temperature:0.3,return_full_text:false}}),muteHttpExceptions:true});
    const r=JSON.parse(res.getContentText());if(Array.isArray(r)&&r[0]?.generated_text) return r[0].generated_text.trim();}catch(e){Logger.log('HF:'+e.message);}
  return '🤔 ไม่เข้าใจคำถาม ลองถามใหม่ เช่น:\n• "ใครเวรวันนี้"\n• "ขอแลกเวร Consult วันที่ 5/3 หมอก้อง ให้หมอแอนแทน เหตุผลไปประชุม"';
}


// =====================================================
// 🧪 Tests
// =====================================================
function testDutyToday() { Logger.log(JSON.stringify(processQuestion('ใครเวรวันนี้'))); }
function testSwap() { Logger.log(JSON.stringify(processQuestion('ขอแลกเวร Consult วันที่ 5/3 หมอก้อง ให้หมอแอนแทน เหตุผลไปประชุม'))); }