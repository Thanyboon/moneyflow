
import React, { useMemo, useState } from "react";
import {
  LayoutDashboard, ArrowLeftRight, Wallet,
  PiggyBank, ChartPie, Users, Landmark,
  History, Settings, Plus, Trash2, Moon,
  Sun, Search, Check, Menu, X
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, Tooltip, PieChart, Pie, Cell
} from "recharts";

// ข้อมูลเริ่มต้นสำหรับแสดงหน้าจอ
// จะเชื่อม Google Sheets ในขั้นตอนถัดไป
const initialAccounts = [
  { id: "cash", name: "เงินสด", opening: 0 },
  { id: "bank", name: "บัญชีธนาคาร", opening: 0 }
];

const categories = [
  "อาหาร", "เดินทาง", "ช้อปปิ้ง",
  "ที่พัก", "การศึกษา", "สุขภาพ",
  "เงินเดือน", "รายได้เสริม", "อื่นๆ"
];

const nav = [
  ["dashboard", "ภาพรวม", LayoutDashboard],
  ["transactions", "รายรับรายจ่าย", ArrowLeftRight],
  ["accounts", "กระเป๋าเงิน", Wallet],
  ["savings", "เงินออม", PiggyBank],
  ["budgets", "งบประมาณ", ChartPie],
  ["bills", "หารบิล", Users],
  ["reconcile", "ตรวจยอดเงิน", Landmark],
  ["history", "ประวัติ", History],
  ["settings", "ตั้งค่า", Settings]
];

