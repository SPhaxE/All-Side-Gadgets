// Clash Verge Rev 扩展脚本模板（跨平台通用，适用于 Windows & macOS）
// 实现三路精准分流：
//   1. Claude 及其验证/支付生态 -> 「AI」-> 「🎯 独享美区落地」(通过「⚡ 中转前置」链式转发)
//   2. Gemini / Google AI / Antigravity -> 「🤖 国际AI」-> 英国节点
//   3. 其余外网（ChatGPT/GitHub/YouTube/日常网页）-> 「默认节点」
//
// 使用方法：
//   1. 复制本文件到本地（不要把真实密码提交到公开仓库），修改下方 LANDING 参数并把 enabled 改为 true。
//   2. 在 Clash Verge Rev 中：右键订阅 ->「编辑扩展脚本」，粘贴并保存。
//   3. 将 Clash Verge 顶栏模式切换为「规则 (Rule)」，确认「⚡ 中转前置」「🤖 国际AI」「默认节点」所选节点。

const LANDING = {
  // 填好真实服务器信息后再改为 true；未启用或仍为占位符时会自动跳过
  enabled: false,

  // 落地节点名称（同时会作为 AI 策略组的首选节点）
  name: "🎯 独享美区落地",

  // 支持三种类型: "socks5" | "http" | "vless"
  type: "socks5",

  // 必填：美区落地服务器 IP 或域名
  server: "REPLACE_WITH_US_IP",
  port: 443,

  // --- type 为 "socks5" 或 "http" 时填写 ---
  username: "REPLACE_WITH_USERNAME",
  password: "REPLACE_WITH_PASSWORD",
  tls: false,

  // --- type 为 "vless" (VLESS + Reality) 时填写 ---
  uuid: "",
  servername: "www.apple.com",
  publicKey: "",
  shortId: "",

  // --- 前置中转设置 (dialer-proxy) ---
  useRelay: true,
  relayGroupName: "⚡ 中转前置",

  // Gemini 专用节点名称（不完全匹配时自动回退到包含 英国/UK/GB 的节点）
  geminiGroupName: "🤖 国际AI",
  geminiNodeName: "🇬🇧 V英国",
};

// 1) 仅限 Claude 及其验证/监控/支付生态走静态 ISP（节省流量且绝对隔离）
const CLAUDE_DOMAINS = [
  "anthropic.com",
  "clau.de",
  "claude.ai",
  "claude.com",
  "claudemcpclient.com",
  "claudemcpcontent.com",
  "claudeusercontent.com",
  "challenges.cloudflare.com",
  "hcaptcha.com",
  "hcaptcha.net",
  "withpersona.com",
  "persona-id.com",
  "servd-anthropic-website.b-cdn.net",
  "o1158394.ingest.us.sentry.io",
  "datadoghq.com",
  "us5-datadoghq.com",
  "browser-intake-us5-datadoghq.com",
  "statsig.com",
  "statsigapi.net",
  "intercom.io",
  "featureassets.org",
  "featuregates.org",
  "prodregistryv2.org",
  "stripe.com",
  "workos.com",
];

// 2) Gemini + Google AI + Antigravity 生态走英国
const GEMINI_DOMAINS = [
  "bard.google.com",
  "gemini.google",
  "gemini.google.com",
  "gemini.gstatic.com",
  "robinfrontend-pa.googleapis.com",
  "signaler-pa.clients6.google.com",
  "ai.google.dev",
  "alkalicore-pa.clients6.google.com",
  "alkalimakersuite-pa.clients6.google.com",
  "waa-pa.clients6.google.com",
  "webchannel-alkalimakersuite-pa.clients6.google.com",
  "ai.studio",
  "aistudio.google.com",
  "generativeai.google",
  "makersuite.google.com",
  "geller-pa.googleapis.com",
  "generativelanguage.googleapis.com",
  "proactivebackend-pa.googleapis.com",
  "notebooklm-pa.googleapis.com",
  "notebooklm.googleapis.com",
  "notebook.google",
  "notebook.google.com",
  "notebooklm.google",
  "notebooklm.google.com",
  "labs.google",
  "labs.google.com",
  "flow.google",
  "flow.google.com",
  "aisandbox-pa.googleapis.com",
  "opal.google",
  "opal.google.com",
  "stitch.withgoogle.com",
  "antigravity-pa.googleapis.com",
  "antigravity.googleapis.com",
  "cloudaicompanion.googleapis.com",
  "cloudcode-pa.googleapis.com",
  "daily-cloudcode-pa.googleapis.com",
  "aicode.googleapis.com",
  "aida.googleapis.com",
  "antigravity-unleash.goog",
  "antigravity.google",
  "developerprofiles.googleapis.com",
  "jules.google",
  "jules.google.com",
  "deepmind.com",
  "deepmind.google",
  "labstailwind.pa.googleapis.com",
  "accounts.google.com",
];

