// Clash Verge Rev 四路精准分流扩展脚本模板（兼容 claude-safe-env，针对 macOS ChatGPT / Claude / Gemini 共存优化）
//
// 四路分流架构：
//   1. ChatGPT / OpenAI / Codex 生态 -> 「💬 ChatGPT」（支持选订阅干净节点，或启用独立静态落地/链式中转）
//   2. Claude / Anthropic 生态       -> 「AI」-> 「🎯 独享美区落地」（兼容 claude-safe-env）
//   3. Gemini / Google AI / Antigravity -> 「🤖 国际AI」-> 英国节点
//   4. 其余外网（GitHub / YouTube / 日常网页）-> 「默认节点」
//
// 防串线核心机制：
//   - 在 TUN 模式下，最顶部通过 PROCESS-NAME-REGEX 优先锁定桌面客户端进程：
//     ChatGPT.app / Codex.app -> 「💬 ChatGPT」，Claude.app -> 「AI」。
//     这样即使两者共用 challenges.cloudflare.com / stripe.com / workos.com / intercom.io 等域名，
//     桌面端流量也绝不会互相串线！
//
// 使用方法：
//   1. 复制本文件到本地（勿把真实密码提交到公开仓库），按需修改 CHATGPT_CONFIG / CLAUDE_LANDING。
//   2. 在 Clash Verge Rev 中：右键订阅 ->「编辑扩展脚本」，粘贴并保存。
//   3. 将 Clash Verge 顶栏模式切换为「规则 (Rule)」，开启「TUN 模式」（建议关闭 IPv6）。

// ============================================================================
// 一、ChatGPT 策略配置（默认自动筛选干净的美/新/日/台节点，可选启用独享落地）
// ============================================================================
const CHATGPT_CONFIG = {
  groupName: "💬 ChatGPT",

  // 优先置顶的现有订阅节点名（按顺序匹配，留空则按下方地区正则自动收集）
  preferredNodes: [
    // "🇺🇸 V美国 05",
    // "🇺🇸 V美国 04",
  ],

  // 允许进入「💬 ChatGPT」候选池的地区关键词（排除 CN/HK/MO/RU 等 OpenAI 不支持地区）
  preferredRegionRegex: /美国|US|狮城|新加坡|SG|日本|JP|台湾|TW|韩国|KR|英国|UK|GB/i,
  blockedRegionRegex:
    /中国|香港|澳门|俄罗斯|白俄罗斯|伊朗|朝鲜|叙利亚|古巴|委内瑞拉|CN|HK|MO|RU|BY|IR|KP|SY|CU|VE|剩余|过期|官网|流量|重置|套餐|通知|DIRECT/i,

  // 可选：为 ChatGPT 单独配置静态 ISP / VPS 独享落地（无需单独落地时保持 enabled: false）
  landing: {
    enabled: false,
    name: "🎯 ChatGPT 独享落地",
    type: "socks5", // "socks5" | "http" | "vless"
    server: "REPLACE_WITH_CHATGPT_IP",
    port: 443,
    username: "REPLACE_WITH_USERNAME",
    password: "REPLACE_WITH_PASSWORD",
    tls: false,
    uuid: "",
    servername: "www.apple.com",
    publicKey: "",
    shortId: "",
    useRelay: true,
    relayGroupName: "⚡ 中转前置",
  },
};

// ============================================================================
// 二、Claude 生态独享落地配置（与 claude-safe-env/clash-verge-script.template.js 完全兼容）
// ============================================================================
const CLAUDE_LANDING = {
  // 若需要同时运行 Claude 桌面端且走静态 ISP 落地，填好真实参数后改为 true
  enabled: false,
  name: "🎯 独享美区落地",
  type: "socks5", // "socks5" | "http" | "vless"
  server: "REPLACE_WITH_US_IP",
  port: 443,
  username: "REPLACE_WITH_USERNAME",
  password: "REPLACE_WITH_PASSWORD",
  tls: false,
  uuid: "",
  servername: "www.apple.com",
  publicKey: "",
  shortId: "",
  useRelay: true,
  relayGroupName: "⚡ 中转前置",
};

