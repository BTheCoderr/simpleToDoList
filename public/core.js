export function normalizeTask(task){
  return Object.assign({
    description:"",
    status:"inbox",
    priority:"medium",
    projectId:"",
    dueDate:"",
    dueTime:"",
    repeat:"none",
    repeatInterval:1,
    repeatUntil:"",
    repeatWeekdays:[],
    tags:[],
    subtasks:[],
    createdAt:new Date().toISOString(),
    completedAt:null,
    archivedAt:null,
    deletedAt:null
  },task,{subtasks:Array.isArray(task.subtasks)?task.subtasks:[],tags:Array.isArray(task.tags)?task.tags.filter(Boolean).map(tag=>String(tag).toLowerCase()):[],repeatWeekdays:Array.isArray(task.repeatWeekdays)?Array.from(new Set(task.repeatWeekdays.map(Number).filter(day=>day>=0&&day<=6))).sort((a,b)=>a-b):[]});
}

export function dateKey(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+d;
}

export function today(){
  return dateKey(new Date());
}

export function addDays(date,count){
  const next=new Date(date);
  next.setDate(next.getDate()+count);
  return next;
}

export function addMonthsClamped(date,count){
  const next=new Date(date);
  const day=next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth()+count);
  const last=new Date(next.getFullYear(),next.getMonth()+1,0).getDate();
  next.setDate(Math.min(day,last));
  return next;
}

export function nextWeekday(date){
  let next=addDays(date,1);
  while(next.getDay()===0||next.getDay()===6)next=addDays(next,1);
  return next;
}

export function nextOccurrence(task,now=new Date()){
  if(!task.repeat||task.repeat==="none")return "";
  const base=task.repeat==="after_completion"
    ? new Date(now)
    : new Date((task.dueDate||dateKey(now))+"T12:00:00");
  const interval=Math.max(1,Number(task.repeatInterval)||1);
  let next;
  if(task.repeat==="daily")next=addDays(base,1);
  else if(task.repeat==="weekdays")next=nextWeekday(base);
  else if(task.repeat==="weekly")next=addDays(base,7);
  else if(task.repeat==="custom_weeks")next=addDays(base,7*interval);
  else if(task.repeat==="selected_weekdays"){
    const allowed=new Set((task.repeatWeekdays||[]).map(Number));
    if(!allowed.size)return "";
    next=addDays(base,1);
    for(let i=0;i<7&&!allowed.has(next.getDay());i++)next=addDays(next,1);
  }
  else if(task.repeat==="monthly")next=addMonthsClamped(base,1);
  else if(task.repeat==="custom_days"||task.repeat==="after_completion")next=addDays(base,interval);
  else return "";
  const key=dateKey(next);
  return task.repeatUntil&&key>task.repeatUntil?"":key;
}

export function parseDatePhrase(text,now=new Date()){
  const lower=text.toLowerCase();
  const date=new Date(now);
  let found="";
  if(/\btoday\b/.test(lower))found="today";
  else if(/\btomorrow\b/.test(lower)){date.setDate(date.getDate()+1);found="tomorrow"}
  else if(/\bnext week\b/.test(lower)){date.setDate(date.getDate()+7);found="next week"}
  else{
    const days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const hit=days.find(day=>new RegExp("\\b(next\\s+)?"+day+"\\b","i").test(text));
    if(hit){
      const target=days.indexOf(hit);
      let delta=(target-date.getDay()+7)%7;
      if(delta===0)delta=7;
      const hasNext=new RegExp("\\bnext\\s+"+hit+"\\b","i").test(text);
      if(hasNext&&delta<7)delta+=7;
      date.setDate(date.getDate()+delta);
      found=(hasNext?"next ":"")+hit;
    }
  }
  const iso=text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if(iso)return {date:iso[1],phrase:iso[1]};
  return found?{date:dateKey(date),phrase:found}:{date:"",phrase:""};
}

