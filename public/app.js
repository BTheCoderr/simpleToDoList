var DB="command-center-v2",VER=2,STORES=["tasks","projects","notes","habits","activity","templates"];
var state={tasks:[],projects:[],notes:[],habits:[],activity:[],templates:[],filter:"open",projectFilter:"",archiveFilter:"archived",view:localStorage.getItem("cc-view")||"today",calendarCursor:new Date(),focusPreset:25,focus:null};
var editingSubtasks=[];
var focusTimer=null;
var $=function(id){return document.getElementById(id)}, $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var defaults={projects:[{id:"p1",name:"Launch Command Center",area:"Personal",createdAt:new Date().toISOString()},{id:"p2",name:"Win the Week",area:"Work",createdAt:new Date().toISOString()}],tasks:[{id:"t1",title:"Pick your top 3 priorities",description:"Use Today for what actually matters.",status:"next",priority:"high",projectId:"p2",dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null},{id:"t2",title:"Export your first backup",description:"Settings → Export JSON keeps a portable copy.",status:"inbox",priority:"medium",projectId:"p1",dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null}],notes:[{id:"n1",title:"How I want to use this",body:"Capture fast. Organize later. Keep Today small.",pinned:true,updatedAt:new Date().toISOString()}],habits:[{id:"h1",name:"Plan tomorrow",history:[],createdAt:new Date().toISOString()}]};
var builtInTemplates=[
  {id:"builtin-weekly-reset",name:"Weekly Reset",title:"Weekly reset",description:"Review calendar, inbox, projects and priorities.",priority:"high",projectId:"",subtasks:["Clear inbox","Review overdue tasks","Review active projects","Choose top 3 for next week","Export a backup"]},
  {id:"builtin-job-application",name:"Job Application",title:"Apply to role",description:"Reusable application checklist.",priority:"high",projectId:"",subtasks:["Tailor resume","Review company and role","Write application answers","Attach work sample","Submit and record follow-up date"]},
  {id:"builtin-launch",name:"Project Launch",title:"Launch project",description:"Turn a finished build into a shipped release.",priority:"high",projectId:"",subtasks:["Final QA","Mobile check","Backup/export","Deploy production","Verify live URL","Write release notes"]},
  {id:"builtin-errands",name:"Errands Run",title:"Run errands",description:"Quick reusable errands checklist.",priority:"medium",projectId:"",subtasks:["Make list","Plan route","Complete stops","Put receipts away"]}
];

function uid(p){return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)}
function openDB(){return new Promise(function(res,rej){var r=indexedDB.open(DB,VER);r.onupgradeneeded=function(){STORES.forEach(function(s){if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:"id"})})};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function all(store){return openDB().then(function(db){return new Promise(function(res,rej){var r=db.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=function(){db.close();res(r.result)};r.onerror=function(){db.close();rej(r.error)}})})}
function save(store,val){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction(store,"readwrite");tx.objectStore(store).put(val);tx.oncomplete=function(){db.close();res()};tx.onerror=function(){db.close();rej(tx.error)}})})}
function del(store,id){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction(store,"readwrite");tx.objectStore(store).delete(id);tx.oncomplete=function(){db.close();res()};tx.onerror=function(){db.close();rej(tx.error)}})})}
function clear(store){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction(store,"readwrite");tx.objectStore(store).clear();tx.oncomplete=function(){db.close();res()};tx.onerror=function(){db.close();rej(tx.error)}})})}
async function seed(){var count=0;for(var s of ["tasks","projects","notes","habits"])count+=(await all(s)).length;if(count)return;for(var k of ["projects","tasks","notes","habits"])for(var x of defaults[k])await save(k,x)}
async function load(){await seed();state.tasks=(await all("tasks")).map(normalizeTask);state.projects=await all("projects");state.notes=await all("notes");state.habits=await all("habits");state.activity=await all("activity");state.templates=await all("templates");render()}
function normalizeTask(t){return Object.assign({description:"",status:"inbox",priority:"medium",projectId:"",dueDate:"",dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null},t,{subtasks:Array.isArray(t.subtasks)?t.subtasks:[]})}
function activeTasks(){return state.tasks.filter(function(t){return !t.deletedAt&&!t.archivedAt})}
function visibleTasks(){return activeTasks()}
function esc(v){return String(v||"").replace(/[&<>'"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]})}
function today(){var d=new Date();return dateKey(d)}
function dateKey(d){var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day}
function pname(id){var p=state.projects.find(function(x){return x.id===id});return p?p.name:""}
function overdue(t){return t.dueDate&&t.status!=="done"&&t.dueDate<today()}
function fmt(d,time){if(!d)return"";var text=new Date(d+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});if(time){var x=new Date("2000-01-01T"+time);text+=" · "+x.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}return text}
function toast(m,actionLabel,actionFn){var e=$("toast"),txt=$("toastText"),btn=$("toastAction");txt.textContent=m;btn.classList.toggle("hidden",!actionLabel);btn.textContent=actionLabel||"";btn.onclick=actionFn||null;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove("show");btn.classList.add("hidden");btn.onclick=null},actionLabel?5000:1900)}
async function log(type,label,extra){await save("activity",Object.assign({id:uid("a"),type:type,label:label,createdAt:new Date().toISOString()},extra||{}))}
function subtaskStats(t){var a=t.subtasks||[],done=a.filter(function(x){return x.done}).length;return {done:done,total:a.length}}
function taskScore(t){var p={high:0,medium:1,low:2};return (t.status==="done"?100:0)+(p[t.priority]||0)}

