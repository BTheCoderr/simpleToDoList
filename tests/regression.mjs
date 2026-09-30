import fs from "node:fs";
import assert from "node:assert/strict";
import {
  normalizeTask,
  nextOccurrence,
  parseQuick,
  goalProgress
} from "../public/core.js";
import {
  APP_VERSION,
  DB_VERSION,
  MAX_SNAPSHOT_BYTES,
  MAX_SNAPSHOTS,
  runMigrations
} from "../public/storage.js";
import {
  BACKUP_VERSION,
  MAX_IMPORT_BYTES,
  validateBackupPayload
} from "../public/backup.js";

const app=fs.readFileSync("public/app.js","utf8");
const core=fs.readFileSync("public/core.js","utf8");
const storage=fs.readFileSync("public/storage.js","utf8");
const backup=fs.readFileSync("public/backup.js","utf8");
const html=fs.readFileSync("public/index.html","utf8");
const css=fs.readFileSync("public/style.css","utf8");
const manifestText=fs.readFileSync("public/manifest.webmanifest","utf8");
const sw=fs.readFileSync("public/sw.js","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");

let passed=0;
function test(name,fn){
  try{fn();passed++;console.log("✓",name)}
  catch(error){console.error("✗",name);throw error}
}

const manifest=JSON.parse(manifestText);

test("release version is 6.2.0",()=>{
  assert.equal(APP_VERSION,"6.2.0");
  assert.equal(pkg.version,"6.2.0");
});
test("app uses browser modules",()=>assert.match(html,/type="module" src="\/app\.js"/));
test("storage, core, and backup modules are imported",()=>{
  assert.match(app,/from "\.\/storage\.js"/);
  assert.match(app,/from "\.\/core\.js"/);
  assert.match(app,/from "\.\/backup\.js"/);
});
test("legacy dead helpers remain removed",()=>{
  assert.doesNotMatch(app,/function visibleTasks\b/);
  assert.doesNotMatch(app,/focusPreset/);
  assert.doesNotMatch(app,/function parseDatePhrase\b/);
  assert.doesNotMatch(app,/function openDB\b/);
});
test("dependency surface stays minimal",()=>{
  assert.ok(!pkg.dependencies||Object.keys(pkg.dependencies).length===0);
  assert.deepEqual(Object.keys(pkg.devDependencies||{}),["@playwright/test"]);
});
test("browser QA files and scripts exist",()=>{
  assert.ok(fs.existsSync("playwright.config.mjs"));
  assert.ok(fs.existsSync("tests/e2e.spec.mjs"));
  assert.ok(fs.existsSync("tests/production.spec.mjs"));
  assert.equal(pkg.scripts.e2e,"playwright test");
  assert.match(workflow,/production-smoke:/);
  assert.match(workflow,/Wait for Netlify v6\.2/);
});

test("manifest has share target",()=>assert.equal(manifest.share_target?.action,"/?share=1"));
test("manifest review shortcut remains simplified",()=>assert.ok((manifest.shortcuts||[]).some(x=>x.url==="/?view=review")));
test("manifest does not force portrait orientation",()=>assert.equal("orientation" in manifest,false));
test("production PWA PNG icons exist and are declared",()=>{
  for(const name of ["apple-touch-icon.png","icon-192.png","icon-512.png","icon-512-maskable.png"]){
    assert.ok(fs.existsSync("public/"+name),name+" missing");
    assert.ok(fs.statSync("public/"+name).size>1000,name+" unexpectedly small");
  }
  assert.ok(manifest.icons.some(x=>x.src==="/icon-192.png"&&x.sizes==="192x192"));
  assert.ok(manifest.icons.some(x=>x.src==="/icon-512.png"&&x.sizes==="512x512"));
  assert.ok(manifest.icons.some(x=>x.src==="/icon-512-maskable.png"&&x.purpose==="maskable"));
  assert.match(html,/apple-touch-icon\.png/);
});

