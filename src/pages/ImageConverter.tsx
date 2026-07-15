import { createSignal, Show } from "solid-js";

export default function ImageConverter() {
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [outputFormat, setOutputFormat] = createSignal("image/png");
    const [convertedUrl, setConvertedUrl] = createSignal("");
    const [isConverting, setIsConverting] = createSignal(false);

    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            setSelectedFile(target.files[0]);
            if (convertedUrl()) {
                URL.revokeObjectURL(convertedUrl());
                setConvertedUrl("");
            }
        }
    };

    const convertImage = () => {
        const file = selectedFile();
        if (!file) return;

        setIsConverting(true);
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                    if (outputFormat() === "image/jpeg") {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                setConvertedUrl(url);
                            }
                            setIsConverting(false);
                        },
                        outputFormat(),
                        0.9,
                    );
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const getExtensionLabel = () => {
        if (outputFormat() === "image/jpeg") return "JPEG";
        if (outputFormat() === "image/webp") return "WebP";
        return "PNG";
    };

    return (
        <div class="h-full w-full p-4 flex flex-col gap-4 bg-base-300/40">
            <div class="card bg-base-100 shadow-2xl p-6 w-full border border-base-300">
                <div class="mb-6 border-b-2 border-base-300 pb-4">
                    <h2 class="text-2xl font-black text-primary flex items-center gap-2">
                        🖼️ 画像形式変換ツール
                    </h2>
                    <p class="text-xs text-base-content font-bold mt-1 leading-relaxed opacity-80">
                        PNG、JPEG、WebPなどの画像をブラウザ内だけで素早く、安全に別のフォーマットへ変換します。
                    </p>
                </div>

                <div class="flex flex-col lg:flex-row gap-6 items-stretch">
                    <div class="flex-1 flex flex-col gap-5 bg-base-200/70 p-5 rounded-2xl border border-base-300">
                        <div class="form-control w-full">
                            <label class="label py-1">
                                <span class="label-text font-black text-sm text-base-content">
                                    📁 画像ファイルを選択
                                </span>
                            </label>
                            <label class="flex items-center justify-center gap-3 h-16 border-2 border-dashed border-base-400 rounded-xl bg-base-100 hover:bg-base-200/80 cursor-pointer px-4 transition-all group shadow-inner">
                                <span class="text-base-content font-bold text-sm truncate group-hover:text-primary">
                                    {selectedFile()
                                        ? selectedFile()?.name
                                        : "ここをクリックして写真を選択"}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    class="hidden"
                                />
                            </label>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-4 items-end">
                            <div class="form-control flex-1 w-full">
                                <label class="label py-1">
                                    <span class="label-text font-black text-sm text-base-content">
                                        🔆 変換後のフォーマット
                                    </span>
                                </label>
                                <select
                                    value={outputFormat()}
                                    onChange={(e) =>
                                        setOutputFormat(e.currentTarget.value)
                                    }
                                    class="select select-bordered select-sm h-12 text-sm font-bold bg-base-100 border-base-400 focus:border-primary text-base-content w-full"
                                >
                                    <option value="image/png">PNG</option>
                                    <option value="image/jpeg">JPEG</option>
                                    <option value="image/webp">WebP</option>
                                </select>
                            </div>

                            <button
                                onClick={convertImage}
                                disabled={!selectedFile() || isConverting()}
                                class="btn btn-primary w-full sm:w-40 text-white text-sm font-black h-12 min-h-0 disabled:bg-base-300 disabled:text-base-content/30 shadow-md"
                            >
                                {isConverting()
                                    ? "変換中..."
                                    : "形式を変換する"}
                            </button>
                        </div>
                    </div>

                    <Show when={convertedUrl()}>
                        <div class="flex-1 flex flex-col gap-4 bg-base-200 p-5 rounded-2xl border-2 border-base-300 shadow-inner animate-fade-in">
                            <div class="flex justify-between items-center border-b border-base-300 pb-2">
                                <span class="text-xs font-black text-base-content/80 tracking-wider uppercase">
                                    📊 変換完了（{getExtensionLabel()}）
                                </span>
                                <a
                                    href={convertedUrl()}
                                    download={`converted.${outputFormat().split("/")[1]}`}
                                    class="btn btn-success text-white font-bold text-xs h-9 min-h-0 px-4 rounded-xl shadow-md"
                                >
                                    💾 ダウンロード
                                </a>
                            </div>

                            <div class="bg-base-300/80 border border-base-400 rounded-xl p-3 flex justify-center items-center max-h-[350px] overflow-hidden">
                                <img
                                    src={convertedUrl()}
                                    alt="Converted Preview"
                                    class="max-w-full max-h-[320px] object-contain rounded-lg shadow-md bg-base-100"
                                />
                            </div>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
}
