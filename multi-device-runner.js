const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 按需修改：每个对象对应一台手机
const devices = [
  {
    endpoint: "124.236.70.143:20523",
    adbPassword: "lqNM8dkn",
    email: "zM1fTqIm@rpilosj.com",
    googlePassword: "v70htff8",
    appiumPort: 4720
  },
  {
    endpoint: "124.236.70.143:20714",
    adbPassword: "Yg8FHb3S",
    email: "t3nyLoka@rpilosj.com",
    googlePassword: "mfQc7DUP",
    appiumPort: 4726
  },
  {
    endpoint: "124.236.70.143:20422",
    adbPassword: "0QiHwz0Y",
    email: "IkSbmk16@rpilosj.com",
    googlePassword: "ppZGoCMn",
    appiumPort: 4727
  },
  {
    endpoint: "124.236.70.143:20547",
    adbPassword: "keJS3QNZ",
    email: "lOYXIVBZ@rpilosj.com",
    googlePassword: "dbWkpwZ4",
    appiumPort: 4726
  },
  {
    endpoint: "124.236.70.143:20414",
    adbPassword: "H9p9UuJg",
    email: "d8q77Lot@rpilosj.com",
    googlePassword: "jQT7YzwF",
    appiumPort: 4729
  },
  {
    endpoint: "124.236.70.143:20576",
    adbPassword: "A2Q7uorX",
    email: "EoUliHkW@rpilosj.com",
    googlePassword: "Lx5ZIjUq",
    appiumPort: 4729
  },
];

function runOneDevice(device, index) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "script.js");
    const args = [scriptPath, device.endpoint, device.adbPassword, device.email, device.googlePassword];
    const logsDir = path.join(__dirname, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeEndpoint = String(device.endpoint).replace(/[:/\\]/g, "_");
    const logFile = path.join(logsDir, `${timestamp}_#${index}_${safeEndpoint}_p${device.appiumPort}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: "a" });
    logStream.write(`=== 设备 #${index} 启动 ===\n`);
    logStream.write(`endpoint=${device.endpoint}\nappiumPort=${device.appiumPort}\n`);
    logStream.write(`startedAt=${new Date().toISOString()}\n\n`);

    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        APPIUM_PORT: String(device.appiumPort),
        APPIUM_KEEP_SERVER: "0"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      logStream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      logStream.write(chunk);
    });

    child.on("error", (err) => {
      logStream.write(`\n[child_error] ${String(err?.message || err)}\n`);
    });

    child.on("exit", (code) => {
      logStream.write(`\n=== 设备 #${index} 结束 ===\n`);
      logStream.write(`exit=${code ?? -1}\nendedAt=${new Date().toISOString()}\n`);
      logStream.end();
      resolve({
        index,
        endpoint: device.endpoint,
        appiumPort: device.appiumPort,
        code: code ?? -1,
        logFile
      });
    });
  });
}

async function main() {
  console.log(`准备并发执行 ${devices.length} 台设备`);
  const results = await Promise.all(devices.map((d, idx) => runOneDevice(d, idx + 1)));

  console.log("\n并发执行结果:");
  for (const r of results) {
    const state = r.code === 0 ? "成功" : "失败";
    console.log(`#${r.index} ${r.endpoint} 端口:${r.appiumPort} => ${state} (exit=${r.code})`);
    console.log(`  日志: ${r.logFile}`);
  }
}

main().catch((err) => {
  console.error("并发模板运行失败:", err);
  process.exit(1);
});
