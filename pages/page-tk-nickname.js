const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function readNicknameFromInput(driver) {
  const selectors = [
    'android=new UiSelector().className("android.widget.EditText")',
    '//*[contains(@class,"EditText") and (contains(@hint,"Nickname") or contains(@hint,"nickname") or contains(@hint,"name"))]',
    '//*[contains(@resource-id,"musically") and contains(@class,"EditText")]',
    '//*[@class="android.widget.EditText"]'
  ];
  for (const selector of selectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (!exists || !displayed) {
        continue;
      }
      try {
        const text = String((await element.getText()) || "").trim();
        if (text) {
          return text;
        }
      } catch (_) {
      }
    }
  }
  try {
    const source = await driver.getPageSource();
    const m = source.match(/class="android\.widget\.EditText"[^>]*text="([^"]*)"/i);
    if (m && m[1]) {
      const t = String(m[1] || "")
        .replace(/&quot;/g, '"')
        .trim();
      if (t) {
        return t;
      }
    }
  } catch (_) {
  }
  return "";
}

async function clickTkCreateNicknameSkip(driver) {
  const pageMarkers = [
    'android=new UiSelector().textContains("Create nickname")',
    'android=new UiSelector().textContains("nickname")'
  ];
  const selectors = [
    'android=new UiSelector().text("Skip")',
    'android=new UiSelector().description("Skip")',
    '//*[@text="Skip" or @content-desc="Skip"]'
  ];
  const timeoutMs = 30000;
  const pollIntervalMs = 1200;
  const endTime = Date.now() + timeoutMs;
  let lastError;

  async function isOnNicknamePage() {
    for (const marker of pageMarkers) {
      const elements = await driver.$$(marker);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (exists && displayed) {
          return true;
        }
      }
    }
    return false;
  }

  // 先等待进入昵称页
  while (Date.now() < endTime) {
    try {
      if (await isOnNicknamePage()) {
        break;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error("UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：等待昵称页）。");
      }
    }
    await driver.pause(pollIntervalMs);
  }

  await driver.pause(400);
  let nicknameForLog = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      nicknameForLog = await readNicknameFromInput(driver);
      if (nicknameForLog) {
        break;
      }
    } catch (_) {
    }
    await driver.pause(350);
  }
  if (nicknameForLog) {
    const safe = nicknameForLog.replace(/\r?\n/g, " ").trim().slice(0, 200);
    console.log(`NICKNAME_CAPTURED:${safe}`);
  }

  while (Date.now() < endTime) {
    for (const selector of selectors) {
      try {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const exists = await element.isExisting();
          const displayed = exists ? await element.isDisplayed() : false;
          if (!exists || !displayed) {
            continue;
          }
          await element.click();
          console.log(`已点击昵称页 Skip 按钮 (selector: ${selector})`);
          return;
        }
      } catch (err) {
        if (isUiAutomator2CrashedError(err)) {
          throw new Error("UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：点击昵称页 Skip）。");
        }
        lastError = err;
      }
    }
    await driver.pause(pollIntervalMs);
  }

  throw new Error(`未找到昵称页 Skip 按钮。最后错误: ${String(lastError?.message || "未知错误")}`);
}


module.exports = { clickTkCreateNicknameSkip, readNicknameFromInput };
