var DB="command-center-v2",VER=1,STORES=["tasks","projects","notes","habits","activity"];
var state={tasks:[],projects:[],notes:[],habits:[],activity:[],filter:"open",projectFilter:"",view:localStorage.getItem("cc-view")||"today",calendarCursor:new Date(),focusPreset:25,focus:null};
var editingSubtasks=[];
var focusTimer=null;
var $=function(id){return document.getElementById(id)}, $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var defaults={projects:[{id:"p1",name:"Launch Command Center",area:"Personal",createdAt:new Date().toISOString()},{id:"p2",name:"Win the Week",area:"Work",createdAt:new Date().toISOString()}],tasks:[{id:"t1",title:"Pick your top 3 priorities",description:"Use Today for what actually matters.",status:"next",priority:"high",projectId:"p2",dueDate:"",dueTime:"",repeat:"none",subtasks:[],createdAt:new Date().toISOString(),completedAt:null},{id:"t2",title:"Export your first backup",description:"Settings → Export JSON keeps a portable copy.",status:"inbox",priority:"medium",projectId:"p1",dueDate:"",dueTime:"",repeat:"none",subtasks:[],createdAt:new Date().toISOString(),completedAt:null}],notes:[{id:"n1",title:"How I want to use this",body:"Capture fast. Organize later. Keep Today small.",pinned:true,updatedAt:new Date().toISOString()}],habits:[{id:"h1",name:"Plan tomorrow",history:[],createdAt:new Date().toISOString()}]};

function uid(p){return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)}
function openDB(){return new Promise(function(res,rej){var r=indexedDB.open(DB,VER);r.onupgradeneeded=function(){STORES.forEach(function(s){if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:"id"})})};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function all(store){return openDB().then(function(db){return new Promise(function(res,rej){var r=db.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=function(){db.close();res(r.result)};r.onerror=function(){db.close();rej(r.error)}})})}
function save(store,val){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction(store,"readwrite");tx.objectStore(store).put(val);tx.oncomplete=function(){db.close();res()};tx.onerror=function(){db.close();rej(tx.error)}})})}
function del(store,id){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction(store,"readwrite");tx.objectStore(store).delete(id);tx.oncomplete=function(){db.close();res()};tx.onerror=function(){db.close();rej(tx.error)}})})}
function clear(store){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction(store,"readwrite");tx.objectStore(store).clear();tx.oncomplete=function(){db.close();res()};tx.onerror=function(){db.close();rej(tx.error)}})})}
async function seed(){var count=0;for(var s of ["tasks","projects","notes","habits"])count+=(await all(s)).length;if(count)return;for(var k of ["projects","tasks","notes","habits"])for(var x of defaults[k])await save(k,x)}
async function load(){await seed();state.tasks=(await all("tasks")).map(normalizeTask);state.projects=await all("projects");state.notes=await all("notes");state.habits=await all("habits");state.activity=await all("activity");render()}
function normalizeTask(t){return Object.assign({description:"",status:"inbox",priority:"medium",projectId:"",dueDate:"",dueTime:"",repeat:"none",subtasks:[],createdAt:new Date().toISOString(),completedAt:null},t,{subtasks:Array.isArray(t.subtasks)?t.subtasks:[]})}
function esc(v){return String(v||"").replace(/[&<>'"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]})}
function today(){var d=new Date();return dateKey(d)}
function dateKey(d){var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day}
function pname(id){var p=state.projects.find(function(x){return x.id===id});return p?p.name:""}
function overdue(t){return t.dueDate&&t.status!=="done"&&t.dueDate<today()}
function fmt(d,time){if(!d)return"";var text=new Date(d+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});if(time){var x=new Date("2000-01-01T"+time);text+=" · "+x.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}return text}
function toast(m){var e=$("toast");e.textContent=m;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove("show")},1900)}
async function log(type,label,extra){await save("activity",Object.assign({id:uid("a"),type:type,label:label,createdAt:new Date().toISOString()},extra||{}))}
function subtaskStats(t){var a=t.subtasks||[],done=a.filter(function(x){return x.done}).length;return {done:done,total:a.length}}
function taskScore(t){var p={high:0,medium:1,low:2};return (t.status==="done"?100:0)+(p[t.priority]||0)}

