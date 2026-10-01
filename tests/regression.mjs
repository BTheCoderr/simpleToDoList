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
import { tasksToCsv, workspaceToMarkdown } from "../public/exporters.js";

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

test("release version is 7.3.0",()=>{
  assert.equal(APP_VERSION,"7.3.0");
  assert.equal(pkg.version,"7.3.0");
});
test("app uses browser modules",()=>assert.match(html,/type="module" src="\/app\.js"/));
test("storage, core, backup, privacy, and exporter modules are imported",()=>{
  assert.match(app,/from "\.\/storage\.js"/);
  assert.match(app,/from "\.\/core\.js"/);
  assert.match(app,/from "\.\/backup\.js"/);
  assert.match(app,/from "\.\/privacy\.js"/);
  assert.match(app,/from "\.\/exporters\.js"/);
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
  assert.ok(fs.existsSync("tests/pwa.e2e.spec.mjs"));
  assert.equal(pkg.scripts.e2e,"playwright test");
  assert.match(workflow,/Wait for Netlify v7.3/);
  assert.match(workflow,/Smoke test production/);
  assert.match(workflow,/\[prod-smoke\]/);
  assert.doesNotMatch(workflow,/^  production-smoke:/m);
});

test("manifest has share target",()=>assert.equal(manifest.share_target?.action,"/?share=1"));
test("manifest declares language and stays rotation-friendly",()=>{assert.equal(manifest.lang,"en-US");assert.equal(manifest.dir,"ltr");assert.equal(manifest.prefer_related_applications,false);assert.equal("orientation" in manifest,false)});
test("manifest review shortcut remains simplified",()=>assert.ok((manifest.shortcuts||[]).some(x=>x.url==="/?view=review")));
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

