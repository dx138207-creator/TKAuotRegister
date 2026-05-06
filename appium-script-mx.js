const { runStep } = require("./lib/appium-shared");
const { createSession } = require("./lib/appium-session");
const { openTkApp } = require("./pages/page-open-tk");
const { clickContinuarConGoogle } = require("./pages/page-continue-google-mx");
const { skipSignInWithEaseIfPresent } = require("./pages/page-google-sign-in-ease-skip");
const { clickGoogleAddAnotherAccountIfPresent } = require("./pages/page-google-add-another-account");
const { inputGoogleAccount } = require("./pages/page-google-email");
const { clickGoogleSiguiente } = require("./pages/page-google-next-mx");
const { waitForPasswordPageBeforeInputMx, inputGooglePasswordMx } = require("./pages/page-google-password-mx");
const { handleWelcomeAndClickEntendido } = require("./pages/page-google-welcome-mx");
const {
  clickAceptoAfterPasswordMx,
  clickMasAfterGoogleServicesMx,
  clickAceptarAfterGoogleServicesMx
} = require("./pages/page-google-service-buttons-mx");
const { waitForTkBirthdayPage } = require("./pages/page-tk-birthday-wait");
const { selectRandomBirthdayOnTk } = require("./pages/page-tk-birthday-select");
const {
  clickTkBirthdayContinuarMx,
  ensureBirthdayYearInRangeBeforeContinuarMx
} = require("./pages/page-tk-birthday-next-mx");
const { clickTkCreateNicknameOmitirMx } = require("./pages/page-tk-nickname-mx");
const { dismissTkLoginContinueModalIfPresent } = require("./pages/page-tk-login-continue-dismiss");
const { handleInterestsSkipOptionalMx } = require("./pages/page-tk-interests-mx");
const { waitSwipeUpStartWatchingIfPresentMx } = require("./pages/page-tk-swipe-up-start-mx");
const { openPerfilFromMainFeedMx } = require("./pages/page-tk-feed-open-profile-mx");
const { dismissProfileAvatarPromoIfPresent } = require("./pages/page-tk-profile-avatar-promo-dismiss");
const { clickTkAcceptAndContinueIfPresent } = require("./pages/page-tk-accept-continue");

async function enforceBirthdayYearInRangeUntilOkMx(driver, timeoutMs = 120000) {
  const endAt = Date.now() + timeoutMs;
  let attempt = 0;
  let lastErr;
  while (Date.now() < endAt) {
    attempt += 1;
    try {
      await ensureBirthdayYearInRangeBeforeContinuarMx(driver);
      console.log(`墨西哥生日年份纠偏完成（第 ${attempt} 轮），已进入合法区间。`);
      return;
    } catch (err) {
      lastErr = err;
      console.log(
        `墨西哥生日年份纠偏第 ${attempt} 轮未达标，继续纠偏... ${String(err?.message || err)}`
      );
      await driver.pause(400);
    }
  }
  throw new Error(
    `墨西哥生日年份持续纠偏超时（${Math.floor(timeoutMs / 1000)}s），最后错误: ${String(
      lastErr?.message || "未知错误"
    )}`
  );
}

async function runGoogleRegisterChainMx(
  driver,
  { email, googlePassword, useAddAnotherAccount = false, skipGoogleMoreAccept = false }
) {
  await runStep("墨西哥兴趣页可选 Omitir", () => handleInterestsSkipOptionalMx(driver));
  await runStep("墨西哥上滑引导可选15秒", () => waitSwipeUpStartWatchingIfPresentMx(driver));
  await runStep("点击右下角 Perfil 进入个人主页", () => openPerfilFromMainFeedMx(driver));
  await runStep("点击 Continuar con Google", () => clickContinuarConGoogle(driver));
  if (useAddAnotherAccount) {
    await runStep("选择Add another account(可选)", () =>
      clickGoogleAddAnotherAccountIfPresent(driver)
    );
  }
  await runStep("Sign in with ease可选SKIP", () => skipSignInWithEaseIfPresent(driver));
  await runStep("输入Google账号", () => inputGoogleAccount(driver, email));
  await runStep("点击邮箱页 SIGUIENTE", () => clickGoogleSiguiente(driver, "邮箱页"));
  await runStep("等待墨西哥密码页出现", () => waitForPasswordPageBeforeInputMx(driver));
  await runStep("输入Google密码", () => inputGooglePasswordMx(driver, googlePassword));
  await runStep("点击密码页 SIGUIENTE", () => clickGoogleSiguiente(driver, "密码页"));
  await runStep("处理Welcome并点击 ENTENDIDO", () => handleWelcomeAndClickEntendido(driver));
  await runStep("点击 Acepto", () => clickAceptoAfterPasswordMx(driver));
  if (skipGoogleMoreAccept) {
    console.log("墨西哥二次脚本配置：跳过 Google Más / Aceptar 步骤。");
  } else {
    await runStep("点击 Más", () => clickMasAfterGoogleServicesMx(driver));
    await runStep("点击 Aceptar", () => clickAceptarAfterGoogleServicesMx(driver));
  }
  await runStep("等待生日页", () => waitForTkBirthdayPage(driver));
  const birthdaySelectOk = await runStep("随机选择生日", () => selectRandomBirthdayOnTk(driver));
  if (!birthdaySelectOk) {
    await runStep("生日年份兜底纠偏（直到达标）", () =>
      enforceBirthdayYearInRangeUntilOkMx(driver)
    );
  }
  await runStep("点击生日页 Continuar", () => clickTkBirthdayContinuarMx(driver));
  await runStep("昵称页点击 Omitir", () => clickTkCreateNicknameOmitirMx(driver));
  await runStep("Log in弹窗可选NONE OF THE ABOVE并返回", () =>
    dismissTkLoginContinueModalIfPresent(driver)
  );
  await runStep("再次点击右下角 Perfil 进入个人主页", () => openPerfilFromMainFeedMx(driver));
  await runStep("个人主页公告弹窗可选关闭", () => dismissProfileAvatarPromoIfPresent(driver));
}

async function runAppiumScriptMx({ host = "127.0.0.1", port = 4723, udid, email, googlePassword }) {
  const driver = await createSession(host, port, udid);

  try {
    await runStep("打开TK", () => openTkApp(driver));
    await runStep("墨西哥欢迎页点击 Aceptar y continuar(可选)", () =>
      clickTkAcceptAndContinueIfPresent(driver)
    );
    await runGoogleRegisterChainMx(driver, {
      email,
      googlePassword,
      useAddAnotherAccount: false,
      skipGoogleMoreAccept: false
    });
    console.log("已完成墨西哥主流程（含个人主页），按要求结束脚本。");
  } finally {
    await driver.deleteSession();
    console.log("会话已关闭");
  }
}

async function runAppiumSecondScriptMx({
  host = "127.0.0.1",
  port = 4723,
  udid,
  email,
  googlePassword
}) {
  const driver = await createSession(host, port, udid);
  try {
    await runStep("打开TK", () => openTkApp(driver));
    await runStep("墨西哥欢迎页点击 Aceptar y continuar(可选)", () =>
      clickTkAcceptAndContinueIfPresent(driver)
    );
    await runGoogleRegisterChainMx(driver, {
      email,
      googlePassword,
      useAddAnotherAccount: true,
      skipGoogleMoreAccept: true
    });
    console.log("已完成墨西哥二次注册流程（从Continue with Google开始）。");
  } finally {
    await driver.deleteSession();
    console.log("会话已关闭");
  }
}

module.exports = {
  runAppiumScriptMx,
  runAppiumSecondScriptMx
};
