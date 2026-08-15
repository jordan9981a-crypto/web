import test from 'node:test';
import assert from 'node:assert/strict';
import { site } from '../src/data/site.mjs';
import { memberGroups } from '../src/data/members.mjs';
import { publications } from '../src/data/publications.mjs';

const forbiddenPhoneKeyTerms = ['phone', 'telephone', 'tel', 'mobile', '电话', '手机'];
const mainlandMobile = /(?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9}/;
const mainlandLandline = /(?:\+?86[-\s]?)?(?:\(\s?0\d{2,3}\s?\)|0\d{2,3})(?:[-\s]?\d){7,8}/;

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[\s_.-]/g, '');
}

function isForbiddenPublicKey(key) {
  const normalizedKey = normalizeKey(key);
  return normalizedKey.includes('pdf')
    || forbiddenPhoneKeyTerms.some((term) => normalizedKey.includes(term));
}

function isPhoneLikeValue(value) {
  const publicValue = String(value);
  return mainlandMobile.test(publicValue) || mainlandLandline.test(publicValue);
}

function assertNoForbiddenPublicData(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenPublicData);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      assert.equal(isForbiddenPublicKey(key), false);
      assertNoForbiddenPublicData(nestedValue);
    }
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    assert.equal(isPhoneLikeValue(value), false);
  }
}

test('privacy detector rejects representative forbidden contact and PDF data', () => {
  for (const key of [
    'phoneNumber', 'contactPhone', 'mobilePhone', 'telNumber', '手机号',
    '手机号码', '办公电话', '联系电话', '电话号码', 'CONTACT_PHONE',
    'pdf', 'pdfUrl', 'publicationPdf',
  ]) {
    assert.equal(isForbiddenPublicKey(key), true, key);
  }
  assert.equal(isForbiddenPublicKey('email'), false);
  assert.equal(isForbiddenPublicKey('publicationUrl'), false);

  for (const value of [
    '15140123456', '151-4012-3456', '151 4012 3456', '0312-7521234',
    '03127521234', '0312 7521234', '(0312)7521234',
  ]) {
    assert.equal(isPhoneLikeValue(value), true, value);
  }
  assert.equal(isPhoneLikeValue('2026'), false);
  assert.equal(isPhoneLikeValue('10.1016/j.est.2026.123706'), false);
});

test('site identity, institutions, advisors, directions, and public contact data are verified', () => {
  assert.equal(site.name, '刘景维—吴双妍联合培养课题组');
  assert.deepEqual(site.schools.map(({ name }) => name), ['华北电力大学', '沈阳化工大学']);
  assert.deepEqual(site.advisors.map(({ name }) => name), ['刘景维', '吴双妍']);
  assert.deepEqual(site.advisors.map(({ email }) => email), [
    'liujingwei@ncepu.edu.cn',
    'wushuangyan90@syuct.edu.cn',
  ]);
  assert.deepEqual(site.directions, [
    { name: '功能配合物化学', summary: '围绕金属离子与有机配体的可控组装，研究配位结构、电子状态及其构效关系。' },
    { name: '储能电池关键材料设计合成与应用', summary: '面向锂离子、水系锌离子等储能体系，设计合成电极、电解质与界面功能材料。' },
    { name: '高安全储能电池的设计与开发', summary: '聚焦水系电池、固态电解质与稳定界面，提升电池安全性、循环寿命和实际应用性能。' },
  ]);
});

test('member groups contain exactly the confirmed public names in the planned shape', () => {
  assert.deepEqual(memberGroups, [
    {
      label: '在读成员',
      names: ['李晨旭', '黄奕栋', '庄泽隆', '史思雨', '庞雅文', '申宝鑫', '周建成', '李欣雨', '杨娟', '张珂豪'],
    },
    {
      label: '已毕业成员',
      names: ['郑梦贤', '高秋英', '徐姝祺', '程晓龙', '党仕发', '孔维乐', '王磊'],
    },
  ]);
  const names = memberGroups.flatMap(({ names: groupNames }) => groupNames);
  assert.equal(names.length, 17);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    assert.match(name, /^[\u3400-\u9fff·]{2,10}$/);
  }
});

