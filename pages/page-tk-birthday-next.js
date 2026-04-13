const {
  isUiAutomator2CrashedError,
  TK_BIRTHDAY_YEAR_MIN,
  TK_BIRTHDAY_YEAR_MAX,
  parseTkBirthdayYearFromPageSource
} = require("../lib/appium-shared");

async function resolveElementRect(driver, element) {
  const id = element?.elementId;
  if (id && typeof driver.getElementRect === "function") {
    try {
      return await driver.getElementRect(id);
    } catch (_) {
    }
  }
  if (typeof element.getRect === "function") {
    try {
      return await element.getRect();
    } catch (_) {
    }
  }
  try {
    const location = await element.getLocation();
    const size = await element.getSize();
    return {
      x: location.x,
      y: location.y,
      width: size.width,
      height: size.height
    };
  } catch (_) {
    return null;
  }
}

async function readCurrentBirthdayYear(driver) {
  const selectors = [
    'android=new UiSelector().resourceId("com.zhiliaoapp.musically:id/k5o")',
    '//*[@resource-id="com.zhiliaoapp.musically:id/k5o"]',
    '//*[contains(@hint,"Birthday") and contains(@class,"EditText")]'
  ];
  for (const selector of selectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (!exists || !displayed) {
        continue;
      }
      const text = String((await element.getText()) || "");
      const matched = text.match(/\b(19\d{2}|20\d{2})\b/);
      if (matched) {
        return Number(matched[1]);
      }
    }
  }

  try {
    const pickerSelectors = [
      '//*[contains(@resource-id,"id/year_picker") or contains(@content-desc,"Year picker")]',
      'android=new UiSelector().resourceIdMatches(".*id/year_picker.*")'
    ];
    for (const pickerSelector of pickerSelectors) {
      const pickers = await driver.$$(pickerSelector);
      for (const picker of pickers) {
        const pickerExists = await picker.isExisting();
        const pickerDisplayed = pickerExists ? await picker.isDisplayed() : false;
        if (!pickerExists || !pickerDisplayed) {
          continue;
        }
        const raw = String((await picker.getText()) || "");
        const matched = raw.match(/\b(19\d{2}|20\d{2})\b/);
        if (matched) {
          return Number(matched[1]);
        }
      }
    }
  } catch (_) {
  }

  let birthdayPickerVisible = false;
  try {
    const pageMarkers = [
      '//*[contains(@resource-id,"id/year_picker") or contains(@content-desc,"Year picker")]',
      '//*[contains(@resource-id,"id/nox") or contains(@content-desc,"Month picker")]',
      '//*[contains(@resource-id,"id/ezr") or contains(@content-desc,"Day picker")]',
      'android=new UiSelector().textContains("birthday")'
    ];
    for (const marker of pageMarkers) {
      const elements = await driver.$$(marker);
      for (const el of elements) {
        const exists = await el.isExisting();
        const displayed = exists ? await el.isDisplayed() : false;
        if (exists && displayed) {
          birthdayPickerVisible = true;
          break;
        }
      }
      if (birthdayPickerVisible) {
        break;
      }
    }
  } catch (_) {
  }

  if (!birthdayPickerVisible) {
    return null;
  }

  try {
    const source = await driver.getPageSource();
    const fromHeader = parseTkBirthdayYearFromPageSource(source);
    if (fromHeader != null) {
      return fromHeader;
    }
  } catch (_) {
  }
  return null;
}

function isYearInRange(year, yearMin, yearMax) {
  return Number.isFinite(year) && year >= yearMin && year <= yearMax;
}

async function nudgeBirthdayYear(driver, direction) {
  const yearPicker = await driver.$(
    '//*[contains(@resource-id,"id/year_picker") or contains(@content-desc,"Year picker")]'
  );
  const pickerExists = await yearPicker.isExisting();
  const pickerDisplayed = pickerExists ? await yearPicker.isDisplayed() : false;

  if (pickerExists && pickerDisplayed) {
    const rect = await resolveElementRect(driver, yearPicker);
    if (rect && rect.width > 0 && rect.height > 0) {
      try {
        await driver.execute("mobile: clickGesture", {
          x: Math.floor(rect.x + rect.width / 2),
          y: Math.floor(rect.y + rect.height / 2)
        });
        await driver.pause(80);
        if (yearPicker.elementId) {
          await driver.execute("mobile: swipeGesture", {
            elementId: yearPicker.elementId,
            direction,
            percent: 0.75
          });
        } else {
          await driver.execute("mobile: swipeGesture", {
            left: Math.floor(rect.x),
            top: Math.floor(rect.y),
            width: Math.max(20, Math.floor(rect.width)),
            height: Math.max(20, Math.floor(rect.height)),
            direction,
            percent: 0.75
          });
        }
        await driver.pause(220);
        return;
      } catch (err) {
        console.log(`年份滑轮纠偏失败，改用坐标滑动手势: ${String(err?.message || err)}`);
      }
    }
  }

  const windowRect = await driver.getWindowRect();
  const yearX = Math.floor(windowRect.width * 0.78);
  const top = Math.floor(windowRect.height * 0.64);
  const height = Math.floor(windowRect.height * 0.20);
  await driver.execute("mobile: clickGesture", { x: yearX, y: top + Math.floor(height / 2) });
  await driver.pause(80);
  await driver.execute("mobile: swipeGesture", {
    left: Math.floor(yearX - 45),
    top,
    width: 90,
    height,
    direction,
    percent: 0.78
  });
  await driver.pause(240);
}

