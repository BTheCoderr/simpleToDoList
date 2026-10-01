function csvCell(value){
  const raw=String(value??"");
  const text=/^[=+\-@]/.test(raw)?"'"+raw:raw;
  return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;
}
export function tasksToCsv(tasks,projects){
  const projectMap=new Map((projects||[]).map(p=>[p.id,p.name]));
  const headers=["title","status","priority","project","tags","dueDate","dueTime","repeat","completedAt","archivedAt","deletedAt","description"];
  const rows=(tasks||[]).map(t=>[
    t.title,t.status,t.priority,projectMap.get(t.projectId)||"", (t.tags||[]).join(" "),
    t.dueDate||"",t.dueTime||"",t.repeat||"none",t.completedAt||"",t.archivedAt||"",t.deletedAt||"",t.description||""
  ]);
  return [headers,...rows].map(row=>row.map(csvCell).join(",")).join("\n");
}
function line(value){return String(value||"").replace(/\r?\n/g," ").trim()}
export function workspaceToMarkdown(data){
  const goals=data.goals||[],projects=data.projects||[],tasks=data.tasks||[],notes=data.notes||[],habits=data.habits||[];
  const out=["# Command Center Workspace","","> Exported "+new Date().toISOString(),""];

  out.push("## Goals","");
  if(!goals.length)out.push("_No goals._","");
  for(const goal of goals){
    out.push("### "+line(goal.name),goal.why?line(goal.why):"",goal.targetDate?"Target: "+goal.targetDate:"","Status: "+(goal.status||"active"),"");
    const linked=projects.filter(p=>p.goalId===goal.id);
    for(const project of linked){
      out.push("- **"+line(project.name)+"**");
      for(const task of tasks.filter(t=>t.projectId===project.id&&!t.deletedAt))out.push("  - ["+(task.status==="done"?"x":" ")+"] "+line(task.title));
    }
    if(linked.length)out.push("");
  }

  const validGoalIds=new Set(goals.map(g=>g.id));
  const unlinked=projects.filter(p=>!p.goalId||!validGoalIds.has(p.goalId));
  out.push("## Other Projects","");
  if(!unlinked.length)out.push("_No unlinked projects._","");
  for(const project of unlinked){
    out.push("### "+line(project.name));
    for(const task of tasks.filter(t=>t.projectId===project.id&&!t.deletedAt))out.push("- ["+(task.status==="done"?"x":" ")+"] "+line(task.title));
    out.push("");
  }

  const projectIds=new Set(projects.map(p=>p.id));
  const loose=tasks.filter(t=>(!t.projectId||!projectIds.has(t.projectId))&&!t.deletedAt);
  out.push("## Unassigned Tasks","");
  if(!loose.length)out.push("_No unassigned tasks._","");
  else loose.forEach(task=>out.push("- ["+(task.status==="done"?"x":" ")+"] "+line(task.title)));
  out.push("");

  out.push("## Notes","");
  if(!notes.length)out.push("_No notes._","");
  notes.forEach(note=>{out.push("### "+line(note.title),"",String(note.body||""),"")});

  out.push("## Habits","");
  if(!habits.length)out.push("_No habits._","");
  habits.forEach(habit=>out.push("- "+line(habit.name)+" — "+(habit.history||[]).length+" check-ins"));
  out.push("");
  return out.filter((value,index,array)=>!(value===""&&array[index-1]==="")).join("\n");
}
