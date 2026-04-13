const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

async function clickGoogleAddAnotherAccountIfPresent(driver) {
  const timeoutMs = 10000;
  const pollIntervalMs = 800;
  const endTime = Date.now() + timeoutMs;
  const selectors = [
    'android=new UiSelector().text("Add another account")',
    'android=new UiSelector().textContains("Add another account")',
    'android=new UiSelector().description("Add another account")',
    'android=new UiSelector().descriptionContains("Add another account")',
    '//*[contains(@text,"Add another account") or contains(@content-desc,"Add another account")]',
    '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"add another account")]'
  ];

  while (Date.now() < endTime) {
    try {
      for (const selector of selectors) {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const exists = await element.isExisting();
          const displayed = exists ? await element.isDisplayed() : false;
          if (!exists || !displayed) {
            continue;
          }
          await element.click();
          console.log(`已点击 Add another account (selector: ${selector})`);
          return true;
        }
      }

      const bySource = await clickByKeywordsFromSourceBounds(
        driver,
        ["Add another account", "another account"],
        "Add another account"
      );
      if (bySource) {
        return true;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：点击 Add another account）。"
        );
      }
    }

    await driver.pause(pollIntervalMs);
  }

  console.log("10 秒内未出现 Add another account，跳过该步骤。");
  return false;
}

module.exports = { clickGoogleAddAnotherAccountIfPresent };
