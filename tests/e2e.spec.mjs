import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  page.on("console",msg=>{if(msg.type()==="error")console.log("[browser error]",msg.text())});
  page.on("pageerror",error=>console.log("[pageerror]",error.stack||error.message));
  await page.addInitScript(()=>{
    localStorage.setItem("cc-onboarded-v1","1");
    localStorage.setItem("cc-theme","dark");
    const d=new Date(),key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    localStorage.setItem("cc-signal-builder-day",key);
  });
});

async function assertAppBooted(page){
  await page.waitForLoadState("domcontentloaded");
  if(await page.getByText("Command Center could not start.").count()){
    const body=await page.locator("body").innerText();
    throw new Error("Command Center startup failed. Body: "+body.slice(0,1000));
  }
}

async function openTasks(page){
  await page.goto("/?view=tasks");
  await assertAppBooted(page);
  await expect(page.locator("#tasks")).toHaveClass(/active/);
}

async function createTask(page,{title,status="next",priority="medium",dueDate="",repeat="none",repeatInterval=1,repeatDays=[],project="",tags=""}){
  if(!(await page.locator("#tasks").evaluate(el=>el.classList.contains("active")))) await openTasks(page);
  await page.locator('#tasks [data-add="task"]').click();
  await page.locator("#taskTitle").fill(title);
  await page.locator("#taskStatus").selectOption(status);
  await page.locator("#taskPriority").selectOption(priority);
  if(dueDate) await page.locator("#taskDue").fill(dueDate);
  if(repeat!=="none"){
    await page.locator("#taskRepeat").selectOption(repeat);
    if(["custom_days","after_completion","custom_weeks"].includes(repeat))await page.locator("#taskRepeatInterval").fill(String(repeatInterval));
    if(repeat==="selected_weekdays"){
      for(const day of repeatDays)await page.locator('[data-repeat-weekday="'+day+'"]').check();
    }
  }
  if(project) await page.locator("#taskProject").selectOption({label:project});
  if(tags) await page.locator("#taskTags").fill(tags);
  await page.getByRole("button",{name:"Save task"}).click();
  await expect(page.locator("#taskModal")).not.toHaveAttribute("open","");
}

async function getAll(page,store){
  return page.evaluate(store=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("command-center-v2",4);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction(store,"readonly");
      const q=tx.objectStore(store).getAll();
      q.onsuccess=()=>resolve(q.result);
      q.onerror=()=>reject(q.error);
      tx.oncomplete=()=>db.close();
    };
  }),store);
}

async function replaceTasks(page,count){
  await page.evaluate(count=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("command-center-v2",4);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction("tasks","readwrite");
      const store=tx.objectStore("tasks");
      store.clear();
      const now=new Date().toISOString();
      for(let i=0;i<count;i++){
        store.put({
          id:"stress-"+i,
          title:"Stress task "+i,
          description:"",
          status:"next",
          priority:i%20===0?"high":"medium",
          projectId:"",
          dueDate:i%7===0?"2026-10-01":"",
          dueTime:"",
          repeat:"none",
          repeatInterval:1,
          repeatUntil:"",
          subtasks:[],
          createdAt:now,
          completedAt:null,
          archivedAt:null,
          deletedAt:null
        });
      }
      tx.oncomplete=()=>{db.close();resolve()};
      tx.onerror=()=>{db.close();reject(tx.error)};
    };
  }),count);
}

test("task CRUD, Trash restore, and refresh persistence",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"E2E task",priority:"high"});
  await expect(page.locator("#taskList")).toContainText("E2E task");

  const row=page.locator("#taskList .task-row").filter({hasText:"E2E task"});
  await row.locator("[data-edit-task]").first().click();
  await page.locator("#taskTitle").fill("E2E task edited");
  await page.getByRole("button",{name:"Save task"}).click();
  await expect(page.locator("#taskList")).toContainText("E2E task edited");

  await page.reload();
  await expect(page.locator("#taskList")).toContainText("E2E task edited");

  const edited=page.locator("#taskList .task-row").filter({hasText:"E2E task edited"});
  await edited.locator("[data-edit-task]").first().click();
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#deleteTask").click();
  await expect(page.locator("#taskList")).not.toContainText("E2E task edited");

  await page.getByRole("button",{name:"Archive"}).click();
  await page.locator('[data-archive-filter="trash"]').click();
  await expect(page.locator("#archiveList")).toContainText("E2E task edited");
  await page.locator("#archiveList").getByRole("button",{name:"Restore"}).click();

  await page.getByRole("button",{name:"← Tasks"}).click();
  await expect(page.locator("#taskList")).toContainText("E2E task edited");
});

