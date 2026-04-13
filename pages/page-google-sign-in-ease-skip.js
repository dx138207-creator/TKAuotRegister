const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

async function isGoogleEmailFieldVisible(driver) {
  const nativeSelectors = [
    'android=new UiSelector().resourceId("identifierId")',
    '//*[@resource-id="identifierId" and contains(@class,"EditText")]'
  ];
  for (const selector of nativeSelectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (!exists || !displayed) {
        continue;
      }
      const className = String((await element.getAttribute("class")) || "");
      const resourceId = String((await element.getAttribute("resource-id")) || "");
      const isEditText =
        className.includes("EditText") ||
        resourceId.endsWith(":id/identifierId") ||
        resourceId === "identifierId";
      if (isEditText) {
        return true;
      }
    }
  }

  try {
    const contexts = await driver.getContexts();
    const webviewContext = contexts.find((ctx) => ctx.toUpperCase().includes("WEBVIEW"));
    if (!webviewContext) {
      return false;
    }
    const currentContext = await driver.getContext();
    try {
      await driver.switchContext(webviewContext);
      const elements = await driver.$$('input[type="email"], #identifierId, input[name="identifier"]');
      for (const element of elements) {
        if (await element.isDisplayed()) {
          return true;
        }
      }
      return false;
    } finally {
      await driver.switchContext(currentContext);
    }
  } catch (_) {
    return false;
  }
}

async function isSignInWithEasePage(driver) {
  const selectors = [
    'android=new UiSelector().textContains("Sign in with ease")',
    'android=new UiSelector().textContains("sign in with ease")',
    'android=new UiSelector().descriptionContains("Sign in with ease")',
    '//*[contains(@text,"Sign in with ease") or contains(@content-desc,"Sign in with ease")]'
  ];
  for (const selector of selectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (exists && displayed) {
        return true;
      }
    }
  }
  try {
    const source = await driver.getPageSource();
    if (/sign in with ease/i.test(source)) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function tryClickSkipButton(driver) {
  const selectors = [
    'android=new UiSelector().text("SKIP")',
    'android=new UiSelector().textMatches("(?i)skip")',
    '//*[@text="SKIP" or @content-desc="SKIP" or @text="Skip"]'
  ];
  for (const selector of selectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (!exists || !displayed) {
        continue;
      }
      let target = element;
      for (let i = 0; i < 3; i++) {
        try {
          const clickable = await target.getAttribute("clickable");
          if (String(clickable) === "true") {
            break;
          }
        } catch (_) {
        }
        try {
          const parent = await target.$("..");
          if (await parent.isExisting()) {
            target = parent;
          } else {
            break;
          }
        } catch (_) {
          break;
        }
      }
      await target.click();
      console.log(`已点击 Sign in with ease 页 SKIP (selector: ${selector})`);
      return true;
    }
  }

  try {
    const contexts = await driver.getContexts();
    const webviewContext = contexts.find((ctx) => ctx.toUpperCase().includes("WEBVIEW"));
    if (webviewContext) {
      const currentContext = await driver.getContext();
      try {
        await driver.switchContext(webviewContext);
        const webSelectors = [
          "button=SKIP",
          "a=SKIP",
          '//button[contains(normalize-space(.),"SKIP")]',
          '//a[contains(normalize-space(.),"SKIP")]'
        ];
        for (const sel of webSelectors) {
          try {
            const elements = await driver.$$(sel);
            for (const element of elements) {
              if (await element.isDisplayed()) {
                await element.click();
                console.log(`已点击 Sign in with ease 页 SKIP (webview: ${sel})`);
                return true;
              }
            }
          } catch (_) {
          }
        }
      } finally {
        await driver.switchContext(currentContext);
      }
    }
  } catch (_) {
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["SKIP", "Skip"], "Sign in with ease SKIP")) {
    return true;
  }

  const rect = await driver.getWindowRect();
  const x = Math.floor(rect.width * 0.18);
  const y = Math.floor(rect.height * 0.92);
  await driver.execute("mobile: clickGesture", { x, y });
  console.log(`已通过左下角坐标兜底点击 SKIP: (${x}, ${y})`);
  return true;
}

async function skipSignInWithEaseIfPresent(driver) {
  const timeoutMs = 35000;
  const pollIntervalMs = 1500;
  const endTime = Date.now() + timeoutMs;

  while (Date.now() < endTime) {
    try {
      if (await isGoogleEmailFieldVisible(driver)) {
        console.log("已出现 Google 账号输入框，跳过 Sign in with ease 步骤。");
        return;
      }

      if (await isSignInWithEasePage(driver)) {
        await tryClickSkipButton(driver);
        await driver.pause(900);
        if (await isGoogleEmailFieldVisible(driver)) {
          console.log("点击 SKIP 后已出现账号输入框。");
          return;
        }
        continue;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：Sign in with ease SKIP）。"
        );
      }
      console.log(`检测 Sign in with ease 页异常（忽略并继续）: ${String(err?.message || err)}`);
    }

    await driver.pause(pollIntervalMs);
  }

  console.log("未检测到 Sign in with ease 页或已超时，交由下一步输入账号。");
}

module.exports = { skipSignInWithEaseIfPresent, isGoogleEmailFieldVisible, isSignInWithEasePage };