function buildLandingProxy() {
  const base = {
    name: LANDING.name,
    server: LANDING.server,
    port: Number(LANDING.port),
    udp: true,
  };

  if (LANDING.useRelay) {
    base["dialer-proxy"] = LANDING.relayGroupName;
  }

  if (LANDING.type === "socks5" || LANDING.type === "http") {
    base.type = LANDING.type;
    if (LANDING.username && LANDING.username !== "REPLACE_WITH_USERNAME") {
      base.username = LANDING.username;
    }
    if (LANDING.password && LANDING.password !== "REPLACE_WITH_PASSWORD") {
      base.password = LANDING.password;
    }
    if (LANDING.tls) {
      base.tls = true;
      base["skip-cert-verify"] = false;
    }
    return base;
  }

  if (LANDING.type === "vless") {
    return {
      ...base,
      type: "vless",
      uuid: LANDING.uuid,
      tls: true,
      flow: "xtls-rprx-vision",
      servername: LANDING.servername || "www.apple.com",
      "client-fingerprint": "chrome",
      "skip-cert-verify": false,
      "reality-opts": {
        "public-key": LANDING.publicKey,
        "short-id": LANDING.shortId,
      },
    };
  }

  throw new Error(`Unsupported LANDING.type: ${LANDING.type}`);
}