function nav(){
  $$(".nav,.bottom button").forEach(function(b){b.classList.toggle("active",b.dataset.view===state.view)});
  $$(".view").forEach(function(v){v.classList.toggle("active",v.id===state.view)});
  var v=$(state.view);
  if(v){$("title").textContent={today:"Today",tasks:"Tasks",planner:"Planner",board:"Board",focus:"Focus",projects:"Projects",notes:"Notes",habits:"Habits",analytics:"Analytics",settings:"Settings"}[v.id]||v.id;$("eyebrow").textContent={today:"YOUR DAY",tasks:"EXECUTION",planner:"CALENDAR",board:"FLOW",focus:"DEEP WORK",projects:"OUTCOMES",notes:"THINKING SPACE",habits:"CONSISTENCY",analytics:"PATTERNS",settings:"YOUR WORKSPACE"}[v.id]||""}
  localStorage.setItem("cc-view",state.view);
  $("sidebar").classList.remove("open");
}

function taskHTML(t){
  var p=pname(t.projectId),st=subtaskStats(t),sub=st.total?'<span class="pill">'+st.done+'/'+st.total+' checklist</span>':"";
  return '<div class="task '+(t.status==="done"?"done":"")+'"><button class="checkbtn" data-toggle="'+t.id+'">'+(t.status==="done"?"✓":"")+'</button><div class="taskmain" data-edit-task="'+t.id+'"><div class="tasktitle">'+esc(t.title)+'</div><div class="meta"><span class="pill '+t.priority+'">'+esc(t.priority)+'</span><span class="pill">'+esc(t.status)+'</span>'+(p?'<span class="pill">'+esc(p)+'</span>':"")+(t.dueDate?'<span class="pill '+(overdue(t)?"high":"")+'">'+(overdue(t)?"Overdue · ":"")+fmt(t.dueDate,t.dueTime)+'</span>':"")+(t.repeat!=="none"?'<span class="pill">↻ '+esc(t.repeat)+'</span>':"")+sub+'</div></div><button class="dots" data-edit-task="'+t.id+'">•••</button></div>'
}
function renderTasks(){
  var open=state.tasks.filter(function(t){return t.status!=="done"}).length;$("openCount").textContent=open;
  $("taskProject").innerHTML='<option value="">No project</option>'+state.projects.map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");
  var a=state.tasks.slice().sort(function(a,b){return taskScore(a)-taskScore(b)});
  if(state.filter==="open")a=a.filter(function(t){return t.status!=="done"});else if(state.filter!=="all")a=a.filter(function(t){return t.status===state.filter});
  if(state.projectFilter)a=a.filter(function(t){return t.projectId===state.projectFilter});
  $("taskList").innerHTML=a.length?a.map(taskHTML).join(""):'<div class="empty">Nothing here.</div>';
}
function streak(h){var s=new Set(h||[]),d=new Date(),n=0;if(!s.has(today()))d.setDate(d.getDate()-1);while(s.has(dateKey(d))){n++;d.setDate(d.getDate()-1)}return n}
function habitHTML(h){var on=(h.history||[]).indexOf(today())>=0;return'<div class="habit '+(on?"checked":"")+'"><button data-toggle-habit="'+h.id+'">'+(on?"✓":"○")+'</button><div><b>'+esc(h.name)+'</b><small>'+streak(h.history)+' day streak · '+(h.history||[]).length+' check-ins</small></div><button data-delete-habit="'+h.id+'">Delete</button></div>'}
function renderToday(){
  var now=new Date(),hr=now.getHours();$("todayDate").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});$("greeting").textContent=hr<12?"Good morning.":hr<18?"Good afternoon.":"Good evening.";
  var open=state.tasks.filter(function(t){return t.status!=="done"}),focus=open.filter(function(t){return t.priority==="high"||t.status==="doing"||t.dueDate===today()||overdue(t)}).slice(0,6);
  $("todayTasks").innerHTML=focus.length?focus.map(taskHTML).join(""):'<div class="empty">No urgent work. Pull something from Tasks.</div>';
  $("sToday").textContent=focus.length;$("sOverdue").textContent=open.filter(overdue).length;
  var week=new Date();week.setDate(week.getDate()-7);$("sWeek").textContent=state.tasks.filter(function(t){return t.completedAt&&new Date(t.completedAt)>=week}).length;$("sProjects").textContent=state.projects.length;
  $("todayHabits").innerHTML=state.habits.length?state.habits.slice(0,5).map(habitHTML).join(""):'<div class="empty">Add a habit.</div>';
  $("todayProjects").innerHTML=state.projects.slice(0,5).map(function(p){var a=state.tasks.filter(function(t){return t.projectId===p.id}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0;return'<div class="mini"><b>'+esc(p.name)+'</b><small>'+d+'/'+a.length+' tasks complete</small><div class="progress"><i style="width:'+pc+'%"></i></div></div>'}).join("")||'<div class="empty">No projects yet.</div>';
}
function renderProjects(){$("projectGrid").innerHTML=state.projects.map(function(p){var a=state.tasks.filter(function(t){return t.projectId===p.id}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0;return'<article class="card"><small class="caps">'+esc(p.area||"PROJECT")+'</small><h3>'+esc(p.name)+'</h3><p>'+a.length+' tasks · '+pc+'% complete</p><footer><div class="progress"><i style="width:'+pc+'%"></i></div><div class="row"><button data-focus-project="'+p.id+'" class="link">View tasks</button><button data-delete-project="'+p.id+'">Delete</button></div></footer></article>'}).join("")||'<div class="empty">Create a project for an outcome that takes more than one task.</div>'}
function renderNotes(){$("noteGrid").innerHTML=state.notes.slice().sort(function(a,b){return Number(b.pinned)-Number(a.pinned)}).map(function(n){return'<article class="card note" data-edit-note="'+n.id+'"><small class="caps">'+(n.pinned?"PINNED NOTE":"NOTE")+'</small><h3>'+esc(n.title)+'</h3><p>'+esc(n.body||"Empty note")+'</p><small>'+new Date(n.updatedAt).toLocaleDateString()+'</small></article>'}).join("")||'<div class="empty">Your thinking space is empty.</div>'}
function renderHabits(){$("habitList").innerHTML=state.habits.map(habitHTML).join("")||'<div class="empty">Start with one tiny habit.</div>'}

function renderCalendar(){
  var cur=state.calendarCursor,y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
  $("calendarTitle").textContent=first.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  var html="";
  for(var i=0;i<42;i++){var d=new Date(start);d.setDate(start.getDate()+i);var key=dateKey(d),items=state.tasks.filter(function(t){return t.dueDate===key}),muted=d.getMonth()!==m;
    html+='<div class="cal-day '+(muted?"outside ":"")+(key===today()?"today ":"")+'"><div class="cal-date"><b>'+d.getDate()+'</b><button data-date-add="'+key+'" aria-label="Add task on '+key+'">＋</button></div><div class="cal-tasks">'+items.slice(0,4).map(function(t){return'<button class="cal-task '+t.priority+'" data-edit-task="'+t.id+'">'+(t.dueTime?'<span>'+esc(t.dueTime)+'</span> ':"")+esc(t.title)+'</button>'}).join("")+(items.length>4?'<small>+'+(items.length-4)+' more</small>':"")+'</div></div>';
  }
  $("calendarGrid").innerHTML=html;
  var uns=state.tasks.filter(function(t){return t.status!=="done"&&!t.dueDate}).slice(0,10);
  $("unscheduledTasks").innerHTML=uns.length?uns.map(taskHTML).join(""):'<div class="empty">Everything open has a date.</div>';
}
function boardCard(t){var st=subtaskStats(t);return'<article class="kanban-card" draggable="true" data-drag-task="'+t.id+'" data-edit-task="'+t.id+'"><div class="kanban-card-top"><span class="pill '+t.priority+'">'+esc(t.priority)+'</span>'+(t.dueDate?'<span class="pill '+(overdue(t)?"high":"")+'">'+fmt(t.dueDate,t.dueTime)+'</span>':"")+'</div><b>'+esc(t.title)+'</b>'+(pname(t.projectId)?'<small>'+esc(pname(t.projectId))+'</small>':"")+(st.total?'<div class="progress"><i style="width:'+Math.round(st.done/st.total*100)+'%"></i></div>':"")+'</article>'}
function renderBoard(){
  ["inbox","next","doing","done"].forEach(function(s){var a=state.tasks.filter(function(t){return t.status===s});$("count"+s.charAt(0).toUpperCase()+s.slice(1)).textContent=a.length;$("board"+s.charAt(0).toUpperCase()+s.slice(1)).innerHTML=a.map(boardCard).join("")||'<div class="kanban-empty">Drop tasks here</div>'});
}
function bars(id,arr,total){$(id).innerHTML=arr.map(function(x){var pc=total?Math.round(x[1]/total*100):0;return'<div class="bar"><div class="barhead"><span>'+x[0]+'</span><b>'+x[1]+'</b></div><div class="progress"><i style="width:'+pc+'%"></i></div></div>'}).join("")}
function renderAnalytics(){
  var total=state.tasks.length,done=state.tasks.filter(function(t){return t.status==="done"}).length;
  $("aRate").textContent=total?Math.round(done/total*100)+"%":"0%";$("aDone").textContent=done;$("aOpen").textContent=total-done;$("aHabits").textContent=state.habits.reduce(function(s,h){return s+(h.history||[]).length},0);
  $("aFocus").textContent=state.activity.filter(function(a){return a.type==="focus.completed"}).reduce(function(s,a){return s+(Number(a.minutes)||0)},0);
  bars("priorityBars",[["high",state.tasks.filter(function(t){return t.priority==="high"}).length],["medium",state.tasks.filter(function(t){return t.priority==="medium"}).length],["low",state.tasks.filter(function(t){return t.priority==="low"}).length]],total);
  bars("statusBars",[["inbox",state.tasks.filter(function(t){return t.status==="inbox"}).length],["next",state.tasks.filter(function(t){return t.status==="next"}).length],["doing",state.tasks.filter(function(t){return t.status==="doing"}).length],["done",done]],total);
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
  if(/\b(daily|every day)\b/i.test(work)){repeat="daily";work=work.replace(/\b(daily|every day)\b/i," ")}else if(/\b(weekly|every week)\b/i.test(work)){repeat="weekly";work=work.replace(/\b(weekly|every week)\b/i," ")}
  var tm=work.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);if(tm){var h=parseInt(tm[1],10),min=tm[2]||"00",ap=tm[3].toLowerCase();if(ap==="pm"&&h<12)h+=12;if(ap==="am"&&h===12)h=0;dueTime=String(h).padStart(2,"0")+":"+min;work=work.replace(tm[0]," ")}
  var dp=parseDatePhrase(work);if(dp.phrase)work=work.replace(new RegExp("\\b"+dp.phrase.replace(" ","\\s+")+"\\b","i")," ");
  var tags=work.match(/#[a-z0-9_-]+/ig)||[];if(tags.length){var tag=tags[0].slice(1).toLowerCase().replace(/[-_]/g,"");var p=state.projects.find(function(x){var n=(x.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),a=(x.area||"").toLowerCase().replace(/[^a-z0-9]/g,"");return n===tag||n.startsWith(tag)||a===tag});if(p)projectId=p.id;work=work.replace(tags[0]," ")}
  work=work.replace(/\s+/g," ").trim();
  return {title:work||raw,description:"",status:"inbox",priority:priority,projectId:projectId,dueDate:dp.date,dueTime:dueTime,repeat:repeat,subtasks:[],createdAt:new Date().toISOString(),completedAt:null};
}
function quickPreview(){
  var q=parseQuick($("quickInput").value||""),p=pname(q.projectId);$("quickPreview").innerHTML=q.title?'<b>'+esc(q.title)+'</b><div class="meta"><span class="pill '+q.priority+'">'+q.priority+'</span>'+(q.dueDate?'<span class="pill">'+fmt(q.dueDate,q.dueTime)+'</span>':"")+(p?'<span class="pill">'+esc(p)+'</span>':"")+(q.repeat!=="none"?'<span class="pill">↻ '+q.repeat+'</span>':"")+'</div>':'<span class="hint">Your parsed task will appear here.</span>';
}
function openQuick(seed){$("quickForm").reset();$("quickInput").value=seed||"";quickPreview();$("quickModal").showModal();setTimeout(function(){$("quickInput").focus()},30)}
async function createQuick(text){var q=parseQuick(text);if(!q.title)return; q.id=uid("t");await save("tasks",q);await log("task.created",q.title,{source:"quick-add"});await load();toast("Captured"+(q.dueDate?" for "+fmt(q.dueDate,q.dueTime):" to Inbox"))}

function renderSubtasks(){
  var done=editingSubtasks.filter(function(s){return s.done}).length;$("subtaskProgress").textContent=done+"/"+editingSubtasks.length;
  $("subtaskList").innerHTML=editingSubtasks.map(function(s){return'<div class="subtask '+(s.done?"done":"")+'"><button type="button" data-subtask-toggle="'+s.id+'">'+(s.done?"✓":"○")+'</button><span>'+esc(s.title)+'</span><button type="button" class="subtask-delete" data-subtask-delete="'+s.id+'">×</button></div>'}).join("")||'<div class="empty small-empty">No checklist items yet.</div>';
}
function openTask(t,prefillDate){
  $("taskForm").reset();editingSubtasks=t?(t.subtasks||[]).map(function(s){return Object.assign({},s)}):[];
  $("taskId").value=t?t.id:"";$("taskTitle").value=t?t.title:"";$("taskDescription").value=t?t.description||"":"";
  $("taskStatus").value=t?t.status:"inbox";$("taskPriority").value=t?t.priority:"medium";$("taskProject").value=t?t.projectId||"":"";
  $("taskDue").value=t?t.dueDate||"":(prefillDate||"");$("taskTime").value=t?t.dueTime||"":"";
  $("taskRepeat").value=t?t.repeat||"none":"none";$("taskHeading").textContent=t?"Edit task":"New task";$("deleteTask").classList.toggle("hidden",!t);renderSubtasks();$("taskModal").showModal()
}
async function saveTask(e){
  e.preventDefault();var old=state.tasks.find(function(t){return t.id===$("taskId").value}),status=$("taskStatus").value;
  var t={id:old?old.id:uid("t"),title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),status:status,priority:$("taskPriority").value,projectId:$("taskProject").value,dueDate:$("taskDue").value,dueTime:$("taskTime").value,repeat:$("taskRepeat").value,subtasks:editingSubtasks,createdAt:old?old.createdAt:new Date().toISOString(),completedAt:status==="done"?(old&&old.completedAt?old.completedAt:new Date().toISOString()):null};
  if(!t.title)return;await save("tasks",t);await log(old?"task.updated":"task.created",t.title);$("taskModal").close();await load();toast(old?"Task updated":"Task created")
}
async function toggleTask(id){
  var t=state.tasks.find(function(x){return x.id===id});if(!t)return;var was=t.status==="done";t.status=was?"next":"done";t.completedAt=was?null:new Date().toISOString();await save("tasks",t);
  if(!was&&t.repeat!=="none"){var d=new Date(t.dueDate?t.dueDate+"T12:00:00":Date.now());d.setDate(d.getDate()+(t.repeat==="weekly"?7:1));await save("tasks",Object.assign({},t,{id:uid("t"),status:"next",completedAt:null,dueDate:dateKey(d),createdAt:new Date().toISOString(),subtasks:(t.subtasks||[]).map(function(s){return{id:uid("s"),title:s.title,done:false}})}))}
  await load()
}
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
  var open=state.tasks.filter(function(t){return t.status!=="done"});$("focusTask").innerHTML='<option value="">Choose a task</option>'+open.map(function(t){return'<option value="'+t.id+'">'+esc(t.title)+'</option>'}).join("");
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

