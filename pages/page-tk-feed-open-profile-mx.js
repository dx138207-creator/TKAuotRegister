const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

const FEED_WAIT_MS = 12000;
const POLL_MS = 400;

async function isLikelyMainFeedMx(driver) {
  const markers = [
    'android=new UiSelector().text("Para ti")',
    'android=new UiSelector().textContains("Para ti")',
    'android=new UiSelector().text("Siguiendo")',
    'android=new UiSelector().textContains("Siguiendo")',
    'android=new UiSelector().text("Explorar")',
    '//*[contains(@text,"Para ti")]',
    '//*[contains(@text,"Siguiendo")]'
  ];
  for (const selector of markers) {
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
    if (/Para ti/i.test(source) || /Siguiendo/i.test(source) || /Explorar/i.test(source)) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function tryClickPerfilTab(driver) {
  const selectors = [
    "~Perfil",
    'android=new UiSelector().description("Perfil")',
    'android=new UiSelector().descriptionContains("Perfil")',
    'android=new UiSelector().text("Perfil")',
    '//*[@content-desc="Perfil" or @text="Perfil"]',
    '//*[contains(@content-desc,"Perfil") and contains(@class,"FrameLayout")]'
  ];

  for (const selector of selectors) {
    try {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        let target = element;
        for (let i = 0; i < 4; i++) {
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
        console.log(`已点击底部导航 Perfil (selector: ${selector})`);
        return true;
      }
    } catch (_) {
    }
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["Perfil"], "底部 Perfil")) {
    console.log("已通过源码坐标点击 Perfil");
    return true;
  }

  const win = await driver.getWindowRect();
  const x = Math.floor(win.width * 0.88);
  const y = Math.floor(win.height * 0.945);
  await driver.execute("mobile: clickGesture", { x, y });
  console.log(`已通过右下角兜底坐标点击 Perfil: (${x}, ${y})`);
  return true;
}

async function prepareBottomNavForPerfilClickMx(driver) {
  // 某些机型会弹出输入法或浮层，先尝试收起，避免遮挡底部导航
  try {
    if (typeof driver.isKeyboardShown === "function") {
      const shown = await driver.isKeyboardShown();
      if (shown) {
        await driver.back();
        await driver.pause(250);
      }
    }
  } catch (_) {
  }

  // 轻微上滑，确保底部导航可见且可点击
  try {
    const rect = await driver.getWindowRect();
    await driver.execute("mobile: swipeGesture", {
      left: Math.floor(rect.width * 0.10),
      top: Math.floor(rect.height * 0.55),
      width: Math.floor(rect.width * 0.80),
      height: Math.floor(rect.height * 0.25),
      direction: "up",
      percent: 0.22
    });
    await driver.pause(220);
  } catch (_) {
  }
}

async function isOnPerfilPageMx(driver) {
  const markers = [
    'android=new UiSelector().text("Perfil")',
    'android=new UiSelector().textContains("Editar perfil")',
    'android=new UiSelector().textContains("Publicaciones")',
    '//*[contains(@text,"Editar perfil") or contains(@text,"Publicaciones")]'
  ];
  for (const selector of markers) {
    try {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (exists && displayed) {
          return true;
        }
      }
    } catch (_) {
    }
  }
  return false;
}

async function openPerfilFromMainFeedMx(driver) {
  const deadline = Date.now() + FEED_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      if (await isLikelyMainFeedMx(driver)) {
        break;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：墨西哥主刷进入 Perfil）。"
        );
      }
    }
    await driver.pause(POLL_MS);
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    await prepareBottomNavForPerfilClickMx(driver);
    await tryClickPerfilTab(driver);
    await driver.pause(650);
    if (await isOnPerfilPageMx(driver)) {
      console.log(`已点击 Perfil 并确认进入个人主页（第 ${attempt} 次尝试）。`);
      return;
    }
    console.log(`点击 Perfil 后尚未确认进入个人主页，准备第 ${attempt + 1} 次重试。`);
  }
  console.log("已尝试点击右下角 Perfil，但未能可靠确认已进入个人主页。");
}

module.exports = {
  openPerfilFromMainFeedMx,
  isLikelyMainFeedMx
};
