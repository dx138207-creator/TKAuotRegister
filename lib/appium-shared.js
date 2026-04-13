const CANDIDATE_PATHS = ["/", "/wd/hub"];
const TK_APP_IDS = [
  "com.zhiliaoapp.musically",
  "com.ss.android.ugc.trill"
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const MONTH_SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 生日年：严格大于 1986 且严格小于 2007 → 合法区间 [1987, 2006] */
const TK_BIRTHDAY_YEAR_MIN = 1987;
const TK_BIRTHDAY_YEAR_MAX = 2006;
/** 选中年份（含纠偏）默认总时间预算 */
const TK_BIRTHDAY_YEAR_SELECT_BUDGET_MS = 30000;

function parseTkBirthdayYearFromPageSource(source) {
  if (!source) {
    return null;
  }
  const monthRegex =
    "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
  const dateRegex = new RegExp(`${monthRegex}\\s+(\\d{1,2}),\\s*(\\d{4})`, "i");
  const match = source.match(dateRegex);
  if (!match) {
    return null;
  }
  const y = Number(match[3]);
  return Number.isFinite(y) ? y : null;
}

const STEP_TIMEOUT_MS = 45000;
const SESSION_CREATE_RETRY_ROUNDS = 3;
const SESSION_CREATE_RETRY_INTERVAL_MS = 1200;

async function runStep(stepName, stepFn) {
  console.log(`[开始] ${stepName}`);
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve("__STEP_TIMEOUT__"), STEP_TIMEOUT_MS);
  });

  const result = await Promise.race([
    stepFn().then(() => "__STEP_DONE__"),
    timeoutPromise
  ]);
  clearTimeout(timer);

  if (result === "__STEP_TIMEOUT__") {
    console.log(`[超时] ${stepName} 超过 ${STEP_TIMEOUT_MS / 1000}s，进入下一步`);
    return false;
  }

  console.log(`[完成] ${stepName}`);
  return true;
}

function isUiAutomator2CrashedError(err) {
  const message = String(err?.message || err || "");
  return /instrumentation process is not running|cannot be proxied to UiAutomator2/i.test(message);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickByKeywordsFromSourceBounds(driver, keywords = [], logLabel = "") {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return false;
  }
  const source = await driver.getPageSource();
  for (const keywordRaw of keywords) {
    const keyword = String(keywordRaw || "").trim();
    if (!keyword) {
      continue;
    }
    const pattern = new RegExp(
      `<[^>]*(?:text|content-desc|value)="[^"]*${escapeRegex(keyword)}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*>`,
      "i"
    );
    const match = source.match(pattern);
    if (!match) {
      continue;
    }
    const x1 = Number(match[1]);
    const y1 = Number(match[2]);
    const x2 = Number(match[3]);
    const y2 = Number(match[4]);
    const x = Math.floor((x1 + x2) / 2);
    const y = Math.floor((y1 + y2) / 2);
    await driver.execute("mobile: clickGesture", { x, y });
    console.log(`已通过源码坐标点击 ${logLabel || keyword}: (${x}, ${y})`);
    return true;
  }
  return false;
}

function isBasePathMismatchError(err) {
  const message = String(err?.message || err || "");
  return /requested resource could not be found|unknown command/i.test(message);
}

module.exports = {
  CANDIDATE_PATHS,
  TK_APP_IDS,
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  TK_BIRTHDAY_YEAR_MIN,
  TK_BIRTHDAY_YEAR_MAX,
  TK_BIRTHDAY_YEAR_SELECT_BUDGET_MS,
  parseTkBirthdayYearFromPageSource,
  STEP_TIMEOUT_MS,
  SESSION_CREATE_RETRY_ROUNDS,
  SESSION_CREATE_RETRY_INTERVAL_MS,
  runStep,
  isUiAutomator2CrashedError,
  escapeRegex,
  clickByKeywordsFromSourceBounds,
  isBasePathMismatchError
};