// ============================================================================
// 三、其他共用策略组配置
// ============================================================================
const SHARED_CONFIG = {
  relayGroupName: "⚡ 中转前置",
  geminiGroupName: "🤖 国际AI",
  geminiNodeName: "🇬🇧 V英国",
  defaultGroupName: "默认节点",

  // 浏览器中 Claude 与 ChatGPT 共用的验证/支付/客服域名（challenges.cloudflare.com / stripe.com 等）去向：
  // - "AUTO": 若启用了 CLAUDE_LANDING 且未启用 ChatGPT 独享落地，则优先给 "AI"（防止 Claude 网页验证串线），否则给 "💬 ChatGPT"
  // - 也可显式设为 "💬 ChatGPT" 或 "AI"
  sharedAuthTarget: "AUTO",
};

// ============================================================================
// 四、域名清单
// ============================================================================

// 1) ChatGPT / OpenAI / Codex 核心域（参考 OpenAI 官方网络白名单）
const CHATGPT_DOMAINS = [
  "chatgpt.com",
  "ws.chatgpt.com",
  "ab.chatgpt.com",
  "realtime.chatgpt.com",
  "openai.com",
  "auth.openai.com",
  "auth0.openai.com",
  "setup.auth.openai.com",
  "api.openai.com",
  "platform.openai.com",
  "cdn.platform.openai.com",
  "chat.openai.com",
  "desktop.chat.openai.com",
  "ios.chat.openai.com",
  "android.chat.openai.com",
  "tcr9i.chat.openai.com",
  "oaistatic.com",
  "oaiusercontent.com",
  "oaistatsig.com",
  "openaimerge.com",
  "sora.com",
  "o207216.ingest.sentry.io",
  "o33249.ingest.sentry.io",
  "rum.browser-intake-datadoghq.com",
  "intercomcdn.com",
  "ct.sendgrid.net",
  "register.appattest.apple.com",
  "humb.apple.com",
];

// 2) Claude / Anthropic 专属域
const CLAUDE_DOMAINS = [
  "anthropic.com",
  "clau.de",
  "claude.ai",
  "claude.com",
  "claudemcpclient.com",
  "claudemcpcontent.com",
  "claudeusercontent.com",
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
  "prodregistryv2.org",
  "featureassets.org",
];

// 3) 双方都会用到的第三方验证/支付/遥测域
// （桌面客户端已由顶部 PROCESS-NAME-REGEX 优先隔离，此处仅影响浏览器兜底归属）
const SHARED_AUTH_DOMAINS = [
  "challenges.cloudflare.com",
  "workos.com",
  "workoscdn.com",
  "workos.imgix.net",
  "stripe.com",
  "intercom.io",
  "featuregates.org",
  "statsigapi.net",
];

// 4) Gemini / Google AI / Antigravity 生态走英国
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

function isLandingActive(landing) {
  return (
    landing &&
    landing.enabled &&
    landing.server &&
    !String(landing.server).startsWith("REPLACE_WITH_")
  );
}

function buildLandingProxy(landing) {
  const base = {
    name: landing.name,
    server: landing.server,
    port: Number(landing.port),
    udp: true,
  };

  if (landing.useRelay) {
    base["dialer-proxy"] = landing.relayGroupName || SHARED_CONFIG.relayGroupName;
  }

  if (landing.type === "socks5" || landing.type === "http") {
    base.type = landing.type;
    if (landing.username && landing.username !== "REPLACE_WITH_USERNAME") {
      base.username = landing.username;
    }
    if (landing.password && landing.password !== "REPLACE_WITH_PASSWORD") {
      base.password = landing.password;
    }
    if (landing.tls) {
      base.tls = true;
      base["skip-cert-verify"] = false;
    }
    return base;
  }

  if (landing.type === "vless") {
    return {
      ...base,
      type: "vless",
      uuid: landing.uuid,
      tls: true,
      flow: "xtls-rprx-vision",
      servername: landing.servername || "www.apple.com",
      "client-fingerprint": "chrome",
      "skip-cert-verify": false,
      "reality-opts": {
        "public-key": landing.publicKey,
        "short-id": landing.shortId,
      },
    };
  }

  throw new Error(`Unsupported landing type: ${landing.type}`);
}