function nav(){
  $$(".nav,.bottom button").forEach(function(b){b.classList.toggle("active",b.dataset.view===state.view)});
  $$(".view").forEach(function(v){v.classList.toggle("active",v.id===state.view)});
  var v=$(state.view);
  if(v){$("title").textContent={today:"Today",tasks:"Tasks",planner:"Planner",board:"Board",focus:"Focus",projects:"Projects",notes:"Notes",habits:"Habits",review:"Weekly Review",templates:"Templates",archive:"Archive",analytics:"Analytics",settings:"Settings"}[v.id]||v.id;$("eyebrow").textContent={today:"YOUR DAY",tasks:"EXECUTION",planner:"CALENDAR",board:"FLOW",focus:"DEEP WORK",projects:"OUTCOMES",notes:"THINKING SPACE",habits:"CONSISTENCY",review:"RESET",templates:"REUSE",archive:"HISTORY",analytics:"PATTERNS",settings:"YOUR WORKSPACE"}[v.id]||""}
  localStorage.setItem("cc-view",state.view);
  $("sidebar").classList.remove("open");
}

function taskHTML(t){
  var p=pname(t.projectId),st=subtaskStats(t),sub=st.total?'<span class="pill">'+st.done+'/'+st.total+' checklist</span>':"";
  return '<div class="task-row" data-task-row="'+t.id+'"><div class="task-actions"><button class="swipe-edit" data-swipe-edit="'+t.id+'">Edit</button><button class="swipe-done" data-swipe-complete="'+t.id+'">'+(t.status==="done"?"Undo":"Done")+'</button><button class="swipe-delete" data-swipe-delete="'+t.id+'">Delete</button></div><div class="task '+(t.status==="done"?"done":"")+'"><button class="checkbtn" data-toggle="'+t.id+'">'+(t.status==="done"?"✓":"")+'</button><div class="taskmain" data-edit-task="'+t.id+'"><div class="tasktitle">'+esc(t.title)+'</div><div class="meta"><span class="pill '+t.priority+'">'+esc(t.priority)+'</span><span class="pill">'+esc(t.status)+'</span>'+(p?'<span class="pill">'+esc(p)+'</span>':"")+(t.dueDate?'<span class="pill '+(overdue(t)?"high":"")+'">'+(overdue(t)?"Overdue · ":"")+fmt(t.dueDate,t.dueTime)+'</span>':"")+(t.repeat!=="none"?'<span class="pill">↻ '+esc(t.repeat)+'</span>':"")+sub+'</div></div><button class="dots" data-edit-task="'+t.id+'">•••</button></div></div>'
}
function renderTasks(){
  var base=activeTasks(),open=base.filter(function(t){return t.status!=="done"}).length;$("openCount").textContent=open;
  $("taskProject").innerHTML='<option value="">No project</option>'+state.projects.map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");
  var a=base.slice().sort(function(a,b){return taskScore(a)-taskScore(b)});
  if(state.filter==="open")a=a.filter(function(t){return t.status!=="done"});else if(state.filter!=="all")a=a.filter(function(t){return t.status===state.filter});
  if(state.projectFilter)a=a.filter(function(t){return t.projectId===state.projectFilter});
  $("taskList").innerHTML=a.length?a.map(taskHTML).join(""):'<div class="empty">Nothing here.</div>';
}
function streak(h){var s=new Set(h||[]),d=new Date(),n=0;if(!s.has(today()))d.setDate(d.getDate()-1);while(s.has(dateKey(d))){n++;d.setDate(d.getDate()-1)}return n}
function habitHTML(h){var on=(h.history||[]).indexOf(today())>=0;return'<div class="habit '+(on?"checked":"")+'"><button data-toggle-habit="'+h.id+'">'+(on?"✓":"○")+'</button><div><b>'+esc(h.name)+'</b><small>'+streak(h.history)+' day streak · '+(h.history||[]).length+' check-ins</small></div><button data-delete-habit="'+h.id+'">Delete</button></div>'}
function renderToday(){
  var now=new Date(),hr=now.getHours();$("todayDate").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});$("greeting").textContent=hr<12?"Good morning.":hr<18?"Good afternoon.":"Good evening.";
  var base=activeTasks(),open=base.filter(function(t){return t.status!=="done"}),focus=open.filter(function(t){return t.priority==="high"||t.status==="doing"||t.dueDate===today()||overdue(t)}).slice(0,6);
  $("todayTasks").innerHTML=focus.length?focus.map(taskHTML).join(""):'<div class="empty">No urgent work. Pull something from Tasks.</div>';
  $("sToday").textContent=focus.length;$("sOverdue").textContent=open.filter(overdue).length;
  var week=new Date();week.setDate(week.getDate()-7);$("sWeek").textContent=base.filter(function(t){return t.completedAt&&new Date(t.completedAt)>=week}).length;$("sProjects").textContent=state.projects.length;
  $("todayHabits").innerHTML=state.habits.length?state.habits.slice(0,5).map(habitHTML).join(""):'<div class="empty">Add a habit.</div>';
  $("todayProjects").innerHTML=state.projects.slice(0,5).map(function(p){var a=activeTasks().filter(function(t){return t.projectId===p.id}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0;return'<div class="mini"><b>'+esc(p.name)+'</b><small>'+d+'/'+a.length+' tasks complete</small><div class="progress"><i style="width:'+pc+'%"></i></div></div>'}).join("")||'<div class="empty">No projects yet.</div>';
}
function renderProjects(){$("projectGrid").innerHTML=state.projects.map(function(p){var a=activeTasks().filter(function(t){return t.projectId===p.id}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0;return'<article class="card"><small class="caps">'+esc(p.area||"PROJECT")+'</small><h3>'+esc(p.name)+'</h3><p>'+a.length+' tasks · '+pc+'% complete</p><footer><div class="progress"><i style="width:'+pc+'%"></i></div><div class="row"><button data-focus-project="'+p.id+'" class="link">View tasks</button><button data-delete-project="'+p.id+'">Delete</button></div></footer></article>'}).join("")||'<div class="empty">Create a project for an outcome that takes more than one task.</div>'}
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

function parseDatePhrase(text){
  var lower=text.toLowerCase(),d=new Date(),found="";
  if(/\btoday\b/.test(lower)){found="today"}else if(/\btomorrow\b/.test(lower)){d.setDate(d.getDate()+1);found="tomorrow"}else if(/\bnext week\b/.test(lower)){d.setDate(d.getDate()+7);found="next week"}else{
    var days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"],hit=days.find(function(x){return new RegExp("\\b(next\\s+)?"+x+"\\b","i").test(text)});
    if(hit){var target=days.indexOf(hit),delta=(target-d.getDay()+7)%7;if(delta===0)delta=7;if(new RegExp("\\bnext\\s+"+hit+"\\b","i").test(text)&&delta<7)delta+=7;d.setDate(d.getDate()+delta);found=(new RegExp("\\bnext\\s+"+hit+"\\b","i").test(text)?"next ":"")+hit}
  }
  var iso=text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);if(iso){return {date:iso[1],phrase:iso[1]}}
  return found?{date:dateKey(d),phrase:found}:{date:"",phrase:""};
}
function parseQuick(text){
  var raw=text.trim(),work=raw,priority="medium",repeat="none",projectId="",dueTime="";
  var pm=work.match(/!(high|medium|low)\b/i);if(pm){priority=pm[1].toLowerCase();work=work.replace(pm[0]," ")}
  var everyDays=work.match(/\bevery\s+(\d+)\s+days?\b/i),repeatInterval=1;
  if(everyDays){repeat="custom_days";repeatInterval=Math.max(1,Number(everyDays[1])||1);work=work.replace(everyDays[0]," ")}
  else if(/\b(daily|every day)\b/i.test(work)){repeat="daily";work=work.replace(/\b(daily|every day)\b/i," ")}
  else if(/\b(weekdays|every weekday)\b/i.test(work)){repeat="weekdays";work=work.replace(/\b(weekdays|every weekday)\b/i," ")}
  else if(/\b(weekly|every week)\b/i.test(work)){repeat="weekly";work=work.replace(/\b(weekly|every week)\b/i," ")}
  else if(/\b(monthly|every month)\b/i.test(work)){repeat="monthly";work=work.replace(/\b(monthly|every month)\b/i," ")}
  var tm=work.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);if(tm){var h=parseInt(tm[1],10),min=tm[2]||"00",ap=tm[3].toLowerCase();if(ap==="pm"&&h<12)h+=12;if(ap==="am"&&h===12)h=0;dueTime=String(h).padStart(2,"0")+":"+min;work=work.replace(tm[0]," ")}
  var dp=parseDatePhrase(work);if(dp.phrase)work=work.replace(new RegExp("\\b"+dp.phrase.replace(" ","\\s+")+"\\b","i")," ");
  var tags=work.match(/#[a-z0-9_-]+/ig)||[];if(tags.length){var tag=tags[0].slice(1).toLowerCase().replace(/[-_]/g,"");var p=state.projects.find(function(x){var n=(x.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),a=(x.area||"").toLowerCase().replace(/[^a-z0-9]/g,"");return n===tag||n.startsWith(tag)||a===tag});if(p)projectId=p.id;work=work.replace(tags[0]," ")}
  work=work.replace(/\s+/g," ").trim();
  return {title:work||raw,description:"",status:"inbox",priority:priority,projectId:projectId,dueDate:dp.date,dueTime:dueTime,repeat:repeat,repeatInterval:typeof repeatInterval==="number"?repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null};
}
function quickPreview(){
  var q=parseQuick($("quickInput").value||""),p=pname(q.projectId);$("quickPreview").innerHTML=q.title?'<b>'+esc(q.title)+'</b><div class="meta"><span class="pill '+q.priority+'">'+q.priority+'</span>'+(q.dueDate?'<span class="pill">'+fmt(q.dueDate,q.dueTime)+'</span>':"")+(p?'<span class="pill">'+esc(p)+'</span>':"")+(q.repeat!=="none"?'<span class="pill">↻ '+q.repeat+'</span>':"")+'</div>':'<span class="hint">Your parsed task will appear here.</span>';
}
function openQuick(seed){$("quickForm").reset();$("quickInput").value=seed||"";quickPreview();$("quickModal").showModal();setTimeout(function(){$("quickInput").focus()},30)}
async function createQuick(text){var q=parseQuick(text);if(!q.title)return; q.id=uid("t");await save("tasks",q);await log("task.created",q.title,{source:"quick-add"});await load();toast("Captured"+(q.dueDate?" for "+fmt(q.dueDate,q.dueTime):" to Inbox"))}


