/**
 * /api/ai/terminal
 *
 * POST   { command, cwd? }   — spawn command, stream SSE output
 *                              auto-resolves port conflicts for dev servers
 * DELETE { sessionId }       — kill a running process by session ID
 * GET    ?session=<id>       — poll buffered output
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess }       from "child_process";
import path                          from "path";
import fs                            from "fs";

export const dynamic = "force-dynamic";

/* ── Port utilities ───────────────────────────────────────────────── */

/**
 * Check if a port is busy by attempting to CONNECT to it.
 * This is more reliable than trying to bind — binding can have false negatives
 * when the check runs inside the same process that already owns the port.
 */
function isPortBusy(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const { createConnection } = require("net") as typeof import("net");
    const sock = createConnection({ port, host: "127.0.0.1", timeout: 300 });
    sock.once("connect",  () => { sock.destroy(); resolve(true);  }); // port is open = busy
    sock.once("error",    () => { sock.destroy(); resolve(false); }); // connection refused = free
    sock.once("timeout",  () => { sock.destroy(); resolve(false); }); // timeout = likely free
  });
}

async function findFreePort(start: number): Promise<number> {
  for (let p = start; p <= start + 20; p++) {
    if (!(await isPortBusy(p))) return p;
  }
  return start;
}

const DEV_SERVER_PATTERNS: {
  re: RegExp; port: number; strategy: "flag"; flagName: string;
}[] = [
  // Direct binary calls — safe to append --port flag
  // Note: `npm run dev`, `yarn dev` etc. are intentionally excluded.
  // Next.js 15+ and Vite automatically find a free port, so we let them
  // handle it rather than risk breaking env loading with a `set PORT=N &&` prefix.
  { re: /\bnext\s+(dev|start)\b/,      port: 3000,  strategy: "flag", flagName: "--port" },
  { re: /\bvite(\s+(dev|preview))?\b/, port: 5173,  strategy: "flag", flagName: "--port" },
  { re: /\bastro\s+(dev|preview)\b/,   port: 4321,  strategy: "flag", flagName: "--port" },
  { re: /\bnuxt\s+(dev|start)\b/,      port: 3000,  strategy: "flag", flagName: "--port" },
  { re: /\bsvelte-kit\s+dev\b/,        port: 5173,  strategy: "flag", flagName: "--port" },
  { re: /\bremix\s+dev\b/,             port: 3000,  strategy: "flag", flagName: "--port" },
  { re: /\bexpo\s+start\b/,            port: 19000, strategy: "flag", flagName: "--port" },
  { re: /\b(http-server|serve)\b/,     port: 8080,  strategy: "flag", flagName: "-p"    },
  { re: /\bjson-server\b/,             port: 3000,  strategy: "flag", flagName: "--port" },
];

function hasExplicitPort(cmd: string): boolean {
  return /--port\s+\d+|-p\s+\d+|PORT=\d+/i.test(cmd);
}

async function resolveDevPort(command: string): Promise<{
  command: string; port: number | null; changed: boolean;
}> {
  if (hasExplicitPort(command)) return { command, port: null, changed: false };

  for (const p of DEV_SERVER_PATTERNS) {
    if (!p.re.test(command)) continue;
    if (!(await isPortBusy(p.port))) return { command, port: p.port, changed: false };

    const freePort  = await findFreePort(p.port + 1);
    const rewritten = `${command} ${p.flagName} ${freePort}`;

    return { command: rewritten, port: freePort, changed: true };
  }

  return { command, port: null, changed: false };
}

/* ── Next.js config auto-patcher ─────────────────────────────────── */

/**
 * Detects if `next.config.ts` or `next.config.js` already has `turbopack.root`
 * set. If not, injects it so Turbopack anchors to the correct project root
 * and reads the right `.env.local`.
 */