test("tags filter tasks and bulk actions update the selected set",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Call supplier",tags:"#calls #office"});
  await createTask(page,{title:"Call accountant",tags:"#calls #finance"});
  await createTask(page,{title:"Buy labels",tags:"#errands"});

  await expect(page.locator("#tagFilter")).toContainText("#calls");
  await page.locator("#tagFilter").selectOption("calls");
  await expect(page.locator("#taskList")).toContainText("Call supplier");
  await expect(page.locator("#taskList")).toContainText("Call accountant");
  await expect(page.locator("#taskList")).not.toContainText("Buy labels");

  await page.locator("#bulkToggle").click();
  await page.locator("#bulkSelectAll").click();
  await expect(page.locator("#bulkCount")).toHaveText("2");
  await page.locator("#bulkStatus").selectOption("doing");
  await page.locator("#bulkPriority").selectOption("high");
  await page.locator("#bulkApply").click();

  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.filter(x=>["Call supplier","Call accountant"].includes(x.title)).map(x=>x.status+":"+x.priority).sort();
  }).toEqual(["doing:high","doing:high"]);
});

test("Signal promotes, caps, parks, and survives reload",async ({page})=>{
  await openTasks(page);
  await replaceTasks(page,0);
  await page.reload();
  for(const title of ["Must Win A","Must Win B","Must Win C","Must Win D","Must Win E","Noise F"]){
    await createTask(page,{title});
  }

  for(const title of ["Must Win A","Must Win B","Must Win C","Must Win D","Must Win E"]){
    const row=page.locator("#taskList .task-row").filter({hasText:title}).first();
    await row.getByRole("button",{name:/Signal/}).click();
  }

  const sixth=page.locator("#taskList .task-row").filter({hasText:"Noise F"}).first();
  await sixth.getByRole("button",{name:/Signal/}).click();
  await expect(page.locator("#signalSwapModal")).toHaveAttribute("open","");
  await expect(page.locator("#signalSwapIncoming")).toHaveText("Noise F");
  await page.locator("#signalSwapOptions .swap-option").first().click();

  await page.goto("/?view=today");
  await expect(page.locator("#sToday")).toHaveText("5/5");
  await expect(page.locator("#todayTasks")).toContainText("Noise F");
  await expect(page.locator("#todayNoise")).toContainText("Must Win A");

  const park=page.locator("#todayTasks .task-row").filter({hasText:"Must Win E"}).first();
  await park.getByRole("button",{name:/Park/}).click();
  await expect(page.locator("#sToday")).toHaveText("4/5");
  await expect(page.locator("#todayNoise")).toContainText("Must Win E");

  await page.reload();
  await expect(page.locator("#sToday")).toHaveText("4/5");
  await expect(page.locator("#todayNoise")).toContainText("Must Win E");
});

