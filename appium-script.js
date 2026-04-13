const { runStep } = require("./lib/appium-shared");
const { createSession } = require("./lib/appium-session");
const { openTkApp } = require("./pages/page-open-tk");
const { clickContinueWithGoogle } = require("./pages/page-continue-google");
const { skipSignInWithEaseIfPresent } = require("./pages/page-google-sign-in-ease-skip");
const { inputGoogleAccount } = require("./pages/page-google-email");
const { clickGoogleNext } = require("./pages/page-google-next");
const { waitForPasswordPageBeforeInput, inputGooglePassword } = require("./pages/page-google-password");
const { handleWelcomeAndClickIUnderstand } = require("./pages/page-google-welcome");
const {
  clickIAgreeAfterPassword,
  clickMoreAfterGoogleServices,
  clickAcceptAfterGoogleServices
} = require("./pages/page-google-service-buttons");
const { waitForTkBirthdayPage } = require("./pages/page-tk-birthday-wait");
const { selectRandomBirthdayOnTk } = require("./pages/page-tk-birthday-select");
const { clickTkBirthdayNext } = require("./pages/page-tk-birthday-next");
const { clickTkCreateNicknameSkip } = require("./pages/page-tk-nickname");
const { dismissTkLoginContinueModalIfPresent } = require("./pages/page-tk-login-continue-dismiss");
const { handleInterestsSkipOptional } = require("./pages/page-tk-interests");
const { waitSwipeUpStartWatchingIfPresent } = require("./pages/page-tk-swipe-up-start");
const { swipeDownAndOpenProfile } = require("./pages/page-tk-feed-open-profile");
const { dismissProfileAvatarPromoIfPresent } = require("./pages/page-tk-profile-avatar-promo-dismiss");

async function runAppiumScript({ host = "127.0.0.1", port = 4723, udid, email, googlePassword }) {
  const driver = await createSession(host, port, udid);

  try {
    await runStep("打开TK", () => openTkApp(driver));
    await runStep("点击Continue with Google", () => clickContinueWithGoogle(driver));
    await runStep("Sign in with ease可选SKIP", () => skipSignInWithEaseIfPresent(driver));
    await runStep("输入Google账号", () => inputGoogleAccount(driver, email));
    await runStep("点击邮箱页NEXT", () => clickGoogleNext(driver, "邮箱页"));
    await runStep("等待密码页出现", () => waitForPasswordPageBeforeInput(driver));
    await runStep("输入Google密码", () => inputGooglePassword(driver, googlePassword));
    await runStep("点击密码页NEXT", () => clickGoogleNext(driver, "密码页"));
    await runStep("处理Welcome并点击I UNDERSTAND", () => handleWelcomeAndClickIUnderstand(driver));
    await runStep("点击I AGREE", () => clickIAgreeAfterPassword(driver));
    await runStep("点击MORE", () => clickMoreAfterGoogleServices(driver));
    await runStep("点击ACCEPT", () => clickAcceptAfterGoogleServices(driver));
    await runStep("等待生日页", () => waitForTkBirthdayPage(driver));
    await runStep("随机选择生日", () => selectRandomBirthdayOnTk(driver));
    await runStep("点击生日页 Next/Continue", () => clickTkBirthdayNext(driver));
    await runStep("昵称页点击Skip", () => clickTkCreateNicknameSkip(driver));
    await runStep("Log in弹窗可选NONE OF THE ABOVE并返回", () =>
      dismissTkLoginContinueModalIfPresent(driver)
    );
    await runStep("兴趣页可选Skip", () => handleInterestsSkipOptional(driver));
    await runStep("Swipe up引导可选15秒", () => waitSwipeUpStartWatchingIfPresent(driver));
    await runStep("主刷向下滑并进入Profile", () => swipeDownAndOpenProfile(driver));
    await runStep("个人主页公告弹窗可选关闭", () => dismissProfileAvatarPromoIfPresent(driver));
    console.log("已完成主流程（含个人主页），按要求结束脚本。");
  } finally {
    await driver.deleteSession();
    console.log("会话已关闭");
  }
}

async function runBirthdaySelectionOnly({ host = "127.0.0.1", port = 4723, udid }) {
  const driver = await createSession(host, port, udid);

  try {
    await runStep("等待生日页", () => waitForTkBirthdayPage(driver));
    await runStep("随机选择生日", () =>
      selectRandomBirthdayOnTk(driver, {
        skipSourceRead: true,
        inRangeStopHits: 2,
        forceDownWhenOutOfRange: false
      })
    );
    await runStep("点击生日页 Next/Continue", () => clickTkBirthdayNext(driver));
    console.log("生日已选择完成，并已点击 Next/Continue。");
  } finally {
    await driver.deleteSession();
    console.log("会话已关闭");
  }
}

