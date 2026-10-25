import React, {
  useEffect, useMemo, useState, useCallback
} from "react";
import {
  LayoutDashboard, ArrowLeftRight, Wallet,
  PiggyBank, ChartPie, Users, Landmark,
  History, Settings, Plus, Trash2, Moon,
  Sun, Search, Menu, X, RefreshCw,
  LogIn, LogOut, AlertCircle, CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from "recharts";
import {
  connectGoogle, disconnectGoogle,
  readAllData, addRecord, updateRecord,
  deleteRecord, isConnected
} from "./googleSheets";

// หมวดหมู่รายรับและรายจ่าย
const CATEGORIES = [
  "อาหาร", "เดินทาง", "ช้อปปิ้ง", "ที่พัก",
  "การศึกษา", "สุขภาพ", "เงินเดือน",
  "รายได้เสริม", "บันเทิง", "อื่นๆ"
];

const NAV = [
  ["dashboard", "ภาพรวม", LayoutDashboard],
  ["transactions", "รายรับรายจ่าย", ArrowLeftRight],
  ["accounts", "กระเป๋าเงิน", Wallet],
  ["savings", "เงินออม", PiggyBank],
  ["budgets", "งบประมาณ", ChartPie],
  ["bills", "หารบิล", Users],
  ["reconcile", "ตรวจยอดธนาคาร", Landmark],
  ["history", "ประวัติ", History],
  ["settings", "ตั้งค่า", Settings]
];

const money = value =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB"
  }).format(Number(value) || 0);

const today = () => {
  const d = new Date();
  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
};

const currentMonth = () => today().slice(0, 7);

const EMPTY_DATA = {
  Accounts: [],
  Transactions: [],
  Savings: [],
  Budgets: [],
  Bills: [],
  Reconciliations: []
};

const COLORS = [
  "#10b981", "#38bdf8", "#f59e0b",
  "#a78bfa", "#fb7185", "#14b8a6"
];

function Card({ children, className = "" }) {
  return (
    <div className={
      "rounded-2xl border p-5 shadow-sm " +
      "bg-white border-slate-100 " +
      "dark:bg-slate-900 dark:border-slate-800 " +
      className
    }>
      {children}
    </div>
  );
}

function ActionButton({
  children, onClick, disabled = false,
  secondary = false, type = "button"
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-xl px-4 py-3 font-medium " +
        "disabled:opacity-40 transition " +
        (secondary
          ? "bg-slate-100 text-slate-700 " +
            "dark:bg-slate-800 dark:text-white"
          : "bg-emerald-600 text-white " +
            "hover:bg-emerald-700")
      }
    >
      {children}
    </button>
  );
}

function Empty({ text = "ยังไม่มีข้อมูล" }) {
  return (
    <div className="text-center py-12 opacity-60">
      <Wallet className="mx-auto mb-3" size={32}/>
      <p>{text}</p>
    </div>
  );
}

