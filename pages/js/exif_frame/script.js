/** @type {any} */
const globalApp = window;

const state = {
    /** @type {HTMLImageElement | null} */
    originalImage: null,
    /** @type {any} */
    exifData: null
};

async function loadExifLib() {
    if (typeof globalApp.EXIF !== 'undefined') return true;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/exif-js@2.3.0/exif.min.js";
        script.onload = () => {
            console.log("EXIF library loaded successfully.");
            resolve(true);
        };
        script.onerror = () => {
            console.error("Failed to load EXIF library.");
            reject(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * @param {number} value
 */
function formatShutterSpeed(value) {
    if (!value) return "";
    if (value >= 1) return `${value.toFixed(1)}s`;
    const denominator = Math.round(1 / value);
    return `1/${denominator}s`;
}

function drawImageWithExif() {
    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("canvas"));
    const img = state.originalImage;
    const exif = state.exifData || {};

    if (!img || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const frameColor = (/** @type {HTMLInputElement} */(document.querySelector('input[name="frameColor"]:checked')))?.value || "black";
    const framePosition = (/** @type {HTMLInputElement} */(document.querySelector('input[name="framePosition"]:checked')))?.value || "bottom";
    const textAlign = (/** @type {HTMLInputElement} */(document.querySelector('input[name="textAlign"]:checked')))?.value || "left";

    const isVertical = (framePosition === "left" || framePosition === "right");
    const scale = img.height / 1080;
    const padding = Math.round(60 * scale) * 2;

    canvas.width = isVertical ? img.width + padding : img.width;
    canvas.height = isVertical ? img.height : img.height + padding;

    context.fillStyle = frameColor === "white" ? "#fff" : "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    let drawX = (framePosition === "left") ? padding : 0;
    let drawY = (framePosition === "top") ? padding : 0;
    let bandX = (framePosition === "right") ? img.width : 0;
    if (framePosition === "left") bandX = 0;

    context.drawImage(img, drawX, drawY);

    context.fillStyle = frameColor === "white" ? "#000" : "#fff";
    const make = exif.Make || "Unknown Camera";
    const model = exif.Model || "";
    const info = [
        exif.FNumber ? `f/${exif.FNumber}` : "",
        exif.ExposureTime ? `${formatShutterSpeed(exif.ExposureTime)}` : "",
        exif.FocalLength ? `${exif.FocalLength}mm` : "",
        exif.ISOSpeedRatings ? `ISO ${exif.ISOSpeedRatings}` : ""
    ].filter(Boolean).join(" | ");

    const fontSizeBig = Math.round(36 * scale);
    const fontSizeSmall = Math.round(24 * scale);
    const lineSpacing = 16;

    if (isVertical) {
        context.save();
        context.translate(bandX + padding / 2, canvas.height / 2);
        context.rotate(framePosition === "left" ? Math.PI / 2 : -Math.PI / 2);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `${fontSizeBig}px sans-serif`;
        context.fillText(`${make} ${model}`, 0, -(fontSizeSmall + lineSpacing) / 2);
        context.font = `${fontSizeSmall}px sans-serif`;
        context.fillText(info, 0, (fontSizeBig + lineSpacing) / 2);
        context.restore();
    } else {
        context.textAlign = /** @type {CanvasTextAlign} */ (textAlign);

        const totalTextHeight = fontSizeBig + lineSpacing + fontSizeSmall;

        let tx = textAlign === "left" ? 40 : textAlign === "center" ? canvas.width / 2 : canvas.width - 40;

        let ty;
        if (framePosition === "top") {
            ty = (padding / 2) - (totalTextHeight / 2) + fontSizeBig;
        } else {
            ty = img.height + (padding / 2) - (totalTextHeight / 2) + fontSizeBig;
        }

        context.font = `${fontSizeBig}px sans-serif`;
        context.textBaseline = "alphabetic"; // 標準のベースライン
        context.fillText(`${make} ${model}`, tx, ty);

        context.font = `${fontSizeSmall}px sans-serif`;
        context.fillText(info, tx, ty + lineSpacing + fontSizeSmall);
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) downloadBtn.style.display = "flex";
}

document.addEventListener("change", async (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);

    if (target.id === "fileInput" && target.files?.[0]) {
        await loadExifLib();

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                state.originalImage = img;
                if (globalApp.EXIF) {
                    globalApp.EXIF.getData(img, () => {
                        state.exifData = globalApp.EXIF.getAllTags(img);
                        drawImageWithExif();
                    });
                } else {
                    state.exifData = {};
                    drawImageWithExif();
                }
            };
            img.src = String(event.target?.result || "");
        };
        reader.readAsDataURL(target.files[0]);
    }

    if (["frameColor", "framePosition", "textAlign", "formatSelect"].includes(target.name)) {
        if (state.originalImage) drawImageWithExif();
    }
});

document.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const downloadBtn = target.closest('#downloadBtn');

    if (downloadBtn) {
        const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("canvas"));
        if (canvas) {
            const format = (/** @type {HTMLInputElement} */(document.querySelector('input[name="formatSelect"]:checked')))?.value || "image/jpeg";
            const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
            const a = document.createElement("a");
            a.href = canvas.toDataURL(format, 0.95);
            a.download = `photo_framed.${ext}`;
            a.click();
        }
    }
});
