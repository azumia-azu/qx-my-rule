function main(config, profileName) {
  const proxies = config.proxies || [];
  const proxyNames = proxies.map((p) => p.name).filter(Boolean);

  // ===== 工具函数 =====

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  const byRegex = (regex) => {
    return proxyNames.filter((name) => regex.test(name));
  };

  const makeUrlTest = (name, list, extra = {}) => {
    return {
      name,
      type: "url-test",
      proxies: list.length > 0 ? list : ["DIRECT"],
      url: "https://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      lazy: true,
      ...extra,
    };
  };

  const makeSelect = (name, list, extra = {}) => {
    return {
      name,
      type: "select",
      proxies: uniq(list),
      ...extra,
    };
  };

  const groupNames = {
    main: "节点选择",
    auto: "自动选择",
    hk: "香港节点",
    jp: "日本节点",
    tw: "台湾节点",
    sg: "新加坡节点",
    us: "美国节点",
    eu: "欧洲节点",
    other: "其他节点",

    ai: "AI",
    youtube: "YouTube",
    telegram: "Telegram",
    github: "GitHub",
    microsoft: "Microsoft",
    apple: "Apple",
    games: "Games",
    final: "漏网之鱼",
  };

  // ===== 自动节点分组 =====

  const hk = byRegex(/香港|HK|Hong Kong/i);
  const jp = byRegex(/日本|东京|JP|Japan/i);
  const tw = byRegex(/台湾|台灣|TW|Taiwan/i);
  const sg = byRegex(/新加坡|狮城|SG|Singapore/i);
  const us = byRegex(/美国|美國|US|USA|United States/i);

  const eu = byRegex(
    /英国|英國|法国|法國|德国|德國|荷兰|荷蘭|瑞士|意大利|西班牙|葡萄牙|芬兰|芬蘭|波兰|波蘭|捷克|希腊|希臘|比利时|比利時|奥地利|奧地利|爱尔兰|愛爾蘭|欧洲|歐洲|UK|France|Germany|Netherlands|Europe/i
  );

  const known = new Set([...hk, ...jp, ...tw, ...sg, ...us, ...eu]);
  const other = proxyNames.filter((name) => !known.has(name));

  const regionGroups = [
    groupNames.auto,
    groupNames.hk,
    groupNames.jp,
    groupNames.tw,
    groupNames.sg,
    groupNames.us,
    groupNames.eu,
    groupNames.other,
  ];

  // ===== 基础代理组 =====

  const proxyGroups = [
    makeSelect(groupNames.main, [
      groupNames.auto,
      groupNames.hk,
      groupNames.jp,
      groupNames.tw,
      groupNames.sg,
      groupNames.us,
      groupNames.eu,
      groupNames.other,
      "DIRECT",
    ]),

    makeUrlTest(groupNames.auto, proxyNames),

    makeUrlTest(groupNames.hk, hk),
    makeUrlTest(groupNames.jp, jp),
    makeUrlTest(groupNames.tw, tw),
    makeUrlTest(groupNames.sg, sg),
    makeUrlTest(groupNames.us, us),
    makeUrlTest(groupNames.eu, eu),
    makeSelect(groupNames.other, other.length > 0 ? other : proxyNames),

    // ===== 规则策略组 =====
    makeSelect(groupNames.ai, [
      groupNames.jp,
      groupNames.sg,
      groupNames.tw,
      groupNames.us,
      groupNames.main,
      "DIRECT",
    ]),

    makeSelect(groupNames.youtube, [
      groupNames.hk,
      groupNames.jp,
      groupNames.sg,
      groupNames.tw,
      groupNames.us,
      groupNames.main,
      "DIRECT",
    ]),

    makeSelect(groupNames.telegram, [
      groupNames.sg,
      groupNames.hk,
      groupNames.jp,
      groupNames.us,
      groupNames.main,
      "DIRECT",
    ]),

    makeSelect(groupNames.github, [
      groupNames.main,
      groupNames.hk,
      groupNames.jp,
      groupNames.sg,
      "DIRECT",
    ]),

    makeSelect(groupNames.microsoft, [
      "DIRECT",
      groupNames.main,
      groupNames.hk,
      groupNames.jp,
      groupNames.sg,
    ]),

    makeSelect(groupNames.apple, [
      "DIRECT",
      groupNames.main,
      groupNames.hk,
      groupNames.jp,
      groupNames.sg,
    ]),

    makeSelect(groupNames.games, [
      groupNames.jp,
      groupNames.hk,
      groupNames.sg,
      groupNames.tw,
      groupNames.main,
      "DIRECT",
    ]),

    makeSelect(groupNames.final, [
      groupNames.main,
      groupNames.auto,
      "DIRECT",
    ]),
  ];

  // ===== 额外自定义规则组 =====
  // 想加自己的规则组，就在这里追加。
  //
  // name: 规则组名称
  // proxies: 这个规则组可以选择哪些代理组/节点
  // rules: 这个规则组对应的规则
  //
  // 规则会自动插入到 rules 前面。

  const extraRuleGroups = [
    {
      name: "下载",
      proxies: [
        "DIRECT",
        groupNames.main,
        groupNames.hk,
        groupNames.jp,
        groupNames.sg,
      ],
      rules: [
        "DOMAIN-SUFFIX,steamserver.net,下载",
        "DOMAIN-SUFFIX,cm.steampowered.com,下载",
        "DOMAIN-SUFFIX,steamcontent.com,下载",
      ],
    },

    {
      name: "开发",
      proxies: [
        groupNames.main,
        groupNames.hk,
        groupNames.jp,
        groupNames.sg,
        "DIRECT",
      ],
      rules: [
        "DOMAIN-SUFFIX,github.com,开发",
        "DOMAIN-SUFFIX,githubusercontent.com,开发",
        "DOMAIN-SUFFIX,githubassets.com,开发",
        "DOMAIN-SUFFIX,gitlab.com,开发",
        "DOMAIN-SUFFIX,npmjs.org,开发",
        "DOMAIN-SUFFIX,npmjs.com,开发",
        "DOMAIN-SUFFIX,crates.io,开发",
        "DOMAIN-SUFFIX,static.crates.io,开发",
      ],
    },
  ];

  for (const group of extraRuleGroups) {
    proxyGroups.push(makeSelect(group.name, group.proxies));
  }

  // ===== 规则 =====

  const baseRules = [
    // AI
    `DOMAIN-SUFFIX,openai.com,${groupNames.ai}`,
    `DOMAIN-SUFFIX,chatgpt.com,${groupNames.ai}`,
    `DOMAIN-SUFFIX,oaistatic.com,${groupNames.ai}`,
    `DOMAIN-SUFFIX,oaiusercontent.com,${groupNames.ai}`,
    `DOMAIN-SUFFIX,anthropic.com,${groupNames.ai}`,
    `DOMAIN-SUFFIX,claude.ai,${groupNames.ai}`,
    `DOMAIN-SUFFIX,gemini.google.com,${groupNames.ai}`,

    // YouTube / Google Video
    `DOMAIN-SUFFIX,youtube.com,${groupNames.youtube}`,
    `DOMAIN-SUFFIX,ytimg.com,${groupNames.youtube}`,
    `DOMAIN-SUFFIX,googlevideo.com,${groupNames.youtube}`,
    `DOMAIN-SUFFIX,youtu.be,${groupNames.youtube}`,

    // Telegram
    `DOMAIN-SUFFIX,telegram.org,${groupNames.telegram}`,
    `DOMAIN-SUFFIX,t.me,${groupNames.telegram}`,
    `IP-CIDR,91.108.4.0/22,${groupNames.telegram},no-resolve`,
    `IP-CIDR,91.108.8.0/21,${groupNames.telegram},no-resolve`,
    `IP-CIDR,91.108.16.0/22,${groupNames.telegram},no-resolve`,
    `IP-CIDR,91.108.56.0/22,${groupNames.telegram},no-resolve`,
    `IP-CIDR,149.154.160.0/20,${groupNames.telegram},no-resolve`,

    // GitHub
    `DOMAIN-SUFFIX,github.com,${groupNames.github}`,
    `DOMAIN-SUFFIX,githubusercontent.com,${groupNames.github}`,
    `DOMAIN-SUFFIX,githubassets.com,${groupNames.github}`,

    // Microsoft
    `DOMAIN-SUFFIX,microsoft.com,${groupNames.microsoft}`,
    `DOMAIN-SUFFIX,windows.com,${groupNames.microsoft}`,
    `DOMAIN-SUFFIX,windowsupdate.com,${groupNames.microsoft}`,
    `DOMAIN-SUFFIX,office.com,${groupNames.microsoft}`,
    `DOMAIN-SUFFIX,live.com,${groupNames.microsoft}`,

    // Apple
    `DOMAIN-SUFFIX,apple.com,${groupNames.apple}`,
    `DOMAIN-SUFFIX,icloud.com,${groupNames.apple}`,
    `DOMAIN-SUFFIX,cdn-apple.com,${groupNames.apple}`,

    // Games
    `DOMAIN-SUFFIX,steampowered.com,${groupNames.games}`,
    `DOMAIN-SUFFIX,steamcommunity.com,${groupNames.games}`,
    `DOMAIN-SUFFIX,epicgames.com,${groupNames.games}`,

    // 国内直连
    "GEOIP,CN,DIRECT",
    "GEOSITE,CN,DIRECT",
  ];

  const extraRules = extraRuleGroups.flatMap((group) => group.rules || []);

  // 去掉原来已有的 MATCH，避免 MATCH 太早导致后面的规则失效
  const oldRules = (config.rules || []).filter((rule) => {
    return typeof rule === "string" && !/^MATCH,/.test(rule);
  });

  config["proxy-groups"] = proxyGroups;

  config.rules = uniq([
    ...extraRules,
    ...baseRules,
    ...oldRules,
    `MATCH,${groupNames.final}`,
  ]);

  return config;
}