function patchNextConfig(projectCwd: string): { patched: boolean; file: string; error?: string } {
  const candidates = ["next.config.ts", "next.config.mjs", "next.config.js"];
  let configPath = "";

  for (const name of candidates) {
    const p = path.join(projectCwd, name);
    if (fs.existsSync(p)) { configPath = p; break; }
  }

  if (!configPath) return { patched: false, file: "", error: "next.config not found" };

  const src = fs.readFileSync(configPath, "utf-8");

  // Already has turbopack root — nothing to do
  if (/turbopack\s*:\s*\{[\s\S]*root\s*:/.test(src)) {
    return { patched: false, file: configPath, error: "already set" };
  }

  let patched = src;

  // Strategy 1: nextConfig object literal — inject into existing turbopack block
  if (/turbopack\s*:\s*\{/.test(patched)) {
    patched = patched.replace(/turbopack\s*:\s*\{/, `turbopack: {\n    root: __dirname,`);
  }
  // Strategy 2: nextConfig object literal — no turbopack block yet, add one
  else if (/const nextConfig[^=]*=\s*\{/.test(patched)) {
    patched = patched.replace(
      /(const nextConfig[^=]*=\s*\{)/,
      `$1\n  turbopack: { root: __dirname },`,
    );
  }
  // Strategy 3: export default { ... } pattern
  else if (/export\s+default\s+\{/.test(patched)) {
    patched = patched.replace(
      /export\s+default\s+\{/,
      `export default {\n  turbopack: { root: __dirname },`,
    );
  } else {
    return { patched: false, file: configPath, error: "could not find insertion point" };
  }

  try {
    fs.writeFileSync(configPath, patched, "utf-8");
    return { patched: true, file: configPath };
  } catch (e: any) {
    return { patched: false, file: configPath, error: e.message };
  }
}

/* ── Process registry ─────────────────────────────────────────────── */
interface Session { proc: ChildProcess; buffer: string[]; done: boolean; }

const REGISTRY     = new Map<string, Session>();
const MAX_SESSIONS = 100;

function pruneRegistry() {
  if (REGISTRY.size <= MAX_SESSIONS) return;
  for (const [id, s] of REGISTRY) {
    if (s.done) { REGISTRY.delete(id); break; }
  }
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function getShell() {
  return process.platform === "win32"
    ? { shell: "cmd.exe", args: (cmd: string) => ["/c", cmd] }
    : { shell: "/bin/sh",  args: (cmd: string) => ["-c", cmd] };
}

function killTree(proc: ChildProcess) {
  try {
    if (process.platform === "win32" && proc.pid) {
      spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { windowsHide: true });
    } else {
      proc.kill("SIGTERM");
    }
  } catch { /* ignore */ }
}

/* ── POST: spawn & stream ─────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => ({}));
  const rawCmd = String(body.command ?? "").trim();
  const rawCwd = String(body.cwd    ?? "").trim() || process.cwd();

  if (!rawCmd) return NextResponse.json({ error: "command is required." }, { status: 400 });

  const cwd = fs.existsSync(rawCwd) ? rawCwd : process.cwd();
  const { command, port, changed } = await resolveDevPort(rawCmd);

  const sessionId        = crypto.randomUUID();
  const buffer: string[] = [];
  const { shell, args }  = getShell();

  const spawnEnv = {
    ...process.env,
    FORCE_COLOR:             "1",
    TERM:                    "xterm-256color",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  const proc = spawn(shell, args(command), {
    cwd,
    env:         spawnEnv,
    windowsHide: true,
    detached:    process.platform !== "win32",
  });

  const session: Session = { proc, buffer, done: false };
  REGISTRY.set(sessionId, session);
  pruneRegistry();

  const stream = new ReadableStream({
    start(controller) {
      const enc  = new TextEncoder();
      let closed = false;

      const send = (data: object) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); }
        catch { /* ignore */ }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };

      send({ type: "session", id: sessionId });

      if (changed && port) {
        send({ type: "info", text: `⚡ Port conflict detected — starting on port ${port} instead\n` });
      }

      proc.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        buffer.push(text);

        // Detect Next.js workspace root mismatch — auto-patch next.config and notify
        if (text.includes("inferred your workspace root") || text.includes("selected the directory of")) {
          send({ type: "stdout", text });

          const result = patchNextConfig(cwd);
          if (result.patched) {
            send({
              type: "info",
              text: [
                "\n┌─ ⚡ AUTO-FIXED: Workspace Root Mismatch ──────────────────────────┐\n",
                `│  Patched: ${result.file.split(/[\\/]/).slice(-1)[0].padEnd(56)}│\n`,
                "│  Added: turbopack: { root: __dirname }                           │\n",
                "│  Restart npm run dev to apply the fix.                           │\n",
                "└───────────────────────────────────────────────────────────────────┘\n",
              ].join(""),
            });
          } else {
            send({
              type: "info",
              text: [
                "\n┌─ ⚠  Workspace Root Mismatch — .env.local may not load ───────────┐\n",
                "│  Fix: add to next.config.ts:                                     │\n",
                "│    turbopack: { root: __dirname }                                │\n",
                `│  ${result.error ? `(Auto-patch skipped: ${result.error})`.padEnd(66) : ""}│\n`,
                "└───────────────────────────────────────────────────────────────────┘\n",
              ].join(""),
            });
          }
          return;
        }

        send({ type: "stdout", text });
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        buffer.push(text);
        send({ type: "stderr", text });
      });

      proc.on("error", (err) => {
        const text = `Error: ${err.message}\n`;
        buffer.push(text);
        send({ type: "stderr", text });
        session.done = true;
        send({ type: "exit", code: -1 });
        close();
      });

      proc.on("close", (code) => {
        session.done = true;
        send({ type: "exit", code: code ?? 0 });
        close();
      });
    },
    cancel() {
      killTree(proc);
      session.done = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Session-Id":      sessionId,
    },
  });
}

/* ── PATCH: fix next.config turbopack root ───────────────────────── */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const cwd  = String(body.cwd ?? "").trim();

  if (!cwd || !fs.existsSync(cwd)) {
    return NextResponse.json({ error: "Invalid cwd." }, { status: 400 });
  }

  const result = patchNextConfig(cwd);
  return NextResponse.json(result);
}

/* ── DELETE: kill process ─────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const body      = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? "").trim();

  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const session = REGISTRY.get(sessionId);
  if (!session)  return NextResponse.json({ error: "Session not found." },    { status: 404 });

  killTree(session.proc);
  session.done = true;
  REGISTRY.delete(sessionId);

  return NextResponse.json({ success: true });
}

/* ── GET: poll buffered output ────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("session");
  if (!id) return NextResponse.json({ error: "session param required." }, { status: 400 });

  const session = REGISTRY.get(id);
  if (!session)  return NextResponse.json({ error: "Session not found." },  { status: 404 });

  return NextResponse.json({ output: session.buffer.join(""), done: session.done });
}
