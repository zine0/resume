
import { useEffect, useRef, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function AuthForm({
  from,
  hasError,
}: {
  from: string;
  hasError: boolean;
}) {
  const [show, setShow] = useState(false);
  const [pwd, setPwd] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border shadow-sm overflow-hidden bg-white/60 dark:bg-white/10 backdrop-blur-md">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">访问认证</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              请输入访问密码继续
            </p>
          </div>
        </div>

        <form method="post" action="/api/auth" className="px-6 pb-6 pt-2">
          {hasError ? (
            <div className="mb-3 text-sm rounded-md border border-destructive/40 bg-destructive/5 text-destructive px-3 py-2">
              密码错误，请重试。
            </div>
          ) : null}

          <input type="hidden" name="from" value={from || "/"} />
          <div className="relative mt-2 mb-4">
            <input
              id="password"
              name="password"
              ref={inputRef}
              type={show ? "text" : "password"}
              required
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
              placeholder="输入密码"
              aria-label="密码"
              autoComplete="current-password"
            />
            <button
              type="button"
              aria-label={show ? "隐藏密码" : "显示密码"}
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground/90 p-1"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!pwd}
            className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
          >
            认证并进入
          </button>
        </form>
      </div>
    </div>
  );
}
