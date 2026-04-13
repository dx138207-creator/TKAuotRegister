const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function clickContinueWithGoogle(driver) {
  const selectors = [
    "~Continue with Google",
    'android=new UiSelector().text("Continue with Google")',
    'android=new UiSelector().textContains("Continue with Google")',
    'android=new UiSelector().textContains("Google")',
    'android=new UiSelector().description("Continue with Google")',
    'android=new UiSelector().descriptionContains("Continue with Google")',
    'android=new UiSelector().descriptionContains("Google")',
    '//*[@text="Continue with Google" or @content-desc="Continue with Google"]',
    '//*[contains(@text,"Google") or contains(@content-desc,"Google")]',
    '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"google") or contains(translate(@content-desc,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"google")]'
  ];
  const timeoutMs = 10000;
  const pollIntervalMs = 2000;
  const endTime = Date.now() + timeoutMs;

  let lastError;
  let loopCount = 0;

  async function clickBySourceBounds() {
    const source = await driver.getPageSource();
    const lineWithGoogle = source.match(
      /<[^>]*(?:text|content-desc)="[^"]*Google[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*>/i
    );

    if (!lineWithGoogle) {
      return false;
    }

    const x1 = Number(lineWithGoogle[1]);
    const y1 = Number(lineWithGoogle[2]);
    const x2 = Number(lineWithGoogle[3]);
    const y2 = Number(lineWithGoogle[4]);
    const x = Math.floor((x1 + x2) / 2);
    const y = Math.floor((y1 + y2) / 2);

    await driver.execute("mobile: clickGesture", { x, y });
    console.log(`已通过坐标点击 Google 区域: (${x}, ${y})`);
    return true;
  }

  while (Date.now() < endTime) {
    for (const selector of selectors) {
      try {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const exists = await element.isExisting();
          if (!exists) {
            continue;
          }
          const displayed = await element.isDisplayed();
          if (!displayed) {
            continue;
          }

          // 某些页面中真正可点击的是父节点容器，不是文字本身
          let clickableTarget = element;
          for (let i = 0; i < 3; i++) {
            const isClickable = await clickableTarget.getAttribute("clickable");
            if (String(isClickable) === "true") {
              break;
            }
            const parent = await clickableTarget.$("..");
            const hasParent = await parent.isExisting();
            if (!hasParent) {
              break;
            }
            clickableTarget = parent;
          }

          await clickableTarget.click();
          console.log(`已点击按钮: Continue with Google (selector: ${selector})`);
          return;
        }
      } catch (err) {
        if (isUiAutomator2CrashedError(err)) {
          throw new Error(
            "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：点击 Continue with Google）。"
          );
        }
        lastError = err;
      }
    }

    try {
      const clicked = await clickBySourceBounds();
      if (clicked) {
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error("UiAutomator2 会话已崩溃，请重启 Appium 服务后重试。");
      }
      lastError = err;
    }

    loopCount += 1;
    if (loopCount % 5 === 0) {
      console.log("仍在等待 Google 按钮，已尝试选择器和坐标点击兜底...");
    }
    console.log("等待 Continue with Google 按钮出现...");
    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    [
      "未找到 Continue with Google 按钮。",
      `已等待约 ${Math.floor(timeoutMs / 1000)} 秒，请确认页面已加载到登录页。`,
      "可提供该按钮的资源 ID 以提高定位稳定性。",
      `最后错误: ${String(lastError?.message || "未知错误")}`
    ].join("\n")
  );
}


module.exports = { clickContinueWithGoogle };
