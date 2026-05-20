/**
 * converter.js — 옛한글 변환 핵심 로직
 *
 * 변환 순서:
 *  1) 사전 조회 → 정확한 역사적 형태 반환
 *  2) 아래아 규칙 → 특정 초성 + ㅏ → ㆍ
 *  3) 구개음화 역적용 → ㅈ+ㅕ/ㅛ → ㄷ+ㅕ/ㅛ 등
 *  4) 변환 없음
 */

/* ── Hangul Unicode 상수 ── */
const HANGUL_BASE  = 0xAC00;
const CHO_COUNT    = 19;
const JUNG_COUNT   = 21;
const JONG_COUNT   = 28;

/* 초성 jamo (U+1100–U+1112) */
const CHO_JAMO = [
  '\u1100','\u1101','\u1102','\u1103','\u1104',
  '\u1105','\u1106','\u1107','\u1108','\u1109',
  '\u110A','\u110B','\u110C','\u110D','\u110E',
  '\u110F','\u1110','\u1111','\u1112'
];

/* 종성 jamo — 인덱스 0은 받침 없음 */
const JONG_JAMO = [
  '',
  '\u11A8','\u11A9','\u11AA','\u11AB','\u11AC','\u11AD','\u11AE',
  '\u11AF','\u11B0','\u11B1','\u11B2','\u11B3','\u11B4','\u11B5','\u11B6',
  '\u11B7','\u11B8','\u11B9','\u11BA','\u11BB','\u11BC','\u11BD','\u11BE',
  '\u11BF','\u11C0','\u11C1','\u11C2'
];

/* 중성 jamo (U+1161–U+1175) */
const JUNG_JAMO = [
  '\u1161','\u1162','\u1163','\u1164','\u1165','\u1166','\u1167','\u1168',
  '\u1169','\u116A','\u116B','\u116C','\u116D','\u116E','\u116F','\u1170',
  '\u1171','\u1172','\u1173','\u1174','\u1175'
];

const ARAE_A = '\u119E';   /* ㆍ 아래아 */

/* ── 유틸리티 ── */

/** 현대 한글 음절인지 확인 */
function isHangulSyllable(ch) {
  const c = ch.charCodeAt(0);
  return c >= HANGUL_BASE && c <= HANGUL_BASE + 11171;
}

