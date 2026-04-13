async function clickGoogleNext(driver, stage = "当前页") {
  const nativeSelectors = [
    'android=new UiSelector().text("NEXT")',
    'android=new UiSelector().textContains("NEXT")',
    'android=new UiSelector().description("NEXT")',
    '//*[@text="NEXT" or @content-desc="NEXT"]'
  ];
  const webviewSelectors = [
    '#identifierNext',
    'button[jsname="LgbsSe"]',
    'button[type="button"]'
  ];
  const timeoutMs = 45000;
  const pollIntervalMs = 2000;
  const endTime = Date.now() + timeoutMs;
  let lastError;

  async function tryClickByNativeSelectors() {
    for (const selector of nativeSelectors) {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        await element.click();
        console.log(`已点击 NEXT 按钮（${stage}）(native: ${selector})`);
        return true;
      }
    }
    return false;
  }

  async function tryClickByWebViewSelectors() {
    const contexts = await driver.getContexts();
    const webviewContext = contexts.find((ctx) => ctx.toUpperCase().includes("WEBVIEW"));
    if (!webviewContext) {
      return false;
    }

    const currentContext = await driver.getContext();
    try {
      await driver.switchContext(webviewContext);
      for (const selector of webviewSelectors) {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const displayed = await element.isDisplayed();
          if (!displayed) {
            continue;
          }
          await element.click();
          console.log(`已点击 NEXT 按钮（${stage}）(webview: ${selector})`);
          return true;
        }
      }
      return false;
    } finally {
      await driver.switchContext(currentContext);
    }
  }

  while (Date.now() < endTime) {
    try {
      if (await tryClickByNativeSelectors()) {
        return;
      }
      if (await tryClickByWebViewSelectors()) {
        return;
      }
    } catch (err) {
      lastError = err;
    }

    console.log(`等待 NEXT 按钮出现（${stage}）...`);
    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    [
      "未找到 Google 的 NEXT 按钮。",
      `已等待约 ${Math.floor(timeoutMs / 1000)} 秒。`,
      `最后错误: ${String(lastError?.message || "未知错误")}`
    ].join("\n")
  );
}


module.exports = { clickGoogleNext };
