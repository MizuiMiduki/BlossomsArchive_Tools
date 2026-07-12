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
        <div class="h-full w-full p-6 flex flex-col">
            <div class="card bg-base-100 shadow-xl p-8 w-full border border-base-300">
                <div class="flex flex-wrap gap-4 items-end mb-8">
                    <div class="form-control flex-1 min-w-[200px]">
                        <label class="label">
                            <span class="label-text font-bold text-base-content">
                                画像ファイルを選択
                            </span>
                        </label>
                        <label class="flex items-center justify-center gap-2 h-14 border-2 border-dashed border-base-300 rounded-xl bg-base-100 hover:bg-base-200 cursor-pointer px-4 transition-all">
                            <span class="text-base-content/70 font-medium truncate">
                                {selectedFile()
                                    ? selectedFile()?.name
                                    : "ファイルを選択してください"}
                            </span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                class="hidden"
                            />
                        </label>
                    </div>

                    <div class="form-control w-40 flex-shrink-0">
                        <label class="label">
                            <span class="label-text font-bold text-base-content">
                                変換フォーマット
                            </span>
                        </label>
                        <select
                            value={outputFormat()}
                            onChange={(e) =>
                                setOutputFormat(e.currentTarget.value)
                            }
                            class="select select-bordered h-14 text-lg bg-base-100 border-base-300 text-base-content w-full"
                        >
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPEG</option>
                            <option value="image/webp">WebP</option>
                        </select>
                    </div>

                    <div class="w-32 flex-shrink-0">
                        <button
                            onClick={convertImage}
                            disabled={!selectedFile() || isConverting()}
                            class="btn btn-primary w-full text-white text-lg h-14 disabled:bg-base-300 disabled:text-base-content/30"
                        >
                            {isConverting() ? "変換中..." : "変換"}
                        </button>
                    </div>
                </div>

                <Show when={convertedUrl()}>
                    <div class="border-t border-base-300 pt-6 w-full animate-fade-in">
                        <div class="flex justify-between items-center mb-4">
                            <span class="font-bold text-base-content">
                                変換結果（{getExtensionLabel()}）
                            </span>
                            <a
                                href={convertedUrl()}
                                download={`converted.${outputFormat().split("/")[1]}`}
                                class="btn btn-success text-white text-base h-10 min-h-0 px-6"
                            >
                                ダウンロード
                            </a>
                        </div>

                        <div class="bg-base-200 border border-base-300 rounded-2xl p-4 flex justify-center max-h-[500px] overflow-hidden">
                            <img
                                src={convertedUrl()}
                                alt="Converted Preview"
                                class="max-w-full max-h-[460px] object-contain rounded-lg shadow-sm bg-base-100"
                            />
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
