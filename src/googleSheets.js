// ==================================================
// MoneyFlow — Google Sheets API v2
// สำหรับ React + Vite + GitHub Pages
// ==================================================

// แก้เฉพาะ 2 ค่านี้ก่อนบันทึก
const CLIENT_ID = "276182967058-pqbng8selgsuj6jn9i3lo804q8klun1d.apps.googleusercontent.com";
const SPREADSHEET_ID = "1oRg3MtH5QB6pt5uFfmZjakI5kkJrAk9uTHTs";

const SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

const API =
  "https://sheets.googleapis.com/v4/spreadsheets/" +
  SPREADSHEET_ID;

// โครงสร้างต้องตรงกับ Code.gs ขั้นตอนที่ 4
export const TABLES = {
  Accounts: [
    "id", "name", "opening",
    "createdAt", "updatedAt"
  ],
  Transactions: [
    "id", "type", "amount", "category",
    "accountId", "toAccountId", "date",
    "note", "createdAt", "updatedAt"
  ],
  Savings: [
    "id", "name", "target", "saved",
    "createdAt", "updatedAt"
  ],
  Budgets: [
    "id", "category", "limit", "month",
    "createdAt", "updatedAt"
  ],
  Bills: [
    "id", "name", "amount", "people",
    "settled", "createdAt", "updatedAt"
  ],
  Reconciliations: [
    "id", "accountId", "actual", "expected",
    "date", "createdAt", "updatedAt"
  ]
};

const NUMBERS = new Set([
  "opening", "amount", "target", "saved",
  "limit", "people", "actual", "expected"
]);

let accessToken = null;
let expiresAt = 0;
let tokenClient = null;
let pendingLogin = null;
let writeQueue = Promise.resolve();

// ไม่เก็บ Access Token ใน localStorage
export function isConnected() {
  return Boolean(
    accessToken && Date.now() < expiresAt - 60000
  );
}

function validateConfig() {
  if (!CLIENT_ID ||
      CLIENT_ID.includes("ใส่_") ||
      !SPREADSHEET_ID ||
      SPREADSHEET_ID.includes("ใส่_")) {
    throw new Error(
      "กรุณาตั้งค่า CLIENT_ID และ SPREADSHEET_ID"
    );
  }
}

// โหลด Google Identity Services
export function initializeGoogle() {
  validateConfig();

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-moneyflow-google="true"]'
    );

    if (existing) {
      existing.addEventListener("load", resolve, {
        once: true
      });
      existing.addEventListener("error", () => {
        reject(new Error("โหลด Google Login ไม่สำเร็จ"));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.moneyflowGoogle = "true";
    script.src =
      "https://accounts.google.com/gsi/client";
    script.async = true;

    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(
        "ไม่สามารถโหลดระบบ Google Login ได้"
      ));
    };

    document.head.appendChild(script);
  });
}

// เชื่อม Google ด้วย OAuth 2.0
export async function connectGoogle() {
  await initializeGoogle();

  if (pendingLogin) {
    throw new Error(
      "กำลังเข้าสู่ระบบ Google กรุณารอสักครู่"
    );
  }

  return new Promise((resolve, reject) => {
    pendingLogin = { resolve, reject };

    const finish = (error, response) => {
      const pending = pendingLogin;
      pendingLogin = null;

      if (!pending) return;

      if (error) {
        pending.reject(error);
        return;
      }

      if (!response?.access_token) {
        pending.reject(new Error(
          "Google ไม่ได้ส่ง Access Token"
        ));
        return;
      }

      accessToken = response.access_token;
      expiresAt = Date.now() +
        Number(response.expires_in || 3600) * 1000;

      pending.resolve(true);
    };

    try {
      tokenClient =
        window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: response => {
            if (response.error) {
              finish(new Error(
                response.error_description ||
                response.error
              ));
              return;
            }
            finish(null, response);
          },
          error_callback: error => {
            finish(new Error(
              error?.message ||
              error?.type ||
              "Google Login ไม่สำเร็จ"
            ));
          }
        });

      tokenClient.requestAccessToken({
        prompt: "consent"
      });
    } catch (error) {
      finish(error);
    }
  });
}

// ยกเลิกสิทธิ์และล้าง Token
export function disconnectGoogle() {
  const token = accessToken;

  accessToken = null;
  expiresAt = 0;

  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(
      token, () => {}
    );
  }
}

// สร้าง URL ของ API
function apiUrl(path) {
  return API + path;
}