function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function nextWeekday(d){var x=addDays(d,1);while(x.getDay()===0||x.getDay()===6)x=addDays(x,1);return x}
function nextOccurrence(t){
  if(!t.repeat||t.repeat==="none")return "";
  var base=t.repeat==="after_completion"?new Date():new Date((t.dueDate||today())+"T12:00:00");
  var n=Math.max(1,Number(t.repeatInterval)||1),next;
  if(t.repeat==="daily")next=addDays(base,1);
  else if(t.repeat==="weekdays")next=nextWeekday(base);
  else if(t.repeat==="weekly")next=addDays(base,7);
  else if(t.repeat==="monthly"){next=new Date(base);next.setMonth(next.getMonth()+1)}
  else if(t.repeat==="custom_days"||t.repeat==="after_completion")next=addDays(base,n);
  else return "";
  var key=dateKey(next);
  return t.repeatUntil&&key>t.repeatUntil?"":key;
}
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
  $("taskStatus").value=t?t.status:"inbox";$("taskPriority").value=t?t.priority:"medium";$("taskProject").value=t?t.projectId||"":"";
  $("taskDue").value=t?t.dueDate||"":(prefillDate||"");$("taskTime").value=t?t.dueTime||"":"";
  $("taskRepeat").value=t?t.repeat||"none":"none";$("taskRepeatInterval").value=t?Math.max(1,Number(t.repeatInterval)||1):1;$("taskRepeatUntil").value=t?t.repeatUntil||"":"";
  $("taskHeading").textContent=t?"Edit task":"New task";$("deleteTask").classList.toggle("hidden",!t);$("archiveTask").classList.toggle("hidden",!t);renderSubtasks();syncRepeatUI();$("taskModal").showModal()
}
async function saveTask(e){
  e.preventDefault();var old=state.tasks.find(function(t){return t.id===$("taskId").value}),status=$("taskStatus").value,was=old?old.status:null;
  var t={id:old?old.id:uid("t"),title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),status:status,priority:$("taskPriority").value,projectId:$("taskProject").value,dueDate:$("taskDue").value,dueTime:$("taskTime").value,repeat:$("taskRepeat").value,repeatInterval:Math.max(1,Number($("taskRepeatInterval").value)||1),repeatUntil:$("taskRepeatUntil").value,subtasks:editingSubtasks,createdAt:old?old.createdAt:new Date().toISOString(),completedAt:status==="done"?(old&&old.completedAt?old.completedAt:new Date().toISOString()):null,archivedAt:old?old.archivedAt:null,deletedAt:old?old.deletedAt:null};
  if(!t.title)return;await save("tasks",t);if(was!=="done"&&status==="done")await spawnNextOccurrence(t);await log(old?"task.updated":"task.created",t.title);$("taskModal").close();await load();toast(old?"Task updated":"Task created")
}
async function toggleTask(id){
  var t=state.tasks.find(function(x){return x.id===id});if(!t)return;await setTaskStatus(t,t.status==="done"?"next":"done");await load()
}
function syncRepeatUI(){var show=["custom_days","after_completion"].indexOf($("taskRepeat").value)>=0;$("repeatIntervalWrap").classList.toggle("hidden",!show)}
async function quickCapture(e){e.preventDefault();var v=$("capture").value.trim();if(!v)return;await createQuick(v);$("capture").value=""}

