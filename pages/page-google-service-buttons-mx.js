const { clickByKeywordsFromSourceBounds, isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function clickGoogleActionButtonMx(driver, options) {
  const {
    label,
    nativeSelectors,
    webviewSelectors,
    sourceKeywords = [],
    coordinateFallback = null,
    timeoutMs = 45000,
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
          sourceKeywords.length
            ? sourceKeywords
            : [label, String(label).toUpperCase(), String(label).toLowerCase()],
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

async function clickAceptoAfterPasswordMx(driver) {
  await clickGoogleActionButtonMx(driver, {
    label: "Acepto",
    nativeSelectors: [
      'android=new UiSelector().text("Acepto")',
      'android=new UiSelector().textContains("Acepto")',
      'android=new UiSelector().description("Acepto")',
      'android=new UiSelector().descriptionContains("Acepto")',
      '//*[@text="Acepto" or @content-desc="Acepto"]',
      '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ","abcdefghijklmnopqrstuvwxyzáéíóúñ"),"acepto")]'
    ],
    webviewSelectors: [
      "button=Acepto",
      "button*=Acepto",
      'input[type="submit"][value="Acepto"]',
      '//*[contains(translate(@value,"ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ","abcdefghijklmnopqrstuvwxyzáéíóúñ"),"acepto")]',
      '//*[self::button or self::a][contains(normalize-space(.), "Acepto")]'
    ],
    sourceKeywords: ["Acepto", "ACEPTO"]
  });
}

async function tryClickMostrarMasIfPresentMx(driver) {
  const selectors = [
    'android=new UiSelector().text("Mostrar más")',
    'android=new UiSelector().textContains("Mostrar más")',
    'android=new UiSelector().textContains("Mostrar m")',
    'android=new UiSelector().descriptionContains("Mostrar")',
    '//*[contains(@text,"Mostrar más") or contains(@text,"Mostrar m")]'
  ];
  for (const selector of selectors) {
    try {
      const elements = await driver.$$(selector);
      for (const element of elements.slice(0, 3)) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        await element.click();
        console.log(`已点击 Mostrar más 以展开 Google 服务页内容 (selector: ${selector})`);
        await driver.pause(500);
        return true;
      }
    } catch (_) {
    }
  }
  return false;
}

async function scrollGoogleServicesPageTowardBottomMx(driver) {
  const rect = await driver.getWindowRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  for (let i = 0; i < 4; i++) {
    try {
      await driver.execute("mobile: swipeGesture", {
        left: Math.floor(w * 0.08),
        top: Math.floor(h * 0.35),
        width: Math.floor(w * 0.84),
        height: Math.floor(h * 0.45),
        direction: "up",
        percent: 0.65
      });
    } catch (_) {
    }
    await driver.pause(280);
  }
}

async function primeServiciosGoogleBeforeAceptarMx(driver) {
  await tryClickMostrarMasIfPresentMx(driver);
  await scrollGoogleServicesPageTowardBottomMx(driver);
}

async function clickMasAfterGoogleServicesMx(driver) {
  await clickGoogleActionButtonMx(driver, {
    label: "Más",
    nativeSelectors: [
      'android=new UiSelector().text("Más")',
      'android=new UiSelector().text("MÁS")',
      'android=new UiSelector().text("MAS")',
      'android=new UiSelector().textContains("Más")',
      'android=new UiSelector().textContains("MÁS")',
      'android=new UiSelector().textContains("MAS")',
      'android=new UiSelector().description("Más")',
      'android=new UiSelector().description("MÁS")',
      'android=new UiSelector().description("MAS")',
      'android=new UiSelector().descriptionContains("Más")',
      'android=new UiSelector().descriptionContains("MÁS")',
      'android=new UiSelector().descriptionContains("MAS")',
      '//*[@text="Más" or @content-desc="Más" or @text="MÁS" or @content-desc="MÁS" or @text="MAS" or @content-desc="MAS"]'
    ],
    webviewSelectors: [
      "button=Más",
      "button=MÁS",
      "button=MAS",
      "button*=Más",
      "button*=MÁS",
      "button*=MAS",
      '//*[self::button or self::a][contains(normalize-space(.), "Más") or contains(normalize-space(.), "MÁS") or contains(normalize-space(.), "MAS")]'
    ],
    sourceKeywords: ["Más", "MÁS", "MAS"]
  });
}

async function clickAceptarAfterGoogleServicesMx(driver) {
  await primeServiciosGoogleBeforeAceptarMx(driver);
  await clickGoogleActionButtonMx(driver, {
    label: "Aceptar",
    nativeSelectors: [
      'android=new UiSelector().text("ACEPTAR")',
      'android=new UiSelector().textContains("ACEPTAR")',
      'android=new UiSelector().description("ACEPTAR")',
      'android=new UiSelector().descriptionContains("ACEPTAR")',
      'android=new UiSelector().text("Aceptar")',
      'android=new UiSelector().textContains("Aceptar")',
      'android=new UiSelector().description("Aceptar")',
      'android=new UiSelector().descriptionContains("Aceptar")',
      '//*[@text="ACEPTAR" or @content-desc="ACEPTAR" or @text="Aceptar" or @content-desc="Aceptar"]',
      '//*[contains(@text,"ACEPTAR") or contains(@content-desc,"ACEPTAR") or contains(@text,"Aceptar") or contains(@content-desc,"Aceptar")]'
    ],
    webviewSelectors: [
      "button=ACEPTAR",
      "button=Aceptar",
      "button*=ACEPTAR",
      "button*=Aceptar",
      'input[type="submit"][value="ACEPTAR"]',
      'input[type="submit"][value="Aceptar"]',
      '//*[self::button or self::a][contains(normalize-space(.), "ACEPTAR") or contains(normalize-space(.), "Aceptar")]'
    ],
    sourceKeywords: ["ACEPTAR", "Aceptar", "aceptar"],
    nativeProbeEvery: 1,
    coordinateFallback: { xPercent: 0.88, yPercent: 0.935 }
  });
}

module.exports = {
  clickGoogleActionButtonMx,
  clickAceptoAfterPasswordMx,
  clickMasAfterGoogleServicesMx,
  clickAceptarAfterGoogleServicesMx
};
