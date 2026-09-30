import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("cc-onboarded-v1","1"));
});

test("production serves v7.3 and supports a persisted local task",async ({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Today",exact:true})).toBeVisible();

  const storageResponse=await page.request.get("/storage.js");
  expect(storageResponse.ok()).toBe(true);
  expect(await storageResponse.text()).toContain('APP_VERSION="7.3.0"');

  await page.getByRole("button",{name:"Tasks"}).click();
  await page.locator('#tasks [data-add="task"]').click();
  await page.locator("#taskTitle").fill("Production smoke task");
  await page.locator("#taskStatus").selectOption("next");
  await page.getByRole("button",{name:"Save task"}).click();
  await expect(page.locator("#taskList")).toContainText("Production smoke task");

  await page.reload();
  await expect(page.locator("#taskList")).toContainText("Production smoke task");

  const row=page.locator("#taskList .task-row").filter({hasText:"Production smoke task"});
  await row.locator("[data-edit-task]").first().click();
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#deleteTask").click();
  await expect(page.locator("#taskList")).not.toContainText("Production smoke task");
});

test("production desktop and mobile release surfaces stay usable",async ({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Today",exact:true})).toBeVisible();
  await expect(page.locator("#sidebar")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
  await page.screenshot({path:"test-results/production-desktop.png",fullPage:true});

  await page.getByRole("button",{name:"Review"}).click();
  await page.locator('#review [data-view="history"]').click();
  await expect(page.locator("#historySearch")).toBeVisible();
  await page.getByRole("button",{name:"Settings"}).click();
  await expect(page.locator("#exportCsv")).toBeVisible();
  await expect(page.locator("#exportMarkdown")).toBeVisible();
  await expect(page.locator("#privacyLockStatus")).toBeVisible();

  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await expect(page.getByRole("button",{name:"Open navigation"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);

  await page.getByRole("button",{name:"Open navigation"}).click();
  await expect(page.locator('#sidebar [data-view="tasks"]')).toBeVisible();
  await page.locator('#sidebar [data-view="tasks"]').click();
  await expect(page.getByRole("heading",{name:"Tasks",exact:true})).toBeVisible();
  await expect(page.locator('#tasks [data-add="task"]')).toBeVisible();
  const mobileLayout=await page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const offenders=[...document.querySelectorAll("body *")].map(el=>{
      const r=el.getBoundingClientRect();
      return {
        tag:el.tagName.toLowerCase(),
        id:el.id||"",
        cls:typeof el.className==="string"?el.className:"",
        left:Math.round(r.left),
        right:Math.round(r.right),
        width:Math.round(r.width)
      };
    }).filter(x=>x.right>viewport+2||x.left<-2).slice(0,20);
    return {viewport,scrollWidth:document.documentElement.scrollWidth,offenders};
  });
  console.log("MOBILE_LAYOUT",JSON.stringify(mobileLayout));
  await page.screenshot({path:"test-results/production-mobile.png",fullPage:true});
  expect(mobileLayout.scrollWidth<=mobileLayout.viewport+2).toBe(true);
});
