import { createSignal, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { animatePop, playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";

export default function ImageConverter() {
    const { title, description } = usePageI18n("/image_conversion", {
        defaultTitle: "画像形式変換ツール",
        defaultDescription:
            "JPEG, PNG, WebP形式の画像を、お好みの拡張子に変換します。すべての画像リサイズ・変換処理は Canvas API（クライアントサイド）を介して実行され、アップロード通信なしで瞬時に処理されます。",
    });
    let containerRef: HTMLDivElement | undefined;
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [outputFormat, setOutputFormat] = createSignal("image/png");
    const [convertedUrl, setConvertedUrl] = createSignal("");
    const [isConverting, setIsConverting] = createSignal(false);

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
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
        <div ref={containerRef} class="ba-page ba-page--wide">
            <div class="ba-stack-6 ba-w-full ba-min-w-0">
                {/* メインツールカード：2カラムレイアウト */}
                <div class="ba-card ba-stack-6 ba-w-full">
                    {/* ヘッダーセクション */}
                    <div style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "1.25rem" }}>
                        <h1 class="ba-title">
                            <BudouX text={title()} />
                        </h1>
                        <BudouX
                            as="p"
                            class="ba-text-xs ba-text-muted ba-font-bold"
                            style={{ "margin-top": "0.5rem", "margin-bottom": 0, "line-height": 1.65 }}
                            text={description()}
                        />
                    </div>

                    {/* グリッドレイアウト */}
                    <div class="ba-grid-2" style={{ gap: "1.5rem", "align-items": "stretch" }}>
                        {/* 左側：設定とファイルアップロード */}
                        <div
                            class="ba-panel ba-flex-col ba-justify-between ba-gap-6"
                            style={{ padding: "1.25rem", "border-radius": "var(--ba-radius-lg)" }}
                        >
                            <div class="ba-stack-6">
                                {/* ファイル選択エリア */}
                                <div class="ba-field">
                                    <label class="ba-label">
                                        <span>変換対象の画像ファイルを選択</span>
                                    </label>
                                    <label
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                        class="ba-dropzone ba-flex-col ba-items-center ba-justify-center ba-gap-2"
                                        style={{
                                            "min-height": "10rem",
                                            background: "var(--ba-surface)",
                                            padding: "1rem",
                                        }}
                                    >
                                        <span style={{ opacity: 0.65 }}>
                                            <ToolIcon name="file" class="ba-icon-lg" />
                                        </span>
                                        <span
                                            class="ba-text-xs ba-font-bold ba-truncate"
                                            style={{ "max-width": "100%" }}
                                        >
                                            {selectedFile()
                                                ? selectedFile()?.name
                                                : "ドラッグ＆ドロップ、またはファイルを選択"}
                                        </span>
                                        <span
                                            class="ba-text-muted"
                                            style={{ "font-size": "0.6875rem", "font-weight": 500 }}
                                        >
                                            ※任意の主要な画像形式（png, jpeg,
                                            webp, gif等）に対応しています
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            aria-label="画像ファイルを選択"
                                            onChange={handleFileChange}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                </div>

                                {/* ターゲットフォーマット選択 */}
                                <div class="ba-field">
                                    <label class="ba-label">
                                        <span>変換後の画像形式（フォーマット）</span>
                                    </label>
                                    <select
                                        value={outputFormat()}
                                        aria-label="変換後の画像形式（フォーマット）"
                                        onChange={(e) =>
                                            setOutputFormat(
                                                e.currentTarget.value,
                                            )
                                        }
                                        class="ba-select ba-font-bold"
                                        style={{ height: "3rem" }}
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
                            <div style={{ "margin-top": "0.5rem" }}>
                                <button
                                    onClick={(e) => {
                                        animatePop(e.currentTarget, 0.95, 0.15);
                                        convertImage();
                                    }}
                                    disabled={!selectedFile() || isConverting()}
                                    class="ba-btn ba-btn--primary ba-btn--lg ba-btn--block ba-font-black"
                                    style={{ height: "3.5rem" }}
                                >
                                    {isConverting()
                                        ? "エンコード処理中..."
                                        : "指定の形式に変換する"}
                                </button>
                            </div>
                        </div>

                        {/* 右側：変換結果プレビュー */}
                        <div
                            class="ba-panel ba-flex-col ba-justify-center"
                            style={{
                                padding: "1.5rem",
                                "border-radius": "var(--ba-radius-lg)",
                                "min-height": "350px",
                            }}
                        >
                            <Show
                                when={convertedUrl()}
                                fallback={
                                    <div
                                        class="ba-text-center ba-stack-2 ba-text-muted"
                                        style={{ padding: "2rem" }}
                                    >
                                        <div class="ba-flex ba-justify-center" style={{ "margin-bottom": "0.5rem" }}>
                                            <ToolIcon name="image" class="ba-icon-xl" />
                                        </div>
                                        <p class="ba-text-xs ba-font-bold" style={{ "line-height": 1.65, margin: 0 }}>
                                            画像をアップロードし、変換ボタンを押すと
                                            <br />
                                            ここに変換後の画像プレビューと保存リンクが表示されます。
                                        </p>
                                    </div>
                                }
                            >
                                <div class="ba-flex-col ba-gap-4" style={{ height: "100%" }}>
                                    <div
                                        class="ba-flex ba-justify-between ba-items-center ba-gap-2 ba-flex-wrap"
                                        style={{
                                            "padding-bottom": "0.5rem",
                                            "border-bottom": "1px solid var(--ba-border)",
                                        }}
                                    >
                                        <span class="ba-font-bold ba-text-xs ba-text-muted">
                                            変換完了（フォーマット:{" "}
                                            {getExtensionLabel()}）
                                        </span>
                                        <a
                                            href={convertedUrl()}
                                            download={`converted.${outputFormat().split("/")[1]}`}
                                            class="ba-btn ba-btn--success ba-btn--sm"
                                        >
                                            画像をダウンロード
                                        </a>
                                    </div>

                                    <div
                                        class="ba-flex ba-justify-center ba-items-center"
                                        style={{
                                            background: "var(--ba-surface)",
                                            border: "1px solid var(--ba-border)",
                                            "border-radius": "var(--ba-radius)",
                                            padding: "0.75rem",
                                            "max-height": "300px",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <img
                                            src={convertedUrl()}
                                            alt="Converted Preview"
                                            style={{
                                                "max-width": "100%",
                                                "max-height": "270px",
                                                "object-fit": "contain",
                                                "border-radius": "var(--ba-radius-sm)",
                                                background: "var(--ba-surface-2)",
                                            }}
                                        />
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>
                <AdSense />

                {/* 技術仕様 ＆ 学術的なQ&Aセクション */}
                <div class="ba-grid-2 ba-w-full" style={{ gap: "1.5rem" }}>
                    {/* 技術仕様 */}
                    <div class="ba-card ba-flex-col ba-justify-between">
                        <div>
                            <h2
                                class="ba-section-title"
                                style={{
                                    "font-size": "1rem",
                                    "border-bottom": "1px solid var(--ba-border)",
                                    "padding-bottom": "0.75rem",
                                    "margin-bottom": "1.25rem",
                                }}
                            >
                                画像変換エンジンの仕様・実行スキーム
                            </h2>
                            <div
                                class="ba-stack-4 ba-text-xs ba-text-muted"
                                style={{ "line-height": 1.65, "font-weight": 500 }}
                            >
                                <p style={{ margin: 0 }}>
                                    本ツールは、HTML5の主要構成要素である{" "}
                                    <strong style={{ color: "var(--ba-text)" }}>Canvas Rendering Context 2D</strong>{" "}
                                    と、ブラウザネイティブの画像デコーダーを用いて処理を行います。
                                </p>
                                <p style={{ margin: 0 }}>
                                    インポートした画像ファイル（バイナリ）は、端末内部で一度メモリ上にピクセルマップとして展開され、ご希望の出力形式に基づき再サンプリング（エンコード）されます。
                                </p>
                                <p style={{ margin: 0 }}>
                                    一般的な画像処理クラウドサービスのように外部サーバーにデータを転送するAPI通信を一切伴わないため、物理的かつ構造的に画像データが流出する恐れはありません。
                                </p>
                            </div>
                        </div>
                        <div
                            class="ba-text-xs ba-text-muted"
                            style={{
                                "margin-top": "1.5rem",
                                "padding-top": "1rem",
                                "border-top": "1px solid var(--ba-border)",
                            }}
                        >
                            ※セキュリティおよび個人情報の取扱いについては、当サイトの
                            <a
                                href="/privacy"
                                class="ba-font-bold ba-underline ba-text-primary"
                                style={{ "margin-left": "0.25rem" }}
                            >
                                プライバシーポリシー
                            </a>
                            に準拠しています。
                        </div>
                    </div>

                    {/* 技術Q&Aセクション */}
                    <div class="ba-card">
                        <h2
                            class="ba-section-title"
                            style={{
                                "font-size": "1rem",
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.75rem",
                                "margin-bottom": "1.25rem",
                            }}
                        >
                            画像フォーマットに関する技術情報（FAQ）
                        </h2>

                        <div class="ba-stack-2">
                            <details class="ba-accordion">
                                <summary>
                                    Q. WebP形式へ変換するメリットは何ですか？
                                </summary>
                                <div class="ba-accordion-body">
                                    Googleがウェブ向けに開発した「WebP（ウェッピー）」は、従来のJPEGやPNGと比較して、
                                    <strong style={{ color: "var(--ba-text)" }}>
                                        同等画質を維持しながら最大30%程度ファイルサイズを軽量化
                                    </strong>
                                    できるのが最大の特徴です。サイト表示速度の向上や転送量削減に大きく貢献します。
                                </div>
                            </details>

                            <details class="ba-accordion">
                                <summary>
                                    Q.
                                    PNG画像をJPEGへ変換した際の透過箇所の挙動は？
                                </summary>
                                <div class="ba-accordion-body">
                                    JPEG規格はアルファチャンネル（透明・透過情報）に対応していません。そのため、本ツールではCanvas上で描画する際、透過レイヤーの下地に白色（#ffffff）の背景を自動で塗り潰し補完した上でJPEGへ出力する仕様を施しています。
                                </div>
                            </details>

                            <details class="ba-accordion">
                                <summary>
                                    Q.
                                    変換元のファイルの最大解像度やサイズ制限はありますか？
                                </summary>
                                <div class="ba-accordion-body">
                                    システム的なサイズ制限は設定していませんが、画像デコードとCanvas書き出しの負荷の上限値は、ご利用環境のハードウェア・ブラウザの空きメモリ容量に依存します。スマートフォンやタブレットでの巨大画像（数十メガピクセル等）の処理時は一時的に応答が遅延する可能性があります。
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
            <AdSense />
            <AdSense />
        </div>
    );
}
