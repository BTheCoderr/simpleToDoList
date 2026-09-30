import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const app=fs.readFileSync("public/app.js","utf8");
const html=fs.readFileSync("public/index.html","utf8");
const manifestText=fs.readFileSync("public/manifest.webmanifest","utf8");
const sw=fs.readFileSync("public/sw.js","utf8");

let passed=0;
function test(name,fn){
  try{fn();passed++;console.log("✓",name)}
  catch(error){console.error("✗",name);throw error}
}

test("app JavaScript parses",()=>{new vm.Script(app)});
test("service worker JavaScript parses",()=>{new vm.Script(sw)});
const manifest=JSON.parse(manifestText);
test("manifest has share target",()=>assert.equal(manifest.share_target?.action,"/?share=1"));
test("manifest has shutdown shortcut",()=>assert.ok((manifest.shortcuts||[]).some(x=>x.url==="/?view=shutdown")));
test("service worker cache is v8",()=>assert.match(sw,/command-center-v8/));

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
test("HTML has no duplicate ids",()=>{
  const dup=[...new Set(ids.filter((x,i,a)=>a.indexOf(x)!==i))];
  assert.deepEqual(dup,[]);
});
const refs=[...app.matchAll(/(?<!\$)\$\("([^"]+)"\)/g)].map(m=>m[1]).filter(x=>!x.startsWith(".")&&!x.startsWith("["));
test("all literal $() DOM ids exist",()=>{
  const missing=[...new Set(refs.filter(id=>!ids.includes(id)))];
  assert.deepEqual(missing,[]);
});
test("no selector accidentally uses single-id helper",()=>{
  const bad=[...new Set([...app.matchAll(/(?<!\$)\$\((["'])([.\[][^"']*)\1\)/g)].map(m=>m[0]))];
  assert.deepEqual(bad,[]);
});

const requiredViews=["today","tasks","planner","board","focus","goals","projects","notes","habits","shutdown","review","templates","archive","analytics","settings"];
test("all primary views exist",()=>requiredViews.forEach(id=>assert.ok(ids.includes(id),id+" missing")));
test("database schema is explicit v4",()=>assert.match(app,/VER=4/));
test("migration map covers v1 through v4",()=>["1:[","2:[","3:[","4:["].forEach(x=>assert.ok(app.includes(x),x+" missing")));
test("meta store is present",()=>assert.match(app,/["']meta["']/));
test("snapshot limits are present",()=>{assert.match(app,/MAX_SNAPSHOT_BYTES=4\*1024\*1024/);assert.match(app,/MAX_SNAPSHOTS=7/)});

const cut=app.indexOf('\ndocument.addEventListener("click"');
assert.ok(cut>0,"core boundary not found");
const storage=new Map();
const context={
  console,
  Date,
  Math,
  Set,
  Map,
  Promise,
  Blob,
  URLSearchParams,
  localStorage:{
    getItem:k=>storage.has(k)?storage.get(k):null,
    setItem:(k,v)=>storage.set(k,String(v)),
    removeItem:k=>storage.delete(k)
  }
};
vm.createContext(context);
new vm.Script(app.slice(0,cut)).runInContext(context);

test("normalizeTask repairs missing arrays",()=>{
  const t=context.normalizeTask({id:"x",title:"X",subtasks:null});
  assert.ok(Array.isArray(t.subtasks));
  assert.equal(t.repeat,"none");
});

function recurrence(repeat,dueDate,extra={}){
  return context.nextOccurrence({repeat,dueDate,repeatInterval:1,repeatUntil:"",...extra});
}
test("daily recurrence advances one day",()=>assert.equal(recurrence("daily","2026-01-30"),"2026-01-31"));
test("weekly recurrence advances seven days",()=>assert.equal(recurrence("weekly","2026-01-30"),"2026-02-06"));
test("weekday recurrence skips weekend",()=>assert.equal(recurrence("weekdays","2026-10-02"),"2026-10-05"));
test("monthly recurrence clamps end of month",()=>assert.equal(recurrence("monthly","2026-01-31"),"2026-02-28"));
test("monthly recurrence handles leap year",()=>assert.equal(recurrence("monthly","2028-01-31"),"2028-02-29"));
test("custom recurrence honors interval",()=>assert.equal(recurrence("custom_days","2026-01-10",{repeatInterval:3}),"2026-01-13"));
test("repeat-until stops future occurrence",()=>assert.equal(recurrence("weekly","2026-01-30",{repeatUntil:"2026-02-05"}),""));

context.state.projects=[];
test("Quick Add parses priority and every-X-days recurrence",()=>{
  const q=context.parseQuick("Review budget every 3 days !high");
  assert.equal(q.title,"Review budget");
  assert.equal(q.repeat,"custom_days");
  assert.equal(q.repeatInterval,3);
  assert.equal(q.priority,"high");
});
test("Quick Add parses monthly recurrence",()=>{
  const q=context.parseQuick("Pay rent monthly !medium");
  assert.equal(q.title,"Pay rent");
  assert.equal(q.repeat,"monthly");
});

context.state.projects=[{id:"p1",goalId:"g1"}];
context.state._active=[{id:"a",projectId:"p1",status:"done"},{id:"b",projectId:"p1",status:"next"}];
test("goal progress rolls up project tasks",()=>{
  const p=context.goalProgress({id:"g1",status:"active"});
  assert.equal(p.projects,1);
  assert.equal(p.tasks,2);
  assert.equal(p.done,1);
  assert.equal(p.percent,50);
});

test("accessibility basics are present",()=>{
  assert.match(html,/class="skip-link"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(app,/aria-current/);
});

console.log("\n"+passed+" regression checks passed.");
