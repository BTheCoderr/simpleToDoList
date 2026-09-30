import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  page.on("console",msg=>{if(msg.type()==="error")console.log("[browser error]",msg.text())});
  page.on("pageerror",error=>console.log("[pageerror]",error.stack||error.message));
  await page.addInitScript(()=>{
    localStorage.setItem("cc-onboarded-v1","1");
    localStorage.setItem("cc-theme","dark");
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

async function createTask(page,{title,status="next",priority="medium",dueDate="",repeat="none",project=""}){
  if(!(await page.locator("#tasks").evaluate(el=>el.classList.contains("active")))) await openTasks(page);
  await page.locator('#tasks [data-add="task"]').click();
  await page.locator("#taskTitle").fill(title);
  await page.locator("#taskStatus").selectOption(status);
  await page.locator("#taskPriority").selectOption(priority);
  if(dueDate) await page.locator("#taskDue").fill(dueDate);
  if(repeat!=="none") await page.locator("#taskRepeat").selectOption(repeat);
  if(project) await page.locator("#taskProject").selectOption({label:project});
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

test("recurrence spawns the next dated task",async ({page})=>{
  await openTasks(page);
  await createTask(page,{title:"Weekly recurring QA",dueDate:"2026-10-01",repeat:"weekly"});
  const row=page.locator(".task-row").filter({hasText:"Weekly recurring QA"});
  await row.locator(".checkbtn").click();

  await expect.poll(async ()=>{
    const tasks=await getAll(page,"tasks");
    return tasks.filter(t=>t.title==="Weekly recurring QA").map(t=>t.dueDate).sort();
  }).toContain("2026-10-08");
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

test("snapshots restore a prior workspace state",async ({page})=>{
  await page.goto("/?view=settings");
  await assertAppBooted(page);
  await page.locator("#createSnapshot").click();
  await expect(page.locator("#snapshotList")).toContainText("Manual snapshot");

  await page.getByRole("button",{name:"Tasks"}).click();
  await createTask(page,{title:"Temporary after snapshot"});
  await expect(page.locator("#taskList")).toContainText("Temporary after snapshot");

  await page.getByRole("button",{name:"Settings"}).click();
  const manual=page.locator(".snapshot-row").filter({hasText:"Manual snapshot"}).first();
  page.once("dialog",dialog=>dialog.accept());
  await manual.getByRole("button",{name:"Restore"}).click();

  await page.getByRole("button",{name:"Tasks"}).click();
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
  await expect(page.getByRole("heading",{name:"Today",exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Tasks"}).click();
  await createTask(page,{title:"Offline task"});
  await expect(page.locator("#taskList")).toContainText("Offline task");

  await context.setOffline(false);
  await page.reload();
  await page.getByRole("button",{name:"Tasks"}).click();
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
