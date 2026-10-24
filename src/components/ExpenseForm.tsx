import { useState, type FormEvent } from 'react';
import { useBudget } from '../context/BudgetContext';
import { expenseTypes, money, today, typeLabels, type ExpenseType, type Expense } from '../types';
async function photoData(file: File): Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) throw new Error('請選擇 10 MB 以下的 JPG、PNG 或 WebP 圖片。');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); const scale = Math.min(1,360/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const data=canvas.toDataURL('image/jpeg',0.45);
  if(data.length>16000)throw new Error('照片壓縮後仍太大，請裁切憑證後重試。');
  return data;
}
export default function ExpenseForm() {
  const {state,status,dispatch}=useBudget();
  const [projectId,setProjectId]=useState('');const [type,setType]=useState<ExpenseType>('hourly');
  const [date,setDate]=useState(today());const [description,setDescription]=useState('');const [amount,setAmount]=useState(0);
  const [hours,setHours]=useState(1);const [leave,setLeave]=useState(0);const [rate,setRate]=useState(400);const [teacher,setTeacher]=useState('');
  const [isAdvance,setAdvance]=useState(false);const [person,setPerson]=useState('');const [photos,setPhotos]=useState<string[]>([]);const [uploading,setUploading]=useState(false);const [notice,setNotice]=useState('');
  const selected=projectId || state.projects[0]?.id || '';const project=state.projects.find(p=>p.id===selected);
  const actualHours=Math.max(0,hours-leave);const total=type==='hourly'?Math.round(actualHours*rate*100)/100:amount;
  const remaining=project?project.totalBudget-Object.values(project.used).reduce((a,b)=>a+b,0):0;
  const categoryRemaining=project?project.limits[type]-project.used[type]:0;
  const invalid= !project || total<=0 || total>remaining || total>categoryRemaining || (type==='hourly'&&leave>hours) || !!(project&&(date<project.startDate||date>project.endDate));
  async function submit(e:FormEvent) {
    e.preventDefault();if(invalid)return;setNotice('');
    const expense:Expense={id:crypto.randomUUID(),projectId:selected,type,amount:total,date,description:description.trim(),isAdvance,photos,...(isAdvance?{advancePerson:person.trim(),advanceStatus:'pending' as const}:{}),...(type==='hourly'?{teacherName:teacher.trim(),classDate:date,hours,leaveHours:leave,actualHours,hourlyRate:rate}:{})};
    if(await dispatch({type:'ADD_EXPENSE',payload:expense})){setDescription('');setPhotos([]);setNotice('支出已儲存至 Google 試算表。');}
  }
  return <div className="split"><section className="panel"><p className="eyebrow">NEW EXPENSE</p><h2>登錄一筆支出</h2>{!project&&<p className="notice">請先在「計畫管理」建立計畫。</p>}<form onSubmit={submit}><fieldset disabled={status!=='ready'||!project||uploading}><div className="two"><label>所屬計畫<select value={selected} onChange={e=>setProjectId(e.target.value)}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>支出類別<select value={type} onChange={e=>setType(e.target.value as ExpenseType)}>{expenseTypes.map(t=><option key={t} value={t}>{typeLabels[t]}</option>)}</select></label></div><label>支出／授課日期<input type="date" required value={date} min={project?.startDate} max={project?.endDate} onChange={e=>setDate(e.target.value)}/></label>
    {type==='hourly'?<><label>授課教師<input required maxLength={80} value={teacher} onChange={e=>setTeacher(e.target.value)}/></label><div className="three"><label>鐘點費率（元）<input type="number" min="0" step="0.01" required value={rate} onChange={e=>setRate(Number(e.target.value))}/></label><label>原定時數<input type="number" min="0.25" step="0.25" required value={hours} onChange={e=>setHours(Number(e.target.value))}/></label><label>請假時數<input type="number" min="0" max={hours} step="0.25" required value={leave} onChange={e=>setLeave(Number(e.target.value))}/></label></div><p className="formula">實付 {actualHours} 小時 × {money(rate)} = <strong>{money(total)}</strong><br/><small>請假時數全額扣除，不計入實付鐘點費。</small></p></>:<label>支出金額（元）<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>}
    <label>用途說明<textarea required maxLength={1000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="check"><input type="checkbox" checked={isAdvance} onChange={e=>setAdvance(e.target.checked)}/>此筆由個人代墊</label>{isAdvance&&<label>代墊人<input required maxLength={80} value={person} onChange={e=>setPerson(e.target.value)}/></label>}
    <label>憑證照片（最多 2 張，自動壓縮）<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value='';setUploading(true);try{if(photos.length+files.length>2)throw new Error('每筆最多 2 張照片。');setPhotos([...photos,...await Promise.all(files.map(photoData))]);setNotice('');}catch(err){setNotice(err instanceof Error?err.message:'圖片處理失敗');}finally{setUploading(false);}}}/></label><div className="photos">{photos.map((p,i)=><div key={i}><img src={p} alt={'憑證 '+(i+1)}/><button className="text" type="button" onClick={()=>setPhotos(photos.filter((_,n)=>n!==i))}>移除</button></div>)}</div><button type="submit" disabled={invalid}>儲存支出 {money(total)}</button></fieldset></form>{uploading&&<p role="status">處理照片中…</p>}{notice&&<p role="status">{notice}</p>}</section>
    <aside><section className="panel"><p className="eyebrow">LIVE BUDGET CHECK</p><h2>即時經費檢查</h2><p>{project?.name||'尚未選擇計畫'}</p><div className="metric"><small>計畫可用餘額</small><strong>{money(remaining)}</strong></div><div className="metric"><small>{typeLabels[type]}可用餘額</small><strong>{money(categoryRemaining)}</strong></div><div className={invalid?'notice warning':'notice'}>{!project?'尚未建立計畫':total<=0?'請輸入支出金額':total>remaining?'超出計畫總經費':total>categoryRemaining?'超出細項上限':leave>hours&&type==='hourly'?'請假時數不可超過原定時數':date<project.startDate||date>project.endDate?'支出日期不在計畫期間':'✓ 符合經費與日期限制'}</div><p className="hint">所有金額與上限都會在儲存前再次檢查。憑證以縮圖存入試算表，請另行保存原始檔案。</p></section></aside></div>;
}