async function exportAll(){var data={version:3,exportedAt:new Date().toISOString()};for(var s of STORES)data[s]=await all(s);var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="command-center-"+today()+".json";a.click();URL.revokeObjectURL(url)}
async function importAll(file){if(!file)return;try{var data=JSON.parse(await file.text());if(!confirm("Replace all local data with this backup?"))return;for(var s of STORES){await clear(s);for(var x of data[s]||[])await save(s,x)}await load();toast("Backup restored")}catch(e){alert("Could not import that JSON backup.")}}
function search(q){var box=$("searchBox");q=q.trim().toLowerCase();if(!q){box.classList.add("hidden");return}var r=[];state.tasks.filter(function(x){return(x.title+" "+x.description+" "+(x.subtasks||[]).map(function(s){return s.title}).join(" ")).toLowerCase().includes(q)}).forEach(function(x){r.push(["task",x.id,x.title,x.status])});state.projects.filter(function(x){return(x.name+" "+x.area).toLowerCase().includes(q)}).forEach(function(x){r.push(["projects","",x.name,x.area||"Project"])});state.notes.filter(function(x){return(x.title+" "+x.body).toLowerCase().includes(q)}).forEach(function(x){r.push(["note",x.id,x.title,"Note"])});box.innerHTML=r.slice(0,10).map(function(x){return'<div class="searchitem" data-search="'+x[0]+':'+x[1]+'"><b>'+esc(x[2])+'</b><small>'+esc(x[3])+'</small></div>'}).join("")||'<div class="empty">No matches.</div>';box.classList.remove("hidden")}
function theme(){var t=localStorage.getItem("cc-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}
function render(){nav();renderTasks();renderToday();renderCalendar();renderBoard();renderProjects();renderNotes();renderHabits();renderAnalytics();renderFocus();theme()}

document.addEventListener("click",async function(e){
  var b=e.target.closest("button,[data-edit-note],[data-search],[data-edit-task]");if(!b)return;
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
});
document.addEventListener("dragstart",function(e){var card=e.target.closest("[data-drag-task]");if(card)e.dataTransfer.setData("text/plain",card.dataset.dragTask)});
$$(".kanban-col").forEach(function(col){col.addEventListener("dragover",function(e){e.preventDefault();col.classList.add("dragover")});col.addEventListener("dragleave",function(){col.classList.remove("dragover")});col.addEventListener("drop",async function(e){e.preventDefault();col.classList.remove("dragover");var id=e.dataTransfer.getData("text/plain"),t=state.tasks.find(function(x){return x.id===id});if(!t)return;t.status=col.dataset.dropStatus;t.completedAt=t.status==="done"?new Date().toISOString():null;await save("tasks",t);await load();toast("Moved to "+t.status)})});

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
$("deleteTask").onclick=async function(){var id=$("taskId").value;if(id&&confirm("Delete this task?")){await del("tasks",id);$("taskModal").close();await load()}};
$("deleteSimple").onclick=async function(){var k=$("simpleKind").value,id=$("simpleId").value;if(id&&confirm("Delete this "+k+"?")){await del(k==="note"?"notes":k+"s",id);$("simpleModal").close();await load()}};
$("search").oninput=function(e){search(e.target.value)};
$("calPrev").onclick=function(){state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()-1,1);renderCalendar()};
$("calNext").onclick=function(){state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()+1,1);renderCalendar()};
$("calToday").onclick=function(){state.calendarCursor=new Date();renderCalendar()};
$("focusStart").onclick=startFocus;$("focusPause").onclick=pauseFocus;$("focusReset").onclick=resetFocus;
$("focusTask").onchange=function(){state.focus.taskId=this.value;persistFocus();renderFocus()};
$("focusComplete").onclick=async function(){var t=state.tasks.find(function(x){return x.id===$("focusTask").value});if(!t){toast("Choose a task first");return}t.status="done";t.completedAt=new Date().toISOString();await save("tasks",t);pauseFocus();await load();toast("Task completed")};
$("light").onclick=function(){localStorage.setItem("cc-theme","light");theme()};$("dark").onclick=function(){localStorage.setItem("cc-theme","dark");theme()};
$("export").onclick=exportAll;$("import").onchange=function(e){importAll(e.target.files[0]);e.target.value=""};
$("reset").onclick=async function(){if(!confirm("Reset all local data? Export a backup first if you want to keep it."))return;for(var s of STORES)await clear(s);localStorage.removeItem("cc-focus");loadFocus();await load();toast("Workspace reset")};