test("Morning Signal Builder opens once per day and locks selected Must-Wins",async ({page})=>{
  await page.addInitScript(()=>localStorage.removeItem("cc-signal-builder-day"));
  await page.goto("/?view=tasks");
  await assertAppBooted(page);
  await replaceTasks(page,0);
  await page.reload();
  await createTask(page,{title:"Morning choice A",priority:"high"});
  await createTask(page,{title:"Morning choice B",priority:"medium"});
  await page.evaluate(()=>localStorage.removeItem("cc-signal-builder-day"));
  await page.reload();
  await expect(page.locator("#signalBuilderModal")).toHaveAttribute("open","");
  await expect(page.locator("#signalBuilderCandidates")).toContainText("Morning choice A");
  const a=page.locator(".signal-builder-item").filter({hasText:"Morning choice A"}).locator("input");
  const b=page.locator(".signal-builder-item").filter({hasText:"Morning choice B"}).locator("input");
  await a.check();
  await b.check();
  await expect(page.locator("#signalBuilderCount")).toHaveText("2/5");
  await page.locator("#signalBuilderForm .primary").click();
  await expect(page.locator("#signalBuilderModal")).not.toHaveAttribute("open","");
  await page.goto("/?view=today");
  await expect(page.locator("#sToday")).toHaveText("2/5");
  await expect(page.locator("#todayTasks")).toContainText("Morning choice A");
  await page.reload();
  await expect(page.locator("#signalBuilderModal")).not.toHaveAttribute("open","");
});

test("Focus Complete advances to the next Signal item",async ({page})=>{
  await openTasks(page);
  await replaceTasks(page,0);
  await page.reload();
  await createTask(page,{title:"Focus Signal A"});
  await createTask(page,{title:"Focus Signal B"});
  for(const title of ["Focus Signal A","Focus Signal B"]){
    const row=page.locator("#taskList .task-row").filter({hasText:title}).first();
    await row.getByRole("button",{name:/Signal/}).click();
  }
  await page.goto("/?view=focus");
  await page.locator("#focusTask").selectOption({label:"Focus Signal A"});
  await page.locator("#focusComplete").click();
  await expect(page.locator("#focusTask option:checked")).toHaveText("Focus Signal B");
  await expect(page.locator("#focusNextHint")).toContainText("Finish this one");
});
test("Signal History shows chosen versus completed Must-Wins",async ({page})=>{
  await openTasks(page);
  await replaceTasks(page,0);
  await page.reload();
  await createTask(page,{title:"History A"});
  await createTask(page,{title:"History B"});
  for(const title of ["History A","History B"]){
    const row=page.locator("#taskList .task-row").filter({hasText:title}).first();
    await row.getByRole("button",{name:/Signal/}).click();
  }
  const done=page.locator("#taskList .task-row").filter({hasText:"History A"}).first();
  await done.locator(".checkbtn").click();
  await page.goto("/?view=today");
  await expect(page.locator("#signalHistoryList")).toContainText("1 of 2 Must-Wins finished");
  await expect(page.locator("#signalHistoryList")).toContainText("1/2");
});

