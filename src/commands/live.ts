// witness live: a small web page where anyone can start a real WITNESS run and watch it.
// It replays the TodoMVC Svelte Kane test on a build the visitor picks (upstream code with the bug, or the fixed code),
// compares with the fixed reference when it fails, and streams the log and the verdict. One run at a time, rate-limited.
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { listOpenPrsAsync, loadPrConfig, pastChecks, type OpenPr } from './pr.js';

export interface LiveOptions {
  exampleDir: string;       // examples/todomvc-svelte (tests + recordings)
  builds: Record<string, { dir: string; label: string }>;  // e.g. buggy, fixed
  referenceDir: string;     // the fixed build
  tests: string[];          // test files relative to exampleDir
  port: number;
  host: string;
  perHour: number;          // runs allowed per hour, all visitors together
  perVisitorMinutes: number;
  stateFile: string;
  cli: string;              // path to dist/cli.js
  pr?: { config: string; app: string };   // optional: check open pull requests of a real app (witness pr), e.g. Actual Budget
  lock?: string;            // optional: a file every Kane run on this machine locks, so runs never overlap
}

interface Run {
  id: string; build: string; pr?: number; test?: string; started: string; finished?: string; seconds?: number;
  status: 'running' | 'done' | 'error'; log: string[]; results?: any[]; listeners: Set<ServerResponse>;
}