const uid = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}-${Math.random()}`;

const money = n =>
  new Intl.NumberFormat("th-TH", {
    style: "currency", currency: "THB"
  }).format(Number(n) || 0);

const today = () =>
  new Date().toLocaleDateString("en-CA");

const monthKey = date => String(date || "").slice(0, 7);

const Card = ({ children, dark, className = "" }) => (
  <div className={
    `rounded-2xl p-5 shadow-sm border ${
      dark
        ? "bg-slate-800 border-slate-700"
        : "bg-white border-slate-100"
    } ${className}`
  }>
    {children}
  </div>
);

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [bills, setBills] = useState([]);
  const [checks, setChecks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [form, setForm] = useState({
    type: "expense", amount: "", category: "อาหาร",
    accountId: "cash", toAccountId: "bank",
    date: today(), note: ""
  });

  const currentMonth = today().slice(0, 7);

  // คำนวณยอดแต่ละบัญชี รวมการโอนเงิน
  const balances = useMemo(() => {
    const result = Object.fromEntries(
      accounts.map(a => [a.id, Number(a.opening) || 0])
    );
    transactions.forEach(t => {
      const amount = Number(t.amount) || 0;
      if (t.type === "income")
        result[t.accountId] = (result[t.accountId] || 0) + amount;
      if (t.type === "expense")
        result[t.accountId] = (result[t.accountId] || 0) - amount;
      if (t.type === "transfer") {
        result[t.accountId] = (result[t.accountId] || 0) - amount;
        result[t.toAccountId] = (result[t.toAccountId] || 0) + amount;
      }
    });
    return result;
  }, [accounts, transactions]);

  const monthly = transactions.filter(t =>
    monthKey(t.date) === currentMonth
  );
  const income = monthly.filter(t => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthly.filter(t => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const total = Object.values(balances)
    .reduce((s, v) => s + v, 0);

  const spending = categories.map(name => ({
    name,
    value: monthly.filter(t =>
      t.type === "expense" && t.category === name
    ).reduce((s, t) => s + Number(t.amount), 0)
  })).filter(x => x.value > 0);

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const key = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0")
    ].join("-");
    const tx = transactions.filter(t => monthKey(t.date) === key);
    return {
      name: d.toLocaleDateString("th-TH", { month: "short" }),
      income: tx.filter(t => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0),
      expense: tx.filter(t => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0)
    };
  });

  function saveTransaction(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return alert("กรอกจำนวนเงินให้ถูกต้อง");
    if (form.type === "transfer" &&
        form.accountId === form.toAccountId)
      return alert("ต้องเลือกบัญชีปลายทางต่างจากต้นทาง");
    setTransactions(prev => [{
      ...form, id: uid(), amount
    }, ...prev]);
    setShowForm(false);
    setForm(prev => ({ ...prev, amount: "", note: "" }));
  }

  function addAccount() {
    const name = prompt("ชื่อบัญชีหรือกระเป๋าเงิน");
    if (!name?.trim()) return;
    const opening = Number(prompt("ยอดเงินเริ่มต้น", "0"));
    if (!Number.isFinite(opening)) return;
    setAccounts(prev => [...prev, {
      id: uid(), name: name.trim(), opening
    }]);
  }

  function addGoal() {
    const name = prompt("ชื่อเป้าหมายการออม");
    if (!name?.trim()) return;
    const target = Number(prompt("จำนวนเงินเป้าหมาย"));
    if (!(target > 0)) return;
    setGoals(prev => [...prev, {
      id: uid(), name, target, saved: 0
    }]);
  }

  function addBudget() {
    const category = prompt(
      "หมวดหมู่: " + categories.join(", "), "อาหาร"
    );
    if (!categories.includes(category)) return;
    const limit = Number(prompt("งบประมาณต่อเดือน"));
    if (!(limit > 0)) return;
    setBudgets(prev => [
      ...prev.filter(b => b.category !== category),
      { id: uid(), category, limit }
    ]);
  }

  function addBill() {
    const name = prompt("ชื่อบิล เช่น ค่าอาหาร");
    if (!name?.trim()) return;
    const amount = Number(prompt("ยอดรวมของบิล"));
    const people = Number(prompt("จำนวนคนรวมตัวเรา", "2"));
    if (!(amount > 0) || !Number.isInteger(people) || people < 2)
      return alert("ข้อมูลไม่ถูกต้อง");
    setBills(prev => [{
      id: uid(), name, amount, people, settled: false
    }, ...prev]);
  }

  function addCheck() {
    const accountId = prompt(
      "รหัสบัญชี:\n" +
      accounts.map(a => `${a.id} = ${a.name}`).join("\n"),
      accounts[0]?.id
    );
    if (!accounts.some(a => a.id === accountId)) return;
    const raw = prompt("ยอดเงินจริงที่ธนาคารแสดง");
    if (raw === null || raw.trim() === "") return;
    const actual = Number(raw);
    if (!Number.isFinite(actual)) return;
    setChecks(prev => [{
      id: uid(), accountId, actual,
      expected: balances[accountId] || 0,
      date: new Date().toISOString()
    }, ...prev]);
  }

  const heading = nav.find(n => n[0] === page)?.[1];

  const Button = ({ children, onClick }) => (
    <button onClick={onClick}
      className="bg-emerald-600 hover:bg-emerald-700
      text-white rounded-xl px-4 py-3 font-medium">
      {children}
    </button>
  );

  return (
    <div className={`${dark
      ? "dark bg-slate-950 text-white"
      : "bg-slate-50 text-slate-900"
    } min-h-screen`}>
      <div className="max-w-7xl mx-auto md:flex min-h-screen">
        <aside className={`${menu ? "block" : "hidden"}
          md:block md:w-60 shrink-0 p-4
          ${dark ? "bg-slate-900" : "bg-white"}
          border-r border-slate-200/10`}>
          <div className="text-2xl font-bold text-emerald-500
            mb-8 flex items-center gap-2">
            <Wallet /> MoneyFlow
          </div>
          <nav className="space-y-1">
            {nav.map(([id, label, Icon]) => (
              <button key={id}
                onClick={() => { setPage(id); setMenu(false); }}
                className={`w-full flex items-center gap-3
                px-4 py-3 rounded-xl text-left ${
                  page === id
                    ? "bg-emerald-600 text-white"
                    : "hover:bg-emerald-500/10"
                }`}>
                <Icon size={19}/>{label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-4 md:p-8 pb-24">
          <header className="flex justify-between items-center mb-7">
            <div className="flex items-center gap-3">
              <button className="md:hidden"
                onClick={() => setMenu(!menu)}>
                {menu ? <X/> : <Menu/>}
              </button>
              <h1 className="text-2xl font-bold">{heading}</h1>
            </div>
            <button onClick={() => setDark(!dark)}
              className="p-3 rounded-xl bg-emerald-500/10">
              {dark ? <Sun/> : <Moon/>}
            </button>
          </header>

          {page === "dashboard" && <>
            <Card dark={dark} className="mb-4
              bg-gradient-to-r from-emerald-600 to-teal-500
              !text-white">
              <p className="opacity-80">ยอดเงินคงเหลือทั้งหมด</p>
              <h2 className="text-4xl font-bold mt-2">{money(total)}</h2>
              <p className="mt-3 text-sm opacity-80">
                จาก {accounts.length} บัญชี
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Card dark={dark}>
                <p className="text-sm">รายรับเดือนนี้</p>
                <h3 className="text-xl font-bold text-emerald-500">
                  {money(income)}
                </h3>
              </Card>
              <Card dark={dark}>
                <p className="text-sm">รายจ่ายเดือนนี้</p>
                <h3 className="text-xl font-bold text-rose-500">
                  {money(expense)}
                </h3>
              </Card>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <Card dark={dark}>
                <h3 className="font-bold mb-5">รายรับ-รายจ่าย 6 เดือน</h3>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <XAxis dataKey="name"/>
                      <Tooltip/>
                      <Bar dataKey="income" fill="#10b981"/>
                      <Bar dataKey="expense" fill="#fb7185"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card dark={dark}>
                <h3 className="font-bold mb-4">หมวดหมู่รายจ่าย</h3>
                {spending.length ? (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={spending} dataKey="value"
                          nameKey="name" outerRadius={85} label>
                          {spending.map((_, i) => (
                            <Cell key={i} fill={[
                              "#10b981", "#38bdf8", "#f59e0b",
                              "#a78bfa", "#fb7185"
                            ][i % 5]}/>
                          ))}
                        </Pie>
                        <Tooltip/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="opacity-60">ยังไม่มีรายจ่าย</p>}
              </Card>
            </div>
            <div className="mt-5">
              <Button onClick={() => setShowForm(true)}>
                + บันทึกรายการใหม่
              </Button>
            </div>
          </>}

          {page === "transactions" && <>
            <Button onClick={() => setShowForm(true)}>
              + เพิ่มรายรับ รายจ่าย หรือโอนเงิน
            </Button>
            <div className="mt-5">
              <TransactionList transactions={transactions}
                accounts={accounts} dark={dark} money={money}
                onDelete={id => setTransactions(prev =>
                  prev.filter(t => t.id !== id))}/>
            </div>
          </>}

          {page === "accounts" && <>
            <div className="flex justify-end mb-4">
              <Button onClick={addAccount}>+ เพิ่มบัญชี</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {accounts.map(a => (
                <Card dark={dark} key={a.id}>
                  <Wallet className="text-emerald-500 mb-3"/>
                  <p>{a.name}</p>
                  <h3 className="text-2xl font-bold">
                    {money(balances[a.id])}
                  </h3>
                  <p className="text-xs opacity-60 mt-2">
                    ยอดตั้งต้น {money(a.opening)}
                  </p>
                </Card>
              ))}
            </div>
          </>}

          {page === "savings" && <>
            <Button onClick={addGoal}>+ สร้างเป้าหมาย</Button>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              {goals.map(g => (
                <Card dark={dark} key={g.id}>
                  <PiggyBank className="text-emerald-500 mb-2"/>
                  <h3 className="font-bold">{g.name}</h3>
                  <p>{money(g.saved)} / {money(g.target)}</p>
                  <div className="bg-slate-200 rounded-full h-3 my-3">
                    <div className="bg-emerald-500 h-3 rounded-full"
                      style={{width: `${Math.min(100,
                        g.saved / g.target * 100)}%`}}/>
                  </div>
                  <Button onClick={() => {
                    const n = Number(prompt("เพิ่มยอดเงินออม"));
                    if (!(n > 0)) return;
                    setGoals(prev => prev.map(x =>
                      x.id === g.id
                        ? {...x, saved: x.saved + n} : x));
                  }}>+ เพิ่มยอดออม</Button>
                </Card>
              ))}
            </div>
          </>}

          {page === "budgets" && <>
            <Button onClick={addBudget}>+ ตั้งงบประมาณ</Button>
            <div className="space-y-4 mt-5">
              {budgets.map(b => {
                const used = spending.find(s =>
                  s.name === b.category)?.value || 0;
                return (
                  <Card dark={dark} key={b.id}>
                    <div className="flex justify-between">
                      <b>{b.category}</b>
                      <span>{money(used)} / {money(b.limit)}</span>
                    </div>
                    <div className="bg-slate-200 h-3 rounded-full mt-3">
                      <div className={`h-3 rounded-full ${
                        used > b.limit ? "bg-rose-500" : "bg-emerald-500"
                      }`} style={{
                        width: `${Math.min(100,
                          used / b.limit * 100)}%`
                      }}/>
                    </div>
                    {used > b.limit &&
                      <p className="text-rose-500 text-sm mt-2">
                        เกินงบประมาณ {money(used - b.limit)}
                      </p>}
                  </Card>
                );
              })}
            </div>
          </>}

          {page === "bills" && <>
            <Button onClick={addBill}>+ สร้างบิลหารกับเพื่อน</Button>
            <div className="space-y-4 mt-5">
              {bills.map(b => (
                <Card dark={dark} key={b.id}>
                  <div className="flex justify-between gap-2">
                    <h3 className="font-bold">{b.name}</h3>
                    <span className={b.settled
                      ? "text-emerald-500" : "text-amber-500"}>
                      {b.settled ? "เคลียร์แล้ว" : "ยังไม่เคลียร์"}
                    </span>
                  </div>
                  <p>ยอดรวม {money(b.amount)}</p>
                  <p>{b.people} คน · คนละ {
                    money(b.amount / b.people)
                  }</p>
                  <button className="text-emerald-500 mt-3"
                    onClick={() => setBills(prev => prev.map(x =>
                      x.id === b.id
                        ? {...x, settled: !x.settled} : x))}>
                    เปลี่ยนสถานะการชำระ
                  </button>
                </Card>
              ))}
            </div>
          </>}

          {page === "reconcile" && <>
            <Button onClick={addCheck}>+ ตรวจสอบยอดเงินจริง</Button>
            <div className="space-y-4 mt-5">
              {checks.map(c => {
                const diff = c.actual - c.expected;
                return (
                  <Card dark={dark} key={c.id}>
                    <h3 className="font-bold">
                      {accounts.find(a =>
                        a.id === c.accountId)?.name}
                    </h3>
                    <p>ยอดตามแอป {money(c.expected)}</p>
                    <p>ยอดเงินจริง {money(c.actual)}</p>
                    <p className={Math.abs(diff) < 0.005
                      ? "text-emerald-500" : "text-rose-500"}>
                      ส่วนต่าง {money(diff)}
                    </p>
                    <p className="text-xs opacity-60">
                      {new Date(c.date).toLocaleString("th-TH")}
                    </p>
                  </Card>
                );
              })}
            </div>
          </>}

          {page === "history" && <>
            <div className="flex flex-wrap gap-3 mb-4">
              <input placeholder="ค้นหาหมายเหตุหรือหมวดหมู่"
                value={search} onChange={e => setSearch(e.target.value)}
                className="border rounded-xl p-3 text-slate-900 flex-1"/>
              <select value={filter}
                onChange={e => setFilter(e.target.value)}
                className="border rounded-xl p-3 text-slate-900">
                <option value="all">ทั้งหมด</option>
                <option value="income">รายรับ</option>
                <option value="expense">รายจ่าย</option>
                <option value="transfer">โอนเงิน</option>
              </select>
            </div>
            <TransactionList dark={dark} money={money}
              accounts={accounts}
              transactions={transactions.filter(t =>
                (filter === "all" || t.type === filter) &&
                `${t.note} ${t.category}`.toLowerCase()
                  .includes(search.toLowerCase()))}
              onDelete={id => setTransactions(prev =>
                prev.filter(t => t.id !== id))}/>
          </>}

          {page === "settings" &&
            <Card dark={dark}>
              <h3 className="font-bold text-lg">ตั้งค่า MoneyFlow</h3>
              <p className="mt-4">ธีม: {dark ? "มืด" : "สว่าง"}</p>
              <button onClick={() => setDark(!dark)}
                className="text-emerald-500 mt-2">
                เปลี่ยนธีม
              </button>
              <hr className="my-5 opacity-20"/>
              <p className="font-bold">การเชื่อมต่อข้อมูล</p>
              <p className="text-amber-500 mt-2">
                ยังไม่ได้เชื่อม Google Sheets
              </p>
              <p className="text-sm opacity-60 mt-2">
                ข้อมูลในเวอร์ชันนี้อยู่ในหน่วยความจำ
                และจะหายเมื่อรีโหลดหน้าเว็บ
              </p>
            </Card>
          }
        </main>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60
          flex items-center justify-center p-4">
          <form onSubmit={saveTransaction}
            className="bg-white text-slate-900 rounded-2xl
            p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-auto">
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">บันทึกรายการ</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X/>
              </button>
            </div>
            <select className="w-full border p-3 rounded-xl"
              value={form.type}
              onChange={e => setForm({
                ...form, type: e.target.value
              })}>
              <option value="expense">รายจ่าย</option>
              <option value="income">รายรับ</option>
              <option value="transfer">โอนระหว่างบัญชี</option>
            </select>
            <input type="number" min="0.01" step="0.01"
              required placeholder="จำนวนเงิน"
              className="w-full border p-3 rounded-xl"
              value={form.amount}
              onChange={e => setForm({
                ...form, amount: e.target.value
              })}/>
            {form.type !== "transfer" && (
              <select className="w-full border p-3 rounded-xl"
                value={form.category}
                onChange={e => setForm({
                  ...form, category: e.target.value
                })}>
                {categories.map(c =>
                  <option key={c}>{c}</option>)}
              </select>
            )}
            <label className="block text-sm">บัญชีต้นทาง</label>
            <select className="w-full border p-3 rounded-xl"
              value={form.accountId}
              onChange={e => setForm({
                ...form, accountId: e.target.value
              })}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {form.type === "transfer" && <>
              <label className="block text-sm">บัญชีปลายทาง</label>
              <select className="w-full border p-3 rounded-xl"
                value={form.toAccountId}
                onChange={e => setForm({
                  ...form, toAccountId: e.target.value
                })}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </>}
            <input type="date" required
              className="w-full border p-3 rounded-xl"
              value={form.date}
              onChange={e => setForm({
                ...form, date: e.target.value
              })}/>
            <textarea placeholder="หมายเหตุ"
              className="w-full border p-3 rounded-xl"
              value={form.note}
              onChange={e => setForm({
                ...form, note: e.target.value
              })}/>
            <button type="submit"
              className="w-full bg-emerald-600 text-white
              rounded-xl p-3 font-bold">
              บันทึกรายการ
            </button>
          </form>
        </div>
      )}

      <div className={`md:hidden fixed bottom-0 inset-x-0
        border-t flex justify-around py-3 ${
          dark ? "bg-slate-900" : "bg-white"
        }`}>
        {nav.slice(0, 5).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setPage(id)}
            className={`flex flex-col items-center text-xs ${
              page === id ? "text-emerald-500" : ""
            }`}>
            <Icon size={22}/>{label}
          </button>
        ))}
        <button onClick={() => setMenu(!menu)}>
          <Menu size={22}/> <span className="text-xs">อื่นๆ</span>
        </button>
      </div>
    </div>
  );
}

function TransactionList({
  transactions, accounts, dark, money, onDelete
}) {
  if (!transactions.length) return (
    <Card dark={dark}>
      <p className="opacity-60 text-center py-8">
        ยังไม่มีรายการธุรกรรม
      </p>
    </Card>
  );

  return (
    <div className="space-y-3">
      {transactions.map(t => (
        <Card dark={dark} key={t.id}>
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="font-bold">
                {t.type === "transfer"
                  ? "โอนเงิน" : t.category}
              </p>
              <p className="text-sm opacity-60">
                {t.date} · {t.note || "ไม่มีหมายเหตุ"}
              </p>
              <p className="text-xs opacity-60">
                {accounts.find(a =>
                  a.id === t.accountId)?.name}
              </p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${
                t.type === "income"
                  ? "text-emerald-500"
                  : t.type === "expense"
                    ? "text-rose-500" : ""
              }`}>
                {t.type === "income" ? "+" : "-"}
                {money(t.amount)}
              </p>
              <button className="text-rose-400 mt-2"
                onClick={() => {
                  if (confirm("ลบรายการนี้?")) onDelete(t.id);
                }}>
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
