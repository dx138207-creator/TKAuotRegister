const {
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  isUiAutomator2CrashedError,
  TK_BIRTHDAY_YEAR_MIN,
  TK_BIRTHDAY_YEAR_MAX,
  TK_BIRTHDAY_YEAR_SELECT_BUDGET_MS,
  parseTkBirthdayYearFromPageSource
} = require("../lib/appium-shared");

function createRandomBirthday(minYear = TK_BIRTHDAY_YEAR_MIN, maxYear = TK_BIRTHDAY_YEAR_MAX) {
  const year = minYear + Math.floor(Math.random() * (maxYear - minYear + 1));
  const month = 1 + Math.floor(Math.random() * 12);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = 1 + Math.floor(Math.random() * daysInMonth);
  return {
    year,
    month,
    day,
    monthName: MONTH_NAMES[month - 1],
    monthShortName: MONTH_SHORT_NAMES[month - 1]
  };
}

async function selectRandomBirthdayOnTk(driver, options = {}) {
  const skipSourceRead = options.skipSourceRead === true;
  let yearMin = options.yearMin ?? TK_BIRTHDAY_YEAR_MIN;
  let yearMax = options.yearMax ?? TK_BIRTHDAY_YEAR_MAX;
  yearMin = Math.max(TK_BIRTHDAY_YEAR_MIN, Math.min(yearMin, TK_BIRTHDAY_YEAR_MAX));
  yearMax = Math.max(TK_BIRTHDAY_YEAR_MIN, Math.min(yearMax, TK_BIRTHDAY_YEAR_MAX));
  if (yearMin > yearMax) {
    yearMin = TK_BIRTHDAY_YEAR_MIN;
    yearMax = TK_BIRTHDAY_YEAR_MAX;
  }
  const inRangeStopHits = options.inRangeStopHits ?? 2;
  const forceDownWhenOutOfRange = options.forceDownWhenOutOfRange === true;
  const yearBudgetMs = options.yearBudgetMs ?? TK_BIRTHDAY_YEAR_SELECT_BUDGET_MS;
  const birthday = createRandomBirthday(yearMin, yearMax);
  const numberPickerSelector = 'android=new UiSelector().className("android.widget.NumberPicker")';
  const pickerColumns = await driver.$$(numberPickerSelector);

  async function selectByBirthdayEditText() {
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

        const dateText = `${birthday.monthName} ${birthday.day}, ${birthday.year}`;
        await element.click();
        await driver.pause(200);
        try {
          await element.clearValue();
        } catch (_) {
          // 某些机型不支持 clearValue
        }
        await element.setValue(dateText);
        await driver.pause(250);
        console.log(
          `已通过 Birthday 输入框随机选择生日: ${dateText}（范围 ${TK_BIRTHDAY_YEAR_MIN}-${TK_BIRTHDAY_YEAR_MAX}）`
        );
        return true;
      }
    }

    return false;
  }

  async function getSeekBarColumns() {
    const month = await driver.$('//*[contains(@resource-id,"id/nox") or contains(@content-desc,"Month picker")]');
    const day = await driver.$('//*[contains(@resource-id,"id/ezr") or contains(@content-desc,"Day picker")]');
    const year = await driver.$(
      '//*[contains(@resource-id,"id/year_picker") or contains(@content-desc,"Year picker")]'
    );

    const all = [month, day, year];
    for (const el of all) {
      const exists = await el.isExisting();
      const displayed = exists ? await el.isDisplayed() : false;
      if (!exists || !displayed) {
        return null;
      }
    }
    return { month, day, year };
  }

  function normalizeMonthValue(text) {
    const normalized = String(text || "").trim().slice(0, 3).toLowerCase();
    const idx = MONTH_SHORT_NAMES.findIndex((m) => m.toLowerCase() === normalized);
    return idx >= 0 ? idx + 1 : null;
  }

  function normalizeNumberValue(text) {
    const matched = String(text || "").match(/\d+/);
    return matched ? Number(matched[0]) : null;
  }

  async function swipeOnElement(element, direction, pauseMs = 220) {
    const rect = await element.getRect();
    await driver.execute("mobile: swipeGesture", {
      left: Math.floor(rect.x),
      top: Math.floor(rect.y),
      width: Math.floor(rect.width),
      height: Math.floor(rect.height),
      direction,
      percent: 0.7
    });
    await driver.pause(pauseMs);
  }

  async function readBirthdayTextFromField() {
    const selectors = [
      'android=new UiSelector().resourceId("com.zhiliaoapp.musically:id/k5o")',
      '//*[@resource-id="com.zhiliaoapp.musically:id/k5o"]',
      '//*[contains(@hint,"Birthday") and contains(@class,"EditText")]'
    ];
    for (const selector of selectors) {
      const fields = await driver.$$(selector);
      for (const field of fields) {
        const exists = await field.isExisting();
        const displayed = exists ? await field.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        const text = await field.getText();
        if (String(text || "").trim()) {
          return String(text).trim();
        }
      }
    }
    return null;
  }

  function parseYearFromBirthdayText(text) {
    const matched = String(text || "").match(/(\d{4})/);
    return matched ? Number(matched[1]) : null;
  }

  async function getCurrentYearFromUi() {
    const text = await readBirthdayTextFromField();
    const fromField = parseYearFromBirthdayText(text);
    if (fromField != null) {
      return fromField;
    }
    try {
      const source = await driver.getPageSource();
      return parseTkBirthdayYearFromPageSource(source);
    } catch (_) {
      return null;
    }
  }

  async function tuneYearWithValidation(applyYearSwipe, deadline) {
    const maxSteps = 60;
    let inRangeHitCount = 0;

    for (let step = 0; step < maxSteps; step++) {
      if (Date.now() > deadline) {
        throw new Error("年份校验调整超时：时间预算用尽（30s 内未完成）。");
      }

      const currentYear = await getCurrentYearFromUi();

      if (currentYear == null) {
        inRangeHitCount = 0;
        const fallbackDirection = birthday.year < new Date().getFullYear() ? "down" : "up";
        await applyYearSwipe(fallbackDirection);
        continue;
      }

      if (currentYear > yearMax) {
        inRangeHitCount = 0;
        console.log(`年份校验: ${currentYear} > ${yearMax}，执行向下滑动纠偏`);
        const burst = Math.min(8, currentYear - yearMax);
        for (let k = 0; k < burst; k++) {
          if (Date.now() > deadline) {
            throw new Error("年份校验调整超时：时间预算用尽（30s 内未完成）。");
          }
          await applyYearSwipe("down");
        }
        continue;
      }
      if (currentYear < yearMin) {
        inRangeHitCount = 0;
        console.log(`年份校验: ${currentYear} < ${yearMin}，执行向上滑动纠偏`);
        const burst = Math.min(8, yearMin - currentYear);
        for (let k = 0; k < burst; k++) {
          if (Date.now() > deadline) {
            throw new Error("年份校验调整超时：时间预算用尽（30s 内未完成）。");
          }
          await applyYearSwipe("up");
        }
        continue;
      }

      inRangeHitCount += 1;
      if (inRangeHitCount >= inRangeStopHits) {
        console.log(
          `年份连续 ${inRangeHitCount} 次落在区间 ${yearMin}-${yearMax}，停止滑动（当前年: ${currentYear}）`
        );
        return;
      }

      if (currentYear === birthday.year) {
        console.log(`年份已命中目标: ${currentYear}`);
        return;
      }

      const direction = currentYear > birthday.year ? "down" : "up";
      const gap = Math.abs(currentYear - birthday.year);
      const burst = Math.min(6, gap);
      for (let k = 0; k < burst; k++) {
        if (Date.now() > deadline) {
          throw new Error("年份校验调整超时：时间预算用尽（30s 内未完成）。");
        }
        await applyYearSwipe(direction);
      }
    }

    throw new Error("年份校验调整超时：未能在限制步数内进入目标范围/命中目标年。");
  }

  async function dragOnElement(element, direction, percent = 0.7) {
    let rect;
    if (typeof element.getRect === "function") {
      rect = await element.getRect();
    } else {
      const location = await element.getLocation();
      const size = await element.getSize();
      rect = {
        x: location.x,
        y: location.y,
        width: size.width,
        height: size.height
      };
    }
    const x = Math.floor(rect.x + rect.width / 2);
    const y = Math.floor(rect.y + rect.height / 2);

    await driver.execute("mobile: clickGesture", { x, y });
    await driver.pause(80);

    const elementId = element.elementId;
    if (elementId) {
      try {
        await driver.execute("mobile: swipeGesture", {
          elementId,
          direction,
          percent
        });
      } catch (_) {
        await driver.execute("mobile: swipeGesture", {
          left: Math.floor(rect.x),
          top: Math.floor(rect.y),
          width: Math.max(20, Math.floor(rect.width)),
          height: Math.max(20, Math.floor(rect.height)),
          direction,
          percent
        });
      }
    } else {
      await driver.execute("mobile: swipeGesture", {
        left: Math.floor(rect.x),
        top: Math.floor(rect.y),
        width: Math.max(20, Math.floor(rect.width)),
        height: Math.max(20, Math.floor(rect.height)),
        direction,
        percent
      });
    }
    await driver.pause(260);
  }

  async function getPickerCurrentText(columnElement) {
    const candidates = [
      'android=new UiSelector().resourceId("android:id/numberpicker_input")',
      'android=new UiSelector().className("android.widget.EditText")',
      'android=new UiSelector().className("android.widget.TextView")'
    ];

    for (const selector of candidates) {
      const inner = await columnElement.$$(selector);
      for (const element of inner) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        const text = (await element.getText()) || "";
        if (String(text).trim()) {
          return String(text).trim();
        }
      }
    }

    const raw = await columnElement.getText();
    return String(raw || "").trim();
  }

  async function getDisplayedBirthdayFromHeader() {
    if (skipSourceRead) {
      return null;
    }
    const source = await driver.getPageSource();
    const monthRegex = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
    const dateRegex = new RegExp(`${monthRegex}\\s+(\\d{1,2}),\\s*(\\d{4})`, "i");
    const match = source.match(dateRegex);
    if (!match) {
      return null;
    }

    const monthLabel = String(match[1]);
    const day = Number(match[2]);
    const year = parseTkBirthdayYearFromPageSource(source) ?? Number(match[3]);
    const monthIndex =
      MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthLabel.toLowerCase()) + 1 ||
      MONTH_SHORT_NAMES.findIndex((m) => m.toLowerCase() === monthLabel.toLowerCase()) + 1;
    return {
      month: monthIndex > 0 ? monthIndex : null,
      day: Number.isFinite(day) ? day : null,
      year: Number.isFinite(year) ? year : null
    };
  }

  async function spinColumnToTarget(element, type, target, minValue, maxValue, opts = {}) {
    const maxSteps = opts.maxSteps ?? (type === "year" ? 50 : 80);
    const deadline = opts.deadline;
    const yearPauseMs = opts.yearPauseMs ?? 110;
    const yearBurstMax = opts.yearBurstMax ?? 8;

    for (let step = 0; step < maxSteps; step++) {
      if (deadline && Date.now() > deadline) {
        throw new Error(`滑轮调整超时: ${type} 超过时间预算`);
      }
      const currentText = await getPickerCurrentText(element);
      const current =
        type === "month" ? normalizeMonthValue(currentText) : normalizeNumberValue(currentText);
      if (current == null) {
        await swipeOnElement(element, "up", type === "year" ? yearPauseMs : 220);
        continue;
      }

      if (type === "year") {
        if (current < minValue || current > maxValue) {
          const direction = current > maxValue ? "down" : "up";
          await swipeOnElement(element, direction, yearPauseMs);
          continue;
        }
        if (current === target) {
          return;
        }
        const direction = current < target ? "up" : "down";
        const delta = Math.abs(target - current);
        const n = Math.min(delta, yearBurstMax);
        for (let b = 0; b < n; b++) {
          if (deadline && Date.now() > deadline) {
            throw new Error("滑轮调整超时: year 超过时间预算");
          }
          await swipeOnElement(element, direction, yearPauseMs);
        }
        continue;
      }

      if (current === target) {
        return;
      }

      const range = maxValue - minValue + 1;
      const forward = (target - current + range) % range;
      const backward = (current - target + range) % range;
      const direction = forward <= backward ? "up" : "down";

      await swipeOnElement(element, direction, 220);
    }

    throw new Error(`滑轮调整失败: ${type} 未命中目标值 ${target}`);
  }

  async function selectByNumberPickerElements() {
    if (pickerColumns.length < 3) {
      return false;
    }

    const monthCol = pickerColumns[0];
    const dayCol = pickerColumns[1];
    const yearCol = pickerColumns[2];

    await monthCol.click();
    await driver.pause(150);
    await spinColumnToTarget(monthCol, "month", birthday.month, 1, 12);

    await dayCol.click();
    await driver.pause(150);
    const maxDay = new Date(birthday.year, birthday.month, 0).getDate();
    await spinColumnToTarget(dayCol, "day", birthday.day, 1, maxDay);

    const yearDeadline = Date.now() + yearBudgetMs;
    await yearCol.click();
    await driver.pause(150);
    await spinColumnToTarget(yearCol, "year", birthday.year, yearMin, yearMax, {
      deadline: yearDeadline,
      yearPauseMs: 110,
      yearBurstMax: 8,
      maxSteps: 50
    });

    console.log(
      `已通过 NumberPicker 滑轮随机选择生日: ${birthday.monthShortName} ${birthday.day}, ${birthday.year}（范围 ${yearMin}-${yearMax}）`
    );

    try {
      const m = await getPickerCurrentText(monthCol);
      const d = await getPickerCurrentText(dayCol);
      const y = await getPickerCurrentText(yearCol);
      console.log(`生日当前显示值: ${m} ${d}, ${y}`);
    } catch (_) {
      // ignore
    }

    return true;
  }

  async function selectBySeekBarElements() {
    const seekbars = await getSeekBarColumns();
    if (!seekbars) {
      return false;
    }

    const { month, day, year } = seekbars;

    async function swipeSeekbarAndVerify(element, direction) {
      const before = await readBirthdayTextFromField();
      const percents = [0.7, 0.82, 0.92];

      for (const percent of percents) {
        await dragOnElement(element, direction, percent);
        const after = await readBirthdayTextFromField();
        if (!before || !after || after !== before) {
          return true;
        }
      }
      return false;
    }

    const monthSteps = Math.floor(Math.random() * 12);
    const daySteps = Math.floor(Math.random() * 28);
    for (let i = 0; i < monthSteps; i++) {
      await swipeSeekbarAndVerify(month, "up");
    }
    for (let i = 0; i < daySteps; i++) {
      await swipeSeekbarAndVerify(day, "up");
    }

    const yearDeadlineSeek = Date.now() + yearBudgetMs;

    if (skipSourceRead) {
      await tuneYearWithValidation(
        async (direction) => {
          if (forceDownWhenOutOfRange && (direction === "up" || direction === "down")) {
            await swipeSeekbarAndVerify(year, "down");
            return;
          }
          await swipeSeekbarAndVerify(year, direction);
        },
        yearDeadlineSeek
      );
    } else {
      let currentYear = (await getDisplayedBirthdayFromHeader())?.year || 2025;
      for (let i = 0; i < 3; i++) {
        await swipeSeekbarAndVerify(year, "up");
      }
      currentYear = (await getDisplayedBirthdayFromHeader())?.year || currentYear - 3;

      let safeCounter = 0;
      while (currentYear !== birthday.year && safeCounter < 80 && Date.now() < yearDeadlineSeek) {
        const gap = Math.abs(currentYear - birthday.year);
        const burst = Math.min(3, Math.max(1, gap));
        if (currentYear > birthday.year) {
          for (let k = 0; k < burst; k++) {
            await swipeSeekbarAndVerify(year, "down");
          }
        } else {
          for (let k = 0; k < burst; k++) {
            await swipeSeekbarAndVerify(year, "up");
          }
        }

        const latest = await getDisplayedBirthdayFromHeader();
        if (latest?.year) {
          currentYear = latest.year;
        } else {
          currentYear += currentYear > birthday.year ? -1 : 1;
        }
        safeCounter += 1;
      }
    }

    console.log(
      `已通过 SeekBar 滑轮随机选择生日（目标年 ${birthday.year}，范围 ${yearMin}-${yearMax}）`
    );
    return true;
  }

  async function swipeByCoordinates(x, startY, endY) {
    const sx = Math.floor(x);
    const sy = Math.floor(startY);
    const ey = Math.floor(endY);
    await driver.execute("mobile: clickGesture", { x: sx, y: Math.floor((sy + ey) / 2) });
    await driver.pause(60);
    await driver.execute("mobile: swipeGesture", {
      left: Math.floor(sx - 45),
      top: Math.floor(Math.min(sy, ey)),
      width: 90,
      height: Math.max(40, Math.floor(Math.abs(ey - sy))),
      direction: sy > ey ? "up" : "down",
      percent: 0.82
    });
    await driver.pause(220);
  }

  async function selectByCoordinateWheels() {
    const windowRect = await driver.getWindowRect();
    const width = windowRect.width;
    const height = windowRect.height;

    const monthX = Math.floor(width * 0.22);
    const dayX = Math.floor(width * 0.50);
    const yearX = Math.floor(width * 0.78);
    const swipeStartY = Math.floor(height * 0.83);
    const swipeEndY = Math.floor(height * 0.67);

    const monthSteps = Math.floor(Math.random() * 12);
    const daySteps = Math.floor(Math.random() * 28);
    for (let i = 0; i < monthSteps; i++) {
      await swipeByCoordinates(monthX, swipeStartY, swipeEndY);
    }
    for (let i = 0; i < daySteps; i++) {
      await swipeByCoordinates(dayX, swipeStartY, swipeEndY);
    }

    const yearDeadlineCoord = Date.now() + yearBudgetMs;

    if (skipSourceRead) {
      await tuneYearWithValidation(
        async (direction) => {
          if (forceDownWhenOutOfRange && (direction === "up" || direction === "down")) {
            await swipeByCoordinates(yearX, swipeEndY, swipeStartY);
            return;
          }
          if (direction === "down") {
            await swipeByCoordinates(yearX, swipeEndY, swipeStartY);
          } else {
            await swipeByCoordinates(yearX, swipeStartY, swipeEndY);
          }
        },
        yearDeadlineCoord
      );
    } else {
      let currentYear = (await getDisplayedBirthdayFromHeader())?.year || 2025;
      for (let i = 0; i < 3; i++) {
        await swipeByCoordinates(yearX, swipeStartY, swipeEndY);
      }
      currentYear = (await getDisplayedBirthdayFromHeader())?.year || currentYear - 3;

      let safeCounter = 0;
      while (currentYear !== birthday.year && safeCounter < 80 && Date.now() < yearDeadlineCoord) {
        const gap = Math.abs(currentYear - birthday.year);
        const burst = Math.min(3, Math.max(1, gap));
        if (currentYear > birthday.year) {
          for (let k = 0; k < burst; k++) {
            await swipeByCoordinates(yearX, swipeEndY, swipeStartY);
          }
        } else {
          for (let k = 0; k < burst; k++) {
            await swipeByCoordinates(yearX, swipeStartY, swipeEndY);
          }
        }

        const latest = await getDisplayedBirthdayFromHeader();
        if (latest?.year) {
          currentYear = latest.year;
        } else {
          currentYear += currentYear > birthday.year ? -1 : 1;
        }
        safeCounter += 1;
      }
    }

    console.log(
      `已通过坐标滑轮随机选择生日（目标年 ${birthday.year}，范围 ${yearMin}-${yearMax}）`
    );
  }

  const selectedByPicker = await selectByNumberPickerElements();
  if (selectedByPicker) {
    return;
  }
  const selectedBySeekBar = await selectBySeekBarElements();
  if (selectedBySeekBar) {
    return;
  }
  await selectByCoordinateWheels();
}


module.exports = { createRandomBirthday, selectRandomBirthdayOnTk };
