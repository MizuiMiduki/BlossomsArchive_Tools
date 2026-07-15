import { createSignal, onMount, onCleanup, Show } from "solid-js";

export default function ImageConverter() {
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [outputFormat, setOutputFormat] = createSignal("image/png");
    const [convertedUrl, setConvertedUrl] = createSignal("");
    const [isConverting, setIsConverting] = createSignal(false);

    // SEO対策：メタデータおよび構造化データの動的注入
    onMount(() => {
        document.title =
            "画像形式変換ツール | WebP・PNG・JPEGの相互変換（ブラウザ完結）";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "ブラウザ上で動作する登録不要の画像拡張子変換ツール。PNG、JPEG、WebP、GIFなどの画像ファイルを、Canvas APIを応用して指定のフォーマットへ相互変換します。クラウドへファイルをアップロードせずローカルで処理を行うため、機密画像やプライベートな写真も安心して処理できます。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "image-converter-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "画像形式変換・拡張子変換ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5 Canvas.",
            description:
                "PNG, JPEG, WebP 形式に相互対応した、クライアントサイド完結型の画像ファイル拡張子変換ツール。",
        });
        document.head.appendChild(script);
    });

    onCleanup(() => {
        const script = document.getElementById("image-converter-jsonld");
        if (script) {
            script.remove();
        }
    });

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
        <div class="h-full w-full p-4 md:p-8 flex flex-col items-center bg-base-300/30 overflow-x-hidden">
            <div class="w-full max-w-7xl flex flex-col gap-8">
                {/* メインツールカード：2カラムレイアウト */}
                <div class="card bg-base-100 shadow-xl p-6 md:p-10 w-full border border-slate-200">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-slate-200 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-slate-800">
                            画像形式変換ツール
                        </h1>
                        <p class="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
                            JPEG, PNG,
                            WebP形式の画像を、お好みの拡張子に変換します。
                            すべての画像リサイズ・変換処理は
                            <strong>Canvas API（クライアントサイド）</strong>
                            を介して実行され、アップロード通信なしで瞬時に処理されます。
                        </p>
                    </div>

                    {/* グリッドレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：設定とファイルアップロード */}
                        <div class="lg:col-span-6 flex flex-col justify-between gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <div class="flex flex-col gap-6">
                                {/* ファイル選択エリア */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-slate-700">
                                            変換対象の画像ファイルを選択
                                        </span>
                                    </label>
                                    <label class="flex flex-col items-center justify-center gap-2 h-40 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-100 cursor-pointer px-4 transition-all group shadow-sm text-center">
                                        <span class="text-3xl opacity-50 group-hover:opacity-80 transition-opacity">
                                            📁
                                        </span>
                                        <span class="text-slate-700 font-bold text-xs truncate max-w-full">
                                            {selectedFile()
                                                ? selectedFile()?.name
                                                : "ドラッグ＆ドロップ、またはファイルを選択"}
                                        </span>
                                        <span class="text-[9px] text-slate-400 font-medium">
                                            ※任意の主要な画像形式（png, jpeg,
                                            webp, gif等）に対応しています
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            class="hidden"
                                        />
                                    </label>
                                </div>

                                {/* ターゲットフォーマット選択 */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-slate-700">
                                            変換後の画像形式（フォーマット）
                                        </span>
                                    </label>
                                    <select
                                        value={outputFormat()}
                                        onChange={(e) =>
                                            setOutputFormat(
                                                e.currentTarget.value,
                                            )
                                        }
                                        class="select select-bordered h-12 text-sm font-bold bg-white border-2 border-slate-300 text-slate-900 w-full focus:border-slate-500"
                                    >
                                        <option value="image/png">
                                            PNG形式 (.png) - 透過保持・高品質
                                        </option>
                                        <option value="image/jpeg">
                                            JPEG形式 (.jpg) - 高い圧縮率・汎用
                                        </option>
                                        <option value="image/webp">
                                            WebP形式 (.webp) - 次世代・軽量表示
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {/* 変換アクションボタン */}
                            <div class="mt-4">
                                <button
                                    onClick={convertImage}
                                    disabled={!selectedFile() || isConverting()}
                                    class="btn bg-slate-800 hover:bg-slate-900 border-none text-white w-full text-base h-14 font-black transition-all shadow-md disabled:bg-slate-200 disabled:text-slate-400"
                                >
                                    {isConverting()
                                        ? "エンコード処理中..."
                                        : "指定の形式に変換する"}
                                </button>
                            </div>
                        </div>

                        {/* 右側：変換結果プレビュー */}
                        <div class="lg:col-span-6 flex flex-col justify-center bg-slate-50 rounded-2xl p-6 border border-slate-200 min-h-[350px]">
                            <Show
                                when={convertedUrl()}
                                fallback={
                                    <div class="text-center p-8 space-y-2 text-slate-400">
                                        <span class="text-5xl block mb-2">
                                            🖼️
                                        </span>
                                        <p class="text-xs font-semibold leading-relaxed">
                                            画像をアップロードし、変換ボタンを押すと
                                            <br />
                                            ここに変換後の画像プレビューと保存リンクが表示されます。
                                        </p>
                                    </div>
                                }
                            >
                                <div class="flex flex-col h-full gap-4">
                                    <div class="flex justify-between items-center pb-2 border-b border-slate-200">
                                        <span class="font-bold text-xs text-slate-600 tracking-wider">
                                            変換完了（フォーマット:{" "}
                                            {getExtensionLabel()}）
                                        </span>
                                        <a
                                            href={convertedUrl()}
                                            download={`converted.${outputFormat().split("/")[1]}`}
                                            class="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 min-h-0 px-4 border-none rounded-xl shadow-sm"
                                        >
                                            画像をダウンロード
                                        </a>
                                    </div>

                                    <div class="bg-white border border-slate-200 rounded-xl p-3 flex justify-center items-center max-h-[300px] overflow-hidden shadow-inner">
                                        <img
                                            src={convertedUrl()}
                                            alt="Converted Preview"
                                            class="max-w-full max-h-[270px] object-contain rounded-lg bg-slate-100"
                                        />
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* 💡 技術仕様 ＆ 学術的なQ&Aセクション */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* 技術仕様仕様 */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-slate-200 shadow-sm justify-between">
                        <div>
                            <h2 class="text-base font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5">
                                画像変換エンジンの仕様・実行スキーム
                            </h2>
                            <div class="space-y-4 text-xs text-slate-600 leading-relaxed font-medium">
                                <p>
                                    本ツールは、HTML5の主要構成要素である{" "}
                                    <strong>Canvas Rendering Context 2D</strong>{" "}
                                    と、ブラウザネイティブの画像デコーダーを用いて処理を行います。
                                </p>
                                <p>
                                    インポートした画像ファイル（バイナリ）は、端末内部で一度メモリ上にピクセルマップとして展開され、ご希望の出力形式に基づき再サンプリング（エンコード）されます。
                                </p>
                                <p>
                                    一般的な画像処理クラウドサービスのように外部サーバーにデータを転送するAPI通信を一切伴わないため、物理的かつ構造的に画像データが流出する恐れはありません。
                                </p>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                            ※セキュリティおよび個人情報の取扱いについては、当サイトの
                            <a
                                href="/privacy-policy"
                                class="text-slate-800 font-bold underline ml-1 hover:text-slate-950"
                            >
                                プライバシーポリシー
                            </a>
                            に準拠しています。
                        </div>
                    </div>

                    {/* 技術Q&Aセクション */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-slate-200 shadow-sm">
                        <h2 class="text-base font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5">
                            画像フォーマットに関する技術情報（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q. WebP形式へ変換するメリットは何ですか？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    Googleがウェブ向けに開発した「WebP（ウェッピー）」は、従来のJPEGやPNGと比較して、
                                    <strong>
                                        同等画質を維持しながら最大30%程度ファイルサイズを軽量化
                                    </strong>
                                    できるのが最大の特徴です。サイト表示速度の向上や転送量削減に大きく貢献します。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q.
                                    PNG画像をJPEGへ変換した際の透過箇所の挙動は？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    JPEG規格はアルファチャンネル（透明・透過情報）に対応していません。そのため、本ツールではCanvas上で描画する際、透過レイヤーの下地に白色（#ffffff）の背景を自動で塗り潰し補完した上でJPEGへ出力する仕様を施しています。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q.
                                    変換元のファイルの最大解像度やサイズ制限はありますか？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    システム的なサイズ制限は設定していませんが、画像デコードとCanvas書き出しの負荷の上限値は、ご利用環境のハードウェア・ブラウザの空きメモリ容量に依存します。スマートフォンやタブレットでの巨大画像（数十メガピクセル等）の処理時は一時的に応答が遅延する可能性があります。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