export function startLive(o: LiveOptions) {
  const runs = new Map<string, Run>();
  const history: any[] = existsSync(o.stateFile) ? JSON.parse(readFileSync(o.stateFile, 'utf8')) : [];
  const byVisitor = new Map<string, number>();
  let current: Run | null = null;
  mkdirSync(dirname(o.stateFile), { recursive: true });
  const save = () => { try { writeFileSync(o.stateFile, JSON.stringify(history.slice(-200), null, 2)); } catch (e) { console.error(`could not save run history: ${(e as Error).message}`); } };
  const lastHour = () => history.filter(h => Date.parse(h.started) > Date.now() - 3600_000).length + (current ? 1 : 0);

  function send(run: Run, event: string, data: unknown) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of run.listeners) res.write(msg);
  }

  let prs: { at: number; list: OpenPr[] } = { at: 0, list: [] };
  let refreshing = false;
  const prConfig = o.pr ? loadPrConfig(o.pr.config) : null;
  async function refreshPrs() {
    if (!prConfig || refreshing) return;
    refreshing = true;
    try { prs = { at: Date.now(), list: (await listOpenPrsAsync(prConfig, 60)).filter(p => p.preview) }; }
    catch (e) { console.error(`could not list pull requests: ${(e as Error).message.split('\n')[0]}`); }
    finally { refreshing = false; }
  }
  if (prConfig) { void refreshPrs(); setInterval(() => void refreshPrs(), 10 * 60_000).unref(); }
  const openPrs = () => prs.list;

  function begin(build: string, pr?: number, test?: string): Run {
    const run: Run = { id: randomUUID(), build, pr, test, started: new Date().toISOString(), status: 'running', log: [], listeners: new Set() };
    runs.set(run.id, run); current = run;
    const work = join(tmpdir(), `witness-live-${run.id}`);
    mkdirSync(work, { recursive: true });
    const cfgPath = join(work, 'witness.json');
    if (!pr) writeFileSync(cfgPath, JSON.stringify({ tests: o.tests.map(t => resolve(o.exampleDir, t)), target: { dir: o.builds[build].dir }, reference: { dir: o.referenceDir }, evidenceDir: join(work, 'runs') }));
    const resultsPath = join(work, 'results.json');
    const t0 = Date.now();
    const argv = pr ? [o.cli, 'pr', 'check', o.pr!.config, String(pr), ...(test ? ['--only', test] : [])] : [o.cli, 'guard', cfgPath];
    const [bin, args] = o.lock ? ['flock', [o.lock, process.execPath, ...argv]] : [process.execPath, argv];
    const child = spawn(bin, args, { cwd: work, env: { ...process.env, WITNESS_RESULTS: resultsPath, NO_COLOR: '1' } });
    const onData = (b: Buffer) => {
      for (const line of b.toString().split('\n').filter(l => l.trim())) {
        const clean = line.replace(/\/[^\s]*witness-live-[^\s/]+\/?/g, '').replace(/http:\/\/127\.0\.0\.1:\d+\//g, m => m);
        run.log.push(clean); send(run, 'log', clean);
      }
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    const killer = setTimeout(() => child.kill('SIGTERM'), (pr ? 30 : 10) * 60_000);
    child.on('close', code => {
      clearTimeout(killer);
      run.seconds = Math.round((Date.now() - t0) / 1000);
      run.finished = new Date().toISOString();
      try { const j = JSON.parse(readFileSync(resultsPath, 'utf8')); run.results = Array.isArray(j) ? j : j.results; run.status = 'done'; } catch { run.status = 'error'; run.log.push(`run ended with code ${code} and no result`); }
      const summary = { id: run.id, build: run.build, pr: run.pr, started: run.started, seconds: run.seconds, status: run.status, results: (run.results ?? []).map(r => ({ test: r.test.split('/').pop(), verdict: r.verdict, kaneLabel: r.kaneLabel, kaneConfidence: r.kaneConfidence, target: r.target, reference: r.reference, credits: Math.round(r.credits * 100) / 100, replayed: r.replayed, recordedAgain: r.recordedAgain })) };
      history.push(summary); save();
      send(run, 'done', { ...summary, results: run.results });
      for (const res of run.listeners) res.end();
      run.listeners.clear();
      current = null;
    });
    return run;
  }

  const json = (res: ServerResponse, code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const visitor = (req: IncomingMessage) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(PAGE(o));
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return json(res, 200, { busy: !!current, current: current ? { id: current.id, build: current.build, pr: current.pr, started: current.started } : null, runsThisHour: lastHour(), perHour: o.perHour, history: history.slice(-20).reverse() });
    }
    if (req.method === 'GET' && url.pathname === '/api/checks') {
      const all = prConfig ? pastChecks(prConfig) : [];
      const titles: Record<string, string> = Object.fromEntries((prConfig?.tests ?? []).map(t => [t.split('/').pop()!, (readFileSync(t, 'utf8').match(/^# (.+)$/m)?.[1] ?? '').trim()]).filter(([, v]) => v));
      return json(res, 200, { repo: prConfig?.repo ?? null, checks: all.slice(0, 200).map(c => ({ number: c.number, title: c.title, ai: c.ai, headSha: c.headSha.slice(0, 9), started: c.started, seconds: c.seconds, results: c.results.map(r => ({ test: titles[r.test] ?? r.test, verdict: r.verdict, kaneLabel: r.kaneLabel, kaneConfidence: r.kaneConfidence })) })) });
    }
    if (req.method === 'GET' && url.pathname === '/api/prs') {
      return json(res, 200, { app: o.pr?.app ?? null, repo: prConfig?.repo ?? null, live: prConfig?.live ?? null, tests: (prConfig?.tests ?? []).map(t => ({ file: t.split('/').pop(), title: (readFileSync(t, 'utf8').match(/^# (.+)$/m)?.[1] ?? t.split('/').pop()!).trim() })), prs: openPrs(), loading: refreshing && !prs.list.length });
    }
    if (req.method === 'POST' && url.pathname === '/api/run') {
      const build = url.searchParams.get('build') ?? '';
      const prN = Number(url.searchParams.get('pr') ?? 0);
      const test = url.searchParams.get('test') || undefined;
      if (prN) {
        if (!prConfig || !openPrs().some(p => p.number === prN)) return json(res, 400, { error: 'Pick an open pull request that has a live preview.' });
        if (test && !prConfig.tests.some(t => t.endsWith('/' + test))) return json(res, 400, { error: 'unknown test' });
      } else if (!o.builds[build]) return json(res, 400, { error: 'unknown build' });
      if (current) return json(res, 409, { error: 'A run is in progress. Watch it below; you can start yours when it ends.', id: current.id });
      if (lastHour() >= o.perHour) return json(res, 429, { error: `This page allows ${o.perHour} runs an hour (each one uses real Kane credits). Try again later, or read a finished run below.` });
      const v = visitor(req); const last = byVisitor.get(v) ?? 0;
      if (Date.now() - last < o.perVisitorMinutes * 60_000) return json(res, 429, { error: `One run per visitor every ${o.perVisitorMinutes} minutes.` });
      byVisitor.set(v, Date.now());
      const run = prN ? begin('pr', prN, test) : begin(build);
      return json(res, 202, { id: run.id });
    }
    const m = url.pathname.match(/^\/api\/run\/([\w-]+)\/events$/);
    if (req.method === 'GET' && m) {
      const run = runs.get(m[1]);
      if (!run) return json(res, 404, { error: 'no such run' });
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      for (const l of run.log) res.write(`event: log\ndata: ${JSON.stringify(l)}\n\n`);
      if (run.status !== 'running') { res.write(`event: done\ndata: ${JSON.stringify({ id: run.id, build: run.build, pr: run.pr, seconds: run.seconds, status: run.status, results: run.results })}\n\n`); return res.end(); }
      run.listeners.add(res);
      req.on('close', () => run.listeners.delete(res));
      return;
    }
    json(res, 404, { error: 'not found' });
  });
  server.listen(o.port, o.host, () => console.log(`witness live on http://${o.host}:${o.port}/`));
  return server;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function PAGE(o: LiveOptions): string {
  const buttons = Object.entries(o.builds).map(([k, b]) => `<button class="btn${k === 'buggy' ? ' btn-primary' : ''}" data-build="${k}"><span class="btn-dot"></span>Run on ${esc(b.label)}</button>`).join('\n');
  const app = o.pr ? esc(o.pr.app) : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WITNESS · App or test?</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a0a0a'/%3E%3Ccircle cx='12.5' cy='16' r='6' fill='none' stroke='%23fff' stroke-width='2.2'/%3E%3Ccircle cx='19.5' cy='16' r='6' fill='none' stroke='%2322c55e' stroke-width='2.2'/%3E%3C/svg%3E">
<meta name="description" content="Kane CLI checks a real app's open pull requests on their live previews, and WITNESS decides who is at fault: the app or the test.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('witness-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<style>
:root{--bg:#fafafa;--bg2:#ffffff;--fg:#0a0a0a;--fg2:#404040;--muted:#737373;--line:#e5e5e5;--line2:#d4d4d4;--hover:#f4f4f5;--term:#0a0a0a;--termfg:#e5e5e5;--termmuted:#8a8a8a;
--green:#16a34a;--greenbg:rgba(22,163,74,.10);--red:#dc2626;--redbg:rgba(220,38,38,.09);--amber:#b45309;--amberbg:rgba(217,119,6,.11);--blue:#2563eb;--bluebg:rgba(37,99,235,.09);
--shadow:0 1px 2px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.04);--glow:rgba(34,197,94,.10);--sans:Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji";--mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0a0a0a;--bg2:#111111;--fg:#ededed;--fg2:#c4c4c4;--muted:#8f8f8f;--line:#232323;--line2:#2e2e2e;--hover:#1a1a1a;--term:#050505;--termfg:#d4d4d4;--termmuted:#6b6b6b;
--green:#22c55e;--greenbg:rgba(34,197,94,.12);--red:#f87171;--redbg:rgba(248,113,113,.12);--amber:#fbbf24;--amberbg:rgba(251,191,36,.12);--blue:#60a5fa;--bluebg:rgba(96,165,250,.12);--shadow:0 0 0 1px rgba(255,255,255,.02),0 8px 30px rgba(0,0,0,.5);--glow:rgba(34,197,94,.08)}}
:root[data-theme="dark"]{--bg:#0a0a0a;--bg2:#111111;--fg:#ededed;--fg2:#c4c4c4;--muted:#8f8f8f;--line:#232323;--line2:#2e2e2e;--hover:#1a1a1a;--term:#050505;--termfg:#d4d4d4;--termmuted:#6b6b6b;
--green:#22c55e;--greenbg:rgba(34,197,94,.12);--red:#f87171;--redbg:rgba(248,113,113,.12);--amber:#fbbf24;--amberbg:rgba(251,191,36,.12);--blue:#60a5fa;--bluebg:rgba(96,165,250,.12);--shadow:0 0 0 1px rgba(255,255,255,.02),0 8px 30px rgba(0,0,0,.5);--glow:rgba(34,197,94,.08)}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased;transition:background .3s,color .3s;overflow-x:hidden}
a{color:inherit}code,.mono{font-family:var(--mono);font-size:.86em}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
/* nav */
.nav{position:sticky;top:0;z-index:20;backdrop-filter:saturate(180%) blur(12px);-webkit-backdrop-filter:saturate(180%) blur(12px);background:color-mix(in srgb,var(--bg) 78%,transparent);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;gap:22px;height:60px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.04em;text-decoration:none;font-size:15px}
.brand svg{display:block}
.links{display:flex;gap:18px;flex:1}.links a{color:var(--muted);text-decoration:none;font-size:14px;transition:color .15s}.links a:hover{color:var(--fg)}
.tog{display:flex;border:1px solid var(--line);border-radius:999px;padding:2px;gap:2px}
.tog button{all:unset;cursor:pointer;width:28px;height:24px;display:grid;place-items:center;border-radius:999px;color:var(--muted);transition:background .2s,color .2s}
.tog button:hover{color:var(--fg)}.tog button[aria-pressed="true"]{background:var(--hover);color:var(--fg);box-shadow:inset 0 0 0 1px var(--line2)}
.gh{display:inline-flex;align-items:center;gap:6px;font-size:14px;text-decoration:none;padding:6px 12px;border:1px solid var(--line);border-radius:8px;transition:border-color .2s,background .2s}.gh:hover{border-color:var(--line2);background:var(--hover)}
/* hero */
.hero{position:relative;padding:84px 0 56px;overflow:hidden}
.hero:before{content:"";position:absolute;inset:-200px 0 auto 0;height:620px;background:radial-gradient(600px 300px at 30% 30%,var(--glow),transparent 70%);pointer-events:none}
.hero .wrap{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.status{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--fg2);padding:5px 12px 5px 10px;border:1px solid var(--line);border-radius:999px;background:var(--bg2);margin-bottom:22px}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--green);position:relative}.pulse:after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--green);animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite}
@keyframes ping{75%,100%{transform:scale(2.6);opacity:0}}
h1{font-size:clamp(38px,5.4vw,60px);line-height:1.04;letter-spacing:-.035em;font-weight:700;margin:0 0 20px}
h1 .dim{color:var(--muted)}
.lead{font-size:18px;color:var(--fg2);max-width:540px;margin:0 0 30px}
.cta{display:flex;gap:12px;flex-wrap:wrap}
.btn{font:500 14px/1 var(--sans);display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:10px;border:1px solid var(--line2);background:var(--bg2);color:var(--fg);cursor:pointer;text-decoration:none;transition:transform .15s,box-shadow .2s,background .2s,border-color .2s}
.btn:hover{transform:translateY(-1px);box-shadow:var(--shadow);border-color:var(--muted)}.btn:active{transform:translateY(0)}
.btn-primary{background:var(--fg);color:var(--bg);border-color:var(--fg)}.btn-primary:hover{border-color:var(--fg);box-shadow:0 6px 24px color-mix(in srgb,var(--fg) 22%,transparent)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
.btn-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.6}
.btn.loading .btn-dot{animation:blink 1s infinite}@keyframes blink{50%{opacity:.1}}
.stats{display:grid;grid-template-columns:repeat(4,1fr);margin-top:44px;border:1px solid var(--line);border-radius:14px;background:var(--bg2);overflow:hidden}
.stat{padding:16px 18px;border-left:1px solid var(--line)}.stat:first-child{border-left:0}
.stat b{display:block;font-size:26px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.stat span{font-size:12.5px;color:var(--muted)}
/* replay visual */
.viz{border:1px solid var(--line);border-radius:16px;background:var(--bg2);box-shadow:var(--shadow);overflow:hidden}
.viz-h{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);font-size:13px;color:var(--muted)}
.viz-h i{width:10px;height:10px;border-radius:50%;background:var(--line2);display:inline-block}
.viz-h .t{margin-left:8px;font-family:var(--mono);font-size:12px}
.lanes{display:grid;grid-template-columns:1fr 1fr}
.lane{padding:16px 18px 18px}.lane+.lane{border-left:1px solid var(--line)}
.lane h4{margin:0 0 12px;font-size:12px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;display:flex;justify-content:space-between}
.st{display:flex;align-items:flex-start;gap:10px;font-size:13px;padding:6px 0;color:var(--fg2);opacity:.28;animation:step 10s infinite}
.st .ic{margin-top:2px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex:none;border:1px solid var(--line2);font-size:11px;font-family:var(--mono)}
.st.ok .ic{background:var(--greenbg);color:var(--green);border-color:transparent}.st.no .ic{background:var(--redbg);color:var(--red);border-color:transparent}
.st.no{color:var(--red)}
@keyframes step{0%{opacity:.28}6%,88%{opacity:1}96%,100%{opacity:.28}}
.verdict-bar{display:flex;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid var(--line);font-size:13.5px;opacity:0;animation:vb 10s infinite;animation-delay:0s}
@keyframes vb{0%,52%{opacity:0;transform:translateY(6px)}60%,88%{opacity:1;transform:none}96%,100%{opacity:0}}
/* sections */
section{padding:64px 0;border-top:1px solid var(--line)}
.kicker{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px}
h2{font-size:clamp(26px,3.2vw,34px);letter-spacing:-.025em;line-height:1.15;margin:0 0 14px;font-weight:650}
.sub{color:var(--fg2);max-width:680px;margin:0 0 28px;font-size:16px}
.verdicts{border:1px solid var(--line);border-radius:14px;background:var(--bg2);overflow:hidden}
.vrow{display:grid;grid-template-columns:190px 1fr 1.1fr;gap:20px;padding:16px 20px;border-top:1px solid var(--line);align-items:start;transition:background .2s}
.vrow:first-child{border-top:0}.vrow:hover{background:var(--hover)}
.vrow .w{color:var(--fg2);font-size:14px}.vrow .d{color:var(--muted);font-size:14px}
.badge{display:inline-flex;align-items:center;gap:6px;font:500 12px/1 var(--mono);padding:5px 9px;border-radius:6px;white-space:nowrap}
.badge:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.b-ok{color:var(--green);background:var(--greenbg)}.b-bad{color:var(--red);background:var(--redbg)}.b-warn{color:var(--amber);background:var(--amberbg)}.b-info{color:var(--blue);background:var(--bluebg)}
/* panel */
.panel{border:1px solid var(--line);border-radius:16px;background:var(--bg2);box-shadow:var(--shadow);overflow:hidden}
.panel-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--line);font-weight:600;font-size:14.5px}
.panel-h .muted{font-weight:400}
.panel-b{padding:20px}
.grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
label{display:block;font-size:13px;font-weight:500;color:var(--fg2);margin:0 0 6px}
.sel{position:relative}.sel:after{content:"";position:absolute;right:14px;top:50%;width:7px;height:7px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:translateY(-70%) rotate(45deg);pointer-events:none}
select{appearance:none;-webkit-appearance:none;width:100%;font:14px var(--sans);padding:11px 36px 11px 12px;border:1px solid var(--line2);border-radius:10px;background:var(--bg);color:var(--fg);transition:border-color .2s,box-shadow .2s;text-overflow:ellipsis}
select:focus{outline:0;border-color:var(--fg);box-shadow:0 0 0 3px color-mix(in srgb,var(--fg) 12%,transparent)}
.row-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:18px}
.link{color:var(--muted);font-size:14px;text-decoration:none;border-bottom:1px solid var(--line2);transition:color .2s}.link:hover{color:var(--fg)}
.msg{min-height:1.4em;font-size:13.5px;color:var(--amber);margin-top:10px}
.muted{color:var(--muted)}
/* terminal */
.term{margin-top:20px;border-radius:14px;background:var(--term);border:1px solid var(--line);overflow:hidden}
.term-h{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.07);color:var(--termmuted);font:12px var(--mono)}
.term-h i{width:10px;height:10px;border-radius:50%;background:#2a2a2a;display:inline-block}
.term-h .live{margin-left:auto;display:none;align-items:center;gap:7px;color:#22c55e}.term.running .live{display:inline-flex}
.term-h .live .pulse{width:6px;height:6px}
.term-h .tm{margin-left:12px}
#log{margin:0;padding:14px 16px;color:var(--termfg);font:12.5px/1.7 var(--mono);white-space:pre-wrap;word-break:break-word;height:240px;overflow:auto;scrollbar-width:thin;scrollbar-color:#333 transparent}
#log .ln{display:block;animation:ln .25s ease-out}#log .v{color:#fafafa;font-weight:500}#log .g{color:#4ade80}#log .r{color:#f87171}#log .y{color:#fbbf24}#log .m{color:var(--termmuted)}
@keyframes ln{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:none}}
.caret{display:inline-block;width:7px;height:14px;background:#d4d4d4;vertical-align:-2px;animation:blink 1s steps(1) infinite}
/* tables */
.tw{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px}
th{font-weight:500;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:12px 18px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:13px 18px;border-top:1px solid var(--line);vertical-align:top;color:var(--fg2)}tbody tr:first-child td{border-top:0}
tbody tr{transition:background .15s}tbody tr:hover{background:var(--hover)}
td a{color:var(--fg);text-decoration:none;font-weight:500}td a:hover{text-decoration:underline}
td .stack{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.ai{display:inline-block;font:500 11px/1 var(--mono);padding:4px 6px;border-radius:5px;background:var(--bluebg);color:var(--blue);margin-right:6px;vertical-align:1px}
.sk{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--hover) 25%,var(--line) 50%,var(--hover) 75%);background-size:200% 100%;animation:sh 1.3s infinite}@keyframes sh{to{background-position:-200% 0}}
.result{margin-top:20px}.result:empty{display:none}
.card pre{margin:0;padding:16px 18px;font:12.5px/1.65 var(--mono);white-space:pre-wrap;color:var(--fg2);max-height:380px;overflow:auto}
.why{color:var(--muted);font-size:13px;margin-top:6px}
.sumline{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px}
.chip{font-size:13px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--bg2);color:var(--fg2)}.chip b{color:var(--fg);font-weight:600}
.demo{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
footer{border-top:1px solid var(--line);padding:32px 0 48px;color:var(--muted);font-size:13.5px}footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}footer a{color:var(--fg2)}
/* reveal */
.rv{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1)}.rv.in{opacity:1;transform:none}
tbody tr.fresh{animation:rowin .45s both}@keyframes rowin{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (max-width:880px){.hero .wrap{grid-template-columns:1fr;gap:36px}.links{display:none}.stats{grid-template-columns:repeat(2,1fr)}.stat:nth-child(3){border-left:0}.stat:nth-child(n+3){border-top:1px solid var(--line)}
.vrow{grid-template-columns:1fr;gap:8px}.grid2{grid-template-columns:1fr}.demo{grid-template-columns:1fr}.hero{padding:56px 0 40px}}
@media (max-width:520px){.lanes{grid-template-columns:1fr}.lane+.lane{border-left:0;border-top:1px solid var(--line)}.wrap{padding:0 16px}}
@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}.st{opacity:1}.verdict-bar{opacity:1}}
</style></head><body>
<nav class="nav"><div class="wrap">
<a class="brand" href="#top"><svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><circle cx="12.5" cy="16" r="6" fill="none" stroke="var(--bg)" stroke-width="2.2"/><circle cx="19.5" cy="16" r="6" fill="none" stroke="#22c55e" stroke-width="2.2"/></svg>WITNESS</a>
<div class="links">${o.pr ? '<a href="#check">Check a pull request</a><a href="#auto-sec">Automatic checks</a>' : ''}<a href="#how">How it decides</a><a href="#demo">Demo</a><a href="#runs">Runs</a></div>
<div class="tog" role="group" aria-label="Theme"><button data-t="system" title="System theme" aria-label="System theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></button><button data-t="light" title="Light theme" aria-label="Light theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button><button data-t="dark" title="Dark theme" aria-label="Dark theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></div>
<a class="gh" href="https://github.com/Jennycruzy/witness"><svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>
</div></nav>

<header class="hero" id="top"><div class="wrap">
<div>
<div class="status"><span class="pulse"></span>${o.pr ? `Watching ${app} pull requests` : 'Live'}</div>
<h1>Is it the app,<br><span class="dim">or the test?</span></h1>
<p class="lead">When a <a href="https://www.testmuai.com/kane-cli/">Kane CLI</a> test fails, a coding agent has to pick: fix the app, or edit the test. WITNESS replays the same recording on a build known to work, and the comparison decides.${o.pr ? ` Here it checks ${app}'s open pull requests on their live previews.` : ''}</p>
<div class="cta">${o.pr ? '<a class="btn btn-primary" href="#check">Check a pull request</a>' : '<a class="btn btn-primary" href="#demo">Run the demo</a>'}<a class="btn" href="#how">How it decides</a></div>
${o.pr ? `<div class="stats" id="stats"><div class="stat"><b data-k="checks">0</b><span>checks</span></div><div class="stat"><b data-k="prs">0</b><span>pull requests</span></div><div class="stat"><b data-k="ai">0</b><span>by AI agents</span></div><div class="stat"><b data-k="runs">0</b><span>test runs</span></div></div>` : ''}
</div>
<div class="viz" aria-label="The same recording replayed on two builds">
<div class="viz-h"><i></i><i></i><i></i><span class="t">same recording · two builds</span></div>
<div class="lanes">
<div class="lane"><h4><span>Live main</span><span>reference</span></h4>
<div class="st ok" style="animation-delay:.0s"><span class="ic">✓</span>Open the budget</div>
<div class="st ok" style="animation-delay:.5s"><span class="ic">✓</span>Add a transaction</div>
<div class="st ok" style="animation-delay:1s"><span class="ic">✓</span>Edit the amount</div>
<div class="st ok" style="animation-delay:1.5s"><span class="ic">✓</span>Check: balance is 50.00</div>
</div>
<div class="lane"><h4><span>PR preview</span><span>target</span></h4>
<div class="st ok" style="animation-delay:2.2s"><span class="ic">✓</span>Open the budget</div>
<div class="st ok" style="animation-delay:2.7s"><span class="ic">✓</span>Add a transaction</div>
<div class="st ok" style="animation-delay:3.2s"><span class="ic">✓</span>Edit the amount</div>
<div class="st no" style="animation-delay:3.7s"><span class="ic">✕</span><span>Check: balance is 50.00<br><span class="mono" style="font-size:11.5px;opacity:.85">read 20.00</span></span></div>
</div></div>
<div class="verdict-bar"><span class="badge b-bad">APP_BUG</span><span>Passes on main, fails here at a check. Fix the app, not the test.</span></div>
</div>
</div></header>

<section id="how"><div class="wrap">
<div class="kicker rv">How it decides</div>
<h2 class="rv">The second build decides, not Kane's label.</h2>
<p class="sub rv">On 12 real app bugs in four open-source apps, Kane's own label blamed the test in 6. An agent that trusts it rewrites the test to accept the bug. WITNESS records Kane's label next to every verdict and never uses it to decide.</p>
<div class="verdicts rv">
<div class="vrow"><div><span class="badge b-bad">APP_BUG</span></div><div class="w">Passes on the reference, fails on yours at a check.</div><div class="d">The app changed. Fix the app, not the test.</div></div>
<div class="vrow"><div><span class="badge b-warn">TEST_PROBLEM</span></div><div class="w">Passes on the reference, fails on yours at a click or typing step.</div><div class="d">The page changed where the test acts. Record it again.</div></div>
<div class="vrow"><div><span class="badge b-info">BEHIND_MAIN</span></div><div class="w">Passes on main, but the branch split off before main fixed it.</div><div class="d">The bug is older than the pull request. Update the branch.</div></div>
<div class="vrow"><div><span class="badge b-warn">ENV</span></div><div class="w">Fails on the reference too.</div><div class="d">Check the environment before changing anything.</div></div>
<div class="vrow"><div><span class="badge b-ok">PASS</span></div><div class="w">Passes on yours.</div><div class="d">Nothing to do. A passing run costs no Kane credits for triage.</div></div>
</div>
</div></section>

${o.pr ? `<section id="check"><div class="wrap">
<div class="kicker rv">Run it yourself</div>
<h2 class="rv">Check a pull request of ${app} before it merges.</h2>
<p class="sub rv">${app} is an open-source budgeting app that people use for their own money, and coding agents write many of its changes. Every pull request gets a live preview. Kane uses that preview like a person would, in a real Chrome, replaying tests written from ${app}'s own bug reports. Each test caught its real regression on ${app}'s own builds.</p>
<div class="panel rv"><div class="panel-h"><span>New check</span><span class="muted" id="prcount">Loading open pull requests...</span></div><div class="panel-b">
<div class="grid2"><div><label for="pr">Open pull request</label><div class="sel"><select id="pr"><option>Loading open pull requests...</option></select></div></div>
<div><label for="test">Tests</label><div class="sel"><select id="test"><option value="">All saved tests</option></select></div></div></div>
<div class="row-actions"><button class="btn btn-primary" id="prgo"><span class="btn-dot"></span>Check this pull request</button><a id="prlink" class="link" href="#" target="_blank" rel="noopener"></a><span class="muted" style="margin-left:auto;font-size:13px">${o.perHour} runs an hour · real Kane credits</span></div>
<div id="prmsg" class="msg"></div>
</div></div>
</div></section>` : ''}

<div class="wrap" style="padding-bottom:64px"><div class="term" id="term"><div class="term-h"><i></i><i></i><i></i><span style="margin-left:8px">witness</span><span class="tm" id="timer"></span><span class="live"><span class="pulse"></span>running</span></div><pre id="log"><span class="m">Pick a pull request${o.pr ? '' : ' or a build'} to start. The log streams here.</span> <span class="caret"></span></pre></div>
<div id="result" class="result"></div></div>

${o.pr ? `<section id="auto-sec"><div class="wrap">
<div class="kicker rv">Checked automatically</div>
<h2 class="rv">Every new commit, every three hours.</h2>
<p class="sub rv" id="autosum">WITNESS checks each open pull request whose newest commit it has not checked yet, with only the tests for the areas that pull request changes (<code>witness pr watch</code>). Every check is listed here and committed in the repository.</p>
<div class="sumline rv" id="autochips"></div>
<div class="panel tw rv"><table><thead><tr><th>When (UTC)</th><th>Pull request</th><th>Commit</th><th>Tests</th><th>Verdict</th></tr></thead><tbody id="auto">${'<tr><td><div class="sk" style="width:90px"></div></td><td><div class="sk" style="width:260px"></div></td><td><div class="sk" style="width:70px"></div></td><td><div class="sk" style="width:180px"></div></td><td><div class="sk" style="width:60px"></div></td></tr>'.repeat(4)}</tbody></table></div>
</div></section>` : ''}

<section id="demo"><div class="wrap">
<div class="kicker rv">${o.pr ? 'Also' : 'Demo'}</div>
<h2 class="rv">Watch it decide on a known bug.</h2>
<div class="demo rv"><p class="sub" style="margin:0">The TodoMVC Svelte example, with its upstream code, has the bugs in <a href="https://github.com/tastejs/todomvc/issues/2315">tastejs/todomvc#2315</a>: an edit made of spaces leaves an empty todo, and the filter is lost on reload. WITNESS replays the saved Kane recording on the build you pick; if a test fails, it replays the same recording on the fixed build and decides. About two minutes.</p>
<div class="cta">${buttons}</div></div>
<div id="msg" class="msg"></div>
</div></section>

<section id="runs"><div class="wrap">
<div class="kicker rv">History</div>
<h2 class="rv">Recent runs from this page.</h2>
<div class="panel tw rv"><table><thead><tr><th>When (UTC)</th><th>What</th><th>Test</th><th>Kane's label</th><th>Verdict</th><th>Credits</th><th>Time</th></tr></thead><tbody id="hist"><tr><td colspan="7" class="muted">None yet.</td></tr></tbody></table></div>
<p class="muted" style="font-size:13.5px;margin-top:16px">Kane reports credits when it diagnoses a failure; a passing replay shows —. Each run uses real Kane credits, so this page allows ${o.perHour} runs an hour and one per visitor every ${o.perVisitorMinutes} minutes. Replays run with <code>--no-adaptive-heal</code>, so Kane cannot heal past a bug. Everything here runs on the same code as the <code>witness</code> CLI: <code>witness pr check</code> and <code>witness guard</code>.</p>
</div></section>

<footer><div class="wrap"><span>WITNESS · Apache-2.0</span><span><a href="https://github.com/Jennycruzy/witness">Source and every run on GitHub</a></span></div></footer>

<script>
const $=s=>document.querySelector(s);const builds=${JSON.stringify(Object.fromEntries(Object.entries(o.builds).map(([k, b]) => [k, b.label])))};
const cls=v=>v==='PASS'?'b-ok':v==='APP_BUG'?'b-bad':v==='BEHIND_MAIN'?'b-info':'b-warn';
const plain=v=>({PASS:'passes on the preview',APP_BUG:'bug added by this pull request',TEST_PROBLEM:'test needs re-recording',BEHIND_MAIN:'branch is behind main: bug is older than this pull request',ENV:'fails on main too: not from this pull request'})[v]||'';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const badge=v=>'<span class="badge '+cls(v)+'">'+esc(v)+'</span>';
const what=h=>h.pr?'Pull request #'+h.pr:(builds[h.build]||h.build);
let t0=0,tick=null,prList=[];
/* theme */
function setTheme(t){try{t==='system'?localStorage.removeItem('witness-theme'):localStorage.setItem('witness-theme',t)}catch(e){}
  if(t==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);
  document.querySelectorAll('.tog button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t===t)))}
(function(){let t='system';try{t=localStorage.getItem('witness-theme')||'system'}catch(e){}document.querySelectorAll('.tog button').forEach(b=>{b.onclick=()=>setTheme(b.dataset.t);b.setAttribute('aria-pressed',String(b.dataset.t===t))})})();
/* reveal on scroll */
const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px'}):null;
document.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%4)*60+'ms';io?io.observe(el):el.classList.add('in')});
setTimeout(()=>document.querySelectorAll('.rv:not(.in)').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight)el.classList.add('in')}),1500);
/* count up */
function countTo(el,n){if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=n;return}const d=900,s=performance.now();const f=t=>{const p=Math.min(1,(t-s)/d);el.textContent=Math.round(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
function busy(b){document.querySelectorAll('.btn[data-build],#prgo').forEach(x=>{x.disabled=b;x.classList.toggle('loading',b)});$('#term').classList.toggle('running',b)}
function logLine(l){const s=document.createElement('span');s.className='ln';
  s.className+=/VERDICT|MINED/.test(l)?' v':/PASS(ED)?\\b/.test(l)?' g':/APP_BUG|FAIL/.test(l)?' r':/TEST_PROBLEM|ENV|BEHIND_MAIN|STALE/.test(l)?' y':/^\\s{2,}(log|evidence|build|next)\\b/.test(l)?' m':'';
  s.textContent=l+'\\n';return s}
function showResult(d){
  if(!d||!d.results){$('#result').innerHTML='<div class="panel"><div class="panel-b"><span class="badge b-bad">ERROR</span> The run ended without a result.</div></div>';return}
  const isPr=!!d.pr;
  const rows=d.results.map(r=>'<tr><td><code>'+esc(String(r.test).split('/').pop())+'</code></td><td>'+esc(r.target)+'</td><td>'+esc(r.reference??'not needed')+'</td><td>'+(r.kaneLabel?esc(r.kaneLabel)+' <span class="muted">'+esc(r.kaneConfidence??'')+'</span>':'—')+'</td><td>'+badge(r.verdict)+(isPr&&plain(r.verdict)?' <span class="muted">'+esc(plain(r.verdict))+'</span>':'')+'<div class="why">'+esc(r.why)+'</div></td></tr>').join('');
  const cards=d.results.filter(r=>r.card).map(r=>'<div class="panel card" style="margin-top:16px"><div class="panel-h"><span>Card for the coding agent</span><span class="muted mono">'+esc(String(r.test).split('/').pop())+'</span></div><pre>'+esc(r.card)+'</pre></div>').join('');
  $('#result').innerHTML='<div class="panel tw"><div class="panel-h"><span>Result · '+esc(what(d))+'</span><span class="muted mono">'+(d.seconds??'')+' s</span></div><table><thead><tr><th>Test</th><th>'+(isPr?'Preview':'Your build')+'</th><th>'+(isPr?'Live main':'Fixed build')+'</th><th>Kane\\'s label</th><th>Verdict</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+cards;
  $('#result').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function watch(id){
  busy(true);$('#result').innerHTML='';const lg=$('#log');lg.textContent='';t0=Date.now();clearInterval(tick);tick=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);$('#timer').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},1000);
  $('#term').scrollIntoView({behavior:'smooth',block:'nearest'});
  const es=new EventSource('/api/run/'+id+'/events');
  es.addEventListener('log',e=>{lg.appendChild(logLine(JSON.parse(e.data)));lg.scrollTop=lg.scrollHeight});
  es.addEventListener('done',e=>{es.close();clearInterval(tick);busy(false);showResult(JSON.parse(e.data));loadStatus()});
  es.onerror=()=>{es.close();clearInterval(tick);busy(false);loadStatus()};
}
async function start(q,msg){
  $(msg).textContent='';
  const r=await fetch('/api/run?'+q,{method:'POST'});const j=await r.json();
  if(r.status===202) return watch(j.id);
  $(msg).textContent=j.error||'Could not start.';if(j.id) watch(j.id);
}
async function loadStatus(){
  const s=await (await fetch('/api/status')).json();
  const rows=[];for(const h of s.history)for(const r of (h.results||[{test:'-',verdict:h.status}]))rows.push('<tr><td class="mono">'+esc(h.started.slice(0,16).replace('T',' '))+'</td><td>'+esc(what(h))+'</td><td><code>'+esc(String(r.test).split('/').pop())+'</code></td><td>'+(r.kaneLabel?esc(r.kaneLabel)+' <span class="muted">'+esc(r.kaneConfidence??'')+'</span>':'—')+'</td><td>'+badge(r.verdict)+'</td><td class="mono">'+(r.credits?esc(r.credits):'—')+'</td><td class="mono">'+esc(h.seconds??'')+' s</td></tr>');
  $('#hist').innerHTML=rows.join('')||'<tr><td colspan="7" class="muted">None yet.</td></tr>';
  return s;
}
async function loadPrs(){
  if(!$('#pr'))return;
  const j=await (await fetch('/api/prs')).json();prList=j.prs||[];
  const ai=prList.filter(p=>p.ai).length;
  $('#prcount').textContent=prList.length?prList.length+' open with a live preview · '+ai+' marked [AI]':(j.loading?'Loading open pull requests...':'');
  $('#pr').innerHTML=prList.map(p=>'<option value="'+p.number+'">#'+p.number+' '+(p.ai?'[AI] ':'')+esc(p.title.replace(/^\\[AI\\]\\s*/,''))+'</option>').join('')||(j.loading?'<option value="">Loading open pull requests from GitHub...</option>':'<option value="">No open pull request has a preview right now</option>');if(j.loading)setTimeout(loadPrs,5000);
  $('#test').innerHTML='<option value="">All '+(j.tests||[]).length+' saved tests · about 15 to 20 minutes</option>'+(j.tests||[]).map(t=>'<option value="'+esc(t.file)+'">'+esc(t.title)+' · about 2 minutes</option>').join('');
  const link=()=>{const p=prList.find(x=>String(x.number)===$('#pr').value);$('#prlink').textContent=p?'Open the preview ↗':'';$('#prlink').href=p?p.preview:'#'};
  $('#pr').onchange=link;link();
}
document.querySelectorAll('.btn[data-build]').forEach(b=>b.onclick=()=>start('build='+encodeURIComponent(b.dataset.build),'#msg'));
if($('#prgo'))$('#prgo').onclick=()=>{const n=$('#pr').value;if(!n)return;start('pr='+encodeURIComponent(n)+($('#test').value?'&test='+encodeURIComponent($('#test').value):''),'#prmsg')};
loadPrs();
async function loadChecks(){
  if(!$('#auto'))return;
  const j=await (await fetch('/api/checks')).json();const c=j.checks||[];
  const prs=new Set(c.map(x=>x.number)).size,ai=new Set(c.filter(x=>x.ai).map(x=>x.number)).size,runs=c.reduce((n,x)=>n+x.results.length,0),bugs=c.filter(x=>x.results.some(r=>r.verdict==='APP_BUG'));
  const tally={};c.forEach(x=>x.results.forEach(r=>tally[r.verdict]=(tally[r.verdict]||0)+1));
  $('#autochips').innerHTML='<span class="chip"><b>'+c.length+'</b> checks</span><span class="chip"><b>'+prs+'</b> pull requests</span><span class="chip"><b>'+runs+'</b> test runs</span>'+Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([v,n])=>'<span class="chip"><b>'+n+'</b> '+esc(v)+'</span>').join('')+'<span class="chip">'+(bugs.length?'<b style="color:var(--red)">'+bugs.length+'</b> found a bug the pull request adds':'<b>0</b> pull requests blamed for a bug they did not add')+'</span>';
  const st=$('#stats');if(st){const v={checks:c.length,prs,ai,runs};st.querySelectorAll('b[data-k]').forEach(b=>countTo(b,v[b.dataset.k]||0))}
  $('#auto').innerHTML=c.map((x,i)=>'<tr class="fresh" style="animation-delay:'+Math.min(i,12)*35+'ms"><td class="mono">'+esc(x.started.slice(0,16).replace('T',' '))+'</td><td>'+(x.ai?'<span class="ai">AI</span>':'')+'<a href="https://github.com/'+esc(j.repo)+'/pull/'+x.number+'" target="_blank" rel="noopener">#'+x.number+'</a> '+esc(x.title.replace(/^\\[AI\\]\\s*/,''))+'</td><td><code>'+esc(x.headSha)+'</code></td><td><div class="stack">'+x.results.map(r=>'<span>'+esc(r.test.replace(/_test\\.md$/,'').replace(/_/g,' '))+'</span>').join('')+'</div></td><td><div class="stack">'+x.results.map(r=>badge(r.verdict)).join('')+'</div></td></tr>').join('')||'<tr><td colspan="5" class="muted">None yet.</td></tr>';
}
loadChecks();
loadStatus().then(s=>{if(s.busy){$('#msg').textContent='A run is in progress:';watch(s.current.id)}});
</script></body></html>`;
}
