const { clickByKeywordsFromSourceBounds, isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function clickGoogleActionButton(driver, options) {
  const {
    label,
    nativeSelectors,
    webviewSelectors,
    sourceKeywords = [],
    coordinateFallback = null,
    timeoutMs = 90000,
    pollIntervalMs = 2000,
    nativeProbeEvery = 3
  } = options;
  const endTime = Date.now() + timeoutMs;
  let lastError;
  let loopCount = 0;
  let webviewUnavailable = false;

  async function clickWithParentFallback(element, channel, selector) {
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
        const hasParent = await parent.isExisting();
        if (!hasParent) {
          break;
        }
        target = parent;
      } catch (_) {
        break;
      }
    }
    await target.click();
    console.log(`已点击 ${label} 按钮 (${channel}: ${selector})`);
    return true;
  }

  async function tryCoordinateFallback() {
    if (!coordinateFallback || typeof coordinateFallback !== "object") {
      return false;
    }
    const rect = await driver.getWindowRect();
    const xPercent = Math.max(0.05, Math.min(0.95, Number(coordinateFallback.xPercent || 0.86)));
    const yPercent = Math.max(0.05, Math.min(0.95, Number(coordinateFallback.yPercent || 0.94)));
    const x = Math.floor(rect.width * xPercent);
    const y = Math.floor(rect.height * yPercent);
    await driver.execute("mobile: clickGesture", { x, y });
    console.log(`已通过坐标兜底点击 ${label}: (${x}, ${y})`);
    await driver.pause(350);
    return true;
  }

  async function tryClickByWebViewSelectors() {
    if (webviewUnavailable) {
      return false;
    }
    const contexts = await driver.getContexts();
    const webviewContext = contexts.find((ctx) => ctx.toUpperCase().includes("WEBVIEW"));
    if (!webviewContext) {
      return false;
    }

    const currentContext = await driver.getContext();
    try {
      if (currentContext !== webviewContext) {
        await driver.switchContext(webviewContext);
      }
      for (const selector of webviewSelectors) {
        const elements = await driver.$$(selector);
        for (const element of elements.slice(0, 6)) {
          const exists = await element.isExisting();
          if (!exists) {
            continue;
          }
          const displayed = await element.isDisplayed();
          if (!displayed) {
            continue;
          }
          if (await clickWithParentFallback(element, "webview", selector)) {
            return true;
          }
        }
      }
      return false;
    } finally {
      if (currentContext !== webviewContext) {
        await driver.switchContext(currentContext);
      }
    }
  }

  async function tryClickByNativeSelectors() {
    for (const selector of nativeSelectors) {
      const elements = await driver.$$(selector);
      for (const element of elements.slice(0, 6)) {
        const exists = await element.isExisting();
        if (!exists) {
          continue;
        }
        const displayed = await element.isDisplayed();
        if (!displayed) {
          continue;
        }
        if (await clickWithParentFallback(element, "native", selector)) {
          return true;
        }
      }
    }
    return false;
  }

  while (Date.now() < endTime) {
    loopCount += 1;
    try {
      if (await tryClickByWebViewSelectors()) {
        return;
      }
      if (loopCount % nativeProbeEvery === 0) {
        if (await tryClickByNativeSelectors()) {
          return;
        }
        const sourceClicked = await clickByKeywordsFromSourceBounds(
          driver,
          sourceKeywords.length ? sourceKeywords : [label, String(label).toUpperCase(), String(label).toLowerCase()],
          label
        );
        if (sourceClicked) {
          return;
        }
        if (await tryCoordinateFallback()) {
          // 坐标点击后由下一轮流程判断是否已跳页
        }
      }
    } catch (err) {
      const message = String(err?.message || err || "");
      if (/No Chromedriver found that can automate Chrome/i.test(message)) {
        webviewUnavailable = true;
        console.log(`检测到 Chromedriver 不匹配，${label} 步骤后续仅使用 Native/源码坐标兜底。`);
        continue;
      }
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(`UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：点击 ${label}）。`);
      }
      lastError = err;
    }
    console.log(`等待 ${label} 按钮出现...`);
    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    [
      `未找到 ${label} 按钮。`,
      `已等待约 ${Math.floor(timeoutMs / 1000)} 秒。`,
      `最后错误: ${String(lastError?.message || "未知错误")}`
    ].join("\n")
  );
}

async function clickIAgreeAfterPassword(driver) {
  await clickGoogleActionButton(driver, {
    label: "I agree",
    nativeSelectors: [
      'android=new UiSelector().text("I agree")',
      'android=new UiSelector().textContains("I agree")',
      'android=new UiSelector().textMatches("(?i).*i\\s*agree.*")',
      'android=new UiSelector().description("I agree")',
      'android=new UiSelector().descriptionContains("I agree")',
      'android=new UiSelector().descriptionMatches("(?i).*i\\s*agree.*")',
      '//*[@text="I agree" or @content-desc="I agree"]',
      '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"i agree") or contains(translate(@content-desc,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"i agree")]'
    ],
    webviewSelectors: [
      'button=I agree',
      'button*=I agree',
      'input[type="submit"][value="I agree"]',
      '//*[contains(translate(@value,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"i agree")]',
      '//*[self::button or self::a][contains(normalize-space(.), "I agree")]',
      '//*[self::button or self::a or @role="button" or self::div or self::span][contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "i agree")]'
    ],
    sourceKeywords: ["I agree", "I AGREE", "Agree"]
  });
}

async function clickMoreAfterGoogleServices(driver) {
  await clickGoogleActionButton(driver, {
    label: "MORE",
    nativeSelectors: [
      'android=new UiSelector().text("MORE")',
      'android=new UiSelector().textContains("MORE")',
      'android=new UiSelector().description("MORE")',
      'android=new UiSelector().descriptionContains("MORE")',
      '//*[@text="MORE" or @content-desc="MORE"]'
    ],
    webviewSelectors: [
      "button=MORE",
      "button*=MORE",
      '//*[self::button or self::a][contains(normalize-space(.), "MORE")]'
    ],
    sourceKeywords: ["MORE", "More"]
  });
}

async function clickAcceptAfterGoogleServices(driver) {
  await clickGoogleActionButton(driver, {
    label: "ACCEPT",
    nativeSelectors: [
      'android=new UiSelector().text("ACCEPT")',
      'android=new UiSelector().textContains("ACCEPT")',
      'android=new UiSelector().description("ACCEPT")',
      'android=new UiSelector().descriptionContains("ACCEPT")',
      '//*[@text="ACCEPT" or @content-desc="ACCEPT"]'
    ],
    webviewSelectors: [
      "button=ACCEPT",
      "button*=ACCEPT",
      '//*[self::button or self::a][contains(normalize-space(.), "ACCEPT")]'
    ],
    sourceKeywords: ["ACCEPT", "Accept"],
    nativeProbeEvery: 1,
    coordinateFallback: { xPercent: 0.86, yPercent: 0.94 }
  });
}


module.exports = {
  clickGoogleActionButton,
  clickIAgreeAfterPassword,
  clickMoreAfterGoogleServices,
  clickAcceptAfterGoogleServices
};