function main(config, profileName) {
  config = config || {};
  config.proxies = Array.isArray(config.proxies) ? config.proxies : [];
  config["proxy-groups"] = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"]
    : [];
  config.rules = Array.isArray(config.rules) ? config.rules : [];

  if (
    !LANDING.enabled ||
    !LANDING.server ||
    LANDING.server === "REPLACE_WITH_US_IP"
  ) {
    return config;
  }

  // 1. 收集现有订阅中的稳定中转节点（优先新加坡，其次港/日/台/美，排除自身防环路）
  const existingNames = config.proxies
    .map((p) => p && p.name)
    .filter((n) => n && n !== LANDING.name);

  const sgOrder = [
    "🇸🇬 V新加坡 04",
    "🇸🇬 V新加坡 05",
    "🇸🇬 V新加坡 01",
    "🇸🇬 V新加坡 02",
    "🇸🇬 V新加坡 03",
  ];
  const sgRelay = [
    ...sgOrder.filter((n) => existingNames.includes(n)),
    ...existingNames.filter(
      (n) => /新加坡|SG/i.test(n) && !sgOrder.includes(n)
    ),
  ];
  const otherNearRelay = existingNames.filter((n) =>
    /香港|日本|台湾|HK|JP|TW/i.test(n)
  );
  const usRelay = existingNames.filter((n) => /美国|US/i.test(n));
  const combinedRelay = [...new Set([...sgRelay, ...otherNearRelay, ...usRelay])];
  const relayCandidates =
    combinedRelay.length > 0 ? combinedRelay : existingNames;

  // 2. 注入独享美区落地节点（若同名则替换）
  const landingProxy = buildLandingProxy();
  config.proxies = config.proxies.filter((p) => p && p.name !== LANDING.name);
  config.proxies.unshift(landingProxy);

  // 3. 创建「⚡ 中转前置」策略组
  if (LANDING.useRelay && relayCandidates.length > 0) {
    config["proxy-groups"] = config["proxy-groups"].filter(
      (g) => g && g.name !== LANDING.relayGroupName
    );
    config["proxy-groups"].push({
      name: LANDING.relayGroupName,
      type: "select",
      proxies: relayCandidates,
    });
  }

  // 4. 配置「AI」策略组（专供 Claude 静态 ISP 落地）
  let aiGroup = config["proxy-groups"].find((g) => g && g.name === "AI");
  if (!aiGroup) {
    aiGroup = {
      name: "AI",
      type: "select",
      proxies: [LANDING.name, "DIRECT"],
    };
    config["proxy-groups"].unshift(aiGroup);
  } else {
    aiGroup.proxies = Array.isArray(aiGroup.proxies) ? aiGroup.proxies : [];
    aiGroup.proxies = [
      LANDING.name,
      ...aiGroup.proxies.filter((n) => n !== LANDING.name),
    ];
  }

  // 5. 配置「🤖 国际AI」策略组（专供 Gemini / Google AI，默认英国）
  const ukNode =
    existingNames.find((n) => n === LANDING.geminiNodeName) ||
    existingNames.find((n) => /英国|UK|GB/i.test(n));
  const geminiProxies = [
    ...(ukNode ? [ukNode] : []),
    "默认节点",
    "DIRECT",
  ];
  let geminiGroup = config["proxy-groups"].find(
    (g) => g && g.name === LANDING.geminiGroupName
  );
  if (!geminiGroup) {
    config["proxy-groups"].push({
      name: LANDING.geminiGroupName,
      type: "select",
      proxies: geminiProxies,
    });
  } else {
    geminiGroup.proxies = [
      ...new Set([
        ...geminiProxies,
        ...(Array.isArray(geminiGroup.proxies) ? geminiGroup.proxies : []),
      ]),
    ];
  }

  // 6. 清理可能引起串线的规则，保证三路互不干扰
  const claudeSet = new Set(CLAUDE_DOMAINS);
  const geminiSet = new Set(GEMINI_DOMAINS);

  const cleanedRules = [];
  for (const r of config.rules) {
    if (typeof r !== "string") {
      cleanedRules.push(r);
      continue;
    }
    const parts = r.split(",");
    const rType = parts[0] ? parts[0].trim() : "";
    const rVal = parts[1] ? parts[1].trim() : "";
    const rTarget = parts[2] ? parts[2].trim() : "";

    if (rTarget === "🤖 国际AI" || rTarget === "🚀 节点选择") {
      continue;
    }
    if (
      (rType === "DOMAIN-SUFFIX" || rType === "DOMAIN") &&
      (claudeSet.has(rVal) || geminiSet.has(rVal))
    ) {
      continue;
    }
    if (rTarget === "AI") {
      parts[2] = "默认节点";
      cleanedRules.push(parts.join(","));
      continue;
    }
    cleanedRules.push(r);
  }

  const topClaudeRules = CLAUDE_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},AI`);
  const topGeminiRules = [
    ...GEMINI_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},${LANDING.geminiGroupName}`),
    `DOMAIN-KEYWORD,jetski,${LANDING.geminiGroupName}`,
    `DOMAIN-KEYWORD,antigravity,${LANDING.geminiGroupName}`,
  ];

  config.rules = [...topClaudeRules, ...topGeminiRules, ...cleanedRules];

  // 7. DoH DNS 策略同步三路隔离
  if (config.dns && config.dns.enable) {
    config.dns["nameserver-policy"] = config.dns["nameserver-policy"] || {};
    for (const d of CLAUDE_DOMAINS) {
      config.dns["nameserver-policy"][`+.${d}`] =
        "https://1.1.1.1/dns-query#AI";
    }
    for (const d of GEMINI_DOMAINS) {
      config.dns["nameserver-policy"][`+.${d}`] =
        `https://1.1.1.1/dns-query#${LANDING.geminiGroupName}`;
    }
  }

  return config;
}