function openSimple(kind,item){$("simpleForm").reset();$("simpleKind").value=kind;$("simpleId").value=item?item.id:"";$("simpleTitle").value=item?(item.title||item.name):"";$("simpleBody").value=item&&item.body?item.body:"";$("simpleMeta").value=item&&item.area?item.area:"";$("simplePin").checked=!!(item&&item.pinned);$("simpleType").textContent=kind.toUpperCase();$("simpleHeading").textContent=(item?"Edit ":"New ")+kind;$("simpleBodyWrap").classList.toggle("hidden",kind!=="note");$("simplePinWrap").classList.toggle("hidden",kind!=="note");$("simpleMetaWrap").classList.toggle("hidden",kind!=="project");$("deleteSimple").classList.toggle("hidden",!item||kind==="project"||kind==="habit");$("simpleModal").showModal()}
async function saveSimple(e){e.preventDefault();var k=$("simpleKind").value,id=$("simpleId").value,title=$("simpleTitle").value.trim();if(!title)return;if(k==="project")await save("projects",{id:id||uid("p"),name:title,area:$("simpleMeta").value.trim(),createdAt:new Date().toISOString()});if(k==="note")await save("notes",{id:id||uid("n"),title:title,body:$("simpleBody").value.trim(),pinned:$("simplePin").checked,updatedAt:new Date().toISOString()});if(k==="habit")await save("habits",{id:id||uid("h"),name:title,history:[],createdAt:new Date().toISOString()});$("simpleModal").close();await load();toast(k.charAt(0).toUpperCase()+k.slice(1)+" saved")}
async function toggleHabit(id){var h=state.habits.find(function(x){return x.id===id});var set=new Set(h.history||[]);set.has(today())?set.delete(today()):set.add(today());h.history=Array.from(set);await save("habits",h);await load()}

