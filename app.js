/* MONEYFLOW APP — เชื่อม Google Apps Script ตาม Backend v1 */
(() => {
"use strict";
const API_URL = "https://script.google.com/macros/s/AKfycbznU3pTIl4qmb2S0n18abnwKl6i7PPdobQcHNg_TAIBGdlGuXg8mWwDKpxZs39FlBWJJg/exec";
const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
const state = {page:"dashboard",data:{},key:sessionStorage.getItem("mf_api_key")||"",busy:false,filter:""};
const content=$("#content"), modalRoot=$("#modalRoot");
const names={dashboard:"ภาพรวมการเงิน",transactions:"รายรับ-รายจ่าย",wallets:"บัญชี / กระเป๋าเงิน",goals:"เป้าหมายการออม",budgets:"งบประมาณรายเดือน",reconcile:"ตรวจสอบยอดธนาคาร",bills:"หารบิลกับเพื่อน",reports:"รายงาน",settings:"ตั้งค่าและซิงค์"};
const money=n=>new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB"}).format(Number(n)||0);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const month=()=>today().slice(0,7);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rows=name=>(state.data[name]||[]);
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)};
function setSync(ok,msg){const el=$("#syncState");el.classList.toggle("online",!!ok);el.innerHTML=`<i></i>${esc(msg)}`;}
function jsonp(params){
 return new Promise((resolve,reject)=>{
  const cb="mfcb_"+Date.now()+"_"+Math.floor(Math.random()*1e6);
  const script=document.createElement("script");
  const q=new URLSearchParams({...params,callback:cb});
  const timer=setTimeout(()=>{cleanup();reject(new Error("เชื่อมต่อหมดเวลา กรุณาตรวจสอบ URL และ API Key"))},18000);
  function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
  window[cb]=data=>{cleanup();resolve(data)};
  script.onerror=()=>{cleanup();reject(new Error("อ่านข้อมูลจาก Apps Script ไม่สำเร็จ"))};
  script.src=API_URL+"?"+q.toString();document.head.appendChild(script);
 });
}
async function loadData(){
 if(!state.key){setSync(false,"ยังไม่ตั้งค่า API Key");return false}
 setSync(false,"กำลังซิงค์...");
 const result=await jsonp({action:"getAll",key:state.key});
 if(!result||!result.success)throw new Error(result?.error||"อ่านข้อมูลไม่สำเร็จ");
 state.data=result.data||{};setSync(true,"ซิงค์แล้ว");render();return true;
}
async function post(body){
 if(!state.key)throw new Error("กรุณาตั้งค่า API Key ในเมนูตั้งค่าก่อน");
 // Apps Script cross-origin POST: no-cors response is opaque.
 // After sending, the app re-reads Sheets to confirm visible state.
 await fetch(API_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...body,key:state.key})});
 await new Promise(r=>setTimeout(r,1100));
 await loadData();
}
function activeWallets(){return rows("Wallets").filter(w=>w.is_active===true||String(w.is_active)==="TRUE")}
function activeCats(type){return rows("Categories").filter(c=>(c.is_active===true||String(c.is_active)==="TRUE")&&(!type||c.type===type))}
function balanceFor(walletId,until=today()){
 const w=rows("Wallets").find(x=>x.wallet_id===walletId);if(!w)return 0;
 let b=Number(w.opening_balance)||0;
 rows("Transactions").filter(t=>t.wallet_id===walletId&&!t.deleted_at&&String(t.date)<=until).forEach(t=>{
  const a=Number(t.amount)||0;if(t.type==="income")b+=a;else if(t.type==="expense")b-=a;else if(t.type==="transfer"){if(t.transfer_direction==="in")b+=a;if(t.transfer_direction==="out")b-=a}
 });return b;
}
function allBalance(){return activeWallets().reduce((s,w)=>s+balanceFor(w.wallet_id),0)}
function monthTotals(){
 const tx=rows("Transactions").filter(t=>!t.deleted_at&&String(t.date).startsWith(month()));
 return {income:tx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0),expense:tx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0)};
}
function head(title,sub,button=""){return `<div class="page-head"><div><p class="eyebrow">MONEYFLOW / PERSONAL FINANCE</p><h1>${title}</h1><p class="sub">${sub||""}</p></div>${button}</div>`}
function stat(label,value,note,cls=""){return `<article class="card"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${money(value)}</div><div class="stat-note">${note||""}</div></article>`}
function empty(msg){return `<div class="empty"><b>${msg}</b>ข้อมูลจะแสดงเมื่อบันทึกรายการแล้ว</div>`}
function render(){
 $$(".nav,.mobile-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
 const renderers={dashboard:dashboard,transactions:transactions,wallets:wallets,goals:goals,budgets:budgets,reconcile:reconcile,bills:bills,reports:reports,settings:settings};
 content.innerHTML=(renderers[state.page]||dashboard)();
}
function dashboard(){
 const t=monthTotals(), tx=rows("Transactions").filter(x=>!x.deleted_at&&x.type==="expense"&&String(x.date).startsWith(month()));
 const sums={};tx.forEach(x=>{const c=rows("Categories").find(c=>c.category_id===x.category_id);const k=c?.category_name||"ไม่ระบุ";sums[k]=(sums[k]||0)+Number(x.amount)});
 const top=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const recent=rows("Transactions").filter(x=>!x.deleted_at).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
 const max=Math.max(1,...top.map(x=>x[1]));
 return `${head("ภาพรวมการเงิน","สรุปสถานะการเงินของคุณ",`<button class="btn" data-modal="transaction">＋ เพิ่มรายการ</button>`)}
 <div class="grid stats">${stat("ยอดคงเหลือรวม",allBalance(),"ทุกบัญชี ณ วันนี้","purple")}${stat("รายรับเดือนนี้",t.income,"รายรับที่บันทึกไว้","green")}${stat("รายจ่ายเดือนนี้",t.expense,"รายจ่ายที่บันทึกไว้","red")}</div>
 <div class="grid two-col"><section class="card"><h2 class="card-title">ค่าใช้จ่ายตามหมวดหมู่</h2>${top.length?top.map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-value">${money(v)}</span></div>`).join(""):empty("ยังไม่มีรายจ่ายเดือนนี้")}</section>
 <section class="card"><h2 class="card-title">บัญชีและกระเป๋าเงิน</h2>${activeWallets().length?`<div class="list">${activeWallets().map(w=>`<div class="list-row"><span>${esc(w.wallet_name)}</span><b>${money(balanceFor(w.wallet_id))}</b></div>`).join("")}</div>`:empty("ยังไม่มีบัญชี")}</section></div>
 <section class="card" style="margin-top:15px"><h2 class="card-title">รายการล่าสุด</h2>${recent.length?`<div class="table-wrap"><table class="table"><thead><tr><th>วันที่</th><th>รายการ</th><th>บัญชี</th><th>ประเภท</th><th>จำนวนเงิน</th></tr></thead><tbody>${recent.map(t=>`<tr><td>${esc(t.date)}</td><td>${esc(t.note||rows("Categories").find(c=>c.category_id===t.category_id)?.category_name||"รายการ")}</td><td>${esc(activeWallets().find(w=>w.wallet_id===t.wallet_id)?.wallet_name||"-")}</td><td>${esc(t.type)}</td><td class="${t.type==="income"?"green":t.type==="expense"?"red":""}">${money(t.amount)}</td></tr>`).join("")}</tbody></table></div>`:empty("ยังไม่มีธุรกรรม")}</section>`;
}
function transactions(){
 const list=rows("Transactions").filter(t=>!t.deleted_at).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const q=state.filter.toLowerCase();const filtered=list.filter(t=>[t.note,t.date,t.type,rows("Categories").find(c=>c.category_id===t.category_id)?.category_name].join(" ").toLowerCase().includes(q));
 return `${head("รายรับ-รายจ่าย","จัดการธุรกรรมทั้งหมด",`<button class="btn" data-modal="transaction">＋ เพิ่มรายการ</button>`)}
 <div class="toolbar"><input id="txSearch" placeholder="ค้นหาวันที่ หมวดหมู่ หรือหมายเหตุ..." value="${esc(state.filter)}"><select id="txType"><option value="">ทุกประเภท</option><option value="income">รายรับ</option><option value="expense">รายจ่าย</option><option value="transfer">โอนเงิน</option></select></div>
 <section class="card"><div class="table-wrap">${filtered.length?`<table class="table"><thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>บัญชี</th><th>หมายเหตุ</th><th>จำนวนเงิน</th><th>จัดการ</th></tr></thead><tbody>${filtered.map(t=>`<tr><td>${esc(t.date)}</td><td><span class="pill ${t.type==="income"?"green":t.type==="expense"?"red":""}">${esc(t.type)}</span></td><td>${esc(rows("Categories").find(c=>c.category_id===t.category_id)?.category_name||"-")}</td><td>${esc(activeWallets().find(w=>w.wallet_id===t.wallet_id)?.wallet_name||"-")}</td><td>${esc(t.note||"-")}</td><td>${money(t.amount)}</td><td><div class="actions"><button class="mini" data-edit-tx="${esc(t.transaction_id)}">แก้ไข</button><button class="mini" data-delete-tx="${esc(t.transaction_id)}">ลบ</button></div></td></tr>`).join("")}</tbody></table>`:empty("ไม่พบรายการ")}</div></section>`;
}
function wallets(){return `${head("บัญชี / กระเป๋าเงิน","จัดการเงินสดและบัญชีธนาคาร",`<button class="btn" data-modal="wallet">＋ เพิ่มบัญชี</button>`)}<div class="grid stats">${stat("ยอดรวม",allBalance(),"ทุกกระเป๋า")}${stat("จำนวนบัญชี",activeWallets().length,"บัญชีที่ใช้งาน")}${stat("สกุลเงิน","THB","เงินบาท")}</div><div class="grid two-col">${activeWallets().map(w=>`<section class="card"><p class="eyebrow">${esc(w.wallet_type||"WALLET")}</p><h2 class="card-title">${esc(w.wallet_name)}</h2><div class="stat-value purple">${money(balanceFor(w.wallet_id))}</div><p class="sub">ยอดตั้งต้น ${money(w.opening_balance)}</p><button class="mini" data-edit-wallet="${esc(w.wallet_id)}">แก้ไขบัญชี</button></section>`).join("")||empty("ยังไม่มีบัญชี")}</div>`}
function goals(){const list=rows("SavingsGoals").filter(g=>g.status!=="cancelled");return `${head("เป้าหมายการออม","ติดตามความคืบหน้าการเก็บเงิน",`<button class="btn" data-modal="goal">＋ สร้างเป้าหมาย</button>`)}<div class="grid two-col">${list.map(g=>{const p=Math.min(100,Math.max(0,Number(g.current_amount)/Math.max(1,Number(g.target_amount))*100));return `<section class="card goal"><div class="goal-top"><strong>${esc(g.goal_name)}</strong><span class="pill">${Math.round(p)}%</span></div><div class="progress"><span style="width:${p}%"></span></div><div class="goal-meta">${money(g.current_amount)} จาก ${money(g.target_amount)}</div><div class="actions"><button class="mini" data-goal-log="${esc(g.goal_id)}" data-kind="add">＋ เติมเงิน</button><button class="mini" data-goal-log="${esc(g.goal_id)}" data-kind="withdraw">ถอนเงิน</button></div></section>`}).join("")||empty("ยังไม่มีเป้าหมาย")}</div>`}
function budgets(){const list=rows("Budgets").filter(b=>b.month===month());return `${head("งบประมาณรายเดือน","กำหนดวงเงินและติดตามค่าใช้จ่าย",`<button class="btn" data-modal="budget">＋ ตั้งงบประมาณ</button>`)}<div class="grid two-col">${list.map(b=>{const cat=rows("Categories").find(c=>c.category_id===b.category_id);const spent=rows("Transactions").filter(t=>!t.deleted_at&&t.type==="expense"&&t.category_id===b.category_id&&String(t.date).startsWith(month())&&(!b.wallet_id||b.wallet_id===t.wallet_id)).reduce((s,t)=>s+Number(t.amount),0);const p=Math.min(100,spent/Math.max(1,Number(b.budget_amount))*100);return `<section class="card goal"><strong>${esc(cat?.category_name||"หมวดหมู่")}</strong><div class="progress"><span style="width:${p}%;background:${p>=100?"#e45d7b":"linear-gradient(90deg,#8d75f4,#6040db)"}"></span></div><div class="goal-meta">ใช้ ${money(spent)} / ${money(b.budget_amount)} (${Math.round(p)}%)</div></section>`}).join("")||empty("ยังไม่มีงบประมาณเดือนนี้")}</div>`}
function reconcile(){return `${head("ตรวจสอบยอดธนาคาร","เปรียบเทียบยอดที่ระบบคำนวณกับยอดเงินจริง",`<button class="btn" data-modal="reconcile">＋ ตรวจสอบยอด</button>`)}<div class="notice">ระบบคำนวณยอดจากยอดตั้งต้นและธุรกรรมที่บันทึกไว้จนถึงวันที่ตรวจสอบ กรุณาบันทึกรายการให้ครบก่อนเปรียบเทียบ</div><section class="card"><h2 class="card-title">ประวัติการตรวจสอบ</h2>${rows("Reconciliations").length?`<div class="table-wrap"><table class="table"><thead><tr><th>วันที่</th><th>บัญชี</th><th>ยอดในระบบ</th><th>ยอดธนาคาร</th><th>ส่วนต่าง</th></tr></thead><tbody>${rows("Reconciliations").slice().reverse().map(r=>`<tr><td>${esc(r.check_date)}</td><td>${esc(activeWallets().find(w=>w.wallet_id===r.wallet_id)?.wallet_name||"-")}</td><td>${money(r.system_balance)}</td><td>${money(r.bank_balance)}</td><td class="${Number(r.difference)===0?"green":"red"}">${money(r.difference)}</td></tr>`).join("")}</tbody></table></div>`:empty("ยังไม่มีประวัติการตรวจสอบ")}</section>`}
function bills(){return `${head("หารบิลกับเพื่อน","บันทึกค่าใช้จ่ายร่วมและยอดที่แต่ละคนต้องจ่าย",`<button class="btn" data-modal="bill">＋ สร้างบิล</button>`)}<div class="grid two-col">${rows("Bills").slice().reverse().map(b=>{const people=rows("BillParticipants").filter(p=>p.bill_id===b.bill_id);return `<section class="card"><div class="goal-top"><strong>${esc(b.bill_name)}</strong><span class="pill">${esc(b.status||"open")}</span></div><div class="stat-value purple">${money(b.total_amount)}</div><p class="sub">วันที่ ${esc(b.bill_date)} · ผู้จ่าย ${esc(b.paid_by_name||"-")}</p>${people.map(p=>`<div class="list-row"><span>${esc(p.person_name)} <small class="goal-meta">${esc(p.status)}</small></span><b>${money(p.amount_owed)}</b></div>`).join("")}</section>`}).join("")||empty("ยังไม่มีบิล")}</div>`}
function reports(){const t=monthTotals(),all=rows("Transactions").filter(x=>!x.deleted_at);return `${head("รายงานการเงิน","สรุปข้อมูลจากธุรกรรมที่บันทึกไว้") }<div class="grid stats">${stat("รายรับเดือนนี้",t.income,"THB","green")}${stat("รายจ่ายเดือนนี้",t.expense,"THB","red")}${stat("สุทธิเดือนนี้",t.income-t.expense,"รายรับลบรายจ่าย",(t.income-t.expense)>=0?"green":"red")}</div><section class="card"><h2 class="card-title">สรุปตามเดือน</h2>${empty(`มีธุรกรรมทั้งหมด ${all.length} รายการ`)}</section>`}
function settings(){return `${head("ตั้งค่าและซิงค์","จัดการการเชื่อมต่อ Google Sheets และธีม")}<section class="card"><h2 class="card-title">การเชื่อมต่อ Google Apps Script</h2><div class="notice">API Key เป็นรหัสผ่านสำหรับเข้าถึงฐานข้อมูล ห้ามส่งให้ผู้อื่นหรือใส่ใน GitHub ระบบนี้เก็บรหัสไว้ใน Session ของแท็บปัจจุบันเท่านั้น เมื่อปิดแท็บอาจต้องกรอกใหม่</div><form id="keyForm"><div class="field"><label>API Key</label><input id="apiKey" type="password" autocomplete="off" placeholder="กรอกรหัส API Key ที่ตั้งไว้ใน Apps Script" value="${esc(state.key)}" required></div><div class="actions"><button class="btn" type="submit">บันทึกและเชื่อมต่อ</button><button class="btn secondary" type="button" id="clearKey">ล้างรหัส</button><button class="btn secondary" type="button" id="refreshData">ซิงค์ข้อมูลตอนนี้</button></div></form><p class="sub">Apps Script: <span style="overflow-wrap:anywhere">${esc(API_URL)}</span></p></section><section class="card" style="margin-top:15px"><h2 class="card-title">สถานะฐานข้อมูล</h2><div class="list">${Object.keys(state.data).map(k=>`<div class="list-row"><span>${esc(k)}</span><b>${(state.data[k]||[]).length} รายการ</b></div>`).join("")||"<div class='empty'>ยังไม่ได้โหลดข้อมูล</div>"}</div></section>`}
function modal(title,body,submitLabel="บันทึก"){modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="modal-head"><h2>${title}</h2><button class="close" data-close>×</button></div><form id="modalForm">${body}<div class="modal-actions"><button type="button" class="btn secondary" data-close>ยกเลิก</button><button class="btn" type="submit">${submitLabel}</button></div></form></section></div>`;$$("[data-close]",modalRoot).forEach(b=>b.onclick=closeModal)}
function closeModal(){modalRoot.innerHTML=""}
function field(label,name,type="text",value="",extra=""){return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></div>`}
function selectField(label,name,opts,selected=""){return `<div class="field"><label>${label}</label><select name="${name}" required>${opts.map(o=>`<option value="${esc(o.value)}" ${o.value===selected?"selected":""}>${esc(o.label)}</option>`).join("")}</select></div>`}
function openForm(kind,record={}){
 const wallets=activeWallets(),cats=activeCats();
 if(kind==="transaction"){
  const type=record.type||"expense";
  modal(record.transaction_id?"แก้ไขธุรกรรม":"เพิ่มรายรับ-รายจ่าย",`${selectField("ประเภท","type",[{value:"income",label:"รายรับ"},{value:"expense",label:"รายจ่าย"}],type)}${field("วันที่","date","date",record.date||today())}${selectField("หมวดหมู่","category_id",cats.filter(c=>c.type===type).map(c=>({value:c.category_id,label:c.category_name})),record.category_id||"")}${selectField("บัญชี","wallet_id",wallets.map(w=>({value:w.wallet_id,label:w.wallet_name})),record.wallet_id||wallets[0]?.wallet_id||"")}${field("จำนวนเงิน (บาท)","amount","number",record.amount||"",`min="0.01" step="0.01"`)}${field("หมายเหตุ","note","text",record.note||"")}`);
 }else if(kind==="wallet"){
  modal(record.wallet_id?"แก้ไขบัญชี":"เพิ่มบัญชี",`${field("ชื่อบัญชี","wallet_name","text",record.wallet_name||"")}${selectField("ประเภทบัญชี","wallet_type",[{value:"cash",label:"เงินสด"},{value:"bank",label:"ธนาคาร"},{value:"saving",label:"เงินเก็บ"},{value:"other",label:"อื่น ๆ"}],record.wallet_type||"cash")}${field("ยอดเงินตั้งต้น","opening_balance","number",record.opening_balance??0,'step="0.01"')}${field("วันที่เริ่มต้น","opening_date","date",record.opening_date||today())}`);
 }else if(kind==="goal"){
  modal("สร้างเป้าหมายการออม",`${field("ชื่อเป้าหมาย","goal_name")}${field("ยอดเป้าหมาย (บาท)","target_amount","number","","min=1 step=0.01")}${field("ยอดที่มีแล้ว (บาท)","current_amount","number","0",'min="0" step="0.01"')}${field("วันที่เริ่ม","start_date","date",today())}${field("วันที่ต้องการให้สำเร็จ","target_date","date",today())}${selectField("บัญชีที่เกี่ยวข้อง","wallet_id",wallets.map(w=>({value:w.wallet_id,label:w.wallet_name})),wallets[0]?.wallet_id||"")}${field("หมายเหตุ","note")}`);
 }else if(kind==="budget"){
  modal("ตั้งงบประมาณ",`${field("เดือน (YYYY-MM)","month","month",month())}${selectField("หมวดหมู่","category_id",cats.filter(c=>c.type==="expense").map(c=>({value:c.category_id,label:c.category_name})))}${selectField("บัญชี (ไม่เลือกบัญชีไม่ได้ในรุ่นนี้)","wallet_id",wallets.map(w=>({value:w.wallet_id,label:w.wallet_name})),wallets[0]?.wallet_id||"")}${field("วงเงิน (บาท)","budget_amount","number","","min=1 step=0.01")}`);
 }else if(kind==="reconcile"){
  modal("ตรวจสอบยอดธนาคาร",`${selectField("บัญชี","wallet_id",wallets.map(w=>({value:w.wallet_id,label:w.wallet_name})),wallets[0]?.wallet_id||"")}${field("วันที่ตรวจสอบ","check_date","date",today())}${field("ยอดเงินจริงในธนาคาร","bank_balance","number","","step=0.01")}${field("หมายเหตุ","note")}`);
 }else if(kind==="goalLog"){
  modal(record.kind==="add"?"เติมเงินเข้าเป้าหมาย":"ถอนเงินจากเป้าหมาย",`${field("จำนวนเงิน","amount","number","","min=0.01 step=0.01")}${field("วันที่","date","date",today())}${field("หมายเหตุ","note")}`);
  $("#modalForm").dataset.goalId=record.goalId;$("#modalForm").dataset.goalKind=record.kind;
 }else if(kind==="bill"){
  modal("สร้างบิลหารกับเพื่อน",`${field("ชื่อบิล","bill_name")}${field("วันที่","bill_date","date",today())}${field("ยอดรวมบิล","total_amount","number","","min=0.01 step=0.01")}${field("ชื่อผู้จ่ายก่อน","paid_by_name")}${selectField("บัญชีที่ใช้จ่าย","paid_by_wallet_id",wallets.map(w=>({value:w.wallet_id,label:w.wallet_name})),wallets[0]?.wallet_id||"")}${field("หมายเหตุ","note")}`);
 }
 $("#modalForm").onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget),data=Object.fromEntries(fd.entries());
  Object.keys(data).forEach(k=>{if(["amount","opening_balance","target_amount","current_amount","budget_amount","bank_balance","total_amount"].includes(k))data[k]=Number(data[k])});
  try{
   if(kind==="transaction"){
    data.type=data.type||"expense";
    if(record.transaction_id){data.transaction_id=record.transaction_id;await post({action:"update",entity:"Transactions",data})}
    else await post({action:"create",entity:"Transactions",data});
   }else if(kind==="wallet"){
    if(record.wallet_id){data.wallet_id=record.wallet_id;await post({action:"update",entity:"Wallets",data})}
    else await post({action:"create",entity:"Wallets",data});
   }else if(kind==="goal"){
    data.status="active";await post({action:"create",entity:"SavingsGoals",data});
   }else if(kind==="budget"){await post({action:"create",entity:"Budgets",data})}
   else if(kind==="reconcile"){await post({action:"reconcile",entity:"Reconciliations",data})}
   else if(kind==="goalLog"){data.goal_id=e.currentTarget.dataset.goalId;data.type=e.currentTarget.dataset.goalKind;await post({action:"addGoalLog",entity:"GoalLogs",data})}
   else if(kind==="bill"){
    data.status="open";await post({action:"create",entity:"Bills",data});
   }
   closeModal();toast("ส่งคำสั่งแล้ว และซิงค์ข้อมูลล่าสุดเรียบร้อย");
  }catch(err){toast(err.message)}
 };
}
document.addEventListener("click",async e=>{
 const page=e.target.closest("[data-page]");if(page){e.preventDefault();state.page=page.dataset.page;state.filter="";render();return}
 const m=e.target.closest("[data-modal]");if(m){openForm(m.dataset.modal);return}
 const edit=e.target.closest("[data-edit-tx]");if(edit){const r=rows("Transactions").find(x=>x.transaction_id===edit.dataset.editTx);if(r)openForm("transaction",r);return}
 const del=e.target.closest("[data-delete-tx]");if(del&&confirm("ต้องการลบรายการนี้ใช่หรือไม่?")){try{await post({action:"delete",entity:"Transactions",data:{transaction_id:del.dataset.deleteTx}});toast("ส่งคำสั่งลบแล้ว")}catch(err){toast(err.message)}return}
 const w=e.target.closest("[data-edit-wallet]");if(w){const r=rows("Wallets").find(x=>x.wallet_id===w.dataset.editWallet);if(r)openForm("wallet",r);return}
 const gl=e.target.closest("[data-goal-log]");if(gl){openForm("goalLog",{goalId:gl.dataset.goalLog,kind:gl.dataset.kind});return}
});
content.addEventListener("input",e=>{if(e.target.id==="txSearch"){state.filter=e.target.value;const pos=e.target.selectionStart;render();const input=$("#txSearch");input.focus();input.setSelectionRange(pos,pos)}});
content.addEventListener("change",e=>{if(e.target.id==="txType"){const val=e.target.value;$$(".table tbody tr").forEach(tr=>{tr.style.display=!val||tr.children[1].textContent.trim()===val?"":"none"})}});
content.addEventListener("submit",async e=>{
 if(e.target.id==="keyForm"){e.preventDefault();state.key=$("#apiKey").value.trim();sessionStorage.setItem("mf_api_key",state.key);try{await loadData();toast("เชื่อมต่อฐานข้อมูลสำเร็จ")}catch(err){setSync(false,"เชื่อมต่อไม่สำเร็จ");toast(err.message)}}
});
content.addEventListener("click",async e=>{
 if(e.target.id==="clearKey"){state.key="";sessionStorage.removeItem("mf_api_key");state.data={};setSync(false,"ล้างรหัสแล้ว");render()}
 if(e.target.id==="refreshData"){try{await loadData();toast("ซิงค์ข้อมูลแล้ว")}catch(err){toast(err.message)}}
});
$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("mf_theme",document.body.classList.contains("dark")?"dark":"light")};
if(localStorage.getItem("mf_theme")==="dark")document.body.classList.add("dark");
function start(){render();if(state.key)loadData().catch(err=>{setSync(false,"เชื่อมต่อไม่สำเร็จ");toast(err.message)});else{state.page="settings";render();}}
if("serviceWorker" in navigator && location.protocol==="https:")window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
start();
})();