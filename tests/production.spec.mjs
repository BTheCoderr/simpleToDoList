import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("cc-onboarded-v1","1"));
});

test("production serves v6.2 and supports a persisted local task",async ({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Today"})).toBeVisible();

  const storageResponse=await page.request.get("/storage.js");
  expect(storageResponse.ok()).toBe(true);
  expect(await storageResponse.text()).toContain('APP_VERSION="6.2.0"');

  await page.getByRole("button",{name:"Tasks"}).click();
  await page.locator('#tasks [data-add="task"]').click();
  await page.locator("#taskTitle").fill("Production smoke task");
  await page.locator("#taskStatus").selectOption("next");
  await page.getByRole("button",{name:"Save task"}).click();
  await expect(page.locator("#taskList")).toContainText("Production smoke task");

  await page.reload();
  await expect(page.locator("#taskList")).toContainText("Production smoke task");

  const row=page.locator(".task-row").filter({hasText:"Production smoke task"});
  await row.locator("[data-edit-task]").first().click();
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#deleteTask").click();
  await expect(page.locator("#taskList")).not.toContainText("Production smoke task");
});
