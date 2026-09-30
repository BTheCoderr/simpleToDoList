import {
  APP_VERSION,
  DB_VERSION,
  STORES,
  DATA_STORES,
  MAX_SNAPSHOT_BYTES,
  MAX_SNAPSHOTS,
  openDB,
  all,
  readStores,
  save,
  saveMany,
  del,
  clear
} from "./storage.js";
import {
  normalizeTask,
  dateKey,
  today,
  nextOccurrence,
  parseQuick as parseQuickCore,
  goalProgress as goalProgressCore
} from "./core.js";
import { BACKUP_VERSION, MAX_IMPORT_BYTES, validateBackupPayload } from "./backup.js";

const SW_CACHE="command-center-v11";
var state={tasks:[],projects:[],notes:[],habits:[],activity:[],templates:[],goals:[],snapshots:[],_active:[],filter:"open",projectFilter:"",tagFilter:"",archiveFilter:"archived",bulkMode:false,selectedTaskIds:new Set(),view:localStorage.getItem("cc-view")||"today",calendarCursor:new Date(),focus:null};
var editingSubtasks=[];
var focusTimer=null;
var $=function(id){return document.getElementById(id)}, $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var dialogReturnFocus=new WeakMap();
function dialogFocusables(dialog){
  return Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(function(el){return !el.classList.contains("hidden")&&el.offsetParent!==null});
}
function openDialog(dialog){
  if(!dialog||dialog.open)return;
  var current=document.activeElement;if(current&&current!==document.body)dialogReturnFocus.set(dialog,current);
  dialog.showModal();
  requestAnimationFrame(function(){
    var preferred=dialog.querySelector("[autofocus],input:not([type=hidden]),textarea,select,button:not([data-close])");
    if(preferred&&typeof preferred.focus==="function")preferred.focus();
  });
}
$$("dialog").forEach(function(dialog){
  dialog.addEventListener("close",function(){
    var previous=dialogReturnFocus.get(dialog);dialogReturnFocus.delete(dialog);
    if(previous&&document.contains(previous)&&typeof previous.focus==="function")previous.focus();
  });
});
document.addEventListener("keydown",function(e){
  if(e.key!=="Tab")return;
  var dialog=document.querySelector("dialog[open]");if(!dialog)return;
  var items=dialogFocusables(dialog);if(!items.length)return;
  var first=items[0],last=items[items.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
var defaults={projects:[{id:"p1",name:"Launch Command Center",area:"Personal",createdAt:new Date().toISOString()},{id:"p2",name:"Win the Week",area:"Work",createdAt:new Date().toISOString()}],tasks:[{id:"t1",title:"Pick your top 3 priorities",description:"Use Today for what actually matters.",status:"next",priority:"high",projectId:"p2",dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null},{id:"t2",title:"Export your first backup",description:"Settings → Export JSON keeps a portable copy.",status:"inbox",priority:"medium",projectId:"p1",dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null}],notes:[{id:"n1",title:"How I want to use this",body:"Capture fast. Organize later. Keep Today small.",pinned:true,updatedAt:new Date().toISOString()}],habits:[{id:"h1",name:"Plan tomorrow",history:[],createdAt:new Date().toISOString()}]};
var builtInTemplates=[
  {id:"builtin-weekly-reset",name:"Weekly Reset",title:"Weekly reset",description:"Review calendar, inbox, projects and priorities.",priority:"high",projectId:"",subtasks:["Clear inbox","Review overdue tasks","Review active projects","Choose top 3 for next week","Export a backup"]},
  {id:"builtin-job-application",name:"Job Application",title:"Apply to role",description:"Reusable application checklist.",priority:"high",projectId:"",subtasks:["Tailor resume","Review company and role","Write application answers","Attach work sample","Submit and record follow-up date"]},
  {id:"builtin-launch",name:"Project Launch",title:"Launch project",description:"Turn a finished build into a shipped release.",priority:"high",projectId:"",subtasks:["Final QA","Mobile check","Backup/export","Deploy production","Verify live URL","Write release notes"]},
  {id:"builtin-errands",name:"Errands Run",title:"Run errands",description:"Quick reusable errands checklist.",priority:"medium",projectId:"",subtasks:["Make list","Plan route","Complete stops","Put receipts away"]}
];

function uid(p){return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)}
async function seed(){var data=await readStores(["tasks","projects","notes","habits"]),count=data.tasks.length+data.projects.length+data.notes.length+data.habits.length;if(count)return;for(var k of ["projects","tasks","notes","habits"])await saveMany(k,defaults[k])}
async function load(){await seed();var data=await readStores(STORES);state.tasks=(data.tasks||[]).map(normalizeTask);state._active=state.tasks.filter(function(t){return !t.deletedAt&&!t.archivedAt});state.projects=(data.projects||[]).map(function(p){return Object.assign({goalId:""},p)});state.notes=data.notes||[];state.habits=data.habits||[];state.activity=data.activity||[];state.templates=data.templates||[];state.goals=data.goals||[];state.snapshots=data.snapshots||[];render()}
function activeTasks(){return state._active||[]}
function esc(v){return String(v||"").replace(/[&<>'"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]})}
function pname(id){var p=state.projects.find(function(x){return x.id===id});return p?p.name:""}
function gname(id){var g=state.goals.find(function(x){return x.id===id});return g?g.name:""}
function overdue(t){return t.dueDate&&t.status!=="done"&&t.dueDate<today()}
function fmt(d,time){if(!d)return"";var text=new Date(d+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});if(time){var x=new Date("2000-01-01T"+time);text+=" · "+x.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}return text}
function toast(m,actionLabel,actionFn){var e=$("toast"),txt=$("toastText"),btn=$("toastAction");txt.textContent=m;btn.classList.toggle("hidden",!actionLabel);btn.textContent=actionLabel||"";btn.onclick=actionFn||null;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove("show");btn.classList.add("hidden");btn.onclick=null},actionLabel?5000:1900)}
async function log(type,label,extra){await save("activity",Object.assign({id:uid("a"),type:type,label:label,createdAt:new Date().toISOString()},extra||{}))}
function subtaskStats(t){var a=t.subtasks||[],done=a.filter(function(x){return x.done}).length;return {done:done,total:a.length}}
function parseTagInput(value){return Array.from(new Set(String(value||"").split(/[\s,]+/).map(function(tag){return tag.replace(/^#/,"").trim().toLowerCase()}).filter(function(tag){return /^[a-z0-9_-]+$/.test(tag)})))}
function tagPills(t){return (t.tags||[]).map(function(tag){return '<span class="pill tag-pill">#'+esc(tag)+'</span>'}).join("")}
function taskScore(t){var p={high:0,medium:1,low:2};return (t.status==="done"?100:0)+(p[t.priority]||0)}

function nav(){
  var navView=["templates","archive"].includes(state.view)?"tasks":["shutdown","analytics"].includes(state.view)?"review":state.view;
  $$(".nav,.bottom button").forEach(function(b){var active=b.dataset.view===navView;b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  $$(".view").forEach(function(v){v.classList.toggle("active",v.id===state.view)});
  var v=$(state.view);
  if(v){$("title").textContent={today:"Today",tasks:"Tasks",planner:"Planner",board:"Board",focus:"Focus",goals:"Goals",projects:"Projects",notes:"Notes",habits:"Habits",shutdown:"Daily Review",review:"Weekly Review",templates:"Templates",archive:"Archive",analytics:"Review Analytics",settings:"Settings"}[v.id]||v.id;$("eyebrow").textContent={today:"YOUR DAY",tasks:"EXECUTION",planner:"CALENDAR",board:"FLOW",focus:"DEEP WORK",goals:"DIRECTION",projects:"OUTCOMES",notes:"THINKING SPACE",habits:"CONSISTENCY",shutdown:"CLOSE THE DAY",review:"RESET",templates:"REUSE",archive:"HISTORY",analytics:"PATTERNS",settings:"YOUR WORKSPACE"}[v.id]||""}
  localStorage.setItem("cc-view",state.view);
  $("sidebar").classList.remove("open");if(state.view==="settings")setTimeout(refreshSystemInfo,0);
}

function taskHTML(t){
  var p=pname(t.projectId),st=subtaskStats(t),sub=st.total?'<span class="pill">'+st.done+'/'+st.total+' checklist</span>':"",selected=state.selectedTaskIds.has(t.id);
  return `<div class="task-row" data-task-row="${t.id}">
    <div class="task-actions">
      <button class="swipe-edit" data-swipe-edit="${t.id}">Edit</button>
      <button class="swipe-done" data-swipe-complete="${t.id}">${t.status==="done"?"Undo":"Done"}</button>
      <button class="swipe-delete" data-swipe-delete="${t.id}">Delete</button>
    </div>
    <div class="task ${t.status==="done"?"done ":""}${selected?"selected":""}">
      <label class="task-select" aria-label="Select ${esc(t.title)}"><input type="checkbox" data-select-task="${t.id}" ${selected?"checked":""}></label>
      <button class="checkbtn" data-toggle="${t.id}">${t.status==="done"?"✓":""}</button>
      <div class="taskmain" data-edit-task="${t.id}">
        <div class="tasktitle">${esc(t.title)}</div>
        <div class="meta">
          <span class="pill ${t.priority}">${esc(t.priority)}</span>
          <span class="pill">${esc(t.status)}</span>
          ${p?'<span class="pill">'+esc(p)+'</span>':""}
          ${tagPills(t)}
          ${t.dueDate?'<span class="pill '+(overdue(t)?"high":"")+'">'+(overdue(t)?"Overdue · ":"")+fmt(t.dueDate,t.dueTime)+'</span>':""}
          ${t.repeat!=="none"?'<span class="pill">↻ '+esc(t.repeat)+'</span>':""}
          ${sub}
        </div>
      </div>
      <button class="dots" data-edit-task="${t.id}" aria-label="Edit ${esc(t.title)}">•••</button>
    </div>
  </div>`
}
function filteredTasks(){
  var a=activeTasks().slice().sort(function(a,b){return taskScore(a)-taskScore(b)});
  if(state.filter==="open")a=a.filter(function(t){return t.status!=="done"});else if(state.filter!=="all")a=a.filter(function(t){return t.status===state.filter});
  if(state.projectFilter)a=a.filter(function(t){return t.projectId===state.projectFilter});
  if(state.tagFilter)a=a.filter(function(t){return (t.tags||[]).includes(state.tagFilter)});
  return a;
}
function renderBulkBar(){
  var count=state.selectedTaskIds.size;$("bulkCount").textContent=count;$("bulkBar").classList.toggle("hidden",!state.bulkMode);$("bulkToggle").textContent=state.bulkMode?"Done selecting":"Select";
  $("taskList").classList.toggle("bulk-mode",state.bulkMode);
  var bulkProjectValue=$("bulkProject").value||"__keep__";$("bulkProject").innerHTML='<option value="__keep__">Keep project</option><option value="">No project</option>'+state.projects.map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");if(Array.from($("bulkProject").options).some(function(o){return o.value===bulkProjectValue}))$("bulkProject").value=bulkProjectValue;
}
function renderTasks(){
  var base=activeTasks(),open=base.filter(function(t){return t.status!=="done"}).length;$("openCount").textContent=open;
  $("taskProject").innerHTML='<option value="">No project</option>'+state.projects.map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");
  var tagValue=state.tagFilter,tags=Array.from(new Set(base.flatMap(function(t){return t.tags||[]}))).sort();
  $("tagFilter").innerHTML='<option value="">All tags</option>'+tags.map(function(tag){return'<option value="'+esc(tag)+'">#'+esc(tag)+'</option>'}).join("");if(tags.includes(tagValue))$("tagFilter").value=tagValue;else state.tagFilter="";
  state.selectedTaskIds=new Set(Array.from(state.selectedTaskIds).filter(function(id){return base.some(function(t){return t.id===id})}));
  var a=filteredTasks();$("taskList").innerHTML=a.length?a.map(taskHTML).join(""):'<div class="empty">Nothing here.</div>';renderBulkBar();
}
async function applyBulkChanges(){
  var items=state.tasks.filter(function(t){return state.selectedTaskIds.has(t.id)&&!t.deletedAt&&!t.archivedAt});if(!items.length){toast("Select at least one task");return}
  var status=$("bulkStatus").value,priority=$("bulkPriority").value,project=$("bulkProject").value,due=$("bulkDue").value,pending=[];
  for(var t of items){
    if(priority)t.priority=priority;if(project!=="__keep__")t.projectId=project;if(due)t.dueDate=due;
    if(status)await setTaskStatus(t,status);else pending.push(t);
  }
  if(pending.length)await saveMany("tasks",pending);
  await log("task.bulk-updated",items.length+" tasks",{count:items.length});state.selectedTaskIds.clear();await load();toast(items.length+" tasks updated")
}
async function bulkArchive(){
  var items=state.tasks.filter(function(t){return state.selectedTaskIds.has(t.id)&&!t.deletedAt&&!t.archivedAt});if(!items.length){toast("Select at least one task");return}
  var stamp=new Date().toISOString();items.forEach(function(t){t.archivedAt=stamp});await saveMany("tasks",items);await log("task.bulk-archived",items.length+" tasks",{count:items.length});state.selectedTaskIds.clear();await load();toast(items.length+" tasks archived")
}
async function bulkTrash(){
  var items=state.tasks.filter(function(t){return state.selectedTaskIds.has(t.id)&&!t.deletedAt&&!t.archivedAt});if(!items.length){toast("Select at least one task");return}
  if(!confirm("Move "+items.length+" selected tasks to Trash?"))return;
  var stamp=new Date().toISOString();items.forEach(function(t){t.deletedAt=stamp});await saveMany("tasks",items);await log("task.bulk-trashed",items.length+" tasks",{count:items.length});state.selectedTaskIds.clear();await load();toast(items.length+" tasks moved to Trash")
}
function clearBulkSelection(){state.selectedTaskIds.clear();renderTasks()}
function toggleBulkMode(){state.bulkMode=!state.bulkMode;if(!state.bulkMode)state.selectedTaskIds.clear();renderTasks()}
function streak(h){var s=new Set(h||[]),d=new Date(),n=0;if(!s.has(today()))d.setDate(d.getDate()-1);while(s.has(dateKey(d))){n++;d.setDate(d.getDate()-1)}return n}
function habitHTML(h){var on=(h.history||[]).indexOf(today())>=0;return'<div class="habit '+(on?"checked":"")+'"><button data-toggle-habit="'+h.id+'">'+(on?"✓":"○")+'</button><div><b>'+esc(h.name)+'</b><small>'+streak(h.history)+' day streak · '+(h.history||[]).length+' check-ins</small></div><button data-delete-habit="'+h.id+'">Delete</button></div>'}

var DASHBOARD_DEFAULT={order:["tasks","habits","projects","capture"],hidden:[]},dashboardDraft=null;
var DASHBOARD_LABELS={tasks:"Today's priorities",habits:"Habits",projects:"Projects",capture:"Quick inbox"};
function dashboardPrefs(){
  try{
    var saved=JSON.parse(localStorage.getItem("cc-today-layout-v1")||"null"),order=saved&&Array.isArray(saved.order)?saved.order.slice():DASHBOARD_DEFAULT.order.slice(),hidden=saved&&Array.isArray(saved.hidden)?saved.hidden.slice():[];
    DASHBOARD_DEFAULT.order.forEach(function(key){if(!order.includes(key))order.push(key)});
    order=order.filter(function(key){return DASHBOARD_DEFAULT.order.includes(key)});
    hidden=hidden.filter(function(key){return DASHBOARD_DEFAULT.order.includes(key)});
    return {order:order,hidden:hidden};
  }catch(e){return {order:DASHBOARD_DEFAULT.order.slice(),hidden:[]}}
}
function applyDashboardLayout(){
  var grid=$("today").querySelector(".grid"),prefs=dashboardPrefs();if(!grid)return;
  prefs.order.forEach(function(key){var card=grid.querySelector('[data-dashboard-card="'+key+'"]');if(card)grid.appendChild(card)});
  $$("[data-dashboard-card]").forEach(function(card){card.classList.toggle("dashboard-hidden",prefs.hidden.includes(card.dataset.dashboardCard))});
}
function renderDashboardOptions(){
  if(!dashboardDraft)return;
  $("dashboardOptions").innerHTML=dashboardDraft.order.map(function(key,index){
    var visible=!dashboardDraft.hidden.includes(key);
    return '<div class="dashboard-option"><label class="check"><input type="checkbox" data-dashboard-visible="'+key+'" '+(visible?"checked":"")+'> '+esc(DASHBOARD_LABELS[key])+'</label><div class="buttons compact"><button type="button" data-dashboard-move="'+key+'" data-direction="-1" '+(index===0?"disabled":"")+' aria-label="Move '+esc(DASHBOARD_LABELS[key])+' up">↑</button><button type="button" data-dashboard-move="'+key+'" data-direction="1" '+(index===dashboardDraft.order.length-1?"disabled":"")+' aria-label="Move '+esc(DASHBOARD_LABELS[key])+' down">↓</button></div></div>'
  }).join("");
}
function openDashboardCustomize(){
  var prefs=dashboardPrefs();dashboardDraft={order:prefs.order.slice(),hidden:prefs.hidden.slice()};renderDashboardOptions();openDialog($("dashboardModal"));
}
function moveDashboardCard(key,direction){
  if(!dashboardDraft)return;var from=dashboardDraft.order.indexOf(key),to=from+Number(direction);if(from<0||to<0||to>=dashboardDraft.order.length)return;
  var tmp=dashboardDraft.order[from];dashboardDraft.order[from]=dashboardDraft.order[to];dashboardDraft.order[to]=tmp;renderDashboardOptions();
}
function saveDashboardLayout(e){
  e.preventDefault();if(!dashboardDraft)return;localStorage.setItem("cc-today-layout-v1",JSON.stringify(dashboardDraft));$("dashboardModal").close();applyDashboardLayout();toast("Today layout saved")
}
function resetDashboardDraft(){dashboardDraft={order:DASHBOARD_DEFAULT.order.slice(),hidden:[]};renderDashboardOptions()}

function renderToday(){
  var now=new Date(),hr=now.getHours();$("todayDate").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});$("greeting").textContent=hr<12?"Good morning.":hr<18?"Good afternoon.":"Good evening.";
  var base=activeTasks(),open=base.filter(function(t){return t.status!=="done"}),focus=open.filter(function(t){return t.priority==="high"||t.status==="doing"||t.dueDate===today()||overdue(t)}).slice(0,6);
  $("todayTasks").innerHTML=focus.length?focus.map(taskHTML).join(""):'<div class="empty">No urgent work. Pull something from Tasks.</div>';
  $("sToday").textContent=focus.length;$("sOverdue").textContent=open.filter(overdue).length;
  var week=new Date();week.setDate(week.getDate()-7);$("sWeek").textContent=base.filter(function(t){return t.completedAt&&new Date(t.completedAt)>=week}).length;$("sProjects").textContent=state.projects.length;
  $("todayHabits").innerHTML=state.habits.length?state.habits.slice(0,5).map(habitHTML).join(""):'<div class="empty">Add a habit.</div>';
  $("todayProjects").innerHTML=state.projects.slice(0,5).map(function(p){var a=activeTasks().filter(function(t){return t.projectId===p.id}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0;return'<div class="mini"><b>'+esc(p.name)+'</b><small>'+d+'/'+a.length+' tasks complete</small><div class="progress"><i style="width:'+pc+'%"></i></div></div>'}).join("")||'<div class="empty">No projects yet.</div>';applyDashboardLayout();
}
function renderProjects(){$("projectGrid").innerHTML=state.projects.map(function(p){var a=activeTasks().filter(function(t){return t.projectId===p.id}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0,goal=gname(p.goalId);return'<article class="card"><small class="caps">'+esc(p.area||"PROJECT")+'</small><h3>'+esc(p.name)+'</h3>'+(goal?'<span class="goal-chip">◎ '+esc(goal)+'</span>':'')+'<p>'+a.length+' tasks · '+pc+'% complete</p><footer><div class="progress"><i style="width:'+pc+'%"></i></div><div class="row"><button data-focus-project="'+p.id+'" class="link">View tasks</button><button data-delete-project="'+p.id+'">Delete</button></div></footer></article>'}).join("")||'<div class="empty">Create a project for an outcome that takes more than one task.</div>'}
function renderNotes(){$("noteGrid").innerHTML=state.notes.slice().sort(function(a,b){return Number(b.pinned)-Number(a.pinned)}).map(function(n){return'<article class="card note" data-edit-note="'+n.id+'"><small class="caps">'+(n.pinned?"PINNED NOTE":"NOTE")+'</small><h3>'+esc(n.title)+'</h3><p>'+esc(n.body||"Empty note")+'</p><small>'+new Date(n.updatedAt).toLocaleDateString()+'</small></article>'}).join("")||'<div class="empty">Your thinking space is empty.</div>'}
function renderHabits(){$("habitList").innerHTML=state.habits.map(habitHTML).join("")||'<div class="empty">Start with one tiny habit.</div>'}

function renderCalendar(){
  var cur=state.calendarCursor,y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
  $("calendarTitle").textContent=first.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  var html="";
  for(var i=0;i<42;i++){var d=new Date(start);d.setDate(start.getDate()+i);var key=dateKey(d),items=activeTasks().filter(function(t){return t.dueDate===key}),muted=d.getMonth()!==m;
    html+='<div class="cal-day '+(muted?"outside ":"")+(key===today()?"today ":"")+'" data-date-add="'+key+'"><div class="cal-date"><b>'+d.getDate()+'</b><button data-date-add="'+key+'" aria-label="Add task on '+key+'">＋</button></div><div class="cal-tasks">'+items.slice(0,4).map(function(t){return'<button class="cal-task '+t.priority+'" data-edit-task="'+t.id+'">'+(t.dueTime?'<span>'+esc(t.dueTime)+'</span> ':"")+esc(t.title)+'</button>'}).join("")+(items.length>4?'<small>+'+(items.length-4)+' more</small>':"")+'</div></div>';
  }
  $("calendarGrid").innerHTML=html;
  var uns=activeTasks().filter(function(t){return t.status!=="done"&&!t.dueDate}).slice(0,10);
  $("unscheduledTasks").innerHTML=uns.length?uns.map(taskHTML).join(""):'<div class="empty">Everything open has a date.</div>';
}
function boardCard(t){var st=subtaskStats(t);return'<article class="kanban-card" draggable="true" data-drag-task="'+t.id+'" data-edit-task="'+t.id+'"><div class="kanban-card-top"><span class="pill '+t.priority+'">'+esc(t.priority)+'</span>'+(t.dueDate?'<span class="pill '+(overdue(t)?"high":"")+'">'+fmt(t.dueDate,t.dueTime)+'</span>':"")+'</div><b>'+esc(t.title)+'</b>'+(pname(t.projectId)?'<small>'+esc(pname(t.projectId))+'</small>':"")+(st.total?'<div class="progress"><i style="width:'+Math.round(st.done/st.total*100)+'%"></i></div>':"")+'</article>'}
function renderBoard(){
  ["inbox","next","doing","done"].forEach(function(s){var a=activeTasks().filter(function(t){return t.status===s});$("count"+s.charAt(0).toUpperCase()+s.slice(1)).textContent=a.length;$("board"+s.charAt(0).toUpperCase()+s.slice(1)).innerHTML=a.map(boardCard).join("")||'<div class="kanban-empty">Drop tasks here</div>'});
}
function bars(id,arr,total){$(id).innerHTML=arr.map(function(x){var pc=total?Math.round(x[1]/total*100):0;return'<div class="bar"><div class="barhead"><span>'+x[0]+'</span><b>'+x[1]+'</b></div><div class="progress"><i style="width:'+pc+'%"></i></div></div>'}).join("")}
function renderAnalytics(){
  var base=activeTasks(),total=base.length,done=base.filter(function(t){return t.status==="done"}).length;
  $("aRate").textContent=total?Math.round(done/total*100)+"%":"0%";$("aDone").textContent=done;$("aOpen").textContent=total-done;$("aHabits").textContent=state.habits.reduce(function(s,h){return s+(h.history||[]).length},0);
  $("aFocus").textContent=state.activity.filter(function(a){return a.type==="focus.completed"}).reduce(function(s,a){return s+(Number(a.minutes)||0)},0);
  bars("priorityBars",[["high",base.filter(function(t){return t.priority==="high"}).length],["medium",base.filter(function(t){return t.priority==="medium"}).length],["low",base.filter(function(t){return t.priority==="low"}).length]],total);
  bars("statusBars",[["inbox",base.filter(function(t){return t.status==="inbox"}).length],["next",base.filter(function(t){return t.status==="next"}).length],["doing",base.filter(function(t){return t.status==="doing"}).length],["done",done]],total);
}

function parseQuick(text){return parseQuickCore(text,state.projects)}
function quickPreview(){
  var q=parseQuick($("quickInput").value||""),p=pname(q.projectId);$("quickPreview").innerHTML=q.title?'<b>'+esc(q.title)+'</b><div class="meta"><span class="pill '+q.priority+'">'+q.priority+'</span>'+(q.dueDate?'<span class="pill">'+fmt(q.dueDate,q.dueTime)+'</span>':"")+(p?'<span class="pill">'+esc(p)+'</span>':"")+tagPills(q)+(q.repeat!=="none"?'<span class="pill">↻ '+q.repeat+'</span>':"")+'</div>':'<span class="hint">Your parsed task will appear here.</span>';
}
function openQuick(seed){$("quickForm").reset();$("quickInput").value=seed||"";quickPreview();openDialog($("quickModal"));setTimeout(function(){$("quickInput").focus()},30)}
async function createQuick(text){var q=parseQuick(text);if(!q.title)return; q.id=uid("t");await save("tasks",q);await log("task.created",q.title,{source:"quick-add"});await load();toast("Captured"+(q.dueDate?" for "+fmt(q.dueDate,q.dueTime):" to Inbox"))}


async function spawnNextOccurrence(t){
  var due=nextOccurrence(t);if(!due)return;
  var copy=Object.assign({},t,{id:uid("t"),status:"next",completedAt:null,dueDate:due,createdAt:new Date().toISOString(),archivedAt:null,deletedAt:null,subtasks:(t.subtasks||[]).map(function(s){return{id:uid("s"),title:s.title,done:false}})});
  await save("tasks",copy);await log("task.recurred",t.title,{nextDue:due});
}
async function setTaskStatus(t,status){
  var was=t.status;t.status=status;t.completedAt=status==="done"?(t.completedAt||new Date().toISOString()):null;await save("tasks",t);
  if(was!=="done"&&status==="done")await spawnNextOccurrence(t);
}

function renderSubtasks(){
  var done=editingSubtasks.filter(function(s){return s.done}).length;$("subtaskProgress").textContent=done+"/"+editingSubtasks.length;
  $("subtaskList").innerHTML=editingSubtasks.map(function(s){return'<div class="subtask '+(s.done?"done":"")+'"><button type="button" data-subtask-toggle="'+s.id+'">'+(s.done?"✓":"○")+'</button><span>'+esc(s.title)+'</span><button type="button" class="subtask-delete" data-subtask-delete="'+s.id+'">×</button></div>'}).join("")||'<div class="empty small-empty">No checklist items yet.</div>';
}
function openTask(t,prefillDate){
  $("taskForm").reset();editingSubtasks=t?(t.subtasks||[]).map(function(s){return Object.assign({},s)}):[];
  $("taskId").value=t?t.id:"";$("taskTitle").value=t?t.title:"";$("taskDescription").value=t?t.description||"":"";
  $("taskStatus").value=t?t.status:"inbox";$("taskPriority").value=t?t.priority:"medium";$("taskProject").value=t?t.projectId||"":"";$("taskTags").value=t?(t.tags||[]).map(function(tag){return "#"+tag}).join(" "):"";
  $("taskDue").value=t?t.dueDate||"":(prefillDate||"");$("taskTime").value=t?t.dueTime||"":"";
  $("taskRepeat").value=t?t.repeat||"none":"none";$("taskRepeatInterval").value=t?Math.max(1,Number(t.repeatInterval)||1):1;$("taskRepeatUntil").value=t?t.repeatUntil||"":"";
  $("taskHeading").textContent=t?"Edit task":"New task";$("deleteTask").classList.toggle("hidden",!t);$("archiveTask").classList.toggle("hidden",!t);renderSubtasks();syncRepeatUI();openDialog($("taskModal"))
}
async function saveTask(e){
  e.preventDefault();var old=state.tasks.find(function(t){return t.id===$("taskId").value}),status=$("taskStatus").value,was=old?old.status:null;
  var t={id:old?old.id:uid("t"),title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),status:status,priority:$("taskPriority").value,projectId:$("taskProject").value,tags:parseTagInput($("taskTags").value),dueDate:$("taskDue").value,dueTime:$("taskTime").value,repeat:$("taskRepeat").value,repeatInterval:Math.max(1,Number($("taskRepeatInterval").value)||1),repeatUntil:$("taskRepeatUntil").value,subtasks:editingSubtasks,createdAt:old?old.createdAt:new Date().toISOString(),completedAt:status==="done"?(old&&old.completedAt?old.completedAt:new Date().toISOString()):null,archivedAt:old?old.archivedAt:null,deletedAt:old?old.deletedAt:null};
  if(!t.title)return;await save("tasks",t);if(was!=="done"&&status==="done")await spawnNextOccurrence(t);await log(old?"task.updated":"task.created",t.title);$("taskModal").close();await load();toast(old?"Task updated":"Task created")
}
async function toggleTask(id){
  var t=state.tasks.find(function(x){return x.id===id});if(!t)return;await setTaskStatus(t,t.status==="done"?"next":"done");await load()
}
function syncRepeatUI(){var show=["custom_days","after_completion"].indexOf($("taskRepeat").value)>=0;$("repeatIntervalWrap").classList.toggle("hidden",!show)}
async function quickCapture(e){e.preventDefault();var v=$("capture").value.trim();if(!v)return;await createQuick(v);$("capture").value=""}

function openSimple(kind,item){$("simpleForm").reset();$("simpleKind").value=kind;$("simpleId").value=item?item.id:"";$("simpleTitle").value=item?(item.title||item.name):"";$("simpleBody").value=item&&item.body?item.body:"";$("simpleMeta").value=item&&item.area?item.area:"";$("simpleGoal").innerHTML='<option value="">No goal</option>'+state.goals.filter(function(g){return g.status!=="done"}).map(function(g){return '<option value="'+g.id+'">'+esc(g.name)+'</option>'}).join("");$("simpleGoal").value=item&&item.goalId?item.goalId:"";$("simplePin").checked=!!(item&&item.pinned);$("simpleType").textContent=kind.toUpperCase();$("simpleHeading").textContent=(item?"Edit ":"New ")+kind;$("simpleBodyWrap").classList.toggle("hidden",kind!=="note");$("simplePinWrap").classList.toggle("hidden",kind!=="note");$("simpleMetaWrap").classList.toggle("hidden",kind!=="project");$("simpleGoalWrap").classList.toggle("hidden",kind!=="project");$("deleteSimple").classList.toggle("hidden",!item||kind==="project"||kind==="habit");openDialog($("simpleModal"))}
async function saveSimple(e){e.preventDefault();var k=$("simpleKind").value,id=$("simpleId").value,title=$("simpleTitle").value.trim();if(!title)return;if(k==="project"){var oldp=state.projects.find(function(p){return p.id===id});await save("projects",{id:id||uid("p"),name:title,area:$("simpleMeta").value.trim(),goalId:$("simpleGoal").value,createdAt:oldp?oldp.createdAt:new Date().toISOString()})};if(k==="note")await save("notes",{id:id||uid("n"),title:title,body:$("simpleBody").value.trim(),pinned:$("simplePin").checked,updatedAt:new Date().toISOString()});if(k==="habit")await save("habits",{id:id||uid("h"),name:title,history:[],createdAt:new Date().toISOString()});$("simpleModal").close();await load();toast(k.charAt(0).toUpperCase()+k.slice(1)+" saved")}
async function toggleHabit(id){var h=state.habits.find(function(x){return x.id===id});var set=new Set(h.history||[]);set.has(today())?set.delete(today()):set.add(today());h.history=Array.from(set);await save("habits",h);await load()}

function loadFocus(){
  try{state.focus=JSON.parse(localStorage.getItem("cc-focus")||"null")}catch(e){state.focus=null}
  if(!state.focus)state.focus={taskId:"",minutes:25,remaining:25*60,running:false,endAt:null};
  if(state.focus.running&&state.focus.endAt){state.focus.remaining=Math.max(0,Math.ceil((state.focus.endAt-Date.now())/1000))}
}
function persistFocus(){localStorage.setItem("cc-focus",JSON.stringify(state.focus))}
function focusDisplay(seconds){seconds=Math.max(0,Math.floor(seconds));return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0")}
function renderFocus(){
  if(!state.focus)loadFocus();
  var open=activeTasks().filter(function(t){return t.status!=="done"});$("focusTask").innerHTML='<option value="">Choose a task</option>'+open.map(function(t){return'<option value="'+t.id+'">'+esc(t.title)+'</option>'}).join("");
  if(state.focus.taskId)$("focusTask").value=state.focus.taskId;
  $("focusClock").textContent=focusDisplay(state.focus.remaining);
  $$("[data-minutes]").forEach(function(b){b.classList.toggle("active",Number(b.dataset.minutes)===state.focus.minutes)});
  $("focusStart").textContent=state.focus.running?"Running…":(state.focus.remaining<state.focus.minutes*60?"Resume focus":"Start focus");
  $("focusStatusText").textContent=state.focus.taskId?(state.tasks.find(function(t){return t.id===state.focus.taskId})||{}).title||"Pick one task.":"Pick one task. Everything else can wait.";
  var start=new Date();start.setHours(0,0,0,0);var hist=state.activity.filter(function(a){return a.type==="focus.completed"&&new Date(a.createdAt)>=start}).sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)});
  $("focusHistory").innerHTML=hist.length?hist.map(function(a){return'<div class="focus-history-item"><b>'+esc(a.label)+'</b><small>'+a.minutes+' min · '+new Date(a.createdAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+'</small></div>'}).join(""):'<div class="empty">No focus sessions yet today.</div>';
}
async function finishFocus(){
  var task=state.tasks.find(function(t){return t.id===state.focus.taskId}),minutes=state.focus.minutes;
  if(task)await log("focus.completed",task.title,{minutes:minutes});
  state.focus={taskId:state.focus.taskId,minutes:minutes,remaining:minutes*60,running:false,endAt:null};persistFocus();clearInterval(focusTimer);focusTimer=null;await load();toast("Focus session complete")
}
function tickFocus(){
  if(!state.focus||!state.focus.running)return;
  state.focus.remaining=Math.max(0,Math.ceil((state.focus.endAt-Date.now())/1000));
  if($("focusClock"))$("focusClock").textContent=focusDisplay(state.focus.remaining);
  if(state.focus.remaining<=0)finishFocus();
}
function startFocus(){
  var taskId=$("focusTask").value;if(!taskId){toast("Choose a task first");return}
  state.focus.taskId=taskId;if(state.focus.remaining<=0)state.focus.remaining=state.focus.minutes*60;
  state.focus.running=true;state.focus.endAt=Date.now()+state.focus.remaining*1000;persistFocus();clearInterval(focusTimer);focusTimer=setInterval(tickFocus,1000);renderFocus()
}
function pauseFocus(){if(!state.focus.running)return;state.focus.remaining=Math.max(0,Math.ceil((state.focus.endAt-Date.now())/1000));state.focus.running=false;state.focus.endAt=null;persistFocus();clearInterval(focusTimer);focusTimer=null;renderFocus()}
function resetFocus(){clearInterval(focusTimer);focusTimer=null;state.focus.running=false;state.focus.endAt=null;state.focus.remaining=state.focus.minutes*60;persistFocus();renderFocus()}

async function exportAll(){var stores=await readStores(DATA_STORES),data=Object.assign({version:BACKUP_VERSION,exportedAt:new Date().toISOString()},stores),blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="command-center-"+today()+".json";a.click();URL.revokeObjectURL(url)}
async function importAll(file){
  if(!file)return;
  if(file.size>MAX_IMPORT_BYTES){alert("Backup is too large to import safely. Use a smaller Command Center JSON backup.");return}
  try{
    var parsed=JSON.parse(await file.text()),check=validateBackupPayload(parsed,file.size);
    if(!check.ok){alert(check.error);return}
    if(!confirm("Replace all local data with this validated backup?"))return;
    var guard=await createSnapshot("Before JSON import");
    if(!guard&&!confirm("A recovery snapshot could not be created. Continue with import anyway?"))return;
    for(var s of DATA_STORES){await clear(s);await saveMany(s,check.data[s]||[])}
    await load();toast("Backup restored");
  }catch(e){console.error(e);alert("Could not import that JSON backup. No data was changed.")}
}
function search(q){var box=$("searchBox");q=q.trim().toLowerCase();if(!q){box.classList.add("hidden");return}var r=[];activeTasks().filter(function(x){return(x.title+" "+x.description+" "+(x.tags||[]).join(" ")+" "+(x.subtasks||[]).map(function(s){return s.title}).join(" ")).toLowerCase().includes(q)}).forEach(function(x){r.push(["task",x.id,x.title,x.status])});state.projects.filter(function(x){return(x.name+" "+x.area).toLowerCase().includes(q)}).forEach(function(x){r.push(["projects","",x.name,x.area||"Project"])});state.notes.filter(function(x){return(x.title+" "+x.body).toLowerCase().includes(q)}).forEach(function(x){r.push(["note",x.id,x.title,"Note"])});state.goals.filter(function(x){return(x.name+" "+(x.why||"")).toLowerCase().includes(q)}).forEach(function(x){r.push(["goal",x.id,x.name,"Goal"])});box.innerHTML=r.slice(0,10).map(function(x){return'<div class="searchitem" data-search="'+x[0]+':'+x[1]+'"><b>'+esc(x[2])+'</b><small>'+esc(x[3])+'</small></div>'}).join("")||'<div class="empty">No matches.</div>';box.classList.remove("hidden")}
function theme(){var t=localStorage.getItem("cc-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}



function goalProgress(g){return goalProgressCore(g,state.projects,activeTasks())}
function renderGoals(){
  $("goalGrid").innerHTML=state.goals.slice().sort(function(a,b){return (a.status==="done")-(b.status==="done")}).map(function(g){var p=goalProgress(g);return '<article class="card goal-card"><small class="caps">'+esc(g.status||"active")+'</small><h3>'+esc(g.name)+'</h3><p>'+esc(g.why||"No description yet.")+'</p>'+(g.targetDate?'<span class="goal-target">Target · '+fmt(g.targetDate)+'</span>':'')+'<div class="progress"><i style="width:'+p.percent+'%"></i></div><small>'+p.done+'/'+p.tasks+' tasks · '+p.projects+' projects · '+p.percent+'%</small><footer><div class="row"><button data-goal-project="'+g.id+'" class="link">Add project</button><button data-edit-goal="'+g.id+'">Edit</button></div></footer></article>'}).join("")||'<div class="empty">Create a goal, then connect projects to it.</div>';
}
function openGoal(g){
  $("goalForm").reset();$("goalId").value=g?g.id:"";$("goalName").value=g?g.name:"";$("goalWhy").value=g?g.why||"":"";
  $("goalTarget").value=g?g.targetDate||"":"";$("goalStatus").value=g?g.status||"active":"active";$("goalHeading").textContent=g?"Edit goal":"New goal";$("deleteGoal").classList.toggle("hidden",!g);openDialog($("goalModal"));
}
async function saveGoal(e){
  e.preventDefault();var id=$("goalId").value,name=$("goalName").value.trim();if(!name)return;var old=state.goals.find(function(g){return g.id===id});
  await save("goals",{id:id||uid("g"),name:name,why:$("goalWhy").value.trim(),targetDate:$("goalTarget").value,status:$("goalStatus").value,createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  $("goalModal").close();await load();toast(old?"Goal updated":"Goal created");
}
async function deleteGoalById(id){
  var g=state.goals.find(function(x){return x.id===id});if(!g||!confirm('Delete goal "'+g.name+'"? Projects will stay.'))return;
  await createSnapshot("Before deleting goal");await del("goals",id);
  for(var p of state.projects.filter(function(x){return x.goalId===id}))await save("projects",Object.assign({},p,{goalId:""}));
  await load();toast("Goal deleted");
}

async function captureState(){
  var stores=await readStores(DATA_STORES);return Object.assign({version:BACKUP_VERSION,createdAt:new Date().toISOString()},stores);
}
function dataSizeBytes(value){try{return new Blob([JSON.stringify(value)]).size}catch(e){return JSON.stringify(value).length*2}}
async function createSnapshot(reason){
  try{
    var data=await captureState(),bytes=dataSizeBytes(data);
    if(bytes>MAX_SNAPSHOT_BYTES){console.warn("Snapshot skipped: workspace exceeds local snapshot limit",bytes);toast("Snapshot skipped — export JSON for this large workspace");return null}
    var shot={id:uid("snap"),createdAt:new Date().toISOString(),reason:reason||"Manual snapshot",bytes:bytes,data:data};await save("snapshots",shot);
    var shots=(await all("snapshots")).sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)});
    for(var old of shots.slice(MAX_SNAPSHOTS))await del("snapshots",old.id);
    state.snapshots=await all("snapshots");renderSnapshots();return shot;
  }catch(e){console.error("Snapshot failed",e);toast("Could not create recovery snapshot");return null}
}
function formatBytes(n){n=Number(n)||0;if(n<1024)return n+" B";if(n<1024*1024)return (n/1024).toFixed(1)+" KB";return (n/(1024*1024)).toFixed(1)+" MB"}
function renderSnapshots(){
  if(!$("snapshotList"))return;var shots=state.snapshots.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)}).slice(0,MAX_SNAPSHOTS);
  $("snapshotList").innerHTML=shots.length?shots.map(function(s){return '<div class="snapshot-row"><div><b>'+esc(s.reason||"Snapshot")+'</b><small>'+new Date(s.createdAt).toLocaleString()+(s.bytes?" · "+formatBytes(s.bytes):"")+'</small></div><div class="buttons compact"><button data-restore-snapshot="'+s.id+'">Restore</button><button aria-label="Delete snapshot" data-delete-snapshot="'+s.id+'">×</button></div></div>'}).join(""):'<small class="hint">No snapshots yet.</small>';
}
async function restoreSnapshot(id){
  var shot=state.snapshots.find(function(s){return s.id===id});if(!shot||!confirm("Restore this snapshot? Current data will be replaced."))return;
  var guard=await createSnapshot("Before snapshot restore");if(!guard&&!confirm("A recovery snapshot could not be created. Continue anyway?"))return;
  for(var s of DATA_STORES){await clear(s);await saveMany(s,shot.data[s]||[])}
  await load();toast("Snapshot restored");
}
async function ensureDailySnapshot(){
  var key="cc-snapshot-day",d=today();if(localStorage.getItem(key)===d)return;var shot=await createSnapshot("Automatic daily snapshot");if(shot)localStorage.setItem(key,d);
}

function renderShutdown(){
  var base=activeTasks(),start=new Date();start.setHours(0,0,0,0);var tom=new Date(start);tom.setDate(tom.getDate()+1);
  var done=base.filter(function(t){return t.completedAt&&new Date(t.completedAt)>=start&&new Date(t.completedAt)<tom}),open=base.filter(function(t){return t.status!=="done"&&(t.dueDate===today()||overdue(t))});
  $("shutdownDone").textContent=done.length;$("shutdownOpen").textContent=open.length;$("shutdownOverdue").textContent=open.filter(overdue).length;
  var last=state.activity.filter(function(x){return x.type==="shutdown.completed"}).sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)})[0];
  $("shutdownLast").textContent=last?new Date(last.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"—";
  $("shutdownOpenList").innerHTML=open.length?open.slice(0,10).map(taskHTML).join(""):'<div class="empty">Nothing urgent is hanging over today.</div>';
}
async function completeShutdown(e){
  e.preventDefault();await createSnapshot("Before daily shutdown");var tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);var due=dateKey(tomorrow);
  if($("shutdownRoll").checked){var rolled=activeTasks().filter(function(x){return x.status!=="done"&&x.dueDate===today()}).map(function(t){t.dueDate=due;return t});await saveMany("tasks",rolled)}
  var vals=[$("shutdown1").value,$("shutdown2").value,$("shutdown3").value].map(function(x){return x.trim()}).filter(Boolean);
  var planned=vals.map(function(title,i){return {id:uid("t"),title:title,description:"",status:"next",priority:i===0?"high":"medium",projectId:"",dueDate:due,dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null}});await saveMany("tasks",planned);
  var reflection=$("shutdownReflection").value.trim();if(reflection)await save("notes",{id:uid("n"),title:"Daily shutdown — "+today(),body:reflection,pinned:false,updatedAt:new Date().toISOString()});
  await log("shutdown.completed","Daily shutdown",{planned:vals.length,rolled:$("shutdownRoll").checked});$("shutdownForm").reset();$("shutdownRoll").checked=true;await load();await createSnapshot("Daily shutdown complete");toast("Day closed. Tomorrow is planned.");
}

var paletteIndex=0,paletteItems=[];
function paletteCommands(q){
  var items=[
    {label:"Quick add task",hint:"Create",action:"quick"},
    {label:"Today",hint:"Go to view",action:"view:today"},
    {label:"Daily Shutdown",hint:"Close the day",action:"view:shutdown"},
    {label:"Weekly Review",hint:"Review",action:"view:review"},
    {label:"Focus Mode",hint:"Start focus",action:"view:focus"},
    {label:"New goal",hint:"Create",action:"new:goal"},
    {label:"New project",hint:"Create",action:"new:project"},
    {label:"New note",hint:"Create",action:"new:note"},
    {label:"Create local snapshot",hint:"Backup",action:"snapshot"},
    {label:"Settings",hint:"Go to view",action:"view:settings"}
  ];
  activeTasks().slice(0,80).forEach(function(t){items.push({label:t.title,hint:"Task · "+t.status,action:"task:"+t.id})});
  state.projects.forEach(function(p){items.push({label:p.name,hint:"Project",action:"project:"+p.id})});
  state.goals.forEach(function(g){items.push({label:g.name,hint:"Goal · "+g.status,action:"goal:"+g.id})});
  q=(q||"").trim().toLowerCase();return q?items.filter(function(x){return (x.label+" "+x.hint).toLowerCase().includes(q)}).slice(0,12):items.slice(0,10);
}
function renderPalette(){
  paletteItems=paletteCommands($("paletteInput").value);if(paletteIndex>=paletteItems.length)paletteIndex=0;
  $("paletteResults").innerHTML=paletteItems.length?paletteItems.map(function(x,i){return '<button type="button" class="palette-item '+(i===paletteIndex?"selected":"")+'" data-palette-action="'+esc(x.action)+'"><div><b>'+esc(x.label)+'</b><small>'+esc(x.hint)+'</small></div><span>↵</span></button>'}).join(""):'<div class="empty">No matches.</div>';
}
function openPalette(){paletteIndex=0;$("paletteInput").value="";renderPalette();openDialog($("paletteModal"));setTimeout(function(){$("paletteInput").focus()},20)}
async function runPaletteAction(action){
  if(!action)return;if($("paletteModal").open)$("paletteModal").close();var parts=action.split(":"),kind=parts[0],id=parts.slice(1).join(":");
  if(kind==="view"){state.view=id;nav();window.scrollTo(0,0)}
  else if(kind==="quick")openQuick();
  else if(kind==="new"&&id==="goal")openGoal();
  else if(kind==="new"&&id==="project")openSimple("project");
  else if(kind==="new"&&id==="note")openSimple("note");
  else if(kind==="snapshot"){await createSnapshot("Manual snapshot");toast("Snapshot created")}
  else if(kind==="task")openTask(state.tasks.find(function(t){return t.id===id}));
  else if(kind==="project"){state.projectFilter=id;state.filter="open";state.view="tasks";nav();renderTasks()}
  else if(kind==="goal")openGoal(state.goals.find(function(g){return g.id===id}));
}
function openShareCapture(params){
  var title=params.get("title")||"",text=params.get("text")||"",url=params.get("url")||"",body=[text,url].filter(Boolean).join("\n");
  $("shareForm").reset();$("shareTitle").value=title;$("shareBody").value=body;$("shareProject").innerHTML='<option value="">No project</option>'+state.projects.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");openDialog($("shareModal"));
}
async function saveSharedItem(e){
  e.preventDefault();var title=$("shareTitle").value.trim(),body=$("shareBody").value.trim(),kind=$("shareKind").value;if(!title)title=body.slice(0,80)||"Shared item";
  if(kind==="note")await save("notes",{id:uid("n"),title:title,body:body,pinned:false,updatedAt:new Date().toISOString()});
  else await save("tasks",{id:uid("t"),title:title,description:body,status:"inbox",priority:"medium",projectId:$("shareProject").value,dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null});
  await log("share.captured",title,{kind:kind});$("shareModal").close();history.replaceState(null,"",location.pathname);await load();toast("Shared item saved");
}

function renderWeeklyReview(){
  var base=activeTasks(),history=state.tasks.filter(function(t){return !t.deletedAt}),now=new Date(),week=new Date();week.setDate(week.getDate()-7);
  var completed=history.filter(function(t){return t.completedAt&&new Date(t.completedAt)>=week}),over=base.filter(overdue),stale=base.filter(function(t){return t.status!=="done"&&new Date(t.createdAt)<week&&!overdue(t)});
  $("reviewCompleted").textContent=completed.length;$("reviewOverdue").textContent=over.length;$("reviewCarry").textContent=stale.length;
  $("reviewFocus").textContent=state.activity.filter(function(x){return x.type==="focus.completed"&&new Date(x.createdAt)>=week}).reduce(function(s,x){return s+(Number(x.minutes)||0)},0)+"m";
  $("reviewWins").innerHTML=completed.length?completed.slice(0,8).map(function(t){return '<div class="review-win"><span>✓</span><div><b>'+esc(t.title)+'</b><small>'+(t.completedAt?new Date(t.completedAt).toLocaleDateString():"Completed")+'</small></div></div>'}).join(""):'<div class="empty">No completed tasks in the last 7 days yet.</div>';
  var attention=over.concat(stale.filter(function(t){return !over.some(function(o){return o.id===t.id})})).slice(0,8);
  $("reviewNeedsAttention").innerHTML=attention.length?attention.map(taskHTML).join(""):'<div class="empty">Nothing overdue or stale. Nice.</div>';
}
function nextMondayKey(){var d=new Date(),delta=(8-d.getDay())%7;if(delta===0)delta=7;d.setDate(d.getDate()+delta);return dateKey(d)}
async function planNextWeek(e){
  e.preventDefault();var vals=[$("weekly1").value,$("weekly2").value,$("weekly3").value].map(function(x){return x.trim()}).filter(Boolean);if(!vals.length){toast("Add at least one priority");return}
  var due=nextMondayKey(),planned=vals.map(function(title){return {id:uid("t"),title:title,description:"",status:"next",priority:"high",projectId:"",dueDate:due,dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null}});await saveMany("tasks",planned);
  await log("review.planned","Weekly top priorities",{count:vals.length,dueDate:due});$("weeklyPlanForm").reset();await load();toast("Next week planned");
}
function templateCard(t,builtin){return '<article class="card template-card"><small class="caps">'+(builtin?"STARTER TEMPLATE":"YOUR TEMPLATE")+'</small><h3>'+esc(t.name)+'</h3><p>'+esc(t.description||t.title)+'</p><div class="meta"><span class="pill '+(t.priority||"medium")+'">'+esc(t.priority||"medium")+'</span><span class="pill">'+(t.subtasks||[]).length+' checklist</span></div><footer><div class="row"><button data-template-use="'+t.id+'" data-template-builtin="'+(builtin?"1":"0")+'" class="primary">Use template</button>'+(builtin?"":'<button data-template-edit="'+t.id+'">Edit</button>')+'</div></footer></article>'}
function renderTemplates(){
  $("templateProject").innerHTML='<option value="">No project</option>'+state.projects.map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");
  $("templateGrid").innerHTML=builtInTemplates.map(function(t){return templateCard(t,true)}).join("")+state.templates.map(function(t){return templateCard(t,false)}).join("");
}
function openTemplate(t){
  $("templateForm").reset();var existing=!!(t&&t.id);$("templateId").value=existing?t.id:"";$("templateName").value=t?t.name:"";$("templateTitle").value=t?t.title:"";$("templateDescription").value=t?t.description||"":"";
  $("templatePriority").value=t?t.priority||"medium":"medium";$("templateProject").value=t?t.projectId||"":"";$("templateChecklist").value=t?(t.subtasks||[]).map(function(s){return typeof s==="string"?s:s.title}).join("\n"):"";
  $("templateHeading").textContent=existing?"Edit template":"New template";$("deleteTemplate").classList.toggle("hidden",!existing);openDialog($("templateModal"))
}
async function saveTemplateForm(e){
  e.preventDefault();var id=$("templateId").value,name=$("templateName").value.trim(),title=$("templateTitle").value.trim();if(!name||!title)return;
  var t={id:id||uid("tpl"),name:name,title:title,description:$("templateDescription").value.trim(),priority:$("templatePriority").value,projectId:$("templateProject").value,subtasks:$("templateChecklist").value.split("\n").map(function(x){return x.trim()}).filter(Boolean),updatedAt:new Date().toISOString()};await save("templates",t);$("templateModal").close();await load();toast("Template saved");
}
async function useTemplate(id,builtin){
  var source=builtin?builtInTemplates.find(function(t){return t.id===id}):state.templates.find(function(t){return t.id===id});if(!source)return;
  var task={id:uid("t"),title:source.title,description:source.description||"",status:"inbox",priority:source.priority||"medium",projectId:source.projectId||"",dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:(source.subtasks||[]).map(function(s){return{id:uid("s"),title:typeof s==="string"?s:s.title,done:false}}),createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null};
  await save("tasks",task);await log("template.used",source.name);await load();state.view="tasks";nav();toast("Template created a task");
}
async function saveCurrentAsTemplate(){
  var title=$("taskTitle").value.trim();if(!title){toast("Give the task a title first");return}
  $("taskModal").close();openTemplate({name:title,title:title,description:$("taskDescription").value.trim(),priority:$("taskPriority").value,projectId:$("taskProject").value,subtasks:editingSubtasks.map(function(s){return s.title})});
}
function archiveRow(t,trash){return '<div class="archive-row"><div><b>'+esc(t.title)+'</b><small>'+(trash?"Trashed ":"Archived ")+new Date(trash?t.deletedAt:t.archivedAt).toLocaleDateString()+'</small></div><div class="buttons compact"><button data-restore-task="'+t.id+'">Restore</button>'+(trash?'<button class="dangerbtn" data-purge-task="'+t.id+'">Delete forever</button>':"")+'</div></div>'}
function renderArchive(){
  $$("[data-archive-filter]").forEach(function(b){b.classList.toggle("active",b.dataset.archiveFilter===state.archiveFilter)});
  var trash=state.archiveFilter==="trash",items=state.tasks.filter(function(t){return trash?!!t.deletedAt:!!t.archivedAt&&!t.deletedAt}).sort(function(a,b){return new Date(trash?b.deletedAt:b.archivedAt)-new Date(trash?a.deletedAt:a.archivedAt)});
  $("archiveList").innerHTML=items.length?items.map(function(t){return archiveRow(t,trash)}).join(""):'<div class="empty">'+(trash?"Trash is empty.":"No archived tasks yet.")+'</div>';
}
async function trashTask(id){
  var t=state.tasks.find(function(x){return x.id===id});if(!t)return;t.deletedAt=new Date().toISOString();await save("tasks",t);await log("task.trashed",t.title);await load();
  toast("Moved to Trash","Undo",async function(){t.deletedAt=null;await save("tasks",t);await load();toast("Restored")});
}
async function archiveTaskById(id){
  var t=state.tasks.find(function(x){return x.id===id});if(!t)return;t.archivedAt=new Date().toISOString();await save("tasks",t);await log("task.archived",t.title);await load();toast("Archived","Undo",async function(){t.archivedAt=null;await save("tasks",t);await load();toast("Restored")});
}
async function restoreTask(id){var t=state.tasks.find(function(x){return x.id===id});if(!t)return;t.deletedAt=null;t.archivedAt=null;await save("tasks",t);await load();toast("Task restored")}
async function archiveCompleted(){var items=activeTasks().filter(function(t){return t.status==="done"});for(var t of items){t.archivedAt=new Date().toISOString();await save("tasks",t)}await load();toast(items.length?items.length+" completed tasks archived":"Nothing to archive")}


async function refreshSystemInfo(){
  var box=$("systemInfo");if(!box)return;
  try{
    var meta=(await all("meta")).find(function(x){return x.id==="schema"})||{},estimate={};
    if(navigator.storage&&navigator.storage.estimate)estimate=await navigator.storage.estimate();
    var reg=("serviceWorker" in navigator)?await navigator.serviceWorker.getRegistration():null;
    var usage=estimate.usage!=null?formatBytes(estimate.usage):"Unavailable",quota=estimate.quota!=null?formatBytes(estimate.quota):"Unavailable";
    var rows=[
      ["App version","v"+APP_VERSION],
      ["Database schema","v"+(meta.version||DB_VERSION)],
      ["Offline cache",SW_CACHE],
      ["Service worker",reg&&reg.active?"Active":"Not active yet"],
      ["Open tasks",String(activeTasks().filter(function(t){return t.status!=="done"}).length)],
      ["Projects / Goals",state.projects.length+" / "+state.goals.length],
      ["Recovery snapshots",state.snapshots.length+" / "+MAX_SNAPSHOTS],
      ["Browser storage",usage+" of "+quota]
    ];
    box.innerHTML=rows.map(function(r){return '<div class="system-row"><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>'}).join("");
  }catch(e){box.innerHTML='<div class="diag-row warn"><b>System info unavailable</b><small>'+esc(e.message||"Unknown error")+'</small></div>'}
}

var onboardingStep=0;
var onboardingSlides=[
  {icon:"⌂",eyebrow:"WELCOME",title:"Your day, without the noise.",body:"Today surfaces what matters now. Everything stays private on this device — no account and no cloud database required.",action:"See Quick Add"},
  {icon:"＋",eyebrow:"CAPTURE FAST",title:"Type it like you think it.",body:"Try “Call Josh tomorrow 3pm #work !high.” Command Center pulls out the date, time, priority and project locally.",action:"See Planner"},
  {icon:"▣",eyebrow:"PLAN + MOVE",title:"See the month. Move the work.",body:"Planner puts deadlines on a calendar. Board lets you move tasks from Inbox → Next → Doing → Done.",action:"See Focus"},
  {icon:"◉",eyebrow:"FOCUS",title:"One task. One timer.",body:"Choose a task, start 25 / 50 / 90 minutes, and let everything else wait. Export JSON backups anytime from Settings.",action:"Start using Command Center"}
];
function renderOnboarding(){
  var s=onboardingSlides[onboardingStep];
  $("onboardingProgress").style.width=((onboardingStep+1)/onboardingSlides.length*100)+"%";
  $("onboardingSlide").innerHTML='<div class="tour-icon">'+s.icon+'</div><small class="caps">'+s.eyebrow+'</small><h2>'+s.title+'</h2><p>'+s.body+'</p>';
  $("onboardingBack").disabled=onboardingStep===0;
  $("onboardingNext").textContent=s.action;
}
function openOnboarding(force){
  if(!force&&localStorage.getItem("cc-onboarded-v1")==="1")return;
  onboardingStep=0;renderOnboarding();
  if(!$("onboardingModal").open)openDialog($("onboardingModal"));
}
function finishOnboarding(){
  localStorage.setItem("cc-onboarded-v1","1");
  if($("onboardingModal").open)$("onboardingModal").close();
  state.view="today";nav();toast("Command Center is ready");
}
function closeSwipeRows(except){
  $$(".task-row.reveal").forEach(function(row){if(row!==except)row.classList.remove("reveal")});
}
async function deleteTaskById(id){var t=state.tasks.find(function(x){return x.id===id});if(!t)return;if(!confirm('Move "'+t.title+'" to Trash?'))return;await trashTask(id)}
async function runDiagnostics(){
  var box=$("diagnosticResults");box.innerHTML='<div class="diag-row"><span>Running checks…</span></div>';
  var checks=[];
  try{localStorage.setItem("cc-diag","ok");var ok=localStorage.getItem("cc-diag")==="ok";localStorage.removeItem("cc-diag");checks.push(["Local preferences",ok,"Theme and app preferences can persist."])}catch(e){checks.push(["Local preferences",false,e.message])}
  try{var db=await openDB();var stores=STORES.every(function(s){return db.objectStoreNames.contains(s)});db.close();checks.push(["IndexedDB",stores,stores?"All local data stores are available.":"One or more stores are missing."])}catch(e){checks.push(["IndexedDB",false,e.message])}
  try{var reg=("serviceWorker" in navigator)?await navigator.serviceWorker.getRegistration():null;checks.push(["Offline worker",!!reg,reg?"Offline app shell is registered.":"Refresh once while online to register offline support."])}catch(e){checks.push(["Offline worker",false,e.message])}
  var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  checks.push(["Install mode",true,standalone?"Running from Home Screen / standalone.":"Running in browser; install from Settings when ready."]);
  checks.push(["Connection",true,navigator.onLine?"Online now. Local data still works offline.":"Offline now. Local data remains available."]);
  box.innerHTML=checks.map(function(c){return'<div class="diag-row '+(c[1]?"pass":"warn")+'"><b>'+(c[1]?"✓":"! ")+' '+esc(c[0])+'</b><small>'+esc(c[2])+'</small></div>'}).join("");
  toast(checks.every(function(c){return c[1]})?"App check passed":"App check finished");
}
function render(){nav();renderTasks();renderToday();renderCalendar();renderBoard();renderGoals();renderProjects();renderNotes();renderHabits();renderShutdown();renderWeeklyReview();renderTemplates();renderArchive();renderAnalytics();renderFocus();renderSnapshots();theme()}

document.addEventListener("click",async function(e){
  var b=e.target.closest("button,[data-edit-note],[data-search],[data-edit-task],[data-date-add]");if(!b)return;
  if(b.dataset.view){state.view=b.dataset.view;nav();window.scrollTo(0,0);if(state.view==="focus")renderFocus()}
  if(b.dataset.add==="task")openTask();if(b.dataset.add==="project")openSimple("project");if(b.dataset.add==="note")openSimple("note");if(b.dataset.add==="habit")openSimple("habit");
  if(b.dataset.close)$(b.dataset.close).close();
  if(b.dataset.toggle)await toggleTask(b.dataset.toggle);
  if(b.dataset.editTask)openTask(state.tasks.find(function(x){return x.id===b.dataset.editTask}));
  if(b.dataset.editNote)openSimple("note",state.notes.find(function(x){return x.id===b.dataset.editNote}));
  if(b.dataset.toggleHabit)await toggleHabit(b.dataset.toggleHabit);
  if(b.dataset.deleteHabit&&confirm("Delete this habit?")){await del("habits",b.dataset.deleteHabit);await load()}
  if(b.dataset.deleteProject&&confirm("Delete this project? Tasks will stay.")){var id=b.dataset.deleteProject;await del("projects",id);for(var t of state.tasks.filter(function(x){return x.projectId===id}))await save("tasks",Object.assign({},t,{projectId:""}));await load()}
  if(b.dataset.focusProject){state.projectFilter=b.dataset.focusProject;state.filter="open";state.view="tasks";nav();renderTasks()}
  if(b.dataset.filter){state.projectFilter="";state.filter=b.dataset.filter;$$("[data-filter]").forEach(function(x){x.classList.toggle("active",x.dataset.filter===state.filter)});renderTasks()}
  if(b.dataset.search){var z=b.dataset.search.split(":");$("searchBox").classList.add("hidden");$("search").value="";if(z[0]==="task")openTask(state.tasks.find(function(x){return x.id===z[1]}));else if(z[0]==="note")openSimple("note",state.notes.find(function(x){return x.id===z[1]}));else if(z[0]==="goal")openGoal(state.goals.find(function(x){return x.id===z[1]}));else{state.view=z[0];nav()}}
  if(b.dataset.dateAdd)openTask(null,b.dataset.dateAdd);
  if(b.dataset.minutes){state.focus.minutes=Number(b.dataset.minutes);state.focus.remaining=state.focus.minutes*60;state.focus.running=false;state.focus.endAt=null;persistFocus();renderFocus()}
  if(b.dataset.subtaskToggle){var s=editingSubtasks.find(function(x){return x.id===b.dataset.subtaskToggle});if(s){s.done=!s.done;renderSubtasks()}}
  if(b.dataset.subtaskDelete){editingSubtasks=editingSubtasks.filter(function(x){return x.id!==b.dataset.subtaskDelete});renderSubtasks()}
  if(b.dataset.swipeEdit){closeSwipeRows();openTask(state.tasks.find(function(x){return x.id===b.dataset.swipeEdit}))}
  if(b.dataset.swipeComplete){closeSwipeRows();await toggleTask(b.dataset.swipeComplete);toast("Task updated")}
  if(b.dataset.swipeDelete){closeSwipeRows();await deleteTaskById(b.dataset.swipeDelete)}
  if(b.dataset.templateUse)await useTemplate(b.dataset.templateUse,b.dataset.templateBuiltin==="1");
  if(b.dataset.templateEdit)openTemplate(state.templates.find(function(x){return x.id===b.dataset.templateEdit}));
  if(b.dataset.archiveFilter){state.archiveFilter=b.dataset.archiveFilter;renderArchive()}
  if(b.dataset.restoreTask)await restoreTask(b.dataset.restoreTask);
  if(b.dataset.purgeTask&&confirm("Delete this task forever? This cannot be undone.")){var purgeGuard=await createSnapshot("Before permanent delete");if(purgeGuard||confirm("Recovery snapshot failed. Delete forever anyway?")){await del("tasks",b.dataset.purgeTask);await load();toast("Permanently deleted")}}
  if(b.dataset.editGoal)openGoal(state.goals.find(function(g){return g.id===b.dataset.editGoal}));
  if(b.dataset.goalProject){openSimple("project");$("simpleGoal").value=b.dataset.goalProject}
  if(b.dataset.restoreSnapshot)await restoreSnapshot(b.dataset.restoreSnapshot);
  if(b.dataset.deleteSnapshot){await del("snapshots",b.dataset.deleteSnapshot);state.snapshots=await all("snapshots");renderSnapshots();toast("Snapshot removed")}
  if(b.dataset.paletteAction)await runPaletteAction(b.dataset.paletteAction);
  if(b.dataset.dashboardMove)moveDashboardCard(b.dataset.dashboardMove,b.dataset.direction);
});
document.addEventListener("change",function(e){
  var select=e.target.closest&&e.target.closest("[data-select-task]");
  if(select){select.checked?state.selectedTaskIds.add(select.dataset.selectTask):state.selectedTaskIds.delete(select.dataset.selectTask);renderTasks();return}
  var visible=e.target.closest&&e.target.closest("[data-dashboard-visible]");
  if(visible&&dashboardDraft){
    var key=visible.dataset.dashboardVisible;
    if(visible.checked)dashboardDraft.hidden=dashboardDraft.hidden.filter(function(x){return x!==key});
    else if(!dashboardDraft.hidden.includes(key))dashboardDraft.hidden.push(key);
  }
});
var swipeStart=null;
document.addEventListener("touchstart",function(e){
  var row=e.target.closest&&e.target.closest("[data-task-row]");if(!row||e.target.closest("button"))return;
  var t=e.changedTouches[0];swipeStart={row:row,x:t.clientX,y:t.clientY};
},{passive:true});
document.addEventListener("touchend",function(e){
  if(!swipeStart)return;
  var t=e.changedTouches[0],dx=t.clientX-swipeStart.x,dy=t.clientY-swipeStart.y,row=swipeStart.row;
  swipeStart=null;
  if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.25)return;
  if(dx<0){closeSwipeRows(row);row.classList.add("reveal")}
  else{row.classList.remove("reveal")}
},{passive:true});
document.addEventListener("click",function(e){
  if(!e.target.closest(".task-row")&&!e.target.closest(".task-actions"))closeSwipeRows();
});
document.addEventListener("dragstart",function(e){var card=e.target.closest("[data-drag-task]");if(card)e.dataTransfer.setData("text/plain",card.dataset.dragTask)});
$$(".kanban-col").forEach(function(col){col.addEventListener("dragover",function(e){e.preventDefault();col.classList.add("dragover")});col.addEventListener("dragleave",function(){col.classList.remove("dragover")});col.addEventListener("drop",async function(e){e.preventDefault();col.classList.remove("dragover");var id=e.dataTransfer.getData("text/plain"),t=state.tasks.find(function(x){return x.id===id});if(!t)return;await setTaskStatus(t,col.dataset.dropStatus);await load();toast("Moved to "+t.status)})});

$("menu").onclick=function(){$("sidebar").classList.toggle("open")};
$("openPalette").onclick=openPalette;$("sidebarPalette").onclick=openPalette;
$("addTask").onclick=function(){openQuick()};
$("customizeToday").onclick=openDashboardCustomize;
$("dashboardForm").onsubmit=saveDashboardLayout;
$("resetDashboard").onclick=resetDashboardDraft;
$("bulkToggle").onclick=toggleBulkMode;
$("bulkSelectAll").onclick=function(){filteredTasks().forEach(function(t){state.selectedTaskIds.add(t.id)});renderTasks()};
$("bulkClear").onclick=clearBulkSelection;
$("bulkApply").onclick=applyBulkChanges;
$("bulkArchive").onclick=bulkArchive;
$("bulkTrash").onclick=bulkTrash;
$("tagFilter").onchange=function(){state.tagFilter=this.value;renderTasks()};
$("quickHelp").onclick=function(){openQuick()};
$("captureForm").onsubmit=quickCapture;
$("quickInput").oninput=quickPreview;
$("quickForm").onsubmit=async function(e){e.preventDefault();var v=$("quickInput").value.trim();if(!v)return;await createQuick(v);$("quickModal").close()};
$("taskForm").onsubmit=saveTask;
$("addSubtask").onclick=function(){var v=$("newSubtask").value.trim();if(!v)return;editingSubtasks.push({id:uid("s"),title:v,done:false});$("newSubtask").value="";renderSubtasks()};
$("newSubtask").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();$("addSubtask").click()}});
$("simpleForm").onsubmit=saveSimple;
$("goalForm").onsubmit=saveGoal;
$("newGoal").onclick=function(){openGoal()};
$("deleteGoal").onclick=async function(){var id=$("goalId").value;if(id){$("goalModal").close();await deleteGoalById(id)}};
$("shareForm").onsubmit=saveSharedItem;
$("openShareCapture").onclick=function(){openShareCapture(new URLSearchParams())};
$("pasteShare").onclick=async function(){try{var t=await navigator.clipboard.readText();if(t)$("shareBody").value=[$("shareBody").value.trim(),t].filter(Boolean).join("\n")}catch(e){toast("Clipboard access is not available here")}};
$("shutdownForm").onsubmit=completeShutdown;
$("createSnapshot").onclick=async function(){await createSnapshot("Manual snapshot");toast("Snapshot created")};
$("deleteTask").onclick=async function(){var id=$("taskId").value;if(id&&confirm("Move this task to Trash?")){$("taskModal").close();await trashTask(id)}};
$("archiveTask").onclick=async function(){var id=$("taskId").value;if(id){$("taskModal").close();await archiveTaskById(id)}};
$("saveTemplateFromTask").onclick=saveCurrentAsTemplate;
$("taskRepeat").onchange=syncRepeatUI;
$("templateForm").onsubmit=saveTemplateForm;
$("newTemplate").onclick=function(){openTemplate()};
$("deleteTemplate").onclick=async function(){var id=$("templateId").value;if(id&&confirm("Delete this template?")){await del("templates",id);$("templateModal").close();await load();toast("Template deleted")}};
$("weeklyPlanForm").onsubmit=planNextWeek;
$("archiveCompleted").onclick=archiveCompleted;
$("deleteSimple").onclick=async function(){var k=$("simpleKind").value,id=$("simpleId").value;if(id&&confirm("Delete this "+k+"?")){await del(k==="note"?"notes":k+"s",id);$("simpleModal").close();await load()}};
$("search").oninput=function(e){search(e.target.value)};
$("calPrev").onclick=function(){state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()-1,1);renderCalendar()};
$("calNext").onclick=function(){state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()+1,1);renderCalendar()};
$("calToday").onclick=function(){state.calendarCursor=new Date();renderCalendar()};
$("focusStart").onclick=startFocus;$("focusPause").onclick=pauseFocus;$("focusReset").onclick=resetFocus;
$("focusTask").onchange=function(){state.focus.taskId=this.value;persistFocus();renderFocus()};
$("focusComplete").onclick=async function(){var t=state.tasks.find(function(x){return x.id===$("focusTask").value});if(!t){toast("Choose a task first");return}await setTaskStatus(t,"done");pauseFocus();await load();toast("Task completed")};
$("light").onclick=function(){localStorage.setItem("cc-theme","light");theme()};$("dark").onclick=function(){localStorage.setItem("cc-theme","dark");theme()};
$("export").onclick=exportAll;$("import").onchange=function(e){importAll(e.target.files[0]);e.target.value=""};
$("reset").onclick=async function(){if(!confirm("Reset all local data? A recovery snapshot will be kept."))return;var guard=await createSnapshot("Before workspace reset");if(!guard&&!confirm("Recovery snapshot failed. Reset anyway?"))return;for(var s of DATA_STORES)await clear(s);localStorage.removeItem("cc-focus");loadFocus();await load();toast("Workspace reset","Restore",async function(){var latest=state.snapshots.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)})[0];if(latest)await restoreSnapshot(latest.id)})};
$("replayTour").onclick=function(){openOnboarding(true)};
$("runDiagnostics").onclick=runDiagnostics;$("refreshSystemInfo").onclick=refreshSystemInfo;
$("onboardingSkip").onclick=finishOnboarding;
$("onboardingBack").onclick=function(){if(onboardingStep>0){onboardingStep--;renderOnboarding()}};
$("onboardingNext").onclick=function(){if(onboardingStep<onboardingSlides.length-1){onboardingStep++;renderOnboarding()}else finishOnboarding()};