test("Noise Aging surfaces stale decisions and Keep resets the age",async ({page})=>{
  await openTasks(page);
  await replaceTasks(page,0);
  await page.reload();
  await createTask(page,{title:"Ancient Noise"});
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("command-center-v2",4);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction("tasks","readwrite"),store=tx.objectStore("tasks"),q=store.getAll();
      q.onsuccess=()=>{
        const t=q.result.find(x=>x.title==="Ancient Noise");
        const d=new Date();d.setDate(d.getDate()-40);t.createdAt=d.toISOString();store.put(t);
      };
      tx.oncomplete=()=>{db.close();resolve()};
      tx.onerror=()=>{db.close();reject(tx.error)};
    };
  }));
  await page.reload();
  await page.goto("/?view=today");
  const item=page.locator("#todayNoise .noise-item").filter({hasText:"Ancient Noise"});
  await expect(item).toContainText(/\d+d stale/);
  await expect(item.getByRole("button",{name:"Keep"})).toBeVisible();
  await expect(item.getByRole("button",{name:"Archive"})).toBeVisible();
  await expect(item.getByRole("button",{name:"Trash"})).toBeVisible();
  await item.getByRole("button",{name:"Keep"}).click();
  await expect(page.locator("#todayNoise .noise-item").filter({hasText:"Ancient Noise"})).not.toContainText(/stale|waiting|old/);
});
test("Signal dashboard visibility and order persist after reload",async ({page})=>{
  await page.goto("/?view=today");
  await assertAppBooted(page);
  await page.locator("#customizeToday").click();
  await page.locator('[data-dashboard-visible="habits"]').uncheck();
  const moveCaptureUp=page.locator('[data-dashboard-move="capture"][data-direction="-1"]');
  await moveCaptureUp.click();
  await moveCaptureUp.click();
  await moveCaptureUp.click();
  await moveCaptureUp.click();
  await page.locator("#dashboardForm .primary").click();

  await expect(page.locator('[data-dashboard-card="habits"]')).toHaveClass(/dashboard-hidden/);
  let order=await page.locator('#today .grid > [data-dashboard-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.dashboardCard));
  expect(order[0]).toBe("capture");

  await page.reload();
  await assertAppBooted(page);
  await expect(page.locator('[data-dashboard-card="habits"]')).toHaveClass(/dashboard-hidden/);
  order=await page.locator('#today .grid > [data-dashboard-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.dashboardCard));
  expect(order[0]).toBe("capture");
});

test("saved task views persist and restore status project and tag filters",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Work call doing",status:"doing",project:"Win the Week",tags:"#calls"});
  await createTask(page,{title:"Work call next",status:"next",project:"Win the Week",tags:"#calls"});
  await createTask(page,{title:"Personal call doing",status:"doing",project:"Launch Command Center",tags:"#calls"});
  await createTask(page,{title:"Work errand doing",status:"doing",project:"Win the Week",tags:"#errands"});

  await page.locator('[data-filter="doing"]').click();
  await page.locator("#projectFilter").selectOption({label:"Win the Week"});
  await page.locator("#tagFilter").selectOption("calls");
  await expect(page.locator("#taskList")).toContainText("Work call doing");
  await expect(page.locator("#taskList")).not.toContainText("Work call next");
  await expect(page.locator("#taskList")).not.toContainText("Personal call doing");
  await expect(page.locator("#taskList")).not.toContainText("Work errand doing");

  await page.locator("#saveCurrentView").click();
  await expect(page.locator("#savedViewSummary")).toContainText("Doing");
  await expect(page.locator("#savedViewSummary")).toContainText("Win the Week");
  await expect(page.locator("#savedViewSummary")).toContainText("#calls");
  await page.locator("#savedViewName").fill("Work calls");
  await page.locator("#savedViewForm .primary").click();
  await expect(page.locator("#savedViews")).toContainText("Work calls");

  await page.locator('[data-filter="all"]').click();
  await page.locator("#projectFilter").selectOption("");
  await page.locator("#tagFilter").selectOption("");
  await page.reload();
  await page.locator("#savedViews").getByRole("button",{name:"Work calls",exact:true}).click();

  await expect(page.locator("#projectFilter")).toHaveValue("p2");
  await expect(page.locator("#tagFilter")).toHaveValue("calls");
  await expect(page.locator('[data-filter="doing"]')).toHaveClass(/active/);
  await expect(page.locator("#taskList")).toContainText("Work call doing");
  await expect(page.locator("#taskList")).not.toContainText("Work call next");
  await expect(page.locator("#taskList")).not.toContainText("Personal call doing");
  await expect(page.locator("#taskList")).not.toContainText("Work errand doing");
});

test("selected-weekday recurrence creates the next allowed weekday",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"MWF workout",dueDate:"2026-10-02",repeat:"selected_weekdays",repeatDays:[1,3,5]});
  const row=page.locator("#taskList .task-row").filter({hasText:"MWF workout"}).first();
  await expect(row).toContainText("Mon, Wed, Fri");
  await row.locator(".checkbtn").click();

  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.filter(t=>t.title==="MWF workout").map(t=>t.dueDate).sort();
  }).toContain("2026-10-05");
});

test("every-X-weeks recurrence creates the correct future task",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Biweekly review",dueDate:"2026-10-01",repeat:"custom_weeks",repeatInterval:2});
  const row=page.locator("#taskList .task-row").filter({hasText:"Biweekly review"}).first();
  await expect(row).toContainText("Every 2 weeks");
  await row.locator(".checkbtn").click();

  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.filter(t=>t.title==="Biweekly review").map(t=>t.dueDate).sort();
  }).toContain("2026-10-15");
});

