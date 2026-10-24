import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type AppState } from '../types';
import { type Action, initialState, reducer } from '../state';
import { loadFromSheet, saveToSheet } from '../api';
type Status = 'loading' | 'saving' | 'ready' | 'error';
interface BudgetValue { state: AppState; status: Status; error: string; pending: AppState | null; dispatch: (action: Action) => Promise<boolean>; reload: () => Promise<void> }
const BudgetContext = createContext<BudgetValue | undefined>(undefined);
export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<AppState | null>(null);
  const current = useRef(initialState);
  const busy = useRef(true);
  async function reload() {
    busy.current = true; setStatus('loading'); setError('');
    try { const data = await loadFromSheet(); current.current = data; setState(data); setPending(null); setStatus('ready'); }
    catch (e) { setError(e instanceof Error ? e.message : '讀取失敗'); setStatus('error'); }
    finally { busy.current = false; }
  }
  useEffect(() => { void reload(); }, []);
  useEffect(() => { const prevent = (event: BeforeUnloadEvent) => { if (busy.current || pending) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent); }, [pending]);
  async function dispatch(action: Action) {
    if (busy.current || status !== 'ready') return false;
    busy.current = true; setStatus('saving'); setError('');
    let next: AppState;
    try { next = reducer(current.current, action); }
    catch (e) { setError(e instanceof Error ? e.message : '資料無效'); busy.current = false; setStatus('ready'); return false; }
    setPending(next);
    try { const saved = await saveToSheet(next, current.current); current.current = saved; setState(saved); setPending(null); setStatus('ready'); return true; }
    catch (e) { setError(e instanceof Error ? e.message : '同步失敗，請檢查網路與 API 權限。'); setStatus('error'); return false; }
    finally { busy.current = false; }
  }
  return <BudgetContext.Provider value={{ state, status, error, pending, dispatch, reload }}>{children}</BudgetContext.Provider>;
}
export function useBudget() { const context = useContext(BudgetContext); if (!context) throw new Error('useBudget must be used within BudgetProvider'); return context; }