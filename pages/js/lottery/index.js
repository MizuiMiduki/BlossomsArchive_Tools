/** @type {{ title: string, text: string, url: string } | null} */
let shareOpts = null;

$(function () {
    const params = new URLSearchParams(window.location.search);
    const parameter_text = params.get('text');
    const parameter_ret = params.get('result');

    if (parameter_text) {
        $('.tyuusen-input').val(decodeURIComponent(parameter_text));
    }
    if (parameter_ret) {
        const decodedRet = decodeURIComponent(parameter_ret);
        $('#str').text(decodedRet);
        const currentVal = $('.tyuusen-input').val();

        updateShareOpts(decodedRet, String(currentVal || ''));
    }
});

$(document).on("click", "#start_lottery", function () {
    const val = $('.tyuusen-input').val();
    const text = String(val || '').trim();

    if (!text) {
        alert("抽選対象を入力してください。");
        return;
    }

    const arr = text.split(/\r\n|\n|\r/).filter(item => item.trim() !== "");

    if (arr.length > 0) {
        const ret = arr[Math.floor(Math.random() * arr.length)];
        $('#str').text(ret);
        updateShareOpts(ret, text);
    }
});

/**
 * 共有オプションを更新する関数
 * @param {string} result
 * @param {string} fullText
 */
function updateShareOpts(result, fullText) {
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = baseUrl + '?text=' + encodeURIComponent(fullText) + '&result=' + encodeURIComponent(result);

    shareOpts = {
        title: '抽選あぷり - 抽選結果',
        text: '当たったのは『' + result + '』でした',
        url: shareUrl,
    };
}

$(document).on("click", "#reset_text", function () {
    $('.tyuusen-input').val("");
    $('#str').text("");
    shareOpts = null;
    window.history.replaceState({}, document.title, window.location.pathname);
});

$(document).on("click", "#share", async function () {
    if (!shareOpts) {
        alert("先に抽選を行ってください。");
        return;
    }

    try {
        if (navigator.share) {
            await navigator.share(shareOpts);
        } else {
            alert("共有機能がサポートされていないブラウザです。URLをコピーしてください。");
        }
    } catch (err) {
        console.error("Share failed:", err);
    }
});
