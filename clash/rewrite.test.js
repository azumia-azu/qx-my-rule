const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMain() {
  const source = fs.readFileSync(path.join(__dirname, 'rewrite.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'rewrite.js' });
  return context.main;
}

function testRuleSetsAreInsertedBeforeMatch() {
  const main = loadMain();
  const result = main({
    proxies: [{ name: 'US 01' }],
    'proxy-groups': [
      { name: '节点选择', type: 'select', proxies: [] },
      { name: '自动选择', type: 'url-test', proxies: [] },
    ],
    rules: ['DOMAIN,example.com,DIRECT', 'MATCH,节点选择'],
  });

  const matchIndex = result.rules.findIndex((rule) => rule.startsWith('MATCH,'));
  const openAIIndex = result.rules.indexOf('RULE-SET,OpenAI-Codex,OpenAI');

  assert(openAIIndex !== -1, 'OpenAI-Codex rule should be added');
  assert(
    openAIIndex < matchIndex,
    'added RULE-SET rules should be evaluated before terminal MATCH',
  );
}

function testFlagPrefixedProxyNamesCreateCountryGroups() {
  const main = loadMain();
  const result = main({
    proxies: [{ name: '🇺🇸 美国 01' }],
    'proxy-groups': [],
    rules: [],
  });

  const usGroup = result['proxy-groups'].find((group) => group.name === '美国');

  assert(usGroup, 'flag-prefixed US proxy should create 美国 country group');
  assert.strictEqual(usGroup.proxies.length, 1);
  assert.strictEqual(usGroup.proxies[0], '🇺🇸 美国 01');
}

testRuleSetsAreInsertedBeforeMatch();
testFlagPrefixedProxyNamesCreateCountryGroups();
