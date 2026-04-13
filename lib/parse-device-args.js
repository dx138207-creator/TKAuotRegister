function parseDeviceInput(argv) {
  const raw = argv.join(" ").trim();
  if (!raw) {
    throw new Error(
      [
        "请在启动时输入: ip:port adbPassword email googlePassword",
        '示例: node script.js "124.236.70.143:22330 vAdsNY1g demo@gmail.com 11111"'
      ].join("\n")
    );
  }

  const parts = raw.split(/\s+/);
  if (parts.length !== 4) {
    throw new Error("输入格式错误，请使用: ip:port adbPassword email googlePassword");
  }

  const [endpoint, adbPassword, email, googlePassword] = parts;
  const endpointParts = endpoint.split(":");
  if (endpointParts.length !== 2) {
    throw new Error("ip:port 格式错误，请检查输入。");
  }

  const [host, portText] = endpointParts;
  const port = Number(portText);
  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new Error("ip:port 格式错误，请检查输入。");
  }

  if (!email || !googlePassword || !adbPassword) {
    throw new Error("adbPassword、email、googlePassword 不能为空。");
  }

  return {
    host,
    port,
    adbPassword,
    email,
    googlePassword,
    udid: `${host}:${port}`
  };
}

module.exports = { parseDeviceInput };