$("paletteInput").oninput=function(){paletteIndex=0;renderPalette()};
$("paletteInput").onkeydown=async function(e){
  if(e.key==="ArrowDown"){e.preventDefault();if(paletteItems.length){paletteIndex=(paletteIndex+1)%paletteItems.length;renderPalette()}}
  else if(e.key==="ArrowUp"){e.preventDefault();if(paletteItems.length){paletteIndex=(paletteIndex-1+paletteItems.length)%paletteItems.length;renderPalette()}}
  else if(e.key==="Enter"){e.preventDefault();if(paletteItems[paletteIndex])await runPaletteAction(paletteItems[paletteIndex].action)}
};
document.addEventListener("keydown",function(e){
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openPalette()}
  else if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();openQuick()}
  else if(e.key.toLowerCase()==="q"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)&&!document.querySelector("dialog[open]")){openQuick()}
});

var pendingUpdateRegistration=null,swReloadRequested=false;
function showUpdateBanner(registration){
  pendingUpdateRegistration=registration;
  $("updateBanner").classList.remove("hidden");
}
function hideUpdateBanner(){$("updateBanner").classList.add("hidden")}
$("updateDismiss").onclick=hideUpdateBanner;
$("updateReload").onclick=function(){
  swReloadRequested=true;hideUpdateBanner();
  var worker=pendingUpdateRegistration&&pendingUpdateRegistration.waiting;
  if(worker)worker.postMessage({type:"SKIP_WAITING"});else location.reload();
};
async function registerServiceWorker(){
  if(!("serviceWorker" in navigator))return;
  try{
    var registration=await navigator.serviceWorker.register("/sw.js");
    if(registration.waiting&&navigator.serviceWorker.controller)showUpdateBanner(registration);
    registration.addEventListener("updatefound",function(){
      var worker=registration.installing;if(!worker)return;
      worker.addEventListener("statechange",function(){
        if(worker.state==="installed"&&navigator.serviceWorker.controller)showUpdateBanner(registration);
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange",function(){if(swReloadRequested)location.reload()});
  }catch(e){console.warn("Service worker registration failed",e)}
}

var deferredInstall=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredInstall=e;var b=$("installApp");if(b){b.disabled=false;b.textContent="Install Command Center"}});
window.addEventListener("appinstalled",function(){deferredInstall=null;var b=$("installApp");if(b){b.textContent="Installed";b.disabled=true}toast("Command Center installed")});
function installState(){var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);var b=$("installApp"),hint=$("iosInstall"),copy=$("installCopy");if(!b)return;if(standalone){b.textContent="Installed";b.disabled=true;if(copy)copy.textContent="You are running Command Center as an installed web app."}else if(ios){b.textContent="How to install on iPhone";if(hint)hint.classList.remove("hidden")}}
$("installApp").onclick=async function(){if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;return}if(/iphone|ipad|ipod/i.test(navigator.userAgent)){var h=$("iosInstall");if(h)h.classList.remove("hidden");toast("Safari → Share → Add to Home Screen");return}toast("Use your browser menu → Install app / Add to Home Screen")};

loadFocus();
var params=new URLSearchParams(location.search);if(params.get("view"))state.view=params.get("view");if(params.get("quick")==="1")setTimeout(function(){openQuick()},300);
theme();installState();load().then(async function(){
  if(state.focus.running){clearInterval(focusTimer);focusTimer=setInterval(tickFocus,1000)}
  await ensureDailySnapshot();
  if(params.get("share")==="1")setTimeout(function(){openShareCapture(params)},180);
  else if(params.get("quick")!=="1")setTimeout(function(){openOnboarding(false)},250);
}).catch(function(e){console.error(e);document.body.innerHTML="<main style='padding:40px;font-family:system-ui'><h1>Command Center could not start.</h1><p>Refresh the page. Your local data was not intentionally deleted.</p></main>"});
registerServiceWorker();
