import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  emptyState,
  type AppState,
  type Command,
  type Envelope,
  type Role,
} from "../types";
import { applyCommand } from "../domain/core";
import {
  hasSecureBridge,
  loadSecure,
  saveSecure,
  uploadAttachment,
} from "../api";
type Pending = {
  command: Command;
  requestId: string;
  revision: number;
  preview: AppState;
};
type Value = {
  state: AppState;
  role: Role;
  email: string;
  mode: "preview" | "test" | "production";
  status: "loading" | "ready" | "saving" | "error";
  error: string;
  pending: Pending | null;
  revision: number;
  dispatch: (c: Command) => Promise<boolean>;
  reload: () => Promise<void>;
  retry: () => Promise<void>;
  upload: (projectId: string, file: File, kind: string) => Promise<void>;
  replacePreview: (s: AppState) => void;
};
const Context = createContext<Value | undefined>(undefined);
export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(emptyState),
    [role, setRole] = useState<Role>("admin"),
    [email, setEmail] = useState("工作階段預覽"),
    [mode, setMode] = useState<Value["mode"]>("preview"),
    [status, setStatus] = useState<Value["status"]>("loading"),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Pending | null>(null),
    [revision, setRevision] = useState(0);
  const current = useRef(state),
    rev = useRef(0),
    busy = useRef(true),
    dirty = useRef(false);
  const accept = (e: Envelope) => {
    current.current = e.state;
    rev.current = e.revision;
    setState(e.state);
    setRevision(e.revision);
    setRole(e.user.role);
    setEmail(e.user.email);
    setMode(e.environment);
  };
  async function reload() {
    if (!hasSecureBridge()) {
      setStatus("ready");
      busy.current = false;
      return;
    }
    busy.current = true;
    setStatus("loading");
    setError("");
    try {
      accept(await loadSecure());
      setPending(null);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (busy.current || pending || dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [pending]);
  async function send(p: Pending) {
    busy.current = true;
    setStatus("saving");
    setError("");
    try {
      accept(await saveSecure(p.command, p.revision, p.requestId));
      setPending(null);
      setStatus("ready");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失敗");
      setStatus("error");
      return false;
    } finally {
      busy.current = false;
    }
  }
  async function dispatch(command: Command) {
    if (busy.current || status !== "ready") return false;
    try {
      const next = applyCommand(
        current.current,
        command,
        { email, role },
        new Date().toISOString(),
      );
      if (!hasSecureBridge()) {
        current.current = next;
        setState(next);
        dirty.current = true;
        setError("");
        return true;
      }
      const p = {
        command: JSON.parse(JSON.stringify(command)) as Command,
        preview: next,
        revision: rev.current,
        requestId: crypto.randomUUID(),
      };
      setPending(p);
      return send(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      return false;
    }
  }
  async function retry() {
    if (pending && !busy.current) await send(pending);
  }
  async function upload(projectId: string, file: File, kind: string) {
    if (!hasSecureBridge())
      throw new Error("草稿預覽不會上傳附件，請開啟安全帳本");
    if (busy.current || status !== "ready") throw new Error("請先完成目前操作");
    busy.current = true;
    setStatus("saving");
    try {
      accept(await uploadAttachment(projectId, file, kind));
      setStatus("ready");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "附件上傳失敗；請重新載入確認附件清單",
      );
      setStatus("error");
      throw e;
    } finally {
      busy.current = false;
    }
  }
  function replacePreview(s: AppState) {
    if (hasSecureBridge()) throw new Error("正式帳本禁止整表替換");
    current.current = s;
    setState(s);
    dirty.current = true;
    setPending(null);
    setError("");
  }
  return (
    <Context.Provider
      value={{
        state,
        role,
        email,
        mode,
        status,
        error,
        pending,
        revision,
        dispatch,
        reload,
        retry,
        upload,
        replacePreview,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useBudget() {
  const value = useContext(Context);
  if (!value) throw new Error("缺少BudgetProvider");
  return value;
}