function Progress({ value, max }) {
  const percent = max > 0
    ? Math.min(100, Math.max(0, value / max * 100))
    : 0;

  return (
    <div className="mt-3">
      <div className="h-3 bg-slate-200 dark:bg-slate-700
        rounded-full overflow-hidden">
        <div
          className={
            "h-full rounded-full " +
            (value > max
              ? "bg-rose-500" : "bg-emerald-500")
          }
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs opacity-60 mt-2">
        {percent.toFixed(1)}%
      </p>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(() =>
    localStorage.getItem("mf_theme") === "dark"
  );
  const [menu, setMenu] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category: "อาหาร",
    accountId: "",
    toAccountId: "",
    date: today(),
    note: ""
  });

  const accounts = data.Accounts;
  const transactions = data.Transactions;
  const goals = data.Savings;
  const budgets = data.Budgets;
  const bills = data.Bills;
  const checks = data.Reconciliations;

  useEffect(() => {
    localStorage.setItem(
      "mf_theme", dark ? "dark" : "light"
    );
    document.documentElement.classList.toggle(
      "dark", dark
    );
  }, [dark]);

  // อ่านข้อมูลทั้งหมดจาก Google Sheets
  const refresh = useCallback(async () => {
    if (!isConnected()) {
      setConnected(false);
      return;
    }

    try {
      const result = await readAllData();
      setData(result);
      setLastSync(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
      if (!isConnected()) setConnected(false);
    }
  }, []);

  async function login() {
    setBusy(true);
    setError("");

    try {
      await connectGoogle();
      setConnected(true);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    disconnectGoogle();
    setConnected(false);
    setData(EMPTY_DATA);
    setLastSync(null);
    setError("");
  }

  // ซิงค์ทุก 30 วินาทีเมื่อเปิดแอป
  useEffect(() => {
    if (!connected) return;

    const timer = setInterval(() => {
      if (!document.hidden && !busy) refresh();
    }, 30000);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [connected, busy, refresh]);

  // ทำงานกับ Google Sheets แล้วโหลดข้อมูลใหม่
  async function mutate(action) {
    if (!isConnected()) {
      setConnected(false);
      setError("กรุณาเชื่อมต่อ Google อีกครั้ง");
      return false;
    }

    if (busy) return false;

    setBusy(true);
    setError("");

    try {
      await action();
      const result = await readAllData();
      setData(result);
      setLastSync(new Date());
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ยอดเงินแยกบัญชี
  const balances = useMemo(() => {
    const result = Object.fromEntries(
      accounts.map(a => [
        a.id, Number(a.opening) || 0
      ])
    );

    transactions.forEach(t => {
      const amount = Number(t.amount) || 0;

      if (t.type === "income") {
        result[t.accountId] =
          (result[t.accountId] || 0) + amount;
      }

      if (t.type === "expense") {
        result[t.accountId] =
          (result[t.accountId] || 0) - amount;
      }

      if (t.type === "transfer") {
        result[t.accountId] =
          (result[t.accountId] || 0) - amount;

        result[t.toAccountId] =
          (result[t.toAccountId] || 0) + amount;
      }
    });

    return result;
  }, [accounts, transactions]);

  const total = accounts.reduce(
    (sum, a) => sum + (balances[a.id] || 0), 0
  );

  const monthly = transactions.filter(
    t => String(t.date).slice(0, 7) === currentMonth()
  );

  const income = monthly
    .filter(t => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const expense = monthly
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const spending = CATEGORIES.map(name => ({
    name,
    value: monthly
      .filter(t =>
        t.type === "expense" && t.category === name
      )
      .reduce((s, t) => s + Number(t.amount), 0)
  })).filter(x => x.value > 0);

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));

    const key =
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0");

    const tx = transactions.filter(t =>
      String(t.date).slice(0, 7) === key
    );

    return {
      name: d.toLocaleDateString("th-TH", {
        month: "short"
      }),
      income: tx.filter(t => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0),
      expense: tx.filter(t => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0)
    };
  });

  function openTransaction() {
    if (!connected) return login();

    setForm({
      type: "expense",
      amount: "",
      category: "อาหาร",
      accountId: accounts[0]?.id || "",
      toAccountId: accounts[1]?.id || "",
      date: today(),
      note: ""
    });
    setModal(true);
  }

  async function saveTransaction(e) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return alert("กรุณากรอกจำนวนเงินที่ถูกต้อง");
    }

    if (!accounts.some(a => a.id === form.accountId)) {
      return alert("กรุณาเลือกบัญชี");
    }

    if (form.type === "transfer") {
      if (form.accountId === form.toAccountId) {
        return alert("บัญชีต้นทางและปลายทางต้องต่างกัน");
      }
      if (!accounts.some(a => a.id === form.toAccountId)) {
        return alert("กรุณาเลือกบัญชีปลายทาง");
      }
    }

    const success = await mutate(() =>
      addRecord("Transactions", {
        ...form, amount,
        toAccountId: form.type === "transfer"
          ? form.toAccountId : ""
      })
    );

    if (success) setModal(false);
  }

  async function removeRecord(table, id) {
    if (!confirm("ยืนยันลบรายการนี้?")) return;
    await mutate(() => deleteRecord(table, id));
  }

  async function addAccount() {
    const name = prompt("ชื่อบัญชี เช่น ธนาคาร A");
    if (!name?.trim()) return;

    const raw = prompt("ยอดเงินเริ่มต้น", "0");
    if (raw === null || raw.trim() === "") return;
    const opening = Number(raw);

    if (!Number.isFinite(opening)) {
      return alert("ยอดเงินไม่ถูกต้อง");
    }

    await mutate(() =>
      addRecord("Accounts", {
        name: name.trim(), opening
      })
    );
  }

  async function addGoal() {
    const name = prompt("ชื่อเป้าหมายการออม");
    if (!name?.trim()) return;

    const target = Number(prompt("ยอดเงินเป้าหมาย"));
    if (!(target > 0)) return;

    await mutate(() =>
      addRecord("Savings", {
        name: name.trim(), target, saved: 0
      })
    );
  }

  async function depositGoal(goal) {
    const amount = Number(
      prompt("เพิ่มยอดออม (บาท)")
    );
    if (!(amount > 0)) return;

    // เป็นการติดตามเป้าหมาย ไม่หักเงินจากบัญชี
    await mutate(() =>
      updateRecord("Savings", goal.id, {
        saved: Number(goal.saved) + amount
      })
    );
  }

  async function addBudget() {
    const category = prompt(
      "เลือกหมวดหมู่:\n" + CATEGORIES.join(", "),
      "อาหาร"
    );
    if (!CATEGORIES.includes(category)) {
      return alert("ไม่พบหมวดหมู่");
    }

    const limit = Number(prompt("งบประมาณ (บาท)"));
    if (!(limit > 0)) return;

    const existing = budgets.find(b =>
      b.category === category &&
      b.month === currentMonth()
    );

    await mutate(() =>
      existing
        ? updateRecord("Budgets", existing.id, {
            limit
          })
        : addRecord("Budgets", {
            category, limit, month: currentMonth()
          })
    );
  }

  async function addBill() {
    const name = prompt("ชื่อบิล เช่น ค่าอาหาร");
    if (!name?.trim()) return;

    const amount = Number(prompt("ยอดรวมบิล"));
    const people = Number(
      prompt("จำนวนคนรวมตัวเอง", "2")
    );

    if (!(amount > 0) ||
        !Number.isInteger(people) || people < 2) {
      return alert("ข้อมูลบิลไม่ถูกต้อง");
    }

    await mutate(() =>
      addRecord("Bills", {
        name: name.trim(),
        amount, people, settled: false
      })
    );
  }

  async function toggleBill(bill) {
    await mutate(() =>
      updateRecord("Bills", bill.id, {
        settled: !bill.settled
      })
    );
  }

  async function addCheck() {
    if (!accounts.length) return;

    const message = accounts.map(a =>
      `${a.id} = ${a.name}`
    ).join("\n");

    const accountId = prompt(
      "กรอกรหัสบัญชี:\n" + message,
      accounts[0].id
    );

    if (!accounts.some(a => a.id === accountId)) {
      return alert("ไม่พบบัญชี");
    }

    const raw = prompt("ยอดเงินจริงในบัญชี");
    if (raw === null || raw.trim() === "") return;

    const actual = Number(raw);
    if (!Number.isFinite(actual)) {
      return alert("ยอดเงินไม่ถูกต้อง");
    }

    await mutate(() =>
      addRecord("Reconciliations", {
        accountId,
        actual,
        expected: balances[accountId] || 0,
        date: new Date().toISOString()
      })
    );
  }

  const heading = NAV.find(
    item => item[0] === page
  )?.[1] || "MoneyFlow";

  function TransactionList({ items }) {
    if (!items.length) {
      return <Empty text="ยังไม่มีธุรกรรม"/>;
    }

    return (
      <div className="space-y-3">
        {[...items].sort((a, b) =>
          String(b.date).localeCompare(String(a.date))
        ).map(t => (
          <Card key={t.id}>
            <div className="flex items-center
              justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {t.type === "transfer"
                    ? "โอนเงิน" : t.category}
                </p>
                <p className="text-sm opacity-60">
                  {t.date} · {t.note || "ไม่มีหมายเหตุ"}
                </p>
                <p className="text-xs opacity-60">
                  {accounts.find(a =>
                    a.id === t.accountId)?.name || "ไม่พบบัญชี"}
                  {t.type === "transfer" &&
                    " → " + (accounts.find(a =>
                      a.id === t.toAccountId)?.name ||
                      "ไม่พบบัญชี")}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className={
                  "font-bold " +
                  (t.type === "income"
                    ? "text-emerald-500"
                    : t.type === "expense"
                      ? "text-rose-500"
                      : "text-sky-500")
                }>
                  {t.type === "income" ? "+" :
                    t.type === "expense" ? "-" : ""}
                  {money(t.amount)}
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    removeRecord("Transactions", t.id)
                  }
                  className="text-rose-500 mt-2"
                >
                  <Trash2 size={17}/>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={
      "min-h-screen bg-slate-50 text-slate-900 " +
      "dark:bg-slate-950 dark:text-white"
    }>
      <div className="max-w-7xl mx-auto
        md:flex min-h-screen">

        {/* เมนูหลัก */}
        <aside className={
          (menu ? "block " : "hidden ") +
          "md:block md:w-60 shrink-0 p-4 " +
          "bg-white dark:bg-slate-900 " +
          "border-r border-slate-200 " +
          "dark:border-slate-800"
        }>
          <h1 className="text-2xl font-bold
            text-emerald-500 mb-7 flex
            items-center gap-2">
            <Wallet/> MoneyFlow
          </h1>

          <nav className="space-y-1">
            {NAV.map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => {
                  setPage(id);
                  setMenu(false);
                }}
                className={
                  "w-full flex items-center gap-3 " +
                  "px-4 py-3 rounded-xl text-left " +
                  (page === id
                    ? "bg-emerald-600 text-white"
                    : "hover:bg-emerald-500/10")
                }
              >
                <Icon size={19}/>
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* เนื้อหาหลัก */}
        <main className="flex-1 min-w-0
          p-4 md:p-8 pb-28">

          <header className="flex flex-wrap
            items-center justify-between
            gap-3 mb-6">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden"
                onClick={() => setMenu(!menu)}
              >
                {menu ? <X/> : <Menu/>}
              </button>
              <h2 className="text-2xl font-bold">
                {heading}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDark(!dark)}
                className="p-2 rounded-xl
                  bg-emerald-500/10"
              >
                {dark ? <Sun/> : <Moon/>}
              </button>

              {connected ? (
                <button
                  onClick={refresh}
                  disabled={busy}
                  className="bg-emerald-600
                    text-white px-3 py-2
                    rounded-xl flex gap-2
                    items-center text-sm"
                >
                  <RefreshCw size={16}/>
                  ซิงค์
                </button>
              ) : (
                <button
                  onClick={login}
                  disabled={busy}
                  className="bg-emerald-600
                    text-white px-3 py-2
                    rounded-xl flex gap-2
                    items-center text-sm"
                >
                  <LogIn size={16}/>
                  เชื่อม Google
                </button>
              )}
            </div>
          </header>

          {/* สถานะการเชื่อมต่อ */}
          <div className={
            "rounded-xl px-4 py-3 mb-5 text-sm " +
            (connected
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-amber-500/10 text-amber-600")
          }>
            {connected
              ? "● เชื่อม Google Sheets แล้ว"
              : "● ยังไม่ได้เชื่อม Google Sheets"}
            {lastSync && (
              <span className="ml-2 opacity-70">
                · ซิงค์ล่าสุด {
                  lastSync.toLocaleTimeString("th-TH")
                }
              </span>
            )}
          </div>

          {error && (
            <div className="bg-rose-500/10
              text-rose-500 rounded-xl
              p-4 mb-5 flex gap-2">
              <AlertCircle size={20}/>
              <span>{error}</span>
            </div>
          )}

          {/* แดชบอร์ด */}
          {page === "dashboard" && <>
            <div className="rounded-3xl p-7
              bg-gradient-to-r from-emerald-600
              to-teal-500 text-white mb-4">
              <p className="opacity-80">
                ยอดเงินคงเหลือทั้งหมด
              </p>
              <h2 className="text-4xl font-bold mt-3">
                {money(total)}
              </h2>
              <p className="mt-4 opacity-80 text-sm">
                {accounts.length} บัญชี
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <Card>
                <p className="text-sm opacity-70">
                  รายรับเดือนนี้
                </p>
                <p className="text-xl font-bold
                  text-emerald-500 mt-2">
                  {money(income)}
                </p>
              </Card>
              <Card>
                <p className="text-sm opacity-70">
                  รายจ่ายเดือนนี้
                </p>
                <p className="text-xl font-bold
                  text-rose-500 mt-2">
                  {money(expense)}
                </p>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <h3 className="font-bold mb-5">
                  รายรับ-รายจ่าย 6 เดือน
                </h3>
                <div className="h-64">
                  <ResponsiveContainer
                    width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name"/>
                      <YAxis width={45}/>
                      <Tooltip/>
                      <Bar dataKey="income"
                        name="รายรับ" fill="#10b981"/>
                      <Bar dataKey="expense"
                        name="รายจ่าย" fill="#fb7185"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-4">
                  หมวดหมู่รายจ่าย
                </h3>
                {spending.length ? (
                  <div className="h-64">
                    <ResponsiveContainer
                      width="100%" height="100%">
                      <PieChart>
                        <Pie data={spending}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={85} label>
                          {spending.map((s, i) => (
                            <Cell key={s.name}
                              fill={COLORS[i % COLORS.length]}/>
                          ))}
                        </Pie>
                        <Tooltip/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty text="ยังไม่มีรายจ่าย"/>}
              </Card>
            </div>

            <div className="mt-5">
              <ActionButton onClick={openTransaction}>
                + บันทึกรายการใหม่
              </ActionButton>
            </div>
          </>}

          {/* รายรับรายจ่าย */}
          {page === "transactions" && <>
            <div className="mb-5">
              <ActionButton onClick={openTransaction}>
                + เพิ่มรายการ
              </ActionButton>
            </div>
            <TransactionList items={transactions}/>
          </>}

          {/* บัญชี */}
          {page === "accounts" && <>
            <div className="mb-5">
              <ActionButton onClick={addAccount}
                disabled={!connected || busy}>
                + เพิ่มบัญชี
              </ActionButton>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {accounts.map(a => (
                <Card key={a.id}>
                  <Wallet className="text-emerald-500 mb-3"/>
                  <p>{a.name}</p>
                  <p className="text-2xl font-bold mt-2">
                    {money(balances[a.id])}
                  </p>
                  <p className="text-xs opacity-60 mt-3">
                    ยอดตั้งต้น {money(a.opening)}
                  </p>
                </Card>
              ))}
            </div>
            {!accounts.length && <Empty/>}
          </>}

          {/* เงินออม */}
          {page === "savings" && <>
            <div className="mb-5">
              <ActionButton onClick={addGoal}
                disabled={!connected || busy}>
                + สร้างเป้าหมาย
              </ActionButton>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {goals.map(g => (
                <Card key={g.id}>
                  <PiggyBank className="text-emerald-500 mb-3"/>
                  <h3 className="font-bold">{g.name}</h3>
                  <p className="mt-2">
                    {money(g.saved)} / {money(g.target)}
                  </p>
                  <Progress value={g.saved} max={g.target}/>
                  <div className="flex gap-3 mt-4">
                    <ActionButton
                      disabled={busy}
                      onClick={() => depositGoal(g)}>
                      + เพิ่มยอดออม
                    </ActionButton>
                    <button
                      onClick={() =>
                        removeRecord("Savings", g.id)}
                      className="text-rose-500"
                    >
                      <Trash2/>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            {!goals.length && <Empty/>}
          </>}

          {/* งบประมาณ */}
          {page === "budgets" && <>
            <div className="mb-5">
              <ActionButton onClick={addBudget}
                disabled={!connected || busy}>
                + ตั้งงบเดือนนี้
              </ActionButton>
            </div>

            <div className="space-y-4">
              {budgets.filter(b =>
                b.month === currentMonth()
              ).map(b => {
                const used = spending.find(s =>
                  s.name === b.category)?.value || 0;

                return (
                  <Card key={b.id}>
                    <div className="flex justify-between gap-3">
                      <b>{b.category}</b>
                      <span className="text-sm">
                        {money(used)} / {money(b.limit)}
                      </span>
                    </div>
                    <Progress value={used} max={b.limit}/>
                    {used > b.limit && (
                      <p className="text-rose-500 text-sm mt-2">
                        เกินงบ {money(used - b.limit)}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </>}

          {/* หารบิล */}
          {page === "bills" && <>
            <div className="mb-5">
              <ActionButton onClick={addBill}
                disabled={!connected || busy}>
                + สร้างบิล
              </ActionButton>
            </div>

            <div className="space-y-4">
              {bills.map(b => (
                <Card key={b.id}>
                  <div className="flex justify-between">
                    <h3 className="font-bold">{b.name}</h3>
                    <span className={
                      b.settled
                        ? "text-emerald-500"
                        : "text-amber-500"
                    }>
                      {b.settled
                        ? "เคลียร์แล้ว"
                        : "ยังไม่เคลียร์"}
                    </span>
                  </div>
                  <p className="mt-3">
                    ยอดรวม {money(b.amount)}
                  </p>
                  <p>
                    {b.people} คน · คนละ {
                      money(b.amount / b.people)
                    }
                  </p>
                  <div className="flex gap-3 mt-4">
                    <ActionButton
                      disabled={busy}
                      onClick={() => toggleBill(b)}>
                      เปลี่ยนสถานะ
                    </ActionButton>
                    <button
                      className="text-rose-500"
                      onClick={() =>
                        removeRecord("Bills", b.id)}
                    >
                      <Trash2/>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            {!bills.length && <Empty/>}
          </>}

          {/* ตรวจยอดธนาคาร */}
          {page === "reconcile" && <>
            <div className="mb-5">
              <ActionButton onClick={addCheck}
                disabled={!connected || busy}>
                + ตรวจสอบยอดเงิน
              </ActionButton>
            </div>

            <div className="space-y-4">
              {[...checks].reverse().map(c => {
                const diff =
                  Number(c.actual) - Number(c.expected);

                return (
                  <Card key={c.id}>
                    <h3 className="font-bold mb-3">
                      {accounts.find(a =>
                        a.id === c.accountId)?.name ||
                        "บัญชีไม่พบ"}
                    </h3>
                    <p>ยอดตามแอป {money(c.expected)}</p>
                    <p>ยอดเงินจริง {money(c.actual)}</p>
                    <p className={
                      "font-bold mt-3 " +
                      (Math.abs(diff) < 0.005
                        ? "text-emerald-500"
                        : "text-rose-500")
                    }>
                      ส่วนต่าง {money(diff)}
                    </p>
                    <p className="text-xs opacity-60 mt-2">
                      {new Date(c.date)
                        .toLocaleString("th-TH")}
                    </p>
                  </Card>
                );
              })}
            </div>
            {!checks.length && <Empty/>}
          </>}

          {/* ประวัติธุรกรรม */}
          {page === "history" && <>
            <div className="grid sm:grid-cols-3
              gap-3 mb-5">
              <input
                placeholder="ค้นหารายการ"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border rounded-xl p-3
                  text-slate-900"
              />
              <select
                value={typeFilter}
                onChange={e =>
                  setTypeFilter(e.target.value)}
                className="border rounded-xl p-3
                  text-slate-900"
              >
                <option value="all">ทั้งหมด</option>
                <option value="income">รายรับ</option>
                <option value="expense">รายจ่าย</option>
                <option value="transfer">โอนเงิน</option>
              </select>
              <input
                type="month"
                value={dateFilter}
                onChange={e =>
                  setDateFilter(e.target.value)}
                className="border rounded-xl p-3
                  text-slate-900"
              />
            </div>

            <TransactionList items={
              transactions.filter(t =>
                (typeFilter === "all" ||
                 t.type === typeFilter) &&
                (!dateFilter ||
                 String(t.date).startsWith(dateFilter)) &&
                (`${t.note} ${t.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase()))
              )
            }/>
          </>}

          {/* ตั้งค่า */}
          {page === "settings" &&
            <Card>
              <h3 className="text-xl font-bold">
                ตั้งค่า MoneyFlow
              </h3>

              <div className="mt-5 space-y-4">
                <p>
                  การเชื่อมต่อ: {
                    connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อม"
                  }
                </p>

                <p>
                  ธีม: {dark ? "Dark Mode" : "Light Mode"}
                </p>

                <ActionButton
                  onClick={() => setDark(!dark)}
                  secondary>
                  เปลี่ยนธีม
                </ActionButton>

                <hr className="dark:border-slate-700"/>

                {connected ? (
                  <ActionButton onClick={logout}
                    secondary>
                    ออกจาก Google
                  </ActionButton>
                ) : (
                  <ActionButton onClick={login}>
                    เชื่อม Google
                  </ActionButton>
                )}

                <p className="text-sm opacity-60">
                  ฐานข้อมูลหลัก: Google Sheets
                </p>
                <p className="text-sm opacity-60">
                  ซิงค์ข้อมูลทุก 30 วินาทีขณะเปิดแอป
                </p>
                <p className="text-sm opacity-60">
                  เมื่อออฟไลน์จะยังไม่สามารถบันทึก
                  ธุรกรรมใหม่ได้
                </p>
              </div>
            </Card>
          }
        </main>
      </div>

      {/* หน้าต่างเพิ่มธุรกรรม */}
      {modal && (
        <div className="fixed inset-0 z-50
          bg-black/60 flex items-center
          justify-center p-4">
          <form
            onSubmit={saveTransaction}
            className="bg-white text-slate-900
              rounded-2xl p-6 w-full max-w-md
              space-y-3 max-h-[90vh]
              overflow-y-auto"
          >
            <div className="flex justify-between
              items-center">
              <h3 className="text-xl font-bold">
                บันทึกรายการ
              </h3>
              <button type="button"
                onClick={() => setModal(false)}>
                <X/>
              </button>
            </div>

            <select
              value={form.type}
              onChange={e => setForm({
                ...form, type: e.target.value
              })}
              className="w-full border rounded-xl p-3"
            >
              <option value="expense">รายจ่าย</option>
              <option value="income">รายรับ</option>
              <option value="transfer">โอนเงิน</option>
            </select>

            <input
              type="number"
              required min="0.01" step="0.01"
              placeholder="จำนวนเงิน"
              value={form.amount}
              onChange={e => setForm({
                ...form, amount: e.target.value
              })}
              className="w-full border rounded-xl p-3"
            />

            {form.type !== "transfer" && (
              <select
                value={form.category}
                onChange={e => setForm({
                  ...form, category: e.target.value
                })}
                className="w-full border rounded-xl p-3"
              >
                {CATEGORIES.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}

            <label className="block text-sm">
              บัญชีต้นทาง
            </label>
            <select
              required
              value={form.accountId}
              onChange={e => setForm({
                ...form, accountId: e.target.value
              })}
              className="w-full border rounded-xl p-3"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {form.type === "transfer" && <>
              <label className="block text-sm">
                บัญชีปลายทาง
              </label>
              <select
                required
                value={form.toAccountId}
                onChange={e => setForm({
                  ...form, toAccountId: e.target.value
                })}
                className="w-full border rounded-xl p-3"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>}

            <input
              type="date"
              required
              value={form.date}
              onChange={e => setForm({
                ...form, date: e.target.value
              })}
              className="w-full border rounded-xl p-3"
            />

            <textarea
              placeholder="หมายเหตุ"
              value={form.note}
              onChange={e => setForm({
                ...form, note: e.target.value
              })}
              className="w-full border rounded-xl p-3"
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600
                text-white rounded-xl p-3
                font-bold disabled:opacity-50"
            >
              {busy ? "กำลังบันทึก..." : "บันทึกลง Google Sheets"}
            </button>
          </form>
        </div>
      )}

      {/* เมนูด้านล่างสำหรับมือถือ */}
      <div className="md:hidden fixed bottom-0
        inset-x-0 bg-white dark:bg-slate-900
        border-t dark:border-slate-800
        flex justify-around py-3 z-30">
        {NAV.slice(0, 4).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={
              "flex flex-col items-center text-xs " +
              (page === id ? "text-emerald-500" : "")
            }
          >
            <Icon size={21}/>
            {label}
          </button>
        ))}
        <button onClick={() => setMenu(!menu)}
          className="flex flex-col items-center text-xs">
          <Menu size={21}/>
          อื่นๆ
        </button>
      </div>
    </div>
  );
}