// ส่งคำขอ Google Sheets API
async function request(path, options = {}) {
  if (!isConnected()) {
    accessToken = null;
    expiresAt = 0;

    throw new Error(
      "การเชื่อมต่อ Google หมดอายุ " +
      "กรุณากดเชื่อม Google อีกครั้ง"
    );
  }

  let response;

  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error(
      "เชื่อมต่ออินเทอร์เน็ตไม่ได้ " +
      "กรุณาตรวจสอบเครือข่าย"
    );
  }

  if (!response.ok) {
    let message = "Google Sheets API ขัดข้อง";

    try {
      const body = await response.json();
      message = body.error?.message || message;
    } catch {}

    if (response.status === 401) {
      accessToken = null;
      expiresAt = 0;
      throw new Error(
        "สิทธิ์ Google หมดอายุ กรุณาเข้าสู่ระบบใหม่"
      );
    }

    if (response.status === 403) {
      throw new Error(
        "ไม่มีสิทธิ์เข้าถึง Google Sheets: " + message
      );
    }

    if (response.status === 404) {
      throw new Error(
        "ไม่พบ Google Sheets หรือชื่อตาราง: " + message
      );
    }

    if (response.status === 429) {
      throw new Error(
        "มีการเรียก Google API มากเกินไป " +
        "กรุณารอสักครู่"
      );
    }

    throw new Error(
      "Google API " + response.status + ": " + message
    );
  }

  if (response.status === 204) return {};

  return response.json();
}

// ตรวจสอบชื่อตาราง
function checkTable(table) {
  if (!Object.hasOwn(TABLES, table)) {
    throw new Error("ไม่อนุญาตให้เข้าถึงตารางนี้");
  }
}

// แปลงหมายเลขคอลัมน์เป็น A, B, C ...
function columnName(index) {
  let result = "";
  let number = index + 1;

  while (number > 0) {
    number--;
    result =
      String.fromCharCode(65 + number % 26) +
      result;
    number = Math.floor(number / 26);
  }

  return result;
}

// สร้าง A1 range
function tableRange(table) {
  checkTable(table);
  const end = columnName(TABLES[table].length - 1);
  return "'" + table + "'!A:" + end;
}

function encodeRange(range) {
  return encodeURIComponent(range);
}

// แปลงข้อมูลจาก Sheets เป็น Object
function parseRecord(table, row) {
  const item = {};

  TABLES[table].forEach((key, index) => {
    const value = row[index] ?? "";

    if (NUMBERS.has(key)) {
      item[key] = Number(value) || 0;
    } else if (key === "settled") {
      item[key] =
        String(value).toLowerCase() === "true";
    } else {
      item[key] = String(value);
    }
  });

  return item;
}

// อ่านหนึ่งตาราง
export async function readTable(table) {
  checkTable(table);

  const result = await request(
    "/values/" + encodeRange(tableRange(table)) +
    "?valueRenderOption=UNFORMATTED_VALUE"
  );

  const rows = result.values || [];

  if (!rows.length) {
    throw new Error(
      "ตาราง " + table + " ไม่มีหัวคอลัมน์"
    );
  }

  const header = TABLES[table];

  if (header.some((name, i) => rows[0][i] !== name)) {
    throw new Error(
      "หัวคอลัมน์ตาราง " + table + " ไม่ตรง"
    );
  }

  return rows.slice(1)
    .filter(row => row[0])
    .map(row => parseRecord(table, row));
}

// อ่านทุกตารางด้วย Batch GET
export async function readAllData() {
  const names = Object.keys(TABLES);
  const params = new URLSearchParams();

  names.forEach(table => {
    params.append("ranges", tableRange(table));
  });

  params.set(
    "valueRenderOption",
    "UNFORMATTED_VALUE"
  );

  const result = await request(
    "/values:batchGet?" + params.toString()
  );

  const data = {};

  names.forEach((table, index) => {
    const rows =
      result.valueRanges?.[index]?.values || [];

    if (!rows.length ||
        TABLES[table].some((key, i) =>
          rows[0][i] !== key)) {
      throw new Error(
        "โครงสร้างตาราง " + table + " ไม่ถูกต้อง"
      );
    }

    data[table] = rows.slice(1)
      .filter(row => row[0])
      .map(row => parseRecord(table, row));
  });

  return data;
}