function loadFocus(){
  try{state.focus=JSON.parse(localStorage.getItem("cc-focus")||"null")}catch(e){state.focus=null}
  if(!state.focus)state.focus={taskId:"",minutes:25,remaining:25*60,running:false,endAt:null};
  if(state.focus.running&&state.focus.endAt){state.focus.remaining=Math.max(0,Math.ceil((state.focus.endAt-Date.now())/1000))}
  state.focusPreset=state.focus.minutes||25;
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

async function exportAll(){var data={version:4,exportedAt:new Date().toISOString()};for(var s of STORES)data[s]=await all(s);var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="command-center-"+today()+".json";a.click();URL.revokeObjectURL(url)}
async function importAll(file){if(!file)return;try{var data=JSON.parse(await file.text());if(!confirm("Replace all local data with this backup?"))return;for(var s of STORES){await clear(s);for(var x of data[s]||[])await save(s,x)}await load();toast("Backup restored")}catch(e){alert("Could not import that JSON backup.")}}
function search(q){var box=$("searchBox");q=q.trim().toLowerCase();if(!q){box.classList.add("hidden");return}var r=[];activeTasks().filter(function(x){return(x.title+" "+x.description+" "+(x.subtasks||[]).map(function(s){return s.title}).join(" ")).toLowerCase().includes(q)}).forEach(function(x){r.push(["task",x.id,x.title,x.status])});state.projects.filter(function(x){return(x.name+" "+x.area).toLowerCase().includes(q)}).forEach(function(x){r.push(["projects","",x.name,x.area||"Project"])});state.notes.filter(function(x){return(x.title+" "+x.body).toLowerCase().includes(q)}).forEach(function(x){r.push(["note",x.id,x.title,"Note"])});box.innerHTML=r.slice(0,10).map(function(x){return'<div class="searchitem" data-search="'+x[0]+':'+x[1]+'"><b>'+esc(x[2])+'</b><small>'+esc(x[3])+'</small></div>'}).join("")||'<div class="empty">No matches.</div>';box.classList.remove("hidden")}
function theme(){var t=localStorage.getItem("cc-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}


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
  var due=nextMondayKey();for(var title of vals)await save("tasks",{id:uid("t"),title:title,description:"",status:"next",priority:"high",projectId:"",dueDate:due,dueTime:"",repeat:"none",repeatInterval:1,repeatUntil:"",subtasks:[],createdAt:new Date().toISOString(),completedAt:null,archivedAt:null,deletedAt:null});
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
  $("templateHeading").textContent=existing?"Edit template":"New template";$("deleteTemplate").classList.toggle("hidden",!existing);$("templateModal").showModal()
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
  if(!$("onboardingModal").open)$("onboardingModal").showModal();
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
function render(){nav();renderTasks();renderToday();renderCalendar();renderBoard();renderProjects();renderNotes();renderHabits();renderWeeklyReview();renderTemplates();renderArchive();renderAnalytics();renderFocus();theme()}

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
  if(b.dataset.search){var z=b.dataset.search.split(":");$("searchBox").classList.add("hidden");$("search").value="";if(z[0]==="task")openTask(state.tasks.find(function(x){return x.id===z[1]}));else if(z[0]==="note")openSimple("note",state.notes.find(function(x){return x.id===z[1]}));else{state.view=z[0];nav()}}
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
  if(b.dataset.purgeTask&&confirm("Delete this task forever? This cannot be undone.")){await del("tasks",b.dataset.purgeTask);await load();toast("Permanently deleted")}
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
$("addTask").onclick=function(){openQuick()};
$("quickHelp").onclick=function(){openQuick()};
$("captureForm").onsubmit=quickCapture;
$("quickInput").oninput=quickPreview;
$("quickForm").onsubmit=async function(e){e.preventDefault();var v=$("quickInput").value.trim();if(!v)return;await createQuick(v);$("quickModal").close()};
$("taskForm").onsubmit=saveTask;
$("addSubtask").onclick=function(){var v=$("newSubtask").value.trim();if(!v)return;editingSubtasks.push({id:uid("s"),title:v,done:false});$("newSubtask").value="";renderSubtasks()};
$("newSubtask").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();$("addSubtask").click()}});
$("simpleForm").onsubmit=saveSimple;
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
$("reset").onclick=async function(){if(!confirm("Reset all local data? Export a backup first if you want to keep it."))return;for(var s of STORES)await clear(s);localStorage.removeItem("cc-focus");loadFocus();await load();toast("Workspace reset")};
$("replayTour").onclick=function(){openOnboarding(true)};
$("runDiagnostics").onclick=runDiagnostics;
$("onboardingSkip").onclick=finishOnboarding;
$("onboardingBack").onclick=function(){if(onboardingStep>0){onboardingStep--;renderOnboarding()}};
$("onboardingNext").onclick=function(){if(onboardingStep<onboardingSlides.length-1){onboardingStep++;renderOnboarding()}else finishOnboarding()};

