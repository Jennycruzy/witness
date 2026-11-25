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
  const buttons = Object.entries(o.builds).map(([k, b]) => `<button class="btn${k === 'buggy' ? ' btn-primary' : ''}" data-build="${k}">Run on ${esc(b.label)}</button>`).join('\n');
  const app = o.pr ? esc(o.pr.app) : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WITNESS · Run it live</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7' fill='%231f883d'/%3E%3C/svg%3E">
<meta name="description" content="Kane CLI checks a real app's open pull requests on their live previews, and WITNESS decides who is at fault.">
<style>
:root{--bg:#ffffff;--fg:#1f2328;--muted:#59636e;--border:#d1d9e0;--subtle:#f6f8fa;--accent:#0969da;--green:#1a7f37;--red:#d1242f;--amber:#9a6700;--btn:#f6f8fa;--btnp:#1f883d;--btnpfg:#fff;--code:#f6f8fa}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--border:#3d444d;--subtle:#151b23;--accent:#4493f8;--green:#3fb950;--red:#f85149;--amber:#d29922;--btn:#212830;--btnp:#238636;--btnpfg:#fff;--code:#151b23}}
:root[data-theme="dark"]{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--border:#3d444d;--subtle:#151b23;--accent:#4493f8;--green:#3fb950;--red:#f85149;--amber:#d29922;--btn:#212830;--btnp:#238636;--btnpfg:#fff;--code:#151b23}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}
header{border-bottom:1px solid var(--border);background:var(--subtle);padding:16px 0}header .in{max-width:1012px;margin:0 auto;padding:0 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
header b{font-size:16px}header a{color:var(--accent);text-decoration:none}main{max-width:1012px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;font-weight:600;margin:0 0 8px}h2{font-size:18px;font-weight:600;margin:32px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
p{margin:0 0 12px}.muted{color:var(--muted)}a{color:var(--accent)}ol{margin:0 0 12px;padding-left:20px}li{margin:2px 0}
.box{border:1px solid var(--border);border-radius:6px;overflow:hidden;margin:12px 0}.box-h{background:var(--subtle);border-bottom:1px solid var(--border);padding:8px 16px;font-weight:600;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;align-items:center}.btn{font:inherit;font-weight:500;padding:5px 16px;border:1px solid var(--border);border-radius:6px;background:var(--btn);color:var(--fg);cursor:pointer}
.btn-primary{background:var(--btnp);color:var(--btnpfg);border-color:rgba(31,35,40,.15)}.btn:disabled{opacity:.5;cursor:not-allowed}
select{font:inherit;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg);max-width:100%}
label{font-weight:600;display:block;margin:12px 0 4px}
pre{margin:0;padding:12px 16px;background:var(--code);font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto}
table{border-collapse:collapse;width:100%}td,th{border-top:1px solid var(--border);padding:8px 16px;text-align:left;vertical-align:top}th{font-weight:600;background:var(--subtle)}
.tw{overflow-x:auto}.lbl{display:inline-block;padding:0 7px;border-radius:2em;border:1px solid currentColor;font-size:12px;font-weight:500;line-height:20px;white-space:nowrap}
.ok{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--amber)}.msg{min-height:1.5em}
.ai{display:inline-block;padding:0 6px;border-radius:2em;background:var(--subtle);border:1px solid var(--border);font-size:12px}
</style></head><body>
<header><div class="in"><b>WITNESS</b><span class="muted">/</span><span>Run it live</span><span style="flex:1"></span><a href="https://github.com/Jennycruzy/witness">GitHub</a></div></header>
<main>
${o.pr ? `<h1>Check a pull request of ${app} before it merges</h1>
<p>${app} is an open-source budgeting app that people use for their own money. Coding agents now write many of its changes: pull requests marked <span class="ai">[AI]</span>. Every pull request gets a live preview of the app.</p>
<p>Pick one. <a href="https://www.testmuai.com/kane-cli/">Kane CLI</a> then uses that preview like a person would, in a real Chrome, replaying tests that were written from ${app}'s own bug reports. Each one caught its real regression on ${app}'s own builds: it fails on the build with the bug and passes on the build with the fix. If a test fails on the preview, WITNESS replays the same recording on ${app}'s live main build and decides:</p>
<ol><li><b>Bug added by this pull request</b> (APP_BUG): passes on main, fails on the preview at a check. The coding agent is told to fix the app, not the test.</li>
<li><b>Test needs re-recording</b> (TEST_PROBLEM): the page changed where the test clicks or types.</li>
<li><b>Not from this pull request</b> (ENV): it fails on main too.</li></ol>
<p class="muted" id="prcount"></p>
<div class="box"><div class="box-h"><span>Check a live pull request</span><span class="muted">${o.perHour} runs an hour, real Kane credits</span></div><div style="padding:8px 16px 16px">
<label for="pr">Open pull request</label><select id="pr"><option>Loading open pull requests...</option></select>
<label for="test">Tests</label><select id="test"><option value="">All five saved tests (about 15 to 20 minutes)</option></select>
<div class="btns"><button class="btn btn-primary" id="prgo">Check this pull request</button><a id="prlink" class="muted" href="#" target="_blank" rel="noopener"></a></div>
<div id="prmsg" class="msg muted"></div></div></div>` : ''}
<div class="box"><div class="box-h"><span>Log</span><span id="timer" class="muted"></span></div><pre id="log">Pick a pull request${o.pr ? '' : ' or a build'} to start.</pre></div>
<div id="result"></div>
${o.pr ? `<h2>Checked automatically</h2>
<p class="muted" id="autosum">Every few hours WITNESS checks each open pull request whose newest commit it has not checked yet, with the tests for the areas that pull request changes (<code>witness pr watch</code>). Every check is listed here and committed in the repository.</p>
<div class="box tw"><table><thead><tr><th>When (UTC)</th><th>Pull request</th><th>Commit</th><th>Tests</th><th>WITNESS</th></tr></thead><tbody id="auto"><tr><td colspan="5" class="muted">Loading...</td></tr></tbody></table></div>` : ''}
<h2>${o.pr ? 'Also: watch it decide on a known bug' : 'Watch WITNESS decide who is at fault'}</h2>
<p>The TodoMVC Svelte example, with its upstream code, has the bugs in <a href="https://github.com/tastejs/todomvc/issues/2315">tastejs/todomvc#2315</a>: an edit made of spaces leaves an empty todo, and the filter is lost on reload. WITNESS replays the saved Kane recording on the build you pick; if a test fails, it replays the same recording on the fixed build and decides. Kane's own label is shown next to it and never used to decide. About two minutes.</p>
<div class="btns">${buttons}</div>
<div id="msg" class="msg muted"></div>
<h2>Recent runs</h2>
<div class="box tw"><table><thead><tr><th>When (UTC)</th><th>What</th><th>Test</th><th>Kane's label</th><th>WITNESS</th><th>Kane credits</th><th>Time</th></tr></thead><tbody id="hist"><tr><td colspan="7" class="muted">None yet.</td></tr></tbody></table></div>
<p class="muted">Kane reports credits when it diagnoses a failure; a passing replay shows —. Each run uses real Kane credits, so this page allows ${o.perHour} runs an hour and one per visitor every ${o.perVisitorMinutes} minutes. Replays run with <code>--no-adaptive-heal</code>, so Kane cannot heal past a bug. Everything here runs from the same code as the <code>witness</code> CLI: <code>witness pr check</code> and <code>witness guard</code>.</p>
</main>
<script>
const $=s=>document.querySelector(s);const builds=${JSON.stringify(Object.fromEntries(Object.entries(o.builds).map(([k, b]) => [k, b.label])))};
const cls=v=>v==='PASS'?'ok':v==='APP_BUG'?'bad':'warn';
const plain=v=>({PASS:'passes on the preview',APP_BUG:'bug added by this pull request',TEST_PROBLEM:'test needs re-recording',ENV:'fails on main too: not from this pull request'})[v]||'';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const what=h=>h.pr?'Pull request #'+h.pr:(builds[h.build]||h.build);
let t0=0,tick=null,prList=[];
function busy(b){document.querySelectorAll('.btn').forEach(x=>x.disabled=b)}
function showResult(d){
  if(!d||!d.results){$('#result').innerHTML='<p class="bad">The run ended without a result.</p>';return}
  const isPr=!!d.pr;
  const rows=d.results.map(r=>'<tr><td><code>'+esc(String(r.test).split('/').pop())+'</code></td><td>'+esc(r.target)+'</td><td>'+esc(r.reference??'not needed')+'</td><td>'+(r.kaneLabel?esc(r.kaneLabel)+' '+esc(r.kaneConfidence??''):'—')+'</td><td><span class="lbl '+cls(r.verdict)+'">'+esc(r.verdict)+'</span>'+(isPr&&plain(r.verdict)?' '+esc(plain(r.verdict)):'')+'<div class="muted">'+esc(r.why)+'</div></td></tr>').join('');
  const cards=d.results.filter(r=>r.card).map(r=>'<div class="box"><div class="box-h"><span>Card for the coding agent: '+esc(String(r.test).split('/').pop())+'</span></div><pre>'+esc(r.card)+'</pre></div>').join('');
  $('#result').innerHTML='<div class="box tw"><div class="box-h"><span>Result: '+esc(what(d))+'</span><span class="muted">'+(d.seconds??'')+' s</span></div><table><thead><tr><th>Test</th><th>'+(isPr?'Preview':'Your build')+'</th><th>'+(isPr?'Live main':'Fixed build')+'</th><th>Kane\\'s label</th><th>WITNESS</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+cards;
}
function watch(id){
  busy(true);$('#result').innerHTML='';$('#log').textContent='';t0=Date.now();clearInterval(tick);tick=setInterval(()=>{$('#timer').textContent=Math.round((Date.now()-t0)/1000)+' s'},1000);
  const es=new EventSource('/api/run/'+id+'/events');
  es.addEventListener('log',e=>{const l=$('#log');l.textContent+=JSON.parse(e.data)+'\\n';l.scrollTop=l.scrollHeight});
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
  const rows=[];for(const h of s.history)for(const r of (h.results||[{test:'-',verdict:h.status}]))rows.push('<tr><td>'+esc(h.started.slice(0,16).replace('T',' '))+'</td><td>'+esc(what(h))+'</td><td><code>'+esc(String(r.test).split('/').pop())+'</code></td><td>'+(r.kaneLabel?esc(r.kaneLabel)+' '+esc(r.kaneConfidence??''):'—')+'</td><td><span class="lbl '+cls(r.verdict)+'">'+esc(r.verdict)+'</span></td><td>'+(r.credits?esc(r.credits):'—')+'</td><td>'+esc(h.seconds??'')+' s</td></tr>');
  $('#hist').innerHTML=rows.join('')||'<tr><td colspan="7" class="muted">None yet.</td></tr>';
  return s;
}
async function loadPrs(){
  if(!$('#pr'))return;
  const j=await (await fetch('/api/prs')).json();prList=j.prs||[];
  const ai=prList.filter(p=>p.ai).length;
  $('#prcount').textContent=prList.length?'Right now '+prList.length+' open pull requests of '+j.repo+' have a live preview; '+ai+' of them are marked [AI]. Live main: '+(j.live?j.live.url:'')+'.':'';
  $('#pr').innerHTML=prList.map(p=>'<option value="'+p.number+'">#'+p.number+' '+esc(p.title)+'</option>').join('')||(j.loading?'<option value="">Loading open pull requests from GitHub...</option>':'<option value="">No open pull request has a preview right now</option>');if(j.loading)setTimeout(loadPrs,5000);
  $('#test').innerHTML='<option value="">All '+(j.tests||[]).length+' saved tests (about 15 to 20 minutes)</option>'+(j.tests||[]).map(t=>'<option value="'+esc(t.file)+'">'+esc(t.title)+' (about 2 minutes)</option>').join('');
  const link=()=>{const p=prList.find(x=>String(x.number)===$('#pr').value);$('#prlink').textContent=p?'Open the preview':'';$('#prlink').href=p?p.preview:'#'};
  $('#pr').onchange=link;link();
}
document.querySelectorAll('.btn[data-build]').forEach(b=>b.onclick=()=>start('build='+encodeURIComponent(b.dataset.build),'#msg'));
if($('#prgo'))$('#prgo').onclick=()=>{const n=$('#pr').value;if(!n)return;start('pr='+encodeURIComponent(n)+($('#test').value?'&test='+encodeURIComponent($('#test').value):''),'#prmsg')};
loadPrs();
async function loadChecks(){
  if(!$('#auto'))return;
  const j=await (await fetch('/api/checks')).json();const c=j.checks||[];
  const prs=new Set(c.map(x=>x.number)).size,runs=c.reduce((n,x)=>n+x.results.length,0),bugs=c.filter(x=>x.results.some(r=>r.verdict==='APP_BUG'));
  $('#autosum').insertAdjacentHTML('beforeend',' So far: '+c.length+' checks of '+prs+' pull requests, '+runs+' test runs; '+(bugs.length?'<b class="bad">'+bugs.length+' found a bug the pull request adds</b>.':'none found a bug the pull request adds.'));
  $('#auto').innerHTML=c.map(x=>'<tr><td>'+esc(x.started.slice(0,16).replace('T',' '))+'</td><td><a href="https://github.com/'+esc(j.repo)+'/pull/'+x.number+'" target="_blank" rel="noopener">#'+x.number+'</a> '+esc(x.title)+'</td><td><code>'+esc(x.headSha)+'</code></td><td>'+x.results.map(r=>esc(r.test.replace(/_test\.md$/,'').replace(/_/g,' '))).join('<br>')+'</td><td>'+x.results.map(r=>'<span class="lbl '+cls(r.verdict)+'">'+esc(r.verdict)+'</span>').join('<br>')+'</td></tr>').join('')||'<tr><td colspan="5" class="muted">None yet.</td></tr>';
}
loadChecks();
loadStatus().then(s=>{if(s.busy){$('#msg').textContent='A run is in progress:';watch(s.current.id)}});
</script></body></html>`;
}