test("recurrence spawns the next dated task",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Weekly recurring QA",dueDate:"2026-10-01",repeat:"weekly"});
  const row=page.locator("#taskList .task-row").filter({hasText:"Weekly recurring QA"});
  await row.locator(".checkbtn").click();

  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.filter(t=>t.title==="Weekly recurring QA").map(t=>t.dueDate).sort();
  }).toContain("2026-10-08");
});

test("Planner month week day modes persist and drag rescheduling updates dates",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Planner drag target"});
  await page.locator('[data-view="planner"]').first().click();

  await page.locator('[data-planner-mode="week"]').click();
  await expect(page.locator("#calendarGrid")).toHaveClass(/planner-week-grid/);
  await page.locator('[data-planner-mode="day"]').click();
  await expect(page.locator("#calendarGrid")).toHaveClass(/planner-day-grid/);

  await page.reload();
  await assertAppBooted(page);
  await expect(page.locator("#planner")).toHaveClass(/active/);
  await expect(page.locator('[data-planner-mode="day"]')).toHaveClass(/active/);

  await page.locator('[data-planner-mode="month"]').click();
  const source=page.locator('[data-planner-drag-task]').filter({hasText:"Planner drag target"}).first();
  const target=page.locator("[data-planner-date]").last();
  const targetDate=await target.getAttribute("data-planner-date");
  expect(targetDate).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
  const dataTransfer=await page.evaluateHandle(()=>new DataTransfer());
  await source.dispatchEvent("dragstart",{dataTransfer});
  await target.dispatchEvent("dragover",{dataTransfer});
  await target.dispatchEvent("drop",{dataTransfer});
  await dataTransfer.dispose();

  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.find(x=>x.title==="Planner drag target")?.dueDate;
  }).toBe(targetDate);
});

test("quick reschedule presets update task due dates",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Quick reschedule QA"});
  const row=page.locator("#taskList .task-row").filter({hasText:"Quick reschedule QA"}).first();
  await row.locator("[data-edit-task]").first().click();

  await page.locator('[data-reschedule-preset="tomorrow"]').click();
  const tomorrow=await page.locator("#taskDue").inputValue();
  expect(tomorrow).toMatch(/^20\d{2}-\d{2}-\d{2}$/);

  await page.locator('[data-reschedule-preset="week"]').click();
  const week=await page.locator("#taskDue").inputValue();
  expect(week).not.toBe(tomorrow);

  await page.getByRole("button",{name:"Save task"}).click();
  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.find(x=>x.title==="Quick reschedule QA")?.dueDate;
  }).toBe(week);

  await row.locator("[data-edit-task]").first().click();
  await page.locator('[data-reschedule-preset="clear"]').click();
  await expect(page.locator("#taskDue")).toHaveValue("");
});

test("Kanban drag order persists after reload",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Board order A",status:"next"});
  await createTask(page,{title:"Board order B",status:"next"});
  await createTask(page,{title:"Board order C",status:"next"});

  await page.locator('[data-view="board"]').first().click();
  const cardC=page.locator("#boardNext .kanban-card").filter({hasText:"Board order C"});
  const cardA=page.locator("#boardNext .kanban-card").filter({hasText:"Board order A"});
  await cardC.dragTo(cardA);

  async function names(){
    return page.locator("#boardNext .kanban-card>b").evaluateAll(nodes=>nodes.map(n=>n.textContent));
  }
  await expect.poll(async ()=>{
    const list=await names();
    return list.indexOf("Board order C")<list.indexOf("Board order A");
  }).toBe(true);

  await page.reload();
  await assertAppBooted(page);
  await expect.poll(async ()=>{
    const list=await names();
    return list.indexOf("Board order C")<list.indexOf("Board order A");
  }).toBe(true);
});