document.addEventListener("keydown",function(e){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("search").focus()}if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();openQuick()}if(e.key.toLowerCase()==="q"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)){openQuick()}});

var deferredInstall=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredInstall=e;var b=$("installApp");if(b){b.disabled=false;b.textContent="Install Command Center"}});
window.addEventListener("appinstalled",function(){deferredInstall=null;var b=$("installApp");if(b){b.textContent="Installed";b.disabled=true}toast("Command Center installed")});
function installState(){var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);var b=$("installApp"),hint=$("iosInstall"),copy=$("installCopy");if(!b)return;if(standalone){b.textContent="Installed";b.disabled=true;if(copy)copy.textContent="You are running Command Center as an installed web app."}else if(ios){b.textContent="How to install on iPhone";if(hint)hint.classList.remove("hidden")}}
$("installApp").onclick=async function(){if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;return}if(/iphone|ipad|ipod/i.test(navigator.userAgent)){var h=$("iosInstall");if(h)h.classList.remove("hidden");toast("Safari → Share → Add to Home Screen");return}toast("Use your browser menu → Install app / Add to Home Screen")};

loadFocus();
var params=new URLSearchParams(location.search);if(params.get("view"))state.view=params.get("view");if(params.get("quick")==="1")setTimeout(function(){openQuick()},300);
theme();installState();load().then(function(){
  if(state.focus.running){clearInterval(focusTimer);focusTimer=setInterval(tickFocus,1000)}
  if(params.get("quick")!=="1")setTimeout(function(){openOnboarding(false)},250);
}).catch(function(e){console.error(e);document.body.innerHTML="<main style='padding:40px;font-family:system-ui'><h1>Command Center could not start.</h1><p>Refresh the page. Your local data was not intentionally deleted.</p></main>"});
if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(function(){});
