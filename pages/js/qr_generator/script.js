/** @type {any} */
const globalContext = window;


globalContext.generateQRCode = async function() {    const textElement = /** @type {HTMLInputElement | null} */ (document.getElementById("text"));
    const qrcodeContainer = /** @type {HTMLElement | null} */ (document.getElementById("qrcode"));

    if (!textElement || !qrcodeContainer) return;

    const text = textElement.value.trim();
    if (!text) {
        alert("テキストを入力してください。");
        return;
    }

    if (typeof globalContext.QRCode === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs/qrcode.min.js');
    }

    qrcodeContainer.style.display = "block";
    qrcodeContainer.innerHTML = "";

    try {
        new globalContext.QRCode(qrcodeContainer, {
            text: text,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: 0 // QRErrorCorrectLevel.M
        });
    } catch (err) {
        console.error("QRCode generation failed:", err);
    }
};

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Script load error: ${src}`));
        document.head.appendChild(script);
    });
}