test("Planner, Board, Focus, Goals, and Review remain connected",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Flow QA",dueDate:"2026-10-01",status:"next"});

  await page.getByRole("button",{name:"Planner"}).click();
  await expect(page.locator(".cal-task").filter({hasText:"Flow QA"})).toBeVisible();

  await page.getByRole("button",{name:"Board"}).click();
  await expect(page.locator("#boardNext")).toContainText("Flow QA");

  await page.getByRole("button",{name:"Focus"}).click();
  await page.locator("#focusTask").selectOption({label:"Flow QA"});
  await page.locator('[data-minutes="25"]').click();
  await page.locator("#focusStart").click();
  await expect(page.locator("#focusStart")).toHaveText("Running…");
  await page.locator("#focusPause").click();

  await page.getByRole("button",{name:"Goals"}).click();
  await page.locator("#newGoal").click();
  await page.locator("#goalName").fill("Ship QA release");
  await page.locator("#goalWhy").fill("Prove the local edition is stable.");
  await page.locator("#goalForm .primary").click();
  await expect(page.locator("#goalGrid")).toContainText("Ship QA release");

  const goalCard=page.locator(".goal-card").filter({hasText:"Ship QA release"});
  await goalCard.getByRole("button",{name:"Add project"}).click();
  await page.locator("#simpleTitle").fill("QA Project");
  await page.locator("#simpleMeta").fill("Quality");
  await page.locator("#simpleForm .primary").click();
  await expect(page.locator("#projectGrid")).toContainText("QA Project");

  await page.getByRole("button",{name:"Review"}).click();
  await expect(page.locator("#review")).toHaveClass(/active/);
  await expect(page.getByRole("heading",{name:"Review the week. Choose the next one."})).toBeVisible();
  await page.locator("#review").getByRole("button",{name:"Daily"}).click();
  await expect(page.getByRole("heading",{name:"Daily Shutdown"})).toBeVisible();
  await page.locator("#shutdown").getByRole("button",{name:"Analytics"}).click();
  await expect(page.locator("#aRate")).toBeVisible();
});

test("History shows meaningful task audit events",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"History QA",status:"next"});
  const row=page.locator("#taskList .task-row").filter({hasText:"History QA"}).first();
  await row.locator(".checkbtn").click();

  await page.locator('[data-view="review"]').first().click();
  await page.locator("#review").getByRole("button",{name:"History"}).click();
  await expect(page.locator("#history")).toHaveClass(/active/);
  await expect(page.locator("#historyList")).toContainText("History QA");
  await expect(page.locator("#historyList")).toContainText("Task status");

  await page.locator("#historySearch").fill("History QA");
  await expect(page.locator("#historyList .history-row")).toHaveCount(2);
});

test("CSV and Markdown exports download human-readable files",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Export readable QA",tags:"#exports"});
  await page.locator('[data-view="settings"]').first().click();

  const [csv]=await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportCsv").click()
  ]);
  expect(csv.suggestedFilename()).toMatch(/^command-center-tasks-.*\.csv$/);

  const [md]=await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportMarkdown").click()
  ]);
  expect(md.suggestedFilename()).toMatch(/^command-center-workspace-.*\.md$/);
});

test("local privacy lock gates a fresh tab and accepts only the correct code",async ({page,context})=>{
  await page.goto("/?view=settings");
  await assertAppBooted(page);
  await page.locator("#enablePrivacyLock").click();
  await page.locator("#privacyCode").fill("7391");
  await page.locator("#privacyCodeConfirm").fill("7391");
  await page.locator("#privacySetupForm .primary").click();
  await expect(page.locator("#privacyLockStatus")).toContainText("ENABLED");

  await page.locator("#lockNow").click();
  await expect(page.locator("#privacyLockScreen")).not.toHaveClass(/hidden/);
  await page.locator("#privacyUnlockCode").fill("0000");
  await page.locator("#privacyUnlockForm .primary").click();
  await expect(page.locator("#privacyUnlockError")).toHaveText("Incorrect code.");

  await page.locator("#privacyUnlockCode").fill("7391");
  await page.locator("#privacyUnlockForm .primary").click();
  await expect(page.locator("#privacyLockScreen")).toHaveClass(/hidden/);

  const second=await context.newPage();
  await second.goto("/?view=today");
  await assertAppBooted(second);
  await expect(second.locator("#privacyLockScreen")).not.toHaveClass(/hidden/);
  await second.locator("#privacyUnlockCode").fill("7391");
  await second.locator("#privacyUnlockForm .primary").click();
  await expect(second.locator("#privacyLockScreen")).toHaveClass(/hidden/);
  await second.close();
});

