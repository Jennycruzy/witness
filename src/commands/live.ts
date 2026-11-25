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
import { PAGES, renderPage, type PageName, type SiteOptions } from './site.js';

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
  origins?: string[];       // other sites (besides *.vercel.app) whose pages may call the API
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
    const origin = req.headers.origin;
    if (url.pathname.startsWith('/api/') && allowedOrigin(origin, o.origins)) { res.setHeader('access-control-allow-origin', origin!); res.setHeader('vary', 'origin'); }
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) { res.writeHead(204, { 'access-control-allow-methods': 'GET, POST', 'access-control-max-age': '600' }); return res.end(); }
    const page = (Object.keys(PAGES) as PageName[]).find(p => url.pathname === PAGES[p].path || url.pathname === '/' + PAGES[p].file);
    if (req.method === 'GET' && page) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(renderPage(page, o));
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

/** Writes the site's pages as static files (e.g. for Vercel); they call the API at `api`. */
export function exportSite(o: SiteOptions, outDir: string, api: string): string[] {
  mkdirSync(outDir, { recursive: true });
  return (Object.keys(PAGES) as PageName[]).map(p => { const f = join(outDir, PAGES[p].file); writeFileSync(f, renderPage(p, o, api.replace(/\/$/, ''))); return f; });
}

/** Pages served from another site (Vercel) may call the API. */
export function allowedOrigin(origin: string | undefined, extra: string[] = []): boolean {
  if (!origin) return false;
  try { const u = new URL(origin); return (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) || extra.includes(origin); } catch { return false; }
}
