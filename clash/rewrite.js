function main(config, profileName) {

  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  if (proxies.length === 0) return config;

  const { ruleProviders, rules } = materializeRuleProviders(config);
  const countryMap = buildCountryMap(proxies);
  const countryNames = Array.from(countryMap.keys());
  const allProxyNames = proxies.map(({ name }) => name).filter(Boolean);
  const extraGroups = materializeExtraGroups(countryMap);

  const baseGroups = Array.isArray(config['proxy-groups'])
    ? config['proxy-groups']
    : [];

  const updatedGroups = baseGroups.map((group) => {
    if (!group || !group.name) return group;

    if (group.name === '节点选择') {
      return { ...group, proxies: ['自动选择', ...countryNames] };
    }

    if (group.name === '自动选择') {
      return { ...group, proxies: allProxyNames };
    }

    return group;
  });

  const existingGroupNames = new Set(
    updatedGroups.map((group) => group && group.name).filter(Boolean),
  );

  const mergedGroups = [...updatedGroups];

  extraGroups.forEach((group) => {
    if (!existingGroupNames.has(group.name)) {
      mergedGroups.push(group);
      existingGroupNames.add(group.name);
    }
  });

  const countryGroups = countryNames
    .filter((name) => !existingGroupNames.has(name))
    .map((name) => ({
      name,
      type: 'select',
      proxies: countryMap.get(name),
    }));

  return {
    ...config,
    'proxy-groups': [...mergedGroups, ...countryGroups],
    'rule-providers': ruleProviders,
    rules,
  };
}

const EXTRA_GROUP_TEMPLATES = [
  {
    name: 'OpenAI',
    type: 'select',
    include: ['节点选择'], // 先用总入口
    countries: 'openai-supported', // 仅使用 OpenAI 支持的国家/地区节点
  },
  {
    name: 'Niconico',
    type: 'select',
    include: ['节点选择'], // 保留手动入口
    countries: ['日本'], // 仅日本节点
  },
  // 示例：将港台节点聚合到一个策略组，按需改名或添加更多模板
  // {
  //   name: '港台节点',
  //   type: 'select',
  //   include: ['节点选择'], // 静态前置项，可选
  //   countries: ['香港', '台湾'], // 从这些国家的节点填充
  // },
  // {
  //   name: '全球自动',
  //   type: 'url-test',
  //   url: 'http://www.gstatic.com/generate_204',
  //   interval: 600,
  //   countries: 'all', // 将所有国家的节点纳入测速
  // },
];

// 根据 rule-provider 设计的模版，引入远端规则集并自动在 rules 里挂载
const RULE_PROVIDER_TEMPLATES = [
  {
    name: 'OpenAI-Codex',
    policy: 'OpenAI', // 将 RULE-SET 套用到哪个策略组
    type: 'http',
    behavior: 'classical', // 使用经典规则语法，方便混合 DOMAIN/IP
    url: 'https://raw.githubusercontent.com/azumili/qx-my-rule/main/clash/ruleset/openai-codex.list',
    path: './ruleset/openai-codex.list',
    interval: 86400,
    format: 'text',
  },
  {
    name: 'Niconico',
    policy: 'Niconico', // 将 RULE-SET 套用到哪个策略组
    type: 'http',
    behavior: 'classical',
    url: 'https://raw.githubusercontent.com/azumili/qx-my-rule/main/clash/ruleset/niconico.list',
    path: './ruleset/niconico.list',
    interval: 86400,
    format: 'text',
  },
];

function buildCountryMap(proxies) {
  const map = new Map();

  proxies.forEach((proxy) => {
    if (!proxy || !proxy.name) return;

    const country = extractCountry(proxy.name);
    if (!country) return;

    if (!map.has(country)) map.set(country, []);
    map.get(country).push(proxy.name);
  });

  return map;
}

function extractCountry(name) {
  const match = name.match(/^[\p{Script=Han}A-Za-z]+/u);
  if (!match) return null;

  const raw = match[0];
  const normalized = normalizeCountryCode(raw);
  return normalized || raw;
}

function normalizeCountryCode(code) {
  const map = {
    HK: '香港',
    MO: '澳门',
    TW: '台湾',
    SG: '新加坡',
    JP: '日本',
    KR: '韩国',
    US: '美国',
    USA: '美国',
    UK: '英国',
    GB: '英国',
    AU: '澳大利亚',
  };

  const upper = code.toUpperCase();
  return map[upper] || null;
}

function materializeExtraGroups(countryMap) {
  return EXTRA_GROUP_TEMPLATES.map((template) => {
    if (!template || !template.name) return null;

    const { name, type = 'select', include = [], countries, ...rest } =
      template;

    const proxies = Array.isArray(include) ? [...include.filter(Boolean)] : [];

    const countryList =
      countries === 'all'
        ? Array.from(countryMap.values()).flat()
        : countries === 'openai-supported'
          ? Array.from(countryMap.entries())
              .filter(([country]) => isOpenaiSupportedCountry(country))
              .flatMap(([, nodes]) => nodes)
        : Array.isArray(countries)
          ? countries.flatMap((country) => countryMap.get(country) || [])
          : [];

    proxies.push(...countryList.filter(Boolean));

    return { name, type, proxies, ...rest };
  }).filter(Boolean);
}

function materializeRuleProviders(config) {
  const baseProviders =
    config && typeof config === 'object' && config['rule-providers']
      ? { ...config['rule-providers'] }
      : {};

  const baseRules = Array.isArray(config.rules) ? [...config.rules] : [];
  const existing = new Set(Object.keys(baseProviders));

  RULE_PROVIDER_TEMPLATES.forEach((tpl) => {
    if (!tpl || !tpl.name) return;
    if (existing.has(tpl.name)) return;

    const {
      name,
      policy = '节点选择',
      type = 'http',
      behavior = 'domain',
      interval = 86400,
      url,
      path = `./ruleset/${name}.list`,
      format = 'text',
      ...rest
    } = tpl;

    if (!url) return;

    baseProviders[name] = {
      type,
      behavior,
      interval,
      url,
      path,
      format,
      ...rest,
    };

    baseRules.push(`RULE-SET,${name},${policy}`);
    existing.add(name);
  });

  return { ruleProviders: baseProviders, rules: baseRules };
}

// OpenAI 官方未支持的地区（简化版），匹配中文名或代码
const OPENAI_UNSUPPORTED_COUNTRIES = new Set([
  '中国',
  '中国大陆',
  'CN',
  '香港',
  'HK',
  'HKG',
  '俄罗斯',
  'RU',
  'RUS',
  '白俄罗斯',
  'BY',
  '伊朗',
  'IR',
  'IRN',
  '朝鲜',
  'KP',
  'PRK',
  '古巴',
  'CU',
  'CUB',
  '叙利亚',
  'SY',
  'SYR',
  '阿富汗',
  'AF',
  'AFG',
]);

function isOpenaiSupportedCountry(countryName) {
  if (!countryName) return false;
  const normalized = normalizeCountryName(countryName);
  return !OPENAI_UNSUPPORTED_COUNTRIES.has(normalized);
}

function normalizeCountryName(name) {
  if (!name) return '';
  const codeNormalized = normalizeCountryCode(name);
  if (codeNormalized) return codeNormalized;
  return String(name).trim();
}
