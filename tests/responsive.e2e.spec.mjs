import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("cc-onboarded-v1","1");
    localStorage.setItem("cc-theme","dark");
  });
});

async function assertNoDocumentOverflow(page,label){
  await page.waitForLoadState("domcontentloaded");
  const layout=await page.evaluate(()=>({
    viewport:window.innerWidth,
    pageWidth:document.documentElement.scrollWidth
  }));
  expect(layout.pageWidth,label+" overflowed the phone viewport").toBeLessThanOrEqual(layout.viewport+2);
}

test("Daily Shutdown stays inside phone viewports",async ({page})=>{
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await page.goto("/?view=shutdown");
    await expect(page.getByRole("heading",{name:"Daily Shutdown"})).toBeVisible();
    await assertNoDocumentOverflow(page,"Daily Shutdown at "+width+"px");

    const layout=await page.evaluate(()=>{
      const checkbox=document.querySelector("#shutdownRoll");
      const row=document.querySelector(".shutdown-check");
      const rowRect=row.getBoundingClientRect();
      return {
        viewport:window.innerWidth,
        checkboxWidth:checkbox.getBoundingClientRect().width,
        rowLeft:rowRect.left,
        rowRight:rowRect.right,
        rowClientWidth:row.clientWidth,
        rowScrollWidth:row.scrollWidth
      };
    });
    expect(layout.checkboxWidth).toBeLessThanOrEqual(24);
    expect(layout.rowLeft).toBeGreaterThanOrEqual(-1);
    expect(layout.rowRight).toBeLessThanOrEqual(layout.viewport+1);
    expect(layout.rowScrollWidth).toBeLessThanOrEqual(layout.rowClientWidth+1);
  }
});

test("primary views do not create document-level phone overflow",async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  const views=["today","tasks","projects","notes","habits","goals","calendar","board","focus","shutdown","review","analytics","history","settings"];
  for(const view of views){
    await page.goto("/?view="+view);
    await assertNoDocumentOverflow(page,view);
  }
});
