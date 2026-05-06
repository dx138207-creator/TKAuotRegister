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

async function readCurrentBirthdayYearMx(driver) {
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

function isYearInRangeMx(year, yearMin, yearMax) {
  return Number.isFinite(year) && year >= yearMin && year <= yearMax;
}

async function nudgeBirthdayYearMx(driver, direction) {
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
        console.log(`墨西哥年份滑轮纠偏失败，改用坐标滑动手势: ${String(err?.message || err)}`);
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

async function ensureBirthdayYearInRangeBeforeContinuarMx(
  driver,
  yearMin = TK_BIRTHDAY_YEAR_MIN,
  yearMax = TK_BIRTHDAY_YEAR_MAX,
  stableHitsRequired = 2
) {
  let consecutiveInRange = 0;
  const maxIterations = 80;
  const endAt = Date.now() + 25000;

  for (let i = 0; i < maxIterations && Date.now() < endAt; i++) {
    const year = await readCurrentBirthdayYearMx(driver);
    if (year == null) {
      consecutiveInRange = 0;
      await driver.pause(280);
      continue;
    }
    if (year < yearMin || year > yearMax) {
      consecutiveInRange = 0;
      const direction = year > yearMax ? "down" : "up";
      console.log(
        `墨西哥生日年份越界: ${year}（要求 ${yearMin}-${yearMax}），阻止点击继续，继续向${direction === "down" ? "下" : "上"}纠偏...`
      );
      await nudgeBirthdayYearMx(driver, direction);
      continue;
    }

    consecutiveInRange += 1;
    console.log(
      `墨西哥生日年份在合法区间: ${year}（连续命中 ${consecutiveInRange}/${stableHitsRequired} 次后允许继续）`
    );
    if (consecutiveInRange >= stableHitsRequired) {
      console.log(
        `墨西哥已连续 ${stableHitsRequired} 次读到合适年份 ${yearMin}-${yearMax}，允许点击 Continuar。`
      );
      return;
    }
    await driver.pause(220);
  }
  throw new Error(
    `墨西哥生日年份纠偏超时：未能在限制步数内连续 ${stableHitsRequired} 次读到 ${yearMin}-${yearMax}（或超过 25s），已阻止点击继续。`
  );
}

async function ensureBirthdayYearStableForClickMx(
  driver,
  yearMin = TK_BIRTHDAY_YEAR_MIN,
  yearMax = TK_BIRTHDAY_YEAR_MAX,
  sameYearHitsRequired = 3
) {
  let stableCount = 0;
  let lastYear = null;
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    const y = await readCurrentBirthdayYearMx(driver);
    if (!isYearInRangeMx(y, yearMin, yearMax)) {
      stableCount = 0;
      lastYear = null;
      const direction = y != null && y > yearMax ? "down" : "up";
      await nudgeBirthdayYearMx(driver, direction);
      continue;
    }

    if (y === lastYear) {
      stableCount += 1;
    } else {
      stableCount = 1;
      lastYear = y;
    }

    if (stableCount >= sameYearHitsRequired) {
      return y;
    }
    await driver.pause(130);
  }

  throw new Error(
    `墨西哥点击前稳定校验失败：未能在 10s 内连续 ${sameYearHitsRequired} 次读到同一年且位于 ${yearMin}-${yearMax}`
  );
}

async function clickTkBirthdayContinuarMx(driver) {
  await ensureBirthdayYearInRangeBeforeContinuarMx(driver, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX, 3);
  const selectors = [
    'android=new UiSelector().text("Continuar")',
    'android=new UiSelector().text("CONTINUAR")',
    'android=new UiSelector().textContains("Continuar")',
    'android=new UiSelector().text("Siguiente")',
    'android=new UiSelector().text("SIGUIENTE")',
    'android=new UiSelector().textContains("Siguiente")',
    'android=new UiSelector().description("Continuar")',
    'android=new UiSelector().description("Siguiente")',
    '//*[@text="Continuar" or @text="CONTINUAR" or @content-desc="Continuar" or @content-desc="CONTINUAR" or @text="Siguiente" or @text="SIGUIENTE" or @content-desc="Siguiente" or @content-desc="SIGUIENTE"]'
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
          await ensureBirthdayYearStableForClickMx(driver, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX, 3);
          const y1 = await readCurrentBirthdayYearMx(driver);
          if (!isYearInRangeMx(y1, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX)) {
            const direction = y1 != null && y1 > TK_BIRTHDAY_YEAR_MAX ? "down" : "up";
            console.log(`墨西哥点击前复核年份失败: ${String(y1)}，继续纠偏后再尝试点击。`);
            await nudgeBirthdayYearMx(driver, direction);
            continue;
          }
          await driver.pause(180);
          const y2 = await readCurrentBirthdayYearMx(driver);
          if (!isYearInRangeMx(y2, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX)) {
            const direction = y2 != null && y2 > TK_BIRTHDAY_YEAR_MAX ? "down" : "up";
            console.log(`墨西哥点击前二次复核年份失败: ${String(y2)}，继续纠偏后再尝试点击。`);
            await nudgeBirthdayYearMx(driver, direction);
            continue;
          }
          await driver.pause(80);
          const y3 = await readCurrentBirthdayYearMx(driver);
          if (!isYearInRangeMx(y3, TK_BIRTHDAY_YEAR_MIN, TK_BIRTHDAY_YEAR_MAX)) {
            const direction = y3 != null && y3 > TK_BIRTHDAY_YEAR_MAX ? "down" : "up";
            console.log(`墨西哥点击前三次复核年份失败: ${String(y3)}，继续纠偏后再尝试点击。`);
            await nudgeBirthdayYearMx(driver, direction);
            continue;
          }

          const exists = await element.isExisting();
          const displayed = exists ? await element.isDisplayed() : false;
          if (!exists || !displayed) {
            continue;
          }
          await element.click();
          console.log(`已点击墨西哥生日页继续按钮 Siguiente/Continuar (selector: ${selector})`);
          return;
        }
      } catch (err) {
        if (isUiAutomator2CrashedError(err)) {
          throw new Error(
            "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：点击墨西哥生日页 Siguiente/Continuar）。"
          );
        }
        lastError = err;
      }
    }

    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    `未找到墨西哥生日页 Siguiente/Continuar 按钮。最后错误: ${String(lastError?.message || "未知错误")}`
  );
}

module.exports = {
  readCurrentBirthdayYearMx,
  nudgeBirthdayYearMx,
  ensureBirthdayYearInRangeBeforeContinuarMx,
  clickTkBirthdayContinuarMx
};