test("mobile swipe status actions move tasks through Next and Doing",async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openTasks(page);
  await createTask(page,{title:"Mobile stage QA",status:"inbox"});
  let row=page.locator("#taskList .task-row").filter({hasText:"Mobile stage QA"}).first();
  await row.evaluate(el=>el.classList.add("reveal"));
  await row.locator('[data-swipe-status][data-status="next"]').click();
  await expect.poll(async ()=>((await getAll(page,"tasks")).find(x=>x.title==="Mobile stage QA")||{}).status).toBe("next");

  row=page.locator("#taskList .task-row").filter({hasText:"Mobile stage QA"}).first();
  await row.evaluate(el=>el.classList.add("reveal"));
  await row.locator('[data-swipe-status][data-status="doing"]').click();
  await expect.poll(async ()=>((await getAll(page,"tasks")).find(x=>x.title==="Mobile stage QA")||{}).status).toBe("doing");
});

test("Goal to Project to Task creation preserves the hierarchy",async ({page})=>{
  await page.goto("/?view=goals");
  await assertAppBooted(page);
  await page.locator("#newGoal").click();
  await page.locator("#goalName").fill("Hierarchy goal");
  await page.locator("#goalForm .primary").click();

  const goal=page.locator(".goal-card").filter({hasText:"Hierarchy goal"});
  await goal.getByRole("button",{name:"Add project"}).click();
  await page.locator("#simpleTitle").fill("Hierarchy project");
  await page.locator("#simpleForm .primary").click();

  await page.locator('[data-view="projects"]').first().click();
  const project=page.locator("#projectGrid .card").filter({hasText:"Hierarchy project"}).first();
  await project.locator("[data-project-task]").click();
  await expect(page.locator("#taskProject")).toHaveValue(/.+/);
  const projectId=await page.locator("#taskProject").inputValue();
  await page.locator("#taskTitle").fill("Hierarchy task");
  await page.getByRole("button",{name:"Save task"}).click();

  await expect.poll(async ()=>{
    const task=(await getAll(page,"tasks")).find(x=>x.title==="Hierarchy task");
    return task&&task.projectId;
  }).toBe(projectId);
  const projects=await getAll(page,"projects");
  expect(projects.find(x=>x.id===projectId)?.goalId).toBeTruthy();
});

test("snapshots restore a prior workspace state",async ({page})=>{
  await page.goto("/?view=settings");
  await assertAppBooted(page);
  await page.locator("#createSnapshot").click();
  await expect(page.locator("#snapshotList")).toContainText("Manual snapshot");

  await page.locator('[data-view="tasks"]').first().click();
  await createTask(page,{title:"Temporary after snapshot"});
  await expect(page.locator("#taskList")).toContainText("Temporary after snapshot");

  await page.getByRole("button",{name:"Settings"}).click();
  const manual=page.locator(".snapshot-row").filter({hasText:"Manual snapshot"}).first();
  page.once("dialog",dialog=>dialog.accept());
  await manual.getByRole("button",{name:"Restore"}).click();

  await page.locator('[data-view="tasks"]').first().click();
  await expect(page.locator("#taskList")).not.toContainText("Temporary after snapshot");
});

test("export works and malformed, old, partial, and oversized imports fail safely",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Keep me through bad imports"});
  const before=(await getAll(page,"tasks")).length;

  await page.getByRole("button",{name:"Settings"}).click();
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export").click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^command-center-.*\.json$/);

  async function expectRejectedImport(name,buffer,messagePart){
    const dialogPromise=new Promise(resolve=>{
      page.once("dialog",async dialog=>{
        expect(dialog.type()).toBe("alert");
        expect(dialog.message()).toContain(messagePart);
        await dialog.accept();
        resolve();
      });
    });
    await page.locator("#import").setInputFiles({name,mimeType:"application/json",buffer});
    await dialogPromise;
    expect((await getAll(page,"tasks")).length).toBe(before);
  }

  await expectRejectedImport("bad.json",Buffer.from("{bad"),"Could not import");
  await expectRejectedImport("old.json",Buffer.from(JSON.stringify({version:3,tasks:[]})),"too old");
  await expectRejectedImport("partial.json",Buffer.from(JSON.stringify({version:6,tasks:[]})),"incomplete");
  await expectRejectedImport("huge.json",Buffer.alloc(8*1024*1024+1,32),"too large");
});