const PAGE_STEPS = {
  "open-tk": {
    label: "打开TK",
    run: async (driver) => openTkApp(driver)
  },
  "continue-google": {
    label: "点击Continue with Google",
    run: async (driver) => clickContinueWithGoogle(driver)
  },
  "google-sign-in-ease-skip": {
    label: "Sign in with ease可选SKIP",
    run: async (driver) => skipSignInWithEaseIfPresent(driver)
  },
  "google-email": {
    label: "输入Google账号",
    run: async (driver, ctx) => inputGoogleAccount(driver, ctx.email)
  },
  "google-next-email": {
    label: "点击邮箱页NEXT",
    run: async (driver) => clickGoogleNext(driver, "邮箱页")
  },
  "wait-password-page": {
    label: "等待密码页出现",
    run: async (driver) => waitForPasswordPageBeforeInput(driver)
  },
  "google-password": {
    label: "输入Google密码",
    run: async (driver, ctx) => inputGooglePassword(driver, ctx.googlePassword)
  },
  "google-next-password": {
    label: "点击密码页NEXT",
    run: async (driver) => clickGoogleNext(driver, "密码页")
  },
  "welcome-i-understand": {
    label: "处理Welcome并点击I UNDERSTAND",
    run: async (driver) => handleWelcomeAndClickIUnderstand(driver)
  },
  "google-i-agree": {
    label: "点击I AGREE",
    run: async (driver) => clickIAgreeAfterPassword(driver)
  },
  "google-more": {
    label: "点击MORE",
    run: async (driver) => clickMoreAfterGoogleServices(driver)
  },
  "google-accept": {
    label: "点击ACCEPT",
    run: async (driver) => clickAcceptAfterGoogleServices(driver)
  },
  "tk-birthday-wait": {
    label: "等待生日页",
    run: async (driver) => waitForTkBirthdayPage(driver)
  },
  "tk-birthday-select": {
    label: "随机选择生日",
    run: async (driver) => selectRandomBirthdayOnTk(driver)
  },
  "tk-birthday-next": {
    label: "点击生日页 Next/Continue",
    run: async (driver) => clickTkBirthdayNext(driver)
  },
  "tk-nickname-skip": {
    label: "昵称页点击Skip",
    run: async (driver) => clickTkCreateNicknameSkip(driver)
  },
  "tk-login-continue-dismiss": {
    label: "Log in弹窗可选NONE OF THE ABOVE并返回",
    run: async (driver) => dismissTkLoginContinueModalIfPresent(driver)
  },
  "tk-interests-skip": {
    label: "兴趣页可选Skip",
    run: async (driver) => handleInterestsSkipOptional(driver)
  },
  "tk-swipe-up-start": {
    label: "Swipe up引导可选15秒",
    run: async (driver) => waitSwipeUpStartWatchingIfPresent(driver)
  },
  "tk-feed-open-profile": {
    label: "主刷向下滑并进入Profile",
    run: async (driver) => swipeDownAndOpenProfile(driver)
  },
  "tk-profile-promo-dismiss": {
    label: "个人主页公告弹窗可选关闭",
    run: async (driver) => dismissProfileAvatarPromoIfPresent(driver)
  }
};

function getPageStepIds() {
  return Object.keys(PAGE_STEPS);
}

function formatPageStepsList() {
  return Object.entries(PAGE_STEPS)
    .map(([id, e]) => `  ${id.padEnd(24)} ${e.label}`)
    .join("\n");
}

async function runSingleAppiumPageStep({
  host = "127.0.0.1",
  port = 4723,
  udid,
  email,
  googlePassword,
  stepId
}) {
  const entry = PAGE_STEPS[stepId];
  if (!entry) {
    throw new Error(
      `未知步骤 ID: ${stepId}\n可用步骤:\n${formatPageStepsList()}`
    );
  }
  const driver = await createSession(host, port, udid);
  const ctx = { email, googlePassword };
  try {
    await runStep(entry.label, () => entry.run(driver, ctx));
  } finally {
    await driver.deleteSession();
    console.log("会话已关闭");
  }
}

module.exports = {
  runAppiumScript,
  runBirthdaySelectionOnly,
  runSingleAppiumPageStep,
  getPageStepIds,
  formatPageStepsList,
  PAGE_STEPS
};