document.addEventListener("keydown",function(e){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("search").focus()}if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();openQuick()}if(e.key.toLowerCase()==="q"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)){openQuick()}});

var deferredInstall=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredInstall=e;var b=$("installApp");if(b){b.disabled=false;b.textContent="Install Command Center"}});
window.addEventListener("appinstalled",function(){deferredInstall=null;var b=$("installApp");if(b){b.textContent="Installed";b.disabled=true}toast("Command Center installed")});
function installState(){var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);var b=$("installApp"),hint=$("iosInstall"),copy=$("installCopy");if(!b)return;if(standalone){b.textContent="Installed";b.disabled=true;if(copy)copy.textContent="You are running Command Center as an installed web app."}else if(ios){b.textContent="How to install on iPhone";if(hint)hint.classList.remove("hidden")}}
$("installApp").onclick=async function(){if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;return}if(/iphone|ipad|ipod/i.test(navigator.userAgent)){var h=$("iosInstall");if(h)h.classList.remove("hidden");toast("Safari → Share → Add to Home Screen");return}toast("Use your browser menu → Install app / Add to Home Screen")};

loadFocus();
var params=new URLSearchParams(location.search);if(params.get("view"))state.view=params.get("view");if(params.get("quick")==="1")setTimeout(function(){openQuick()},300);
theme();installState();load().then(function(){if(state.focus.running){clearInterval(focusTimer);focusTimer=setInterval(tickFocus,1000)}}).catch(function(e){console.error(e);document.body.innerHTML="<main style='padding:40px;font-family:system-ui'><h1>Command Center could not start.</h1><p>Refresh the page. Your local data was not intentionally deleted.</p></main>"});
if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(function(){});
