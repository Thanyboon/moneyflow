
// MoneyFlow Google Sheets API
// เชื่อมข้อมูลผ่าน OAuth 2.0 โดยไม่เก็บรหัสผ่าน

const CLIENT_ID = "ใส่_GOOGLE_CLIENT_ID";
const SPREADSHEET_ID = "ใส่_SPREADSHEET_ID";

const SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

const API =
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

export const TABLES = {
  Accounts: [
    "id", "name", "opening", "createdAt", "updatedAt"
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

let tokenClient = null;
let accessToken = null;

export function isConnected() {
  return Boolean(accessToken);
}

// โหลด Google Identity Services
export function initializeGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("โหลดระบบ Google Login ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
}

// ขอสิทธิ์จากบัญชี Google
export async function connectGoogle() {
  await initializeGoogle();

  return new Promise((resolve, reject) => {
    tokenClient =
      window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: response => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          accessToken = response.access_token;
          resolve(true);
        },
        error_callback: error => {
          reject(new Error(
            error?.type || "เข้าสู่ระบบไม่สำเร็จ"
          ));
        }
      });

    tokenClient.requestAccessToken({
      prompt: accessToken ? "" : "consent"
    });
  });
}

export function disconnectGoogle() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
}

// เรียก Google Sheets API
async function request(path, options = {}) {
  if (!accessToken) {
    throw new Error("กรุณาเชื่อมต่อ Google ก่อน");
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
    }

    let message = `Google API Error ${response.status}`;
    try {
      const error = await response.json();
      message = error.error?.message || message;
    } catch {}

    throw new Error(message);
  }

  return response.json();
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    n--;
    name = String.fromCharCode(65 + n % 26) + name;
    n = Math.floor(n / 26);
  }
  return name;
}

function rangeFor(table) {
  if (!TABLES[table]) throw new Error("ตารางไม่ถูกต้อง");
  const end = columnName(TABLES[table].length - 1);
  return `'${table}'!A:${end}`;
}

// แปลงข้อมูลกลับเป็นชนิดที่ React ใช้งาน
function parseRecord(table, row) {
  const record = {};
  TABLES[table].forEach((key, i) => {
    const raw = row[i] ?? "";
    if ([
      "amount", "opening", "target", "saved",
      "limit", "people", "actual", "expected"
    ].includes(key)) {
      record[key] = Number(raw) || 0;
    } else if (key === "settled") {
      record[key] = String(raw).toLowerCase() === "true";
    } else {
      record[key] = String(raw);
    }
  });
  return record;
}

// อ่านข้อมูลหนึ่งตาราง
export async function readTable(table) {
  const range = encodeURIComponent(rangeFor(table));
  const result = await request(`/values/${range}`);
  const rows = result.values || [];

  return rows.slice(1)
    .filter(row => row[0])
    .map(row => parseRecord(table, row));
}

// อ่านทุกตารางพร้อมกัน
export async function readAllData() {
  const entries = await Promise.all(
    Object.keys(TABLES).map(async table => [
      table, await readTable(table)
    ])
  );
  return Object.fromEntries(entries);
}

// ตรวจข้อมูลและแปลงเป็นแถว
function recordValues(table, record) {
  if (!TABLES[table]) throw new Error("ตารางไม่ถูกต้อง");

  return TABLES[table].map(key => {
    const value = record[key] ?? "";

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new Error("จำนวนเงินไม่ถูกต้อง");
      }
      return value;
    }

    if (typeof value === "boolean") return value;

    const text = String(value);

    // ป้องกันข้อความถูกตีความเป็นสูตรใน Sheets
    if (/^\s*[=+\-@]/.test(text) &&
        !["id", "date", "createdAt", "updatedAt"]
          .includes(key)) {
      return "'" + text;
    }
    return text;
  });
}

// เพิ่มรายการลง Google Sheets
export async function addRecord(table, data) {
  const now = new Date().toISOString();
  const record = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  const range = encodeURIComponent(rangeFor(table));

  await request(
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({
        values: [recordValues(table, record)]
      })
    }
  );

  return record;
}

// ค้นหาตำแหน่งแถวจาก ID
async function findRow(table, id) {
  const range = encodeURIComponent(`'${table}'!A2:A`);
  const result = await request(`/values/${range}`);
  const rows = result.values || [];
  const index = rows.findIndex(row => row[0] === id);

  if (index === -1) {
    throw new Error("ไม่พบรายการใน Google Sheets");
  }

  return index + 2;
}

// แก้ไขรายการด้วย ID
export async function updateRecord(table, id, changes) {
  const records = await readTable(table);
  const original = records.find(r => r.id === id);
  if (!original) throw new Error("ไม่พบรายการ");

  const row = await findRow(table, id);
  const updated = {
    ...original,
    ...changes,
    id,
    createdAt: original.createdAt,
    updatedAt: new Date().toISOString()
  };

  const end = columnName(TABLES[table].length - 1);
  const range = encodeURIComponent(
    `'${table}'!A${row}:${end}${row}`
  );

  await request(
    `/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [recordValues(table, updated)]
      })
    }
  );

  return updated;
}

// ลบรายการโดยไม่เลื่อนแถวอื่น
// เว้นแถวว่างไว้เพื่อลดความเสี่ยงลบผิดแถว
export async function deleteRecord(table, id) {
  const row = await findRow(table, id);
  const end = columnName(TABLES[table].length - 1);
  const range = encodeURIComponent(
    `'${table}'!A${row}:${end}${row}`
  );

  await request(`/values/${range}:clear`, {
    method: "POST",
    body: JSON.stringify({})
  });

  return true;
}
