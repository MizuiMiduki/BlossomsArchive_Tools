import { createSignal, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { animatePop, playPageEntrance } from "../utils/gsapAnimations";

export default function ImageConverter() {
    let containerRef: HTMLDivElement | undefined;
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [outputFormat, setOutputFormat] = createSignal("image/png");
    const [convertedUrl, setConvertedUrl] = createSignal("");
    const [isConverting, setIsConverting] = createSignal(false);

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
        return () => {
            if (convertedUrl()) {
                URL.revokeObjectURL(convertedUrl());
            }
        };
    });

    const selectImageFile = (file: File) => {
        setSelectedFile(file);
        if (convertedUrl()) {
            URL.revokeObjectURL(convertedUrl());
            setConvertedUrl("");
        }
    };

    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            selectImageFile(target.files[0]);
        }
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            selectImageFile(e.dataTransfer.files[0]);
        }
    };

    const convertImage = () => {
        const file = selectedFile();
        if (!file) return;

        setIsConverting(true);
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(tempUrl);
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
                            if (convertedUrl()) {
                                URL.revokeObjectURL(convertedUrl());
                            }
                            const url = URL.createObjectURL(blob);
                            setConvertedUrl(url);
                        }
                        setIsConverting(false);
                    },
                    outputFormat(),
                    0.9,
                );
            } else {
                setIsConverting(false);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            setIsConverting(false);
        };

        img.src = tempUrl;
    };

    const getExtensionLabel = () => {
        if (outputFormat() === "image/jpeg") return "JPEG";
        if (outputFormat() === "image/webp") return "WebP";
        return "PNG";
    };

    return (
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                {/* メインツールカード：2カラムレイアウト */}
                <div class="card bg-base-100 shadow-xl p-3 sm:p-6 md:p-10 w-full border border-base-300 min-w-0">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-base-300 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="画像形式変換ツール" />
                        </h1>
                        <BudouX
                            as="p"
                            class="text-xs font-semibold text-base-content/70 mt-2 leading-relaxed"
                            text="JPEG, PNG, WebP形式の画像を、お好みの拡張子に変換します。すべての画像リサイズ・変換処理は Canvas API（クライアントサイド）を介して実行され、アップロード通信なしで瞬時に処理されます。"
                        />
                    </div>

                    {/* グリッドレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：設定とファイルアップロード */}
                        <div class="lg:col-span-6 flex flex-col justify-between gap-6 bg-base-200/60 p-5 rounded-2xl border border-base-300">
                            <div class="flex flex-col gap-6">
                                {/* ファイル選択エリア */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            変換対象の画像ファイルを選択
                                        </span>
                                    </label>
                                    <label
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                        class="flex flex-col items-center justify-center gap-2 h-40 border-2 border-dashed border-base-300 rounded-xl bg-base-100 hover:bg-base-200 cursor-pointer px-4 transition-all group shadow-sm text-center"
                                    >
                                        <span class="text-3xl opacity-50 group-hover:opacity-80 transition-opacity">
                                            📁
                                        </span>
                                        <span class="text-base-content font-bold text-xs truncate max-w-full">
                                            {selectedFile()
                                                ? selectedFile()?.name
                                                : "ドラッグ＆ドロップ、またはファイルを選択"}
                                        </span>
                                        <span class="text-[9px] text-base-content/70 font-medium">
                                            ※任意の主要な画像形式（png, jpeg,
                                            webp, gif等）に対応しています
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            aria-label="画像ファイルを選択"
                                            onChange={handleFileChange}
                                            class="hidden"
                                        />
                                    </label>
                                </div>

                                {/* ターゲットフォーマット選択 */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            変換後の画像形式（フォーマット）
                                        </span>
                                    </label>
                                    <select
                                        value={outputFormat()}
                                        aria-label="変換後の画像形式（フォーマット）"
                                        onChange={(e) =>
                                            setOutputFormat(
                                                e.currentTarget.value,
                                            )
                                        }
                                        class="select select-bordered h-12 text-sm font-bold bg-base-100 border-2 border-base-300 text-base-content w-full"
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
                                    onClick={(e) => {
                                        animatePop(e.currentTarget, 0.95, 0.15);
                                        convertImage();
                                    }}
                                    disabled={!selectedFile() || isConverting()}
                                    class="btn btn-primary text-white w-full text-base h-14 font-black transition-all shadow-md disabled:bg-base-300 disabled:text-base-content/60"
                                >
                                    {isConverting()
                                        ? "エンコード処理中..."
                                        : "指定の形式に変換する"}
                                </button>
                            </div>
                        </div>

                        {/* 右側：変換結果プレビュー */}
                        <div class="lg:col-span-6 flex flex-col justify-center bg-base-200/60 rounded-2xl p-6 border border-base-300 min-h-[350px]">
                            <Show
                                when={convertedUrl()}
                                fallback={
                                    <div class="text-center p-8 space-y-2 text-base-content/60">
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
                                    <div class="flex justify-between items-center pb-2 border-b border-base-300">
                                        <span class="font-bold text-xs text-base-content/80 tracking-wider">
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

                                    <div class="bg-base-100 border border-base-300 rounded-xl p-3 flex justify-center items-center max-h-[300px] overflow-hidden shadow-inner">
                                        <img
                                            src={convertedUrl()}
                                            alt="Converted Preview"
                                            class="max-w-full max-h-[270px] object-contain rounded-lg bg-base-200"
                                        />
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>
                <AdSense />

                {/* 💡 技術仕様 ＆ 学術的なQ&Aセクション */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* 技術仕様仕様 */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm justify-between">
                        <div>
                            <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                                画像変換エンジンの仕様・実行スキーム
                            </h2>
                            <div class="space-y-4 text-xs text-base-content/80 leading-relaxed font-medium">
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
                        <div class="mt-6 pt-4 border-t border-base-200 text-xs text-base-content/60">
                            ※セキュリティおよび個人情報の取扱いについては、当サイトの
                            <a
                                href="/privacy"
                                class="text-base-content font-bold underline ml-1 hover:text-primary"
                            >
                                プライバシーポリシー
                            </a>
                            に準拠しています。
                        </div>
                    </div>

                    {/* 技術Q&Aセクション */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm">
                        <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                            画像フォーマットに関する技術情報（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="WebP形式へ変換するメリットについての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q. WebP形式へ変換するメリットは何ですか？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    Googleがウェブ向けに開発した「WebP（ウェッピー）」は、従来のJPEGやPNGと比較して、
                                    <strong>
                                        同等画質を維持しながら最大30%程度ファイルサイズを軽量化
                                    </strong>
                                    できるのが最大の特徴です。サイト表示速度の向上や転送量削減に大きく貢献します。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="PNG画像をJPEGへ変換した際の透過箇所についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    PNG画像をJPEGへ変換した際の透過箇所の挙動は？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    JPEG規格はアルファチャンネル（透明・透過情報）に対応していません。そのため、本ツールではCanvas上で描画する際、透過レイヤーの下地に白色（#ffffff）の背景を自動で塗り潰し補完した上でJPEGへ出力する仕様を施しています。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="変換元のファイルの最大解像度についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    変換元のファイルの最大解像度やサイズ制限はありますか？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    システム的なサイズ制限は設定していませんが、画像デコードとCanvas書き出しの負荷の上限値は、ご利用環境のハードウェア・ブラウザの空きメモリ容量に依存します。スマートフォンやタブレットでの巨大画像（数十メガピクセル等）の処理時は一時的に応答が遅延する可能性があります。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <AdSense />
            <AdSense />
        </div>
    );
}
