import { useState } from 'react';
import { useBudget } from './context/BudgetContext';
import ProjectManager from './components/ProjectManager';
import ExpenseForm from './components/ExpenseForm';
import Reports, { downloadBlob } from './components/Reports';
import { money } from './types';
const tabs=['計畫管理','支出登錄','代墊追蹤','報表與匯出'];
export default function App(){
  const [tab,setTab]=useState(0);const {state,status,error,pending,reload}=useBudget();
  const budget=state.projects.reduce((s,p)=>s+p.totalBudget,0);const used=state.expenses.reduce((s,e)=>s+e.amount,0);const advance=state.expenses.filter(e=>e.isAdvance&&e.advanceStatus!=='reimbursed').reduce((s,e)=>s+e.amount,0);
  return <><header><div className="brand"><span className="brand-icon">▥</span><div><strong>計畫經費控帳系統</strong><small>BUDGET CONTROL · GOOGLE SHEETS</small></div></div><div className="sync"><span className={'dot '+status}/><span role="status">{{loading:'載入雲端資料…',saving:'儲存並驗證中…',ready:'Google 試算表已同步',error:'同步需要處理'}[status]}</span><button className="header-button" disabled={status==='loading'||status==='saving'} onClick={()=>{if(!pending||window.confirm('尚有未確認儲存的變更，請先下載備份。仍要重新載入嗎？'))void reload();}}>重新同步</button></div></header>
  <main><div className="page-heading"><div><p className="eyebrow">FINANCIAL WORKSPACE</p><h1>讓每一筆經費，都有清楚的去向。</h1><p>掌握計畫預算、記錄日常支出，讓核銷更從容。</p></div><span className="cloud-label">☁ 雲端帳本</span></div>
  {error&&<div className="error-banner" role="alert"><strong>同步提示</strong><p>{error}</p><p>畫面目前顯示最後一次確認的資料。失敗時不會以空資料覆蓋雲端。</p>{pending&&<button className="secondary" onClick={()=>downloadBlob(new Blob([JSON.stringify(pending,null,2)],{type:'application/json'}),'經費控帳-未確認變更備份.json')}>下載未確認變更備份</button>}</div>}
  <div className="stats">{[['計畫總經費',budget,'涵蓋 '+state.projects.length+' 個計畫'],['已登錄支出',used,state.expenses.length+' 筆支出紀錄'],['尚可使用',budget-used,'計畫總經費 − 已支用'],['尚未歸墊',advance,'待核銷與已付款的代墊款']].map(([label,value,caption])=><section key={label} className="stat"><small>{label}</small><strong>{money(Number(value))}</strong><span>{caption}</span></section>)}</div>
  <nav aria-label="主要功能">{tabs.map((t,i)=><button aria-current={tab===i?'page':undefined} className={tab===i?'active':''} key={t} onClick={()=>setTab(i)}><span>0{i+1}</span>{t}</button>)}</nav>
  {tab===0?<ProjectManager/>:tab===1?<ExpenseForm/>:tab===2?<Reports key="advance" advancesOnly/>:<Reports key="all"/>}
  <footer><span>計畫經費控帳系統</span><span>資料儲存於 Google 試算表 · 每次儲存後重新讀取驗證</span></footer></main></>;
}