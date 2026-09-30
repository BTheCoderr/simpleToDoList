import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("cc-onboarded-v1","1"));
});

async function waitForControlledServiceWorker(page){
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!(await page.evaluate(()=>!!navigator.serviceWorker.controller))){
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  }
}

test("manifest, icons, and service worker form an installable app shell",async ({page})=>{
  await page.goto("/");
  const manifest=await page.evaluate(async ()=>{
    const href=document.querySelector('link[rel="manifest"]').href;
    const response=await fetch(href);
    return response.json();
  });
  expect(manifest.name).toBe("Command Center");
  expect(manifest.short_name).toBe("Command");
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.lang).toBe("en-US");
  expect(manifest.share_target.action).toBe("/?share=1");

  const sizes=await page.evaluate(async ()=>{
    async function size(src){
      return new Promise((resolve,reject)=>{
        const image=new Image();
        image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);
        image.onerror=reject;
        image.src=src;
      });
    }
    return {
      icon192:await size("/icon-192.png"),
      icon512:await size("/icon-512.png"),
      maskable:await size("/icon-512-maskable.png"),
      touch:await size("/apple-touch-icon.png")
    };
  });
  expect(sizes.icon192).toEqual([192,192]);
  expect(sizes.icon512).toEqual([512,512]);
  expect(sizes.maskable).toEqual([512,512]);
  expect(sizes.touch).toEqual([180,180]);

  await waitForControlledServiceWorker(page);
  const scope=await page.evaluate(async ()=>(await navigator.serviceWorker.getRegistration()).scope);
  expect(scope).toMatch(/\/$/);
});

test("installed shell supports offline deep links and never returns HTML for missing assets",async ({page,context})=>{
  await page.goto("/");
  await waitForControlledServiceWorker(page);
  await context.setOffline(true);

  await page.goto("/?view=settings",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#settings")).toHaveClass(/active/);

  const cachedIcon=await page.evaluate(async ()=>{
    const response=await fetch("/icon-192.png");
    return {status:response.status,type:response.headers.get("content-type")||""};
  });
  expect(cachedIcon.status).toBe(200);
  expect(cachedIcon.type).toContain("image/png");

  const missing=await page.evaluate(async ()=>{
    const response=await fetch("/not-cached-pwa-asset.png");
    return {status:response.status,type:response.headers.get("content-type")||""};
  });
  expect(missing.status).toBe(503);
  expect(missing.type).not.toContain("text/html");

  await context.setOffline(false);
});

test("theme color follows the selected app theme",async ({page})=>{
  await page.goto("/?view=settings");
  await page.locator("#light").click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content","#f5f7fb");
  await page.locator("#dark").click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content","#0b1020");
});

test("iPhone install guidance and share target capture are wired",async ({browser})=>{
  const context=await browser.newContext({userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"});
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.setItem("cc-onboarded-v1","1"));
  await page.goto("/?view=settings");
  await expect(page.locator("#installApp")).toHaveText("Install on iPhone");
  await expect(page.locator("#iosInstall")).toBeVisible();

  await page.goto("/?share=1&title=PWA%20Share&text=Captured%20locally&url=https%3A%2F%2Fexample.com");
  await expect(page.locator("#shareModal")).toHaveAttribute("open","");
  await expect(page.locator("#shareTitle")).toHaveValue("PWA Share");
  await expect(page.locator("#shareBody")).toHaveValue(/Captured locally/);
  await expect(page.locator("#shareBody")).toHaveValue(/https:\/\/example\.com/);
  await context.close();
});