export function parseWeekdayList(value){
  const map={sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
  return Array.from(new Set(String(value||"").toLowerCase().split(/[\s,\/&]+/).map(x=>map[x]).filter(x=>Number.isInteger(x)))).sort((a,b)=>a-b);
}

export function parseQuick(text,projects=[],now=new Date()){
  const raw=text.trim();
  let work=raw;
  let priority="medium";
  let repeat="none";
  let repeatInterval=1;
  let repeatWeekdays=[];
  let projectId="";
  let dueTime="";

  const priorityMatch=work.match(/!(high|medium|low)\b/i);
  if(priorityMatch){priority=priorityMatch[1].toLowerCase();work=work.replace(priorityMatch[0]," ")}

  const weekdayNames="(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)";
  const everyWeekdays=work.match(new RegExp("\\bevery\\s+("+weekdayNames+"(?:\\s*(?:,|/|&|and)\\s*"+weekdayNames+")*)\\b","i"));
  const everyWeeks=work.match(/\bevery\s+(\d+)\s+weeks?\b/i);
  const everyDays=work.match(/\bevery\s+(\d+)\s+days?\b/i);
  if(everyWeekdays){
    repeatWeekdays=parseWeekdayList(everyWeekdays[1]);
    repeat=repeatWeekdays.length?"selected_weekdays":"none";
    work=work.replace(everyWeekdays[0]," ");
  }else if(everyWeeks){
    repeat="custom_weeks";
    repeatInterval=Math.max(1,Number(everyWeeks[1])||1);
    work=work.replace(everyWeeks[0]," ");
  }else if(everyDays){
    repeat="custom_days";
    repeatInterval=Math.max(1,Number(everyDays[1])||1);
    work=work.replace(everyDays[0]," ");
  }else if(/\b(daily|every day)\b/i.test(work)){repeat="daily";work=work.replace(/\b(daily|every day)\b/i," ")}
  else if(/\b(weekdays|every weekday)\b/i.test(work)){repeat="weekdays";work=work.replace(/\b(weekdays|every weekday)\b/i," ")}
  else if(/\b(weekly|every week)\b/i.test(work)){repeat="weekly";work=work.replace(/\b(weekly|every week)\b/i," ")}
  else if(/\b(monthly|every month)\b/i.test(work)){repeat="monthly";work=work.replace(/\b(monthly|every month)\b/i," ")}

  const timeMatch=work.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if(timeMatch){
    let hour=parseInt(timeMatch[1],10);
    const minute=timeMatch[2]||"00";
    const meridiem=timeMatch[3].toLowerCase();
    if(meridiem==="pm"&&hour<12)hour+=12;
    if(meridiem==="am"&&hour===12)hour=0;
    dueTime=String(hour).padStart(2,"0")+":"+minute;
    work=work.replace(timeMatch[0]," ");
  }

  const datePhrase=parseDatePhrase(work,now);
  if(datePhrase.phrase){
    work=work.replace(new RegExp("\\b"+datePhrase.phrase.replace(" ","\\s+")+"\\b","i")," ");
  }

  const hashtags=work.match(/#[a-z0-9_-]+/ig)||[];
  const taskTags=[];
  hashtags.forEach(rawTag=>{
    const clean=rawTag.slice(1).toLowerCase();
    const normalized=clean.replace(/[-_]/g,"");
    const project=!projectId&&projects.find(item=>{
      const name=(item.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
      const area=(item.area||"").toLowerCase().replace(/[^a-z0-9]/g,"");
      return name===normalized||name.startsWith(normalized)||area===normalized;
    });
    if(project)projectId=project.id;
    else if(!taskTags.includes(clean))taskTags.push(clean);
    work=work.replace(rawTag," ");
  });

  work=work.replace(/\s+/g," ").trim();
  return {
    title:work||raw,
    description:"",
    status:"inbox",
    priority,
    projectId,
    dueDate:datePhrase.date,
    dueTime,
    repeat,
    repeatInterval,
    repeatUntil:"",
    repeatWeekdays,
    tags:taskTags,
    subtasks:[],
    createdAt:new Date(now).toISOString(),
    completedAt:null,
    archivedAt:null,
    deletedAt:null
  };
}

export function goalProgress(goal,projects,activeTasks){
  const linked=projects.filter(project=>project.goalId===goal.id);
  const ids=new Set(linked.map(project=>project.id));
  const tasks=activeTasks.filter(task=>ids.has(task.projectId));
  const done=tasks.filter(task=>task.status==="done").length;
  return {
    projects:linked.length,
    tasks:tasks.length,
    done,
    percent:tasks.length?Math.round(done/tasks.length*100):(goal.status==="done"?100:0)
  };
}