test("service worker cache is v10 and caches QA assets",()=>{
  assert.match(sw,/command-center-v10/);
  for(const asset of ["/core.js","/storage.js","/backup.js","/icon-192.png","/icon-512.png","/apple-touch-icon.png"]){
    assert.ok(sw.includes(asset),asset+" not cached");
  }
});
test("service worker updates wait for explicit reload",()=>{
  assert.doesNotMatch(sw,/install"[\s\S]*skipWaiting\(\)/);
  assert.match(sw,/SKIP_WAITING/);
  assert.match(app,/New version ready|showUpdateBanner/);
  assert.match(app,/controllerchange/);
});
test("dialog focus management is present",()=>{
  assert.match(app,/function openDialog/);
  assert.match(app,/dialogReturnFocus/);
  assert.match(app,/dialogFocusables/);
  assert.doesNotMatch(app,/\.showModal\(\)/);
});

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
test("HTML has no duplicate ids",()=>{
  const dup=[...new Set(ids.filter((x,i,a)=>a.indexOf(x)!==i))];
  assert.deepEqual(dup,[]);
});
const refs=[...app.matchAll(/(?<!\$)\$\("([^"]+)"\)/g)]
  .map(m=>m[1])
  .filter(x=>!x.startsWith(".")&&!x.startsWith("["));
test("all literal $() DOM ids exist",()=>{
  const missing=[...new Set(refs.filter(id=>!ids.includes(id)))];
  assert.deepEqual(missing,[]);
});
test("no selector accidentally uses single-id helper",()=>{
  const bad=[...new Set([...app.matchAll(/(?<!\$)\$\((["'])([.\[][^"']*)\1\)/g)].map(m=>m[0]))];
  assert.deepEqual(bad,[]);
});

const requiredViews=["today","tasks","planner","board","focus","goals","projects","notes","habits","shutdown","review","templates","archive","analytics","settings"];
test("all feature views remain available",()=>requiredViews.forEach(id=>assert.ok(ids.includes(id),id+" missing")));
test("sidebar remains simplified",()=>{
  const sidebar=html.slice(html.indexOf("<aside"),html.indexOf("</aside>"));
  assert.doesNotMatch(sidebar,/data-view="templates"/);
  assert.doesNotMatch(sidebar,/data-view="archive"/);
  assert.doesNotMatch(sidebar,/data-view="shutdown"/);
  assert.doesNotMatch(sidebar,/data-view="analytics"/);
  assert.match(sidebar,/data-view="review"/);
});
test("task utilities link to templates and archive",()=>{
  const tasks=html.slice(html.indexOf('<section id="tasks"'),html.indexOf('<section id="planner"'));
  assert.match(tasks,/data-view="templates"/);
  assert.match(tasks,/data-view="archive"/);
});
test("review family links daily weekly analytics",()=>{
  const reviewTabs=[...html.matchAll(/class="view-tabs"/g)].length;
  assert.equal(reviewTabs,3);
  assert.match(html,/data-view="shutdown"/);
  assert.match(html,/data-view="analytics"/);
});

test("database schema remains explicit v4",()=>assert.equal(DB_VERSION,4));
test("migration from v2 creates v3/v4 stores",()=>{
  const existing=new Set(["tasks","projects","notes","habits","activity","templates"]);
  const created=[];
  const metaWrites=[];
  const db={
    objectStoreNames:{contains:name=>existing.has(name)},
    createObjectStore:name=>{existing.add(name);created.push(name);return {}}
  };
  const tx={objectStore:name=>({put:value=>metaWrites.push([name,value])})};
  runMigrations(db,tx,2,4);
  assert.deepEqual(created,["goals","snapshots","meta"]);
  assert.equal(metaWrites[0][0],"meta");
  assert.equal(metaWrites[0][1].version,4);
});
test("snapshot limits remain protected",()=>{
  assert.equal(MAX_SNAPSHOT_BYTES,4*1024*1024);
  assert.equal(MAX_SNAPSHOTS,7);
});

test("backup validator accepts complete current and v4 backups",()=>{
  const current={version:BACKUP_VERSION,tasks:[],projects:[],notes:[],habits:[],activity:[],templates:[],goals:[]};
  const now=validateBackupPayload(current,100);
  assert.equal(now.ok,true);
  const old={version:4,tasks:[],projects:[],notes:[],habits:[],activity:[],templates:[]};
  const migrated=validateBackupPayload(old,100);
  assert.equal(migrated.ok,true);
  assert.deepEqual(migrated.data.goals,[]);
});
test("backup validator rejects old, partial, malformed, and oversized data",()=>{
  assert.equal(validateBackupPayload({version:3,tasks:[]},10).ok,false);
  assert.equal(validateBackupPayload({version:6,tasks:[]},10).ok,false);
  assert.equal(validateBackupPayload({version:6,tasks:[null],projects:[],notes:[],habits:[],activity:[],templates:[],goals:[]},10).ok,false);
  assert.equal(validateBackupPayload({version:6,tasks:[],projects:[],notes:[],habits:[],activity:[],templates:[],goals:[]},MAX_IMPORT_BYTES+1).ok,false);
});

test("normalizeTask repairs missing arrays",()=>{
  const task=normalizeTask({id:"x",title:"X",subtasks:null});
  assert.ok(Array.isArray(task.subtasks));
  assert.equal(task.repeat,"none");
});
function recurrence(repeat,dueDate,extra={}){
  return nextOccurrence({repeat,dueDate,repeatInterval:1,repeatUntil:"",...extra},new Date("2026-09-30T12:00:00"));
}
test("daily recurrence advances one day",()=>assert.equal(recurrence("daily","2026-01-30"),"2026-01-31"));
test("weekly recurrence advances seven days",()=>assert.equal(recurrence("weekly","2026-01-30"),"2026-02-06"));
test("weekday recurrence skips weekend",()=>assert.equal(recurrence("weekdays","2026-10-02"),"2026-10-05"));
test("monthly recurrence clamps end of month",()=>assert.equal(recurrence("monthly","2026-01-31"),"2026-02-28"));
test("monthly recurrence handles leap year",()=>assert.equal(recurrence("monthly","2028-01-31"),"2028-02-29"));
test("custom recurrence honors interval",()=>assert.equal(recurrence("custom_days","2026-01-10",{repeatInterval:3}),"2026-01-13"));
test("repeat-until stops future occurrence",()=>assert.equal(recurrence("weekly","2026-01-30",{repeatUntil:"2026-02-05"}),""));

test("Quick Add parses priority and every-X-days recurrence",()=>{
  const q=parseQuick("Review budget every 3 days !high",[]);
  assert.equal(q.title,"Review budget");
  assert.equal(q.repeat,"custom_days");
  assert.equal(q.repeatInterval,3);
  assert.equal(q.priority,"high");
});
test("Quick Add parses monthly recurrence",()=>{
  const q=parseQuick("Pay rent monthly !medium",[]);
  assert.equal(q.title,"Pay rent");
  assert.equal(q.repeat,"monthly");
});
test("Quick Add resolves project tags",()=>{
  const q=parseQuick("Call client tomorrow #work",[{id:"p1",name:"Win the Week",area:"Work"}],new Date("2026-09-30T12:00:00"));
  assert.equal(q.projectId,"p1");
  assert.equal(q.dueDate,"2026-10-01");
});

test("goal progress rolls up project tasks",()=>{
  const p=goalProgress(
    {id:"g1",status:"active"},
    [{id:"p1",goalId:"g1"}],
    [{id:"a",projectId:"p1",status:"done"},{id:"b",projectId:"p1",status:"next"}]
  );
  assert.equal(p.projects,1);
  assert.equal(p.tasks,2);
  assert.equal(p.done,1);
  assert.equal(p.percent,50);
});

test("accessibility basics and update status regions remain present",()=>{
  assert.match(html,/class="skip-link"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/id="updateBanner"/);
  assert.match(app,/aria-current/);
});
test("mobile CSS remains consolidated",()=>{
  assert.equal((css.match(/@media\(max-width:760px\)\{/g)||[]).length,1);
  assert.doesNotMatch(css,/Personal OS v5|v6 hardening|Weekly review, templates, archive/);
});
test("CSS braces are balanced",()=>{
  let depth=0;
  for(const ch of css){if(ch==="{")depth++;else if(ch==="}")depth--;assert.ok(depth>=0,"unexpected closing brace")}
  assert.equal(depth,0);
});
test("backup module is actually used by import flow",()=>{
  assert.match(backup,/MAX_IMPORT_BYTES=8\*1024\*1024/);
  assert.match(app,/validateBackupPayload/);
  assert.match(app,/No data was changed/);
});

console.log("\n"+passed+" regression checks passed.");