// ตรวจสอบค่าก่อนเขียน
function validateRecord(table, item) {
  checkTable(table);

  if (!item || typeof item !== "object") {
    throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  const result = {};

  TABLES[table].forEach(key => {
    if (Object.hasOwn(item, key)) {
      result[key] = item[key];
    }
  });

  NUMBERS.forEach(key => {
    if (Object.hasOwn(result, key)) {
      const n = Number(result[key]);

      if (!Number.isFinite(n)) {
        throw new Error(
          "ข้อมูลตัวเลข " + key + " ไม่ถูกต้อง"
        );
      }

      result[key] = n;
    }
  });

  if (table === "Accounts") {
    if (!String(result.name || "").trim()) {
      throw new Error("กรุณาระบุชื่อบัญชี");
    }
  }

  if (table === "Transactions") {
    if (!["income", "expense", "transfer"]
      .includes(result.type)) {
      throw new Error("ประเภทรายการไม่ถูกต้อง");
    }

    if (!(result.amount > 0)) {
      throw new Error("จำนวนเงินต้องมากกว่า 0");
    }

    if (!result.accountId) {
      throw new Error("กรุณาเลือกบัญชี");
    }

    if (result.type === "transfer" &&
        (!result.toAccountId ||
         result.accountId === result.toAccountId)) {
      throw new Error(
        "บัญชีต้นทางและปลายทางไม่ถูกต้อง"
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(
      String(result.date || "")
    )) {
      throw new Error("วันที่ไม่ถูกต้อง");
    }
  }

  if (table === "Savings") {
    if (!(result.target > 0) ||
        result.saved < 0) {
      throw new Error("ยอดเป้าหมายไม่ถูกต้อง");
    }
  }

  if (table === "Budgets") {
    if (!(result.limit > 0)) {
      throw new Error("งบประมาณต้องมากกว่า 0");
    }

    if (!/^\d{4}-\d{2}$/.test(
      String(result.month || "")
    )) {
      throw new Error("เดือนงบประมาณไม่ถูกต้อง");
    }
  }

  if (table === "Bills") {
    if (!(result.amount > 0) ||
        !Number.isInteger(result.people) ||
        result.people < 2) {
      throw new Error("ข้อมูลบิลไม่ถูกต้อง");
    }

    result.settled = result.settled === true;
  }

  if (table === "Reconciliations") {
    if (!Number.isFinite(result.actual) ||
        !Number.isFinite(result.expected)) {
      throw new Error("ยอดตรวจสอบไม่ถูกต้อง");
    }
  }

  return result;
}

// แปลง Object เป็นแถว
function recordValues(table, item) {
  const clean = validateRecord(table, item);

  return TABLES[table].map(key => {
    const value = clean[key] ?? "";

    if (typeof value === "number" ||
        typeof value === "boolean") {
      return value;
    }

    const text = String(value);

    // ใช้ RAW ป้องกันการประมวลผลเป็นสูตร
    return text;
  });
}

// คิวคำสั่งเขียนภายในแท็บเดียว
function enqueueWrite(operation) {
  const task = writeQueue.then(operation);
  writeQueue = task.catch(() => {});
  return task;
}

// เพิ่มข้อมูล
export async function addRecord(table, data) {
  return enqueueWrite(async () => {
    checkTable(table);

    const now = new Date().toISOString();

    const record = validateRecord(table, {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    });

    const path =
      "/values/" +
      encodeRange(tableRange(table)) +
      ":append?valueInputOption=RAW" +
      "&insertDataOption=INSERT_ROWS";

    await request(path, {
      method: "POST",
      body: JSON.stringify({
        values: [recordValues(table, record)]
      })
    });

    return record;
  });
}

// ค้นหาแถวจาก ID
async function findRow(table, id) {
  checkTable(table);

  const range = "'" + table + "'!A2:A";

  const result = await request(
    "/values/" + encodeRange(range)
  );

  const rows = result.values || [];
  const index = rows.findIndex(
    row => String(row[0]) === String(id)
  );

  if (index < 0) {
    throw new Error(
      "ไม่พบรายการ อาจถูกลบจากอุปกรณ์อื่นแล้ว"
    );
  }

  return index + 2;
}

// แก้ไขข้อมูล
export async function updateRecord(
  table, id, changes
) {
  return enqueueWrite(async () => {
    checkTable(table);

    const records = await readTable(table);
    const original = records.find(
      record => record.id === id
    );

    if (!original) {
      throw new Error("ไม่พบรายการที่ต้องการแก้ไข");
    }

    // ถ้าผู้เรียกส่ง updatedAt มา
    // จะตรวจว่าข้อมูลยังเป็นเวอร์ชันเดิม
    if (changes.updatedAt &&
        changes.updatedAt !== original.updatedAt) {
      throw new Error(
        "ข้อมูลมีการเปลี่ยนแปลง " +
        "กรุณาซิงค์ก่อนแก้ไข"
      );
    }

    const updated = validateRecord(table, {
      ...original,
      ...changes,
      id: original.id,
      createdAt: original.createdAt,
      updatedAt: new Date().toISOString()
    });

    const row = await findRow(table, id);
    const end = columnName(
      TABLES[table].length - 1
    );

    const range =
      "'" + table + "'!A" + row +
      ":" + end + row;

    await request(
      "/values/" + encodeRange(range) +
      "?valueInputOption=RAW",
      {
        method: "PUT",
        body: JSON.stringify({
          values: [recordValues(table, updated)]
        })
      }
    );

    return updated;
  });
}

// ลบข้อมูลโดยล้างค่าทั้งแถว
export async function deleteRecord(table, id) {
  return enqueueWrite(async () => {
    checkTable(table);

    const row = await findRow(table, id);
    const end = columnName(
      TABLES[table].length - 1
    );

    const range =
      "'" + table + "'!A" + row +
      ":" + end + row;

    await request(
      "/values/" + encodeRange(range) + ":clear",
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );

    return true;
  });
}