function main(config, profileName) {
  config = config || {};
  config.proxies = Array.isArray(config.proxies) ? config.proxies : [];
  config["proxy-groups"] = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"]
    : [];
  config.rules = Array.isArray(config.rules) ? config.rules : [];

  const chatgptLandingOn = isLandingActive(CHATGPT_CONFIG.landing);
  const claudeLandingOn = isLandingActive(CLAUDE_LANDING);

  const reservedNames = new Set([
    CHATGPT_CONFIG.landing.name,
    CLAUDE_LANDING.name,
  ]);

  const existingNames = config.proxies
    .map((p) => p && p.name)
    .filter((n) => n && !reservedNames.has(n));

  // 1. 构建「⚡ 中转前置」候选池（仅在任一独享落地开启 relay 时注入）
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

  const needRelay =
    (chatgptLandingOn && CHATGPT_CONFIG.landing.useRelay) ||
    (claudeLandingOn && CLAUDE_LANDING.useRelay);

  if (needRelay && relayCandidates.length > 0) {
    config["proxy-groups"] = config["proxy-groups"].filter(
      (g) => g && g.name !== SHARED_CONFIG.relayGroupName
    );
    config["proxy-groups"].push({
      name: SHARED_CONFIG.relayGroupName,
      type: "select",
      proxies: relayCandidates,
    });
  }

  // 2. 注入可选独享落地节点
  config.proxies = config.proxies.filter((p) => p && !reservedNames.has(p.name));
  if (claudeLandingOn) {
    config.proxies.unshift(buildLandingProxy(CLAUDE_LANDING));
  }
  if (chatgptLandingOn) {
    config.proxies.unshift(buildLandingProxy(CHATGPT_CONFIG.landing));
  }

  // 3. 配置「💬 ChatGPT」策略组
  const cleanChatgptNodes = existingNames.filter(
    (n) =>
      CHATGPT_CONFIG.preferredRegionRegex.test(n) &&
      !CHATGPT_CONFIG.blockedRegionRegex.test(n)
  );
  const preferredExisting = (CHATGPT_CONFIG.preferredNodes || []).filter((n) =>
    existingNames.includes(n)
  );
  const chatgptCandidates = [
    ...(chatgptLandingOn ? [CHATGPT_CONFIG.landing.name] : []),
    ...preferredExisting,
    ...cleanChatgptNodes,
    ...(existingNames.includes(SHARED_CONFIG.defaultGroupName)
      ? [SHARED_CONFIG.defaultGroupName]
      : []),
  ];
  const chatgptProxies = [
    ...new Set(
      chatgptCandidates.length > 0 ? chatgptCandidates : existingNames
    ),
  ];

  config["proxy-groups"] = config["proxy-groups"].filter(
    (g) => g && g.name !== CHATGPT_CONFIG.groupName
  );
  config["proxy-groups"].unshift({
    name: CHATGPT_CONFIG.groupName,
    type: "select",
    proxies: chatgptProxies.length > 0 ? chatgptProxies : ["DIRECT"],
  });

  // 4. 配置「AI」策略组（供 Claude 使用）
  let aiGroup = config["proxy-groups"].find((g) => g && g.name === "AI");
  if (!aiGroup) {
    const aiFallbacks = existingNames.filter(
      (n) => !CHATGPT_CONFIG.blockedRegionRegex.test(n)
    );
    aiGroup = {
      name: "AI",
      type: "select",
      proxies: [
        ...(claudeLandingOn ? [CLAUDE_LANDING.name] : []),
        ...aiFallbacks.slice(0, 15),
        "DIRECT",
      ],
    };
    config["proxy-groups"].splice(1, 0, aiGroup);
  } else if (claudeLandingOn) {
    aiGroup.proxies = Array.isArray(aiGroup.proxies) ? aiGroup.proxies : [];
    aiGroup.proxies = [
      CLAUDE_LANDING.name,
      ...aiGroup.proxies.filter((n) => n !== CLAUDE_LANDING.name),
    ];
  }

  // 5. 配置「🤖 国际AI」策略组（专供 Gemini / Google AI，默认英国）
  const ukNode =
    existingNames.find((n) => n === SHARED_CONFIG.geminiNodeName) ||
    existingNames.find((n) => /英国|UK|GB/i.test(n));
  const geminiProxies = [
    ...(ukNode ? [ukNode] : []),
    ...(existingNames.includes(SHARED_CONFIG.defaultGroupName)
      ? [SHARED_CONFIG.defaultGroupName]
      : []),
    "DIRECT",
  ];
  let geminiGroup = config["proxy-groups"].find(
    (g) => g && g.name === SHARED_CONFIG.geminiGroupName
  );
  if (!geminiGroup) {
    config["proxy-groups"].push({
      name: SHARED_CONFIG.geminiGroupName,
      type: "select",
      proxies: [...new Set(geminiProxies)],
    });
  } else {
    geminiGroup.proxies = [
      ...new Set([
        ...geminiProxies,
        ...(Array.isArray(geminiGroup.proxies) ? geminiGroup.proxies : []),
      ]),
    ];
  }

  // 6. 决定共享验证域（浏览器端）去向
  let sharedTarget = SHARED_CONFIG.sharedAuthTarget;
  if (!sharedTarget || sharedTarget === "AUTO") {
    sharedTarget =
      claudeLandingOn && !chatgptLandingOn ? "AI" : CHATGPT_CONFIG.groupName;
  }

  // 7. 清理可能引起串线的旧规则，保证四路互不干扰
  const allManagedSet = new Set([
    ...CHATGPT_DOMAINS,
    ...CLAUDE_DOMAINS,
    ...SHARED_AUTH_DOMAINS,
    ...GEMINI_DOMAINS,
  ]);

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

    if (
      rTarget === SHARED_CONFIG.geminiGroupName ||
      rTarget === CHATGPT_CONFIG.groupName ||
      rTarget === "🚀 节点选择"
    ) {
      continue;
    }
    if (
      (rType === "DOMAIN-SUFFIX" || rType === "DOMAIN") &&
      allManagedSet.has(rVal)
    ) {
      continue;
    }
    if (rType === "PROCESS-NAME-REGEX" && /chatgpt|codex|claude|anthropic/i.test(rVal)) {
      continue;
    }
    if (rTarget === "AI") {
      parts[2] = existingNames.includes(SHARED_CONFIG.defaultGroupName)
        ? SHARED_CONFIG.defaultGroupName
        : "DIRECT";
      cleanedRules.push(parts.join(","));
      continue;
    }
    cleanedRules.push(r);
  }

  // 顶部进程隔离规则（需开启 Clash Verge TUN 模式生效）
  const topProcessRules = [
    `PROCESS-NAME-REGEX,(?i)(chatgpt|com\\.openai\\.chat|codex|com\\.openai\\.codex),${CHATGPT_CONFIG.groupName}`,
    `PROCESS-NAME-REGEX,(?i)(claude|anthropic),AI`,
  ];

  const topChatgptRules = [
    ...CHATGPT_DOMAINS.map(
      (d) => `DOMAIN-SUFFIX,${d},${CHATGPT_CONFIG.groupName}`
    ),
    `DOMAIN-KEYWORD,openai,${CHATGPT_CONFIG.groupName}`,
    `DOMAIN-KEYWORD,chatgpt,${CHATGPT_CONFIG.groupName}`,
  ];
  const topClaudeRules = CLAUDE_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},AI`);
  const topSharedAuthRules = SHARED_AUTH_DOMAINS.map(
    (d) => `DOMAIN-SUFFIX,${d},${sharedTarget}`
  );
  const topGeminiRules = [
    ...GEMINI_DOMAINS.map(
      (d) => `DOMAIN-SUFFIX,${d},${SHARED_CONFIG.geminiGroupName}`
    ),
    `DOMAIN-KEYWORD,jetski,${SHARED_CONFIG.geminiGroupName}`,
    `DOMAIN-KEYWORD,antigravity,${SHARED_CONFIG.geminiGroupName}`,
  ];

  config.rules = [
    ...topProcessRules,
    ...topChatgptRules,
    ...topClaudeRules,
    ...topSharedAuthRules,
    ...topGeminiRules,
    ...cleanedRules,
  ];

  // 8. DoH DNS 策略同步四路绑定
  if (config.dns && config.dns.enable) {
    config.dns["nameserver-policy"] = config.dns["nameserver-policy"] || {};
    for (const d of CHATGPT_DOMAINS) {
      config.dns["nameserver-policy"][`+.${d}`] =
        `https://1.1.1.1/dns-query#${CHATGPT_CONFIG.groupName}`;
    }
    for (const d of CLAUDE_DOMAINS) {
      config.dns["nameserver-policy"][`+.${d}`] =
        "https://1.1.1.1/dns-query#AI";
    }
    for (const d of SHARED_AUTH_DOMAINS) {
      config.dns["nameserver-policy"][`+.${d}`] =
        `https://1.1.1.1/dns-query#${sharedTarget}`;
    }
    for (const d of GEMINI_DOMAINS) {
      config.dns["nameserver-policy"][`+.${d}`] =
        `https://1.1.1.1/dns-query#${SHARED_CONFIG.geminiGroupName}`;
    }
  }

  return config;
}
