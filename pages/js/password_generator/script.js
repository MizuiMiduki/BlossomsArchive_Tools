/** @type {any} */
const globalWin = window;

document.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    const copyBtn = target.closest('#copy');

    if (copyBtn) {
        const resultEl = /** @type {HTMLInputElement | null} */ (document.getElementById('result'));

        const btnTextNode = copyBtn.querySelector('span') || copyBtn;

        if (!resultEl || !resultEl.value || resultEl.value.startsWith('（')) return;

        navigator.clipboard.writeText(resultEl.value).then(() => {
            const originalText = btnTextNode.textContent;

            btnTextNode.textContent = 'コピー完了';
            copyBtn.classList.add('success');

            setTimeout(() => {
                btnTextNode.textContent = originalText;
                copyBtn.classList.remove('success');
            }, 1500);
        }).catch(err => {
            console.error('クリップボード操作に失敗しました:', err);
            alert('コピーに失敗しました。');
        });
    }

    if (target.id === 'generate') {
        const lengthEl = /** @type {HTMLInputElement | null} */ (document.getElementById('length'));
        const resultEl = /** @type {HTMLInputElement | null} */ (document.getElementById('result'));
        if (!lengthEl || !resultEl) return;

        const options = {
            lowercase: (/** @type {HTMLInputElement} */ (document.getElementById('use-lowercase')))?.checked ?? false,
            uppercase: (/** @type {HTMLInputElement} */ (document.getElementById('use-uppercase')))?.checked ?? false,
            numbers: (/** @type {HTMLInputElement} */ (document.getElementById('use-numbers')))?.checked ?? false,
            symbols: (/** @type {HTMLInputElement} */ (document.getElementById('use-symbols')))?.checked ?? false
        };

        const password = generatePassword(parseInt(lengthEl.value, 10), options);
        resultEl.value = password || '（文字種を1つ以上選んでください）';
    }
});

/**
 * パスワード生成ロジック
 * @param {number} length
 * @param {Object.<string, boolean>} options
 */
function generatePassword(length, options) {
    const sets = {
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+[]{}|;:,.<>?'
    };
    let charset = '';
    if (options.lowercase) charset += sets.lowercase;
    if (options.uppercase) charset += sets.uppercase;
    if (options.numbers) charset += sets.numbers;
    if (options.symbols) charset += sets.symbols;
    if (!charset || length <= 0) return '';

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(x => charset[x % charset.length]).join('');
}