test('publications contain exactly the confirmed DOI records and metadata', () => {
  assert.deepEqual(publications, [
    {
      year: 2026,
      title: 'Zero-dimensional copper coordination compound for enhanced energy density in aqueous zinc-ion batteries',
      authors: ['Mingchang Zhu', 'Lei Wang', 'Junqi Su', 'Xiaolong Cheng', 'Siyu Shi', 'Lei Wang', 'Yaguang Sun', 'Jingwei Liu', 'Shuangyan Wu'],
      journal: 'Journal of Energy Storage', volume: '178', issue: '', pages: '123706',
      doi: '10.1016/j.est.2026.123706', url: 'https://doi.org/10.1016/j.est.2026.123706',
    },
    {
      year: 2026,
      title: 'Mn-node modulation of hydrophobic-zincophilic coordination polymer interphase for stable zinc metal anodes',
      authors: ['Jingwei Liu', 'Yidong Huang', 'Xinyi Chen', 'Chenxu Li', 'Xiaolong Cheng', 'Shifa Dang', 'Weile Kong', 'Yawen Pang', 'Shuangyan Wu'],
      journal: 'Electrochimica Acta', volume: '575', issue: '', pages: '149500',
      doi: '10.1016/j.electacta.2026.149500', url: 'https://doi.org/10.1016/j.electacta.2026.149500',
    },
    {
      year: 2026,
      title: 'Topology directed Cu-MOF cathode composite with interconnected ion channels for fast and stable Zn2+ storage',
      authors: ['Mingchang Zhu', 'Lei Wang', 'Qiuying Gao', 'Junqi Su', 'Xiaolong Cheng', 'Lei Wang', 'Yaguang Sun', 'Jingwei Liu', 'Junzhou He', 'Shuangyan Wu'],
      journal: 'Energy', volume: '349', issue: '', pages: '140608',
      doi: '10.1016/j.energy.2026.140608', url: 'https://doi.org/10.1016/j.energy.2026.140608',
    },
    {
      year: 2025,
      title: 'Exploration of a one-dimensional iron-based coordination polymer for enhanced lithium storage capabilities',
      authors: ['Jingwei Liu', 'Xiaolong Cheng', 'Shifa Dang', 'Weile Kong', 'Mengxian Zheng', 'Lei Zhang', 'Shuangyan Wu', 'Ning Liu', 'Jinchao Cao'],
      journal: 'CrystEngComm', volume: '27', issue: '5', pages: '687-694',
      doi: '10.1039/d4ce01082e', url: 'https://doi.org/10.1039/d4ce01082e',
    },
    {
      year: 2025,
      title: 'The construction of one-dimensional chain-like coordination polymers and their applications in anode materials for lithium-ion batteries',
      authors: ['Jingwei Liu', 'Shifa Dang', 'Xiaolong Cheng', 'Mengxian Zheng', 'Xinyi Chen', 'Weile Kong', 'Lei Zhang', 'Shuangyan Wu'],
      journal: 'CrystEngComm', volume: '27', issue: '37', pages: '6193-6201',
      doi: '10.1039/d5ce00657k', url: 'https://doi.org/10.1039/d5ce00657k',
    },
  ]);
  assert.equal(publications.length, 5);
  for (const publication of publications) {
    assert.match(publication.doi, /^10\.\d{4,9}\/\S+$/);
    assert.equal(publication.url, `https://doi.org/${publication.doi}`);
    assert.equal(Object.hasOwn(publication, 'pdf'), false);
    assert.ok(publication.authors.length >= 3);
  }
});

test('school records use the downloaded marks’ intrinsic dimensions', () => {
  assert.deepEqual(site.schools.map(({ logo, logoWidth, logoHeight }) => ({ logo, logoWidth, logoHeight })), [
    { logo: 'assets/ncepu-logo.png', logoWidth: 292, logoHeight: 70 },
    { logo: 'assets/syuct-logo.png', logoWidth: 332, logoHeight: 70 },
  ]);
});

test('all exported public data excludes phone-like and PDF-like data', () => {
  assertNoForbiddenPublicData({ site, memberGroups, publications });
});