async function ensureBirthdayYearInRangeBeforeNext(
  driver,
  yearMin = TK_BIRTHDAY_YEAR_MIN,
  yearMax = TK_BIRTHDAY_YEAR_MAX,
  stableHitsRequired = 2
) {
  let consecutiveInRange = 0;
  const maxIterations = 80;
  const endAt = Date.now() + 25000;

  for (let i = 0; i < maxIterations && Date.now() < endAt; i++) {
    const year = await readCurrentBirthdayYear(driver);
    if (year == null) {
      consecutiveInRange = 0;
      await driver.pause(280);
      continue;
    }
    if (year < yearMin || year > yearMax) {
      consecutiveInRange = 0;
      const direction = year > yearMax ? "down" : "up";
      console.log(
        `生日年份越界: ${year}（要求 ${yearMin}-${yearMax}），阻止点击继续，继续向${direction === "down" ? "下" : "上"}纠偏...`
      );
      await nudgeBirthdayYear(driver, direction);
      continue;
    }

    consecutiveInRange += 1;
    console.log(
      `生日年份在合法区间: ${year}（连续命中 ${consecutiveInRange}/${stableHitsRequired} 次后允许继续）`
    );
    if (consecutiveInRange >= stableHitsRequired) {
      console.log(
        `已连续 ${stableHitsRequired} 次读到合适年份 ${yearMin}-${yearMax}，允许点击 Next / Continue。`
      );
      return;
    }
    await driver.pause(220);
  }
  throw new Error(
    `生日年份纠偏超时：未能在限制步数内连续 ${stableHitsRequired} 次读到 ${yearMin}-${yearMax}（或超过 25s），已阻止点击继续。`
  );
}

async function clickTkBirthdayNext(driver) {
  await ensureBirthdayYearInRangeBeforeNext(driver, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX, 2);
  const selectors = [
    'android=new UiSelector().text("Continue")',
    'android=new UiSelector().text("CONTINUE")',
    'android=new UiSelector().text("Next")',
    'android=new UiSelector().text("NEXT")',
    'android=new UiSelector().textContains("Next")',
    'android=new UiSelector().description("Continue")',
    'android=new UiSelector().description("Next")',
    '//*[@text="Continue" or @text="CONTINUE" or @text="Next" or @text="NEXT" or @content-desc="Continue" or @content-desc="CONTINUE" or @content-desc="Next" or @content-desc="NEXT"]'
  ];
  const timeoutMs = 30000;
  const pollIntervalMs = 1500;
  const endTime = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < endTime) {
    for (const selector of selectors) {
      try {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const y1 = await readCurrentBirthdayYear(driver);
          if (!isYearInRange(y1, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX)) {
            const direction = y1 != null && y1 > TK_BIRTHDAY_YEAR_MAX ? "down" : "up";
            console.log(`点击前复核年份失败: ${String(y1)}，继续纠偏后再尝试点击。`);
            await nudgeBirthdayYear(driver, direction);
            continue;
          }
          await driver.pause(120);
          const y2 = await readCurrentBirthdayYear(driver);
          if (!isYearInRange(y2, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX)) {
            const direction = y2 != null && y2 > TK_BIRTHDAY_YEAR_MAX ? "down" : "up";
            console.log(`点击前二次复核年份失败: ${String(y2)}，继续纠偏后再尝试点击。`);
            await nudgeBirthdayYear(driver, direction);
            continue;
          }

          const exists = await element.isExisting();
          const displayed = exists ? await element.isDisplayed() : false;
          if (!exists || !displayed) {
            continue;
          }
          await element.click();
          console.log(`已点击生日页继续按钮 Next/Continue (selector: ${selector})`);
          return;
        }
      } catch (err) {
        if (isUiAutomator2CrashedError(err)) {
          throw new Error(
            "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：点击生日页 Next/Continue）。"
          );
        }
        lastError = err;
      }
    }

    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    `未找到生日页 Next/Continue 按钮。最后错误: ${String(lastError?.message || "未知错误")}`
  );
}


module.exports = {
  readCurrentBirthdayYear,
  nudgeBirthdayYear,
  ensureBirthdayYearInRangeBeforeNext,
  clickTkBirthdayNext
};
