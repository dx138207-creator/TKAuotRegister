async function clickTkAcceptAndContinueIfPresent(driver) {
  const selectors = [
    'android=new UiSelector().text("Aceptar y continuar")',
    'android=new UiSelector().textContains("Aceptar y continuar")',
    '//*[@text="Aceptar y continuar" or @text="ACEPTAR Y CONTINUAR"]',
    '//*[@content-desc="Aceptar y continuar" or @content-desc="ACEPTAR Y CONTINUAR"]'
  ];

  const timeoutMs = 12000;
  const pollIntervalMs = 800;
  const endAt = Date.now() + timeoutMs;

  while (Date.now() < endAt) {
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
          console.log("已点击墨西哥欢迎页按钮: Aceptar y continuar");
          await driver.pause(700);
          return true;
        }
      } catch (_) {
      }
    }
    await driver.pause(pollIntervalMs);
  }

  console.log("未检测到墨西哥欢迎页按钮 Aceptar y continuar，继续后续流程。");
  return false;
}

module.exports = {
  clickTkAcceptAndContinueIfPresent
};