/** 현대 한글 음절 분해 */
function decompose(ch) {
  const c = ch.charCodeAt(0) - HANGUL_BASE;
  return {
    cho:  Math.floor(c / (JUNG_COUNT * JONG_COUNT)),
    jung: Math.floor((c % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT),
    jong: c % JONG_COUNT,
  };
}

/** 분해된 jamo로 현대 한글 음절 재조합 */
function compose(cho, jung, jong) {
  return String.fromCharCode(
    HANGUL_BASE + (cho * JUNG_COUNT + jung) * JONG_COUNT + jong
  );
}

/** 아래아 음절 문자열 생성 (초성 jamo + ㆍ + 선택 종성 jamo) */
function makeAraEaSyllable(cho, jong) {
  return CHO_JAMO[cho] + ARAE_A + (jong > 0 ? JONG_JAMO[jong] : '');
}

/* ── 변환 규칙 ── */

/**
 * 아래아 적용 초성 목록 (어두에서 ㅏ → ㆍ 가능성이 높은 것)
 * ㅎ(18), ㅅ(9), ㅂ(7), ㅁ(6), ㄱ(0), ㄴ(2), ㅈ(12), ㄷ(3)
 */
const ARAE_A_CHO = new Set([18, 9, 7, 6, 0, 2, 12, 3]);

/**
 * 구개음화 역적용 규칙 맵
 * { [현대 초성 인덱스]: [옛 초성 인덱스] }
 * ㅈ(12) → ㄷ(3),  ㅊ(14) → ㅌ(16)
 * 중성 조건: ㅕ(6), ㅛ(12)
 */
const GUPA_RULES = {
  12: { newCho: 3,  vowels: new Set([6, 12]) },  /* ㅈ → ㄷ */
  14: { newCho: 16, vowels: new Set([6, 12]) },  /* ㅊ → ㅌ */
};

/* ── 단어 단위 변환 ── */

/**
 * 한 단어(토큰)를 변환
 * @param {string} word
 * @returns {{ original, converted, rules, fromDict }}
 */
function convertWord(word) {
  /* 앞뒤 비한글 분리 */
  const match = word.match(/^([^\uAC00-\uD7A3]*)([가-힣]+)([^\uAC00-\uD7A3]*)$/);
  if (!match) {
    return { original: word, converted: word, rules: [], fromDict: false };
  }
  const [, pre, korean, post] = match;

  /* 1) 사전 조회 */
  if (DICT[korean]) {
    return {
      original:  word,
      converted: pre + DICT[korean].old + post,
      rules:     DICT[korean].rules,
      fromDict:  true,
    };
  }

  /* 2) 규칙 기반 변환 */
  let converted = '';
  const ruleSet = new Set();

  for (let i = 0; i < korean.length; i++) {
    const ch = korean[i];

    if (!isHangulSyllable(ch)) {
      converted += ch;
      continue;
    }

    const { cho, jung, jong } = decompose(ch);

    /* 규칙 A: 아래아 — 특정 초성 + ㅏ(0) */
    if (jung === 0 && ARAE_A_CHO.has(cho)) {
      converted += makeAraEaSyllable(cho, jong);
      ruleSet.add('아래아(ㆍ) 적용: 특정 초성 + ㅏ → ㆍ 로 변환');
      continue;
    }

    /* 규칙 B: 구개음화 역적용 */
    if (GUPA_RULES[cho] && GUPA_RULES[cho].vowels.has(jung)) {
      const { newCho } = GUPA_RULES[cho];
      converted += compose(newCho, jung, jong);
      ruleSet.add('구개음화 역적용: 현대 ㅈ/ㅊ → 옛 ㄷ/ㅌ');
      continue;
    }

    /* 변환 없음 */
    converted += ch;
  }

  if (ruleSet.size === 0) {
    ruleSet.add('변환 없음 (현대 한글과 동일)');
  }

  return {
    original:  word,
    converted: pre + converted + post,
    rules:     [...ruleSet],
    fromDict:  false,
  };
}

/* ── 전체 텍스트 변환 ── */

/**
 * 입력 텍스트 전체를 변환
 * @param {string} text
 * @returns {Array<{ original, converted, rules, fromDict, isSpace }>}
 */
function convertText(text) {
  /* 공백/줄바꿈 기준으로 분리, 구분자 유지 */
  const tokens = text.split(/(\s+)/);
  const results = [];

  for (const token of tokens) {
    if (!token) continue;

    if (/^\s+$/.test(token)) {
      results.push({ original: token, converted: token, rules: [], fromDict: false, isSpace: true });
    } else {
      results.push(convertWord(token));
    }
  }

  return results;
}

/**
 * 변환 결과 배열에서 최종 출력 문자열 추출
 * @param {Array} results
 * @returns {string}
 */
function getOutputText(results) {
  return results.map(r => r.converted).join('');
}

/**
 * 변환 설명용 HTML 생성
 * @param {Array} results
 * @returns {string}
 */
function buildExplanationHTML(results) {
  const items = results.filter(r => !r.isSpace);
  if (items.length === 0) return '<p style="color:var(--ink-faint)">변환된 단어가 없습니다.</p>';

  return items.map(item => {
    const sourceClass = item.fromDict ? 'source-dict' : (item.rules[0] === '변환 없음 (현대 한글과 동일)' ? 'source-none' : 'source-rule');
    const sourceLabel = item.fromDict ? '📚 사전 참조' : (item.rules[0] === '변환 없음 (현대 한글과 동일)' ? '— 변환 없음' : '⚙️ 규칙 적용');

    const ruleList = item.rules.map(r =>
      `<li>${r}</li>`
    ).join('');

    return `
      <div class="explain-item">
        <div class="explain-word">
          <span class="explain-original">${escapeHTML(item.original.trim())}</span>
          <span class="explain-arrow">→</span>
          <span class="explain-converted">${escapeHTML(item.converted.trim())}</span>
        </div>
        <span class="explain-source ${sourceClass}">${sourceLabel}</span>
        <ul class="explain-rules">${ruleList}</ul>
      </div>
    `;
  }).join('');
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
