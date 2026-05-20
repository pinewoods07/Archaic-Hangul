/**
 * main.js — UI 이벤트 및 상태 관리
 */

/* ── DOM 요소 ── */
const inputEl        = document.getElementById('input-text');
const outputBox      = document.getElementById('output-box');
const charCountEl    = document.getElementById('char-count');
const convertBtn     = document.getElementById('convert-btn');
const clearBtn       = document.getElementById('clear-btn');
const copyBtn        = document.getElementById('copy-btn');
const explainBtn     = document.getElementById('explain-btn');
const explainPanel   = document.getElementById('explanation-panel');
const explainContent = document.getElementById('explanation-content');
const closeExplainBtn= document.getElementById('close-explain-btn');

/* ── 상태 ── */
let lastResults  = [];
let hasConverted = false;

/* ── 글자 수 카운트 ── */
inputEl.addEventListener('input', () => {
  charCountEl.textContent = inputEl.value.length;
});

/* ── 변환 실행 ── */
convertBtn.addEventListener('click', doConvert);
inputEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doConvert();
});

function doConvert() {
  const text = inputEl.value.trim();
  if (!text) {
    shake(convertBtn);
    return;
  }

  lastResults  = convertText(text);
  hasConverted = true;

  const output = getOutputText(lastResults);

  /* 출력 표시 + 잉크 애니메이션 */
  outputBox.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = output;
  span.classList.add('ink-appear');
  outputBox.appendChild(span);

  /* 버튼 활성화 */
  copyBtn.disabled    = false;
  explainBtn.disabled = false;

  /* 설명 패널 열려 있으면 갱신 */
  if (!explainPanel.classList.contains('hidden')) {
    renderExplanation();
  }

  /* 스크롤 */
  outputBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── 초기화 ── */
clearBtn.addEventListener('click', () => {
  inputEl.value     = '';
  charCountEl.textContent = '0';
  outputBox.innerHTML = '<span class="output-placeholder">변환 결과가 여기에 표시됩니다</span>';
  copyBtn.disabled    = true;
  explainBtn.disabled = true;
  hasConverted        = false;
  lastResults         = [];
  explainPanel.classList.add('hidden');
  inputEl.focus();
});

/* ── 복사 ── */
copyBtn.addEventListener('click', async () => {
  if (!hasConverted) return;
  const text = getOutputText(lastResults);
  try {
    await navigator.clipboard.writeText(text);
    const orig = copyBtn.textContent;
    copyBtn.textContent = '✅ 복사 완료!';
    setTimeout(() => { copyBtn.textContent = orig; }, 1800);
  } catch {
    /* 폴백: execCommand */
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copyBtn.textContent = '✅ 복사 완료!';
    setTimeout(() => { copyBtn.textContent = '📋 복사하기'; }, 1800);
  }
});

/* ── 변환 과정 패널 ── */
explainBtn.addEventListener('click', () => {
  if (!hasConverted) return;

  if (explainPanel.classList.contains('hidden')) {
    renderExplanation();
    explainPanel.classList.remove('hidden');
    explainBtn.textContent = '🔍 변환 과정 숨기기';
    explainPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    explainPanel.classList.add('hidden');
    explainBtn.textContent = '🔍 변환 과정 보기';
  }
});

closeExplainBtn.addEventListener('click', () => {
  explainPanel.classList.add('hidden');
  explainBtn.textContent = '🔍 변환 과정 보기';
});

function renderExplanation() {
  explainContent.innerHTML = buildExplanationHTML(lastResults);
}

/* ── 흔들기 애니메이션 (입력 없을 때) ── */
function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; /* reflow */
  el.style.animation = 'shakeX 0.35s ease';
  setTimeout(() => { el.style.animation = ''; }, 360);
}

/* shakeX keyframes를 동적으로 추가 */
(function injectShakeAnim() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shakeX {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-6px); }
      40%     { transform: translateX(6px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
})();
