// src/pages/ImageConverter.tsx
import { createSignal, Show } from "solid-js";

export default function ImageConverter() {
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [outputFormat, setOutputFormat] = createSignal("image/png");
    const [convertedUrl, setConvertedUrl] = createSignal("");
    const [isConverting, setIsConverting] = createSignal(false);

    // ファイルが選択された時の処理
    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            setSelectedFile(target.files[0]);
            // 新しいファイルが来たら前の変換結果はクリアします
            if (convertedUrl()) {
                URL.revokeObjectURL(convertedUrl());
                setConvertedUrl("");
            }
        }
    };

    // 画像変換のコアロジック
    const convertImage = () => {
        const file = selectedFile();
        if (!file) return;

        setIsConverting(true);
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Canvasを使って画像を描画・変換します
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                    // JPEGなどの場合は背景を白にする処理を入れておくと透過が黒くならなくて綺麗です
                    if (outputFormat() === "image/jpeg") {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.drawImage(img, 0, 0);

                    // 指定したMIMEタイプでBlob化します
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            setConvertedUrl(url);
                        }
                        setIsConverting(false);
                    }, outputFormat(), 0.9); // 品質は高めの90%にしておきます
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    // 拡張子の文字列を取り出すユーティリティ
    const getExtensionLabel = () => {
        if (outputFormat() === "image/jpeg") return "JPEG";
        if (outputFormat() === "image/webp") return "WebP";
        return "PNG";
    };

    return (
        <div class="h-full w-full p-6 flex flex-col">
            <div class="card bg-base-100 shadow-xl p-8 w-full border border-base-200">

                {/* コントロールエリア */}
                <div class="flex flex-wrap gap-4 items-end mb-8">
                    {/* ①ファイル選択ボタン */}
                    <div class="form-control flex-1 min-w-[200px]">
                        <label class="label"><span class="label-text font-bold text-slate-800">画像ファイルを選択</span></label>
                        <label class="flex items-center justify-center gap-2 h-14 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 cursor-pointer px-4 transition-all">
                            <span class="text-slate-600 font-medium truncate">
                                {selectedFile() ? selectedFile()?.name : "ファイルを選択してください"}
                            </span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                class="hidden"
                            />
                        </label>
                    </div>

                    {/* ②変換後のフォーマット指定 */}
                    <div class="form-control w-40 flex-shrink-0">
                        <label class="label"><span class="label-text font-bold text-slate-800">変換フォーマット</span></label>
                        <select
                            value={outputFormat()}
                            onChange={(e) => setOutputFormat(e.currentTarget.value)}
                            class="select select-bordered h-14 text-lg bg-white border-2 border-slate-300 text-slate-900 w-full"
                        >
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPEG</option>
                            <option value="image/webp">WebP</option>
                        </select>
                    </div>

                    {/* ③変換実行ボタン */}
                    <div class="w-32 flex-shrink-0">
                        <button
                            onClick={convertImage}
                            disabled={!selectedFile() || isConverting()}
                            class="btn btn-primary w-full text-white text-lg h-14 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {isConverting() ? "変換中..." : "変換"}
                        </button>
                    </div>
                </div>

                {/* ④変換結果のプレビュー＆ダウンロード */}
                <Show when={convertedUrl()}>
                    <div class="border-t border-base-200 pt-6 w-full animate-fade-in">
                        <div class="flex justify-between items-center mb-4">
                            <span class="font-bold text-slate-800">変換結果（{getExtensionLabel()}）</span>
                            <a
                                href={convertedUrl()}
                                download={`converted.${outputFormat().split("/")[1]}`}
                                class="btn btn-success text-white text-base h-10 min-h-0 px-6"
                            >
                                ダウンロード
                            </a>
                        </div>

                        {/* プレビュー画像表示エリア */}
                        <div class="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex justify-center max-h-[500px] overflow-hidden">
                            <img
                                src={convertedUrl()}
                                alt="Converted Preview"
                                class="max-w-full max-h-[460px] object-contain rounded-lg shadow-sm bg-white"
                            />
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
