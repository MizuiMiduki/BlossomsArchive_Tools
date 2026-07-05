// src/pages/QrGenerator.tsx
import { createSignal } from "solid-js";
import QRCode from "qrcode";

export default function QrGenerator() {
    const [text, setText] = createSignal("");
    const [qrData, setQrData] = createSignal("");
    const [isLarge, setIsLarge] = createSignal(false);
    const [fileFormat, setFileFormat] = createSignal("png");

    const getMimeType = (format: string) => {
        switch (format) {
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            default:
                return "image/png";
        }
    };

    const generate = async () => {
        if (!text()) return;
        try {
            const data = await QRCode.toDataURL(text(), {
                width: 600,
                type: getMimeType(fileFormat()),
            });
            setQrData(data);
        } catch (err) {
            console.error(err);
        }
    };

    const getFormattedDateTime = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
    };

    const download = async () => {
        if (!qrData() || !text()) return;

        const safeInput = text()
            .replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龠_-]/g, "_")
            .substring(0, 20);
        const dateTimeStr = getFormattedDateTime();
        const fileName = `qrcode_${safeInput}_${dateTimeStr}.${fileFormat()}`;

        const link = document.createElement("a");
        link.download = fileName;

        if (fileFormat() === "svg") {
            try {
                const svgString = await QRCode.toString(text(), {
                    type: "svg",
                    width: 600,
                });
                const blob = new Blob([svgString], { type: "image/svg+xml" });
                link.href = URL.createObjectURL(blob);
            } catch (err) {
                console.error(err);
                return;
            }
        } else {
            try {
                const data = await QRCode.toDataURL(text(), {
                    width: 600,
                    type: getMimeType(fileFormat()),
                });
                link.href = data;
            } catch (err) {
                console.error(err);
                return;
            }
        }

        link.click();
    };

    return (
        <div class="h-full w-full p-6 flex flex-col items-center">
            <div class="card bg-base-100 shadow-xl p-8 w-full max-w-2xl border border-base-200">
                <input
                    type="text"
                    value={text()}
                    onInput={(e) => setText(e.currentTarget.value)}
                    class="input input-bordered w-full h-16 text-xl mb-6 bg-white border-2 border-slate-300 text-slate-900"
                    placeholder="URLやテキストを入力..."
                />

                <div class="flex gap-4 mb-6">
                    {/* ここを form-control w-40 flex-shrink-0 に修正しました。 */}
                    <div class="form-control w-40 flex-shrink-0">
                        <label class="label">
                            <span class="label-text font-bold">保存形式</span>
                        </label>
                        <select
                            value={fileFormat()}
                            onChange={(e) => {
                                setFileFormat(e.currentTarget.value);
                                if (qrData()) generate();
                            }}
                            class="select select-bordered h-14 text-lg bg-white border-2 border-slate-300 text-slate-900 w-full"
                        >
                            <option value="png">PNG (.png)</option>
                            <option value="jpeg">JPEG (.jpg)</option>
                            <option value="webp">WebP (.webp)</option>
                            <option value="svg">SVG (.svg)</option>
                        </select>
                    </div>

                    <div class="flex-1 flex items-end">
                        <button
                            onClick={generate}
                            class="btn btn-primary w-full text-white text-lg h-14"
                        >
                            生成する
                        </button>
                    </div>
                </div>

                {qrData() && (
                    <div class="mt-8 flex flex-col items-center gap-4 border-t border-base-200 pt-6">
                        <img
                            src={qrData()}
                            class="border-4 border-slate-300 rounded-lg w-64 h-64 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setIsLarge(true)}
                        />
                        <div class="flex gap-4 w-full max-w-xs">
                            <button
                                onClick={() => setIsLarge(true)}
                                class="btn btn-outline flex-1 border-2 border-slate-400 text-slate-800"
                            >
                                拡大表示
                            </button>
                            <button
                                onClick={download}
                                class="btn btn-success flex-1 text-white text-lg"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 拡大用モーダル */}
            {isLarge() && (
                <div
                    class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setIsLarge(false)}
                >
                    <img
                        src={qrData()}
                        class="max-w-full max-h-full bg-white p-4 rounded-xl shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}
