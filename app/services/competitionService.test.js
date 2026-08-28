const test = require('node:test');
const assert = require('node:assert');

const { parseRecordArgs } = require('./competitionService');

// 닉네임과 대회명 둘 다 공백을 가질 수 있어 `/` 하나로 가른다.
test('`/` 앞은 닉네임, 뒤는 대회명', () => {
  assert.deepEqual(parseRecordArgs(['hide', 'on', 'bush#KR1', '/', '멸망전', '1회']), {
    nickArgs: ['hide', 'on', 'bush#KR1'],
    competitionName: '멸망전 1회',
  });
});

test('`/` 앞뒤에 공백이 없어도 가른다 — `링뽀/테스트2`', () => {
  assert.deepEqual(parseRecordArgs(['링뽀/테스트2']), {
    nickArgs: ['링뽀'],
    competitionName: '테스트2',
  });
  assert.deepEqual(parseRecordArgs(['hide', 'on', 'bush/멸망전', '1회']), {
    nickArgs: ['hide', 'on', 'bush'],
    competitionName: '멸망전 1회',
  });
});

test('`/`가 없으면 전부 닉네임이고 대회명은 비어 있다 (OPEN → 최근 대회)', () => {
  assert.deepEqual(parseRecordArgs(['hide', 'on', 'bush']), {
    nickArgs: ['hide', 'on', 'bush'],
    competitionName: '',
  });
});

test('인자가 없으면 닉네임도 비어 있다 (호출자 별명 사용)', () => {
  assert.deepEqual(parseRecordArgs([]), { nickArgs: [], competitionName: '' });
});

test('대회명의 연속 공백은 하나로 줄인다', () => {
  assert.equal(parseRecordArgs(['a', '/', '멸망전', '', '1회']).competitionName, '멸망전 1회');
});