test("installed shell reopens offline and local writes still work",async ({page,context})=>{
  await page.goto("/");
  await assertAppBooted(page);
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Signal",exact:true})).toBeVisible();

  await page.locator('[data-view="tasks"]').first().click();
  await createTask(page,{title:"Offline task"});
  await expect(page.locator("#taskList")).toContainText("Offline task");

  await context.setOffline(false);
  await page.reload();
  await page.locator('[data-view="tasks"]').first().click();
  await expect(page.locator("#taskList")).toContainText("Offline task");
});

test("500, 1000, and 5000 task workspaces remain responsive",async ({page})=>{
  await page.goto("/");
  await assertAppBooted(page);
  for(const count of [500,1000,5000]){
    await replaceTasks(page,count);
    const started=Date.now();
    await page.reload({waitUntil:"domcontentloaded"});
    await expect(page.locator("#openCount")).toHaveText(String(count),{timeout:15000});
    const elapsed=Date.now()-started;
    expect(elapsed,count+" task startup took "+elapsed+"ms").toBeLessThan(15000);
  }

  await page.locator("#search").fill("Stress task 4999");
  await expect(page.locator("#searchBox")).toContainText("Stress task 4999");
});

test("modal focus is trapped/restored and mobile large text avoids page overflow",async ({page})=>{
  await page.goto("/");
  await assertAppBooted(page);
  const trigger=page.locator("#addTask");
  await trigger.focus();
  await trigger.click();
  await expect(page.locator("#quickModal")).toHaveAttribute("open","");

  for(let i=0;i<12;i++){
    await page.keyboard.press("Tab");
    const inside=await page.evaluate(()=>!!document.activeElement?.closest("dialog[open]"));
    expect(inside).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(page.locator("#quickModal")).not.toHaveAttribute("open","");
  await expect(trigger).toBeFocused();

  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await page.evaluate(()=>{document.documentElement.style.fontSize="200%"});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await expect(page.locator(".bottom")).toBeVisible();
});


test("privacy lock blocks command shortcuts until unlock",async ({page})=>{
  await page.goto("/?view=settings");
  await assertAppBooted(page);
  await page.locator("#enablePrivacyLock").click();
  await page.locator("#privacyCode").fill("7391");
  await page.locator("#privacyCodeConfirm").fill("7391");
  await page.locator("#privacySetupForm .primary").click();
  await page.locator("#lockNow").click();
  await page.keyboard.press("Control+K");
  await expect(page.locator("#paletteModal")).not.toHaveAttribute("open","");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#quickModal")).not.toHaveAttribute("open","");
  await page.locator("#privacyUnlockCode").fill("7391");
  await page.locator("#privacyUnlockForm .primary").click();
  await expect(page.locator("#privacyLockScreen")).toHaveClass(/hidden/);
});

test("projects can be edited after creation",async ({page})=>{
  await page.goto("/?view=projects");
  await assertAppBooted(page);
  await page.locator('[data-add="project"]').click();
  await page.locator("#simpleTitle").fill("Editable Project");
  await page.locator("#simpleMeta").fill("Work");
  await page.locator("#simpleForm .primary").click();
  const card=page.locator("#projectGrid .card").filter({hasText:"Editable Project"});
  await card.locator("[data-edit-project]").click();
  await page.locator("#simpleTitle").fill("Edited Project");
  await page.locator("#simpleForm .primary").click();
  await expect(page.locator("#projectGrid")).toContainText("Edited Project");
});

test("unknown view falls back to Signal",async ({page})=>{
  await page.goto("/?view=bogus");
  await assertAppBooted(page);
  await expect(page.locator("#today")).toHaveClass(/active/);
  await expect(page.locator("#title")).toHaveText("Signal");
});
