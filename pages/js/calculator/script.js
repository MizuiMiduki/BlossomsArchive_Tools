/** @type {string[]} */
let calcHistory = [];

/** @type {any} */
const globalWindow = window;

/**
 * ディスプレイに文字を追加
 * @param {string} value
 */
globalWindow.appendToDisplay = function (value) {
  const display = /** @type {HTMLInputElement | null} */ (document.getElementById('display'));
  if (display) {
    display.value += value;
  }
};

/**
 * ディスプレイをクリア
 */
globalWindow.clearDisplay = function () {
  const display = /** @type {HTMLInputElement | null} */ (document.getElementById('display'));
  if (display) {
    display.value = '';
  }
};

/**
 * 計算実行
 */
globalWindow.calculate = function () {
  const display = /** @type {HTMLInputElement | null} */ (document.getElementById('display'));
  if (!display) return;

  let expression = display.value.trim();
  if (!expression) return;

  const displayForHistory = expression;
  expression = expression.replace(/÷/g, '/').replace(/×/g, '*');

  try {
    if (/[^0-9+\-*/(). ]/.test(expression)) {
      throw new Error('無効な式');
    }

    const result = eval(expression);

    if (result === undefined || result === null || !isFinite(result)) {
      throw new Error('計算不能');
    }

    display.value = String(result);
    calcHistory.push(`${displayForHistory} = ${result}`);

    const historyList = document.getElementById('history');
    if (historyList) {
      historyList.innerHTML = '';
      calcHistory.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        historyList.appendChild(li);
      });
    }
  } catch (e) {
    display.value = 'エラー';
    console.error(e);
  }
};