test("service worker cache is v17 and caches v7.3 modules",()=>{
  assert.match(sw,/command-center-v17/);
  for(const asset of ["/core.js","/storage.js","/backup.js","/privacy.js","/exporters.js","/icon-192.png","/icon-512.png","/apple-touch-icon.png"]){
    assert.ok(sw.includes(asset),asset+" not cached");
  }
});
test("service worker updates wait for explicit reload",()=>{
  const installBlock=sw.slice(sw.indexOf('addEventListener("install"'),sw.indexOf('addEventListener("activate"'));
  assert.doesNotMatch(installBlock,/skipWaiting\(\)/);
  assert.match(sw,/SKIP_WAITING/);
  assert.match(app,/showUpdateBanner/);
  assert.match(app,/controllerchange/);
});
test("service worker keeps offline fallback same-origin and navigation-safe",()=>{
  assert.match(sw,/url\.origin!==self\.location\.origin/);
  assert.match(sw,/request\.mode==="navigate"/);
  assert.match(sw,/status:503/);
});
test("installed app chrome follows the selected theme",()=>{
  assert.match(html,/id="themeColor" name="theme-color"/);
  assert.match(html,/name="color-scheme" content="light dark"/);
  assert.match(app,/meta\[name="theme-color"\]/);
  assert.match(app,/#f5f7fb/);
  assert.match(app,/#0b1020/);
});
test("dialog focus management is present",()=>{
  assert.match(app,/function openDialog/);
  assert.match(app,/dialogReturnFocus/);
  assert.match(app,/dialogFocusables/);
  assert.equal((app.match(/\.showModal\(\)/g)||[]).length,1);
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

const requiredViews=["today","tasks","planner","board","focus","goals","projects","notes","habits","shutdown","review","templates","archive","analytics","history","settings"];
test("selector helper names stay valid",()=>assert.doesNotMatch(app,/\$\$\$\(/));

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
test("review family links daily weekly analytics and history",()=>{
  const reviewTabs=[...html.matchAll(/class="view-tabs"/g)].length;
  assert.equal(reviewTabs,4);
  assert.match(html,/data-view="shutdown"/);
  assert.match(html,/data-view="analytics"/);
  assert.match(html,/data-view="history"/);
});

test("v7 task power-user controls are present",()=>{
  for(const id of ["tagFilter","bulkToggle","bulkBar","bulkStatus","bulkPriority","bulkProject","bulkDue","bulkApply","bulkArchive","bulkTrash","taskTags"]){
    assert.ok(ids.includes(id),id+" missing");
  }
  assert.match(app,/function filteredTasks/);
  assert.match(app,/function applyBulkChanges/);
  assert.match(app,/function bulkArchive/);
  assert.match(app,/function bulkTrash/);
  assert.match(app,/tagPills/);
});
test("Today dashboard customization is local and schema-free",()=>{
  for(const id of ["customizeToday","dashboardModal","dashboardOptions","dashboardForm","resetDashboard"]){
    assert.ok(ids.includes(id),id+" missing");
  }
  assert.equal((html.match(/data-dashboard-card=/g)||[]).length,4);
  assert.match(app,/cc-today-layout-v1/);
  assert.match(app,/function applyDashboardLayout/);
  assert.match(app,/function moveDashboardCard/);
});

test("v7.1 Saved Views persist status project and tag combinations locally",()=>{
  for(const id of ["projectFilter","tagFilter","saveCurrentView","savedViews","savedViewModal","savedViewForm","savedViewName","savedViewSummary"]){
    assert.ok(ids.includes(id),id+" missing");
  }
  assert.match(app,/cc-saved-task-views-v1/);
  assert.match(app,/function currentTaskView/);
  assert.match(app,/function applySavedView/);
  assert.match(app,/function deleteSavedView/);
  assert.match(app,/projectFilter=this\.value/);
});
test("v7.1 advanced recurrence controls exist without schema bump",()=>{
  for(const id of ["repeatWeekdaysWrap","repeatIntervalUnit"]){
    assert.ok(ids.includes(id),id+" missing");
  }
  assert.equal((html.match(/data-repeat-weekday=/g)||[]).length,7);
  assert.match(html,/value="selected_weekdays"/);
  assert.match(html,/value="custom_weeks"/);
  assert.match(app,/data-repeat-weekday/);
});

test("URL navigation state stays reload-safe",()=>{
  assert.match(app,/history\.replaceState/);
  assert.match(app,/searchParams\.set\("view",state\.view\)/);
  assert.match(app,/searchParams\.delete\("quick"\)/);
});

test("v7.2 planner modes and quick reschedule controls are wired",()=>{
  for(const id of ["plannerWeekdays","calendarGrid","calPrev","calToday","calNext","taskDue"]){
    assert.ok(ids.includes(id),id+" missing");
  }
  assert.equal((html.match(/data-planner-mode=/g)||[]).length,3);
  assert.equal((html.match(/data-reschedule-preset=/g)||[]).length,4);
  assert.match(app,/cc-planner-mode/);
  assert.match(app,/function shiftPlanner/);
  assert.match(app,/planner-week-grid/);
  assert.match(app,/planner-day-grid/);
  assert.match(app,/data-planner-date/);
  assert.match(app,/function rescheduleTask/);
});
test("v7.2 Kanban order persists on task records without a schema bump",()=>{
  assert.match(core,/boardOrder:null/);
  assert.match(app,/function boardSort/);
  assert.match(app,/function moveBoardTask/);
  assert.match(app,/boardOrder=\(i\+1\)\*100/);
  assert.match(app,/boardOrder:old\?old\.boardOrder:null/);
  assert.equal(DB_VERSION,4);
});

test("v7.3 History is a real local audit view",()=>{
  for(const id of ["history","historyFilter","historySearch","historyList"])assert.ok(ids.includes(id),id+" missing");
  assert.match(app,/function renderHistory/);
  assert.match(app,/function historyTypeLabel/);
  assert.match(app,/task\.status/);
  assert.match(app,/snapshot\.restored/);
  assert.match(app,/backup\.imported/);
});
test("v7.3 human-readable exports are wired and pure helpers work",()=>{
  for(const id of ["exportCsv","exportMarkdown"])assert.ok(ids.includes(id),id+" missing");
  assert.match(app,/exportTasksCsv/);
  assert.match(app,/exportWorkspaceMarkdown/);
  const csv=tasksToCsv([{title:'Hello, "world"',status:"next",priority:"high",projectId:"p1",tags:["calls"],description:"Line\none"}],[{id:"p1",name:"Work"}]);
  assert.match(csv,/"Hello, ""world"""/);
  assert.match(csv,/Work/);
  const md=workspaceToMarkdown({goals:[{id:"g1",name:"Ship",status:"active"}],projects:[{id:"p1",name:"Launch",goalId:"g1"}],tasks:[{title:"Finish QA",status:"next",projectId:"p1"}],notes:[],habits:[]});
  assert.match(md,/## Goals/);
  assert.match(md,/Finish QA/);
});
test("v7.3 local privacy lock is explicit about its limits and uses PBKDF2",()=>{
  for(const id of ["privacyLockStatus","enablePrivacyLock","changePrivacyLock","disablePrivacyLock","lockNow","privacySetupModal","privacySetupForm","privacyLockScreen","privacyUnlockForm"])assert.ok(ids.includes(id),id+" missing");
  const privacy=fs.readFileSync("public/privacy.js","utf8");
  assert.match(privacy,/PBKDF2/);
  assert.match(privacy,/SHA-256/);
  assert.match(app,/cc-privacy-lock-v1/);
  assert.match(html,/convenience lock, not encryption/);
});
test("v7.3 mobile task stages and project-to-task creation are wired",()=>{
  assert.match(app,/data-swipe-status/);
  assert.match(app,/data-status="next"/);
  assert.match(app,/data-status="doing"/);
  assert.match(app,/data-project-task/);
  assert.match(app,/projectTask/);
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

test("normalizeTask repairs missing arrays, tags, and board ordering",()=>{
  const task=normalizeTask({id:"x",title:"X",subtasks:null});
  assert.ok(Array.isArray(task.subtasks));
  assert.deepEqual(task.tags,[]);
  assert.deepEqual(task.repeatWeekdays,[]);
  assert.equal(task.repeat,"none");
  assert.equal(task.boardOrder,null);
  const tagged=normalizeTask({id:"y",title:"Y",tags:["Calls","COMPUTER"],boardOrder:300});
  assert.deepEqual(tagged.tags,["calls","computer"]);
  assert.equal(tagged.boardOrder,300);
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
test("every-X-weeks recurrence honors interval",()=>assert.equal(recurrence("custom_weeks","2026-01-10",{repeatInterval:2}),"2026-01-24"));
test("selected weekday recurrence advances to next allowed day",()=>{
  assert.equal(recurrence("selected_weekdays","2026-10-01",{repeatWeekdays:[1,3,5]}),"2026-10-02");
  assert.equal(recurrence("selected_weekdays","2026-10-02",{repeatWeekdays:[1,3,5]}),"2026-10-05");
  assert.equal(recurrence("selected_weekdays","2026-10-05",{repeatWeekdays:[1,3,5]}),"2026-10-07");
  assert.equal(recurrence("selected_weekdays","2026-10-05",{repeatWeekdays:[]}),"");
});
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

test("Quick Add separates project hashtags from context tags",()=>{
  const q=parseQuick("Call client tomorrow #work #calls #computer",[{id:"p1",name:"Win the Week",area:"Work"}],new Date("2026-09-30T12:00:00"));
  assert.equal(q.projectId,"p1");
  assert.deepEqual(q.tags,["calls","computer"]);
  assert.equal(q.title,"Call client");
});
test("unmatched hashtags remain task tags",()=>{
  const q=parseQuick("Buy envelopes #errands #office",[]);
  assert.deepEqual(q.tags,["errands","office"]);
});

test("Quick Add parses every-X-weeks recurrence",()=>{
  const q=parseQuick("Sprint review every 2 weeks",[]);
  assert.equal(q.title,"Sprint review");
  assert.equal(q.repeat,"custom_weeks");
  assert.equal(q.repeatInterval,2);
});
test("Quick Add parses explicit weekday recurrence",()=>{
  const q=parseQuick("Gym every Mon/Wed/Fri",[]);
  assert.equal(q.title,"Gym");
  assert.equal(q.repeat,"selected_weekdays");
  assert.deepEqual(q.repeatWeekdays,[1,3,5]);
});
test("Quick Add accepts natural named weekday recurrence",()=>{
  const q=parseQuick("Follow up every Monday, Wednesday and Friday #calls",[]);
  assert.equal(q.title,"Follow up");
  assert.equal(q.repeat,"selected_weekdays");
  assert.deepEqual(q.repeatWeekdays,[1,3,5]);
  assert.deepEqual(q.tags,["calls"]);
});
test("Quick Add accepts a single named weekday",()=>{
  const q=parseQuick("Payroll every Tuesday",[]);
  assert.equal(q.title,"Payroll");
  assert.equal(q.repeat,"selected_weekdays");
  assert.deepEqual(q.repeatWeekdays,[2]);
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


test("backup validation rejects missing and duplicate ids",()=>{
  const base={version:BACKUP_VERSION,tasks:[],projects:[],notes:[],habits:[],activity:[],templates:[],goals:[]};
  assert.equal(validateBackupPayload({...base,tasks:[{title:"missing"}]}).ok,false);
  assert.equal(validateBackupPayload({...base,tasks:[{id:"same"},{id:"same"}]}).ok,false);
});
test("markdown export keeps orphaned projects and tasks",()=>{
  const md=workspaceToMarkdown({goals:[],projects:[{id:"p1",name:"Orphan project",goalId:"missing"}],tasks:[{id:"t1",title:"Orphan task",projectId:"missing"}]});
  assert.match(md,/Orphan project/);
  assert.match(md,/Orphan task/);
});
test("audit hardening is present",()=>{
  assert.match(storage,/export function replaceStores/);
  assert.match(app,/cc-data-revision/);
  assert.match(app,/data-edit-project/);
  assert.match(app,/VALID_VIEWS/);
  assert.match(sw,/privateShare/);
  assert.match(css,/v7\.3 audit hardening/);
});

console.log("\n"+passed+" regression checks passed.");
