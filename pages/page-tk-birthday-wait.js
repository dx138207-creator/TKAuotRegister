const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function waitForTkBirthdayPage(driver) {
  const selectors = [
    'android=new UiSelector().textContains("When’s your birthday?")',
    "android=new UiSelector().textContains(\"When's your birthday?\")",
    'android=new UiSelector().textContains("birthday")',
    '//*[contains(@resource-id,"id/nox") or contains(@content-desc,"Month picker")]',
    '//*[contains(@resource-id,"id/ezr") or contains(@content-desc,"Day picker")]',
    '//*[contains(@resource-id,"id/year_picker") or contains(@content-desc,"Year picker")]'
  ];
  const timeoutMs = 90000;
  const pollIntervalMs = 2000;
  const endTime = Date.now() + timeoutMs;

  while (Date.now() < endTime) {
    for (const selector of selectors) {
      try {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const exists = await element.isExisting();
          const displayed = exists ? await element.isDisplayed() : false;
          if (exists && displayed) {
            console.log("已进入 TK 生日选择页");
            return;
          }
        }
      } catch (err) {
        if (isUiAutomator2CrashedError(err)) {
          throw new Error("UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：等待生日页）。");
        }
      }
    }

    console.log("等待 TK 生日选择页出现...");
    await driver.pause(pollIntervalMs);
  }

  throw new Error("等待 TK 生日选择页超时。");
}


module.exports = { waitForTkBirthdayPage };
