import { createSignal, createMemo, onSettled, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";
import {
    COMPRESS_PRESETS,
    CompressPreset,
    SupportedCodec,
    VideoMetadata,
    calculateReductionPercent,
    calculateTargetDimensions,
    compressVideo,
    createSafeObjectUrl,
    estimateCompressedSize,
    extractVideoMetadata,
    formatBytes,
    formatDuration,
    getSupportedVideoCodecs,
} from "../utils/videoCompressor";

export default function VideoCompressor() {
    let containerRef: HTMLDivElement | undefined;
    let fileInputRef: HTMLInputElement | undefined;

    // 状態管理
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [metadata, setMetadata] = createSignal<VideoMetadata | null>(null);
    const [previewUrl, setPreviewUrl] = createSignal<string>("");
    const [selectedPresetId, setSelectedPresetId] = createSignal<CompressPreset["id"]>("balanced");

    // カスタム設定
    const [scalePercent, setScalePercent] = createSignal<number>(75);
    const [maxDimension, setMaxDimension] = createSignal<number>(1280);
    const [videoBitrateKbps, setVideoBitrateKbps] = createSignal<number>(1500);
    const [fps, setFps] = createSignal<number>(30);
    const [includeAudio, setIncludeAudio] = createSignal<boolean>(true);

    // コーデック一覧 & 選択
    const [supportedCodecs, setSupportedCodecs] = createSignal<SupportedCodec[]>([]);
    const [selectedMimeType, setSelectedMimeType] = createSignal<string>("video/webm");

    // 圧縮処理状態
    const [isCompressing, setIsCompressing] = createSignal<boolean>(false);
    const [progressPercent, setProgressPercent] = createSignal<number>(0);
    const [progressTime, setProgressTime] = createSignal<number>(0);
    const [errorMessage, setErrorMessage] = createSignal<string>("");

    // 圧縮結果
    const [compressedBlob, setCompressedBlob] = createSignal<Blob | null>(null);
    const [compressedUrl, setCompressedUrl] = createSignal<string>("");

    // ドラッグ＆ドロップ状態
    const [isDragging, setIsDragging] = createSignal<boolean>(false);

    // キャンセル用 AbortController
    let abortController: AbortController | null = null;

    onSettled(() => {
        // コーデック検出
        const codecs = getSupportedVideoCodecs();
        setSupportedCodecs(codecs);
        if (codecs.length > 0) {
            setSelectedMimeType(codecs[0].mimeType);
        }

        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }

        return () => {
            if (previewUrl()) {
                URL.revokeObjectURL(previewUrl());
            }
            if (compressedUrl()) {
                URL.revokeObjectURL(compressedUrl());
            }
            if (abortController) {
                abortController.abort();
            }
        };
    });

    // プリセット変更ハンドラ
    const handlePresetChange = (presetId: CompressPreset["id"]) => {
        setSelectedPresetId(presetId);
        const preset = COMPRESS_PRESETS.find((p) => p.id === presetId);
        if (preset && presetId !== "custom") {
            setScalePercent(preset.scalePercent);
            setMaxDimension(preset.maxDimension);
            setVideoBitrateKbps(preset.videoBitrateKbps);
            setFps(preset.fps);
            setIncludeAudio(preset.includeAudio);
        }
    };

    // ファイル選択処理
    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov|mkv|avi|flv|wmv)$/i)) {
            setErrorMessage("動画ファイル（MP4, WebM, MOV等）を選択してください。");
            return;
        }

        // 初期化
        setErrorMessage("");
        if (previewUrl()) URL.revokeObjectURL(previewUrl());
        if (compressedUrl()) URL.revokeObjectURL(compressedUrl());
        setCompressedBlob(null);
        setCompressedUrl("");
        setProgressPercent(0);

        try {
            setSelectedFile(file);
            const meta = await extractVideoMetadata(file);
            setMetadata(meta);
            setPreviewUrl(createSafeObjectUrl(file));
        } catch (err) {
            setSelectedFile(null);
            setErrorMessage(err instanceof Error ? err.message : "動画の読み込みに失敗しました。");
        }
    };

    // 圧縮後の解像度計算
    const targetDimensions = createMemo(() => {
        const meta = metadata();
        if (!meta) return { width: 0, height: 0 };
        return calculateTargetDimensions(meta.width, meta.height, scalePercent(), maxDimension());
    });

    // 予想サイズ計算
    const estimatedSize = createMemo(() => {
        const meta = metadata();
        if (!meta) return 0;
        return estimateCompressedSize(meta.duration, videoBitrateKbps(), 128, includeAudio());
    });

    // 予想削減率計算
    const estimatedReduction = createMemo(() => {
        const meta = metadata();
        const est = estimatedSize();
        if (!meta || est <= 0) return 0;
        return calculateReductionPercent(meta.size, est);
    });

    // 圧縮開始
    const startCompression = async () => {
        const file = selectedFile();
        const meta = metadata();
        const dims = targetDimensions();
        if (!file || !meta || dims.width <= 0) return;

        setIsCompressing(true);
        setErrorMessage("");
        setProgressPercent(0);
        setProgressTime(0);

        if (compressedUrl()) {
            URL.revokeObjectURL(compressedUrl());
            setCompressedUrl("");
            setCompressedBlob(null);
        }

        abortController = new AbortController();

        try {
            const blob = await compressVideo({
                file,
                width: dims.width,
                height: dims.height,
                fps: fps(),
                videoBitrateKbps: videoBitrateKbps(),
                mimeType: selectedMimeType(),
                includeAudio: includeAudio(),
                signal: abortController.signal,
                onProgress: (p) => {
                    setProgressPercent(p.percent);
                    setProgressTime(p.currentTime);
                },
            });

            setCompressedBlob(blob);
            setCompressedUrl(createSafeObjectUrl(blob));
        } catch (err) {
            if ((err as Error)?.name !== "AbortError" && !abortController.signal.aborted) {
                setErrorMessage(err instanceof Error ? err.message : "圧縮処理中にエラーが発生しました。");
            }
        } finally {
            setIsCompressing(false);
            abortController = null;
        }
    };

    // キャンセル
    const cancelCompression = () => {
        if (abortController) {
            abortController.abort();
        }
        setIsCompressing(false);
        setProgressPercent(0);
    };

    // ダウンロードファイル名
    const getDownloadFilename = () => {
        const file = selectedFile();
        if (!file) return "compressed_video.mp4";
        const dotIndex = file.name.lastIndexOf(".");
        const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
        const currentCodec = supportedCodecs().find((c) => c.mimeType === selectedMimeType());
        const ext = currentCodec ? currentCodec.extension : "mp4";
        return `${baseName}_compressed.${ext}`;
    };

    // リセット
    const resetAll = () => {
        if (previewUrl()) URL.revokeObjectURL(previewUrl());
        if (compressedUrl()) URL.revokeObjectURL(compressedUrl());
        setSelectedFile(null);
        setMetadata(null);
        setPreviewUrl("");
        setCompressedBlob(null);
        setCompressedUrl("");
        setErrorMessage("");
        setProgressPercent(0);
        if (fileInputRef) fileInputRef.value = "";
    };

    return (
        <div ref={containerRef} class="ba-page ba-page--narrow">
            {/* タイトルヘッダー */}
            <div class="ba-card ba-text-center">
                <h1
                    class="ba-title ba-flex ba-items-center ba-justify-center ba-gap-2"
                    style={{ "margin-bottom": "0.5rem" }}
                >
                    <svg class="ba-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <BudouX text="動画圧縮・軽量化ツール" />
                </h1>
                <p
                    class="ba-text-sm ba-text-muted"
                    style={{ "max-width": "42rem", margin: "0 auto", "line-height": 1.65 }}
                >
                    <BudouX text="動画の解像度やビットレートをブラウザ上で最適化し、ファイルサイズを削減します。サーバーにアップロードせず端末内で安全に完結します。" />
                </p>
                <div
                    class="ba-flex ba-flex-wrap ba-justify-center ba-gap-2"
                    style={{ "margin-top": "0.75rem" }}
                >
                    <span class="ba-badge ba-badge--outline">完全ブラウザ完結</span>
                    <span class="ba-badge ba-badge--outline">サーバー送信ゼロで安心</span>
                    <span class="ba-badge ba-badge--outline">解像度・音声を自由調整</span>
                </div>
            </div>

            {/* エラーメッセージ */}
            <Show when={errorMessage()}>
                <div class="ba-alert ba-alert--error">
                    <svg class="ba-icon-md ba-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errorMessage()}</span>
                </div>
            </Show>

            {/* ファイル未選択時のドロップゾーン */}
            <Show when={!selectedFile()}>
                <div
                    class="ba-card ba-dropzone"
                    style={{
                        padding: "2.5rem 1.5rem",
                        background: isDragging() ? "var(--ba-primary-soft)" : "var(--ba-surface)",
                        "border-color": isDragging() ? "var(--ba-primary)" : "var(--ba-border-strong)",
                        transform: isDragging() ? "scale(1.01)" : "none",
                        transition: "all 0.15s ease",
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleFiles(e.dataTransfer?.files || null);
                    }}
                    onClick={() => fileInputRef?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*,.mp4,.webm,.mov,.mkv,.avi"
                        aria-label="動画ファイルを選択"
                        style={{ display: "none" }}
                        onChange={(e) => handleFiles((e.target as HTMLInputElement).files)}
                    />
                    <div class="ba-flex-col ba-items-center ba-justify-center ba-gap-4">
                        <div
                            class="ba-flex ba-items-center ba-justify-center ba-text-primary"
                            style={{
                                width: "4rem",
                                height: "4rem",
                                "border-radius": "9999px",
                                background: "var(--ba-primary-soft)",
                            }}
                        >
                            <svg class="ba-icon-lg" style={{ width: "2rem", height: "2rem" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <p class="ba-font-bold ba-text-lg" style={{ margin: 0 }}>
                                動画ファイルをドラッグ＆ドロップ
                            </p>
                            <p class="ba-text-sm ba-text-muted" style={{ "margin-top": "0.25rem", "margin-bottom": 0 }}>
                                またはクリックしてファイルを選択（MP4, WebM, MOV等に対応）
                            </p>
                        </div>
                        <button type="button" class="ba-btn ba-btn--primary ba-btn--sm" style={{ "padding-inline": "1.5rem" }}>
                            ファイルを選択
                        </button>
                    </div>
                </div>
            </Show>

            {/* ファイル選択後のエリア */}
            <Show when={selectedFile() && metadata()}>
                {(meta) => (
                    <div class="ba-stack-6">
                        {/* 元動画情報 & プレビュー */}
                        <div class="ba-card ba-stack-4">
                            <div
                                class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-4"
                                style={{
                                    "padding-bottom": "0.75rem",
                                    "border-bottom": "1px solid var(--ba-border)",
                                }}
                            >
                                <div class="ba-min-w-0">
                                    <h2 class="ba-section-title ba-flex ba-items-center ba-gap-2">
                                        元の動画ファイル
                                    </h2>
                                    <p
                                        class="ba-text-xs ba-text-muted ba-truncate ba-mono"
                                        style={{ "max-width": "28rem", "margin-top": "0.2rem", "margin-bottom": 0 }}
                                    >
                                        {meta().name}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={resetAll}
                                    disabled={isCompressing()}
                                    class="ba-btn ba-btn--ghost ba-btn--sm ba-text-danger"
                                >
                                    別の動画に変更
                                </button>
                            </div>

                            <div class="ba-grid-2 ba-items-center" style={{ gap: "1.5rem" }}>
                                {/* プレビュー動画 */}
                                <div
                                    class="ba-flex ba-items-center ba-justify-center"
                                    style={{
                                        "border-radius": "var(--ba-radius)",
                                        overflow: "hidden",
                                        background: "#000000",
                                        "aspect-ratio": "16 / 9",
                                    }}
                                >
                                    <video
                                        src={previewUrl()}
                                        controls
                                        playsinline
                                        style={{ width: "100%", height: "100%", "object-fit": "contain" }}
                                    />
                                </div>

                                {/* メタデータ詳細 */}
                                <div
                                    class="ba-grid ba-text-sm"
                                    style={{ "grid-template-columns": "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}
                                >
                                    <div class="ba-panel" style={{ padding: "0.75rem" }}>
                                        <div class="ba-text-xs ba-text-muted">ファイルサイズ</div>
                                        <div class="ba-text-base ba-font-bold ba-text-primary" style={{ "margin-top": "0.25rem" }}>
                                            {formatBytes(meta().size)}
                                        </div>
                                    </div>
                                    <div class="ba-panel" style={{ padding: "0.75rem" }}>
                                        <div class="ba-text-xs ba-text-muted">解像度</div>
                                        <div class="ba-text-base ba-font-bold" style={{ "margin-top": "0.25rem" }}>
                                            {meta().width} × {meta().height}
                                        </div>
                                    </div>
                                    <div class="ba-panel" style={{ padding: "0.75rem" }}>
                                        <div class="ba-text-xs ba-text-muted">再生時間</div>
                                        <div class="ba-text-base ba-font-bold" style={{ "margin-top": "0.25rem" }}>
                                            {formatDuration(meta().duration)}
                                        </div>
                                    </div>
                                    <div class="ba-panel" style={{ padding: "0.75rem" }}>
                                        <div class="ba-text-xs ba-text-muted">形式</div>
                                        <div class="ba-text-base ba-font-bold ba-truncate" style={{ "margin-top": "0.25rem" }} title={meta().type}>
                                            {meta().type.replace("video/", "").toUpperCase() || "MP4"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 圧縮設定 */}
                        <div class="ba-card ba-stack-6">
                            <div>
                                <h2 class="ba-section-title ba-flex ba-items-center ba-gap-2" style={{ "margin-bottom": "0.25rem" }}>
                                    圧縮設定
                                </h2>
                                <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                    目的に合わせたプリセットを選択するか、自由に数値をカスタマイズできます。
                                </p>
                            </div>

                            {/* プリセット選択タブ */}
                            <div class="ba-grid-4">
                                <For each={COMPRESS_PRESETS}>
                                    {(preset) => (
                                        <button
                                            type="button"
                                            onClick={() => handlePresetChange(preset.id)}
                                            disabled={isCompressing()}
                                            class="ba-flex-col ba-justify-between"
                                            style={{
                                                padding: "1rem",
                                                "border-radius": "var(--ba-radius)",
                                                border: selectedPresetId() === preset.id
                                                    ? "1.5px solid var(--ba-primary)"
                                                    : "1px solid var(--ba-border)",
                                                background: selectedPresetId() === preset.id
                                                    ? "var(--ba-primary-soft)"
                                                    : "var(--ba-surface)",
                                                "text-align": "left",
                                                cursor: isCompressing() ? "not-allowed" : "pointer",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            <div>
                                                <div class="ba-font-bold ba-text-sm ba-flex ba-items-center ba-justify-between">
                                                    <span>{preset.label}</span>
                                                    <Show when={selectedPresetId() === preset.id}>
                                                        <span class="ba-text-primary ba-font-bold">✓</span>
                                                    </Show>
                                                </div>
                                                <p
                                                    class="ba-text-xs ba-text-muted"
                                                    style={{ "margin-top": "0.25rem", "margin-bottom": 0, "line-height": 1.6 }}
                                                >
                                                    {preset.description}
                                                </p>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>

                            {/* 詳細設定（カスタムまたは調整時） */}
                            <div class="ba-panel ba-stack-4">
                                <div class="ba-grid-2">
                                    {/* 解像度スケーリング */}
                                    <div>
                                        <div
                                            class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-font-bold"
                                            style={{ "margin-bottom": "0.25rem" }}
                                        >
                                            <span>解像度スケーリング: {scalePercent()}%</span>
                                            <span class="ba-text-primary">
                                                {targetDimensions().width} × {targetDimensions().height}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="25"
                                            max="100"
                                            step="5"
                                            value={scalePercent()}
                                            aria-label="解像度スケーリング"
                                            onInput={(e) => {
                                                setScalePercent(Number(e.currentTarget.value));
                                                setSelectedPresetId("custom");
                                            }}
                                            disabled={isCompressing()}
                                            class="ba-range"
                                        />
                                        <div
                                            class="ba-flex ba-justify-between ba-text-muted"
                                            style={{ "font-size": "0.625rem", "margin-top": "0.25rem" }}
                                        >
                                            <span>25%（超小型）</span>
                                            <span>50%</span>
                                            <span>75%</span>
                                            <span>100%（元のサイズ）</span>
                                        </div>
                                    </div>

                                    {/* ビットレート調整 */}
                                    <div>
                                        <div
                                            class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-font-bold"
                                            style={{ "margin-bottom": "0.25rem" }}
                                        >
                                            <span>映像ビットレート</span>
                                            <span class="ba-text-primary ba-font-bold">
                                                {videoBitrateKbps() >= 1000
                                                    ? `${(videoBitrateKbps() / 1000).toFixed(1)} Mbps`
                                                    : `${videoBitrateKbps()} kbps`}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="300"
                                            max="6000"
                                            step="100"
                                            value={videoBitrateKbps()}
                                            aria-label="映像ビットレート"
                                            onInput={(e) => {
                                                setVideoBitrateKbps(Number(e.currentTarget.value));
                                                setSelectedPresetId("custom");
                                            }}
                                            disabled={isCompressing()}
                                            class="ba-range"
                                        />
                                        <div
                                            class="ba-flex ba-justify-between ba-text-muted"
                                            style={{ "font-size": "0.625rem", "margin-top": "0.25rem" }}
                                        >
                                            <span>300 kbps (高圧縮)</span>
                                            <span>1.5 Mbps</span>
                                            <span>3.5 Mbps</span>
                                            <span>6.0 Mbps (高品質)</span>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    class="ba-grid-3"
                                    style={{
                                        "padding-top": "0.75rem",
                                        "border-top": "1px solid var(--ba-border)",
                                    }}
                                >
                                    {/* フレームレート */}
                                    <div class="ba-field">
                                        <label class="ba-label">
                                            <span>フレームレート (FPS)</span>
                                        </label>
                                        <select
                                            class="ba-select ba-select--sm"
                                            value={fps()}
                                            aria-label="フレームレート (FPS)"
                                            onChange={(e) => {
                                                setFps(Number(e.currentTarget.value));
                                                setSelectedPresetId("custom");
                                            }}
                                            disabled={isCompressing()}
                                        >
                                            <option value="60">60 fps（滑らか）</option>
                                            <option value="30">30 fps（標準）</option>
                                            <option value="24">24 fps（映画調・低容量）</option>
                                            <option value="15">15 fps（最小容量）</option>
                                        </select>
                                    </div>

                                    {/* 音声トラック */}
                                    <div class="ba-field">
                                        <label class="ba-label">
                                            <span>音声設定</span>
                                        </label>
                                        <select
                                            class="ba-select ba-select--sm"
                                            value={includeAudio() ? "include" : "mute"}
                                            aria-label="音声設定"
                                            onChange={(e) => {
                                                setIncludeAudio(e.currentTarget.value === "include");
                                                setSelectedPresetId("custom");
                                            }}
                                            disabled={isCompressing()}
                                        >
                                            <option value="include">音声を含める（標準）</option>
                                            <option value="mute">音声を削除（無音で軽量化）</option>
                                        </select>
                                    </div>

                                    {/* 出力形式（コーデック） */}
                                    <div class="ba-field">
                                        <label class="ba-label">
                                            <span>出力フォーマット</span>
                                        </label>
                                        <select
                                            class="ba-select ba-select--sm"
                                            value={selectedMimeType()}
                                            aria-label="出力フォーマット"
                                            onChange={(e) => setSelectedMimeType(e.currentTarget.value)}
                                            disabled={isCompressing()}
                                        >
                                            <For each={supportedCodecs()}>
                                                {(codec) => (
                                                    <option value={codec.mimeType}>
                                                        {codec.label}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 予想サイズ & 実行ボタン */}
                            <div
                                class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-4"
                                style={{
                                    padding: "1rem",
                                    "border-radius": "var(--ba-radius)",
                                    background: "var(--ba-primary-soft)",
                                    border: "1px solid var(--ba-border)",
                                }}
                            >
                                <div>
                                    <div class="ba-text-xs ba-text-muted">予想圧縮後サイズ（目安）</div>
                                    <div
                                        class="ba-flex ba-items-center ba-gap-2"
                                        style={{ "margin-top": "0.2rem" }}
                                    >
                                        <span class="ba-text-xl ba-font-black ba-text-primary">
                                            {formatBytes(estimatedSize())}
                                        </span>
                                        <Show when={estimatedReduction() > 0}>
                                            <span class="ba-badge ba-badge--success">
                                                約 {estimatedReduction()}% 削減
                                            </span>
                                        </Show>
                                    </div>
                                </div>

                                <Show
                                    when={!isCompressing()}
                                    fallback={
                                        <div class="ba-flex ba-items-center ba-gap-3">
                                            <span class="ba-spinner ba-text-primary"></span>
                                            <button
                                                type="button"
                                                onClick={cancelCompression}
                                                class="ba-btn ba-btn--outline ba-btn--sm ba-text-danger"
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    }
                                >
                                    <button
                                        type="button"
                                        onClick={startCompression}
                                        class="ba-btn ba-btn--primary"
                                        style={{ "padding-inline": "2rem" }}
                                    >
                                        圧縮を開始する
                                    </button>
                                </Show>
                            </div>

                            {/* 圧縮進捗表示 */}
                            <Show when={isCompressing()}>
                                <div class="ba-panel ba-stack-2">
                                    <div class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-font-bold">
                                        <span class="ba-flex ba-items-center ba-gap-2">
                                            <span class="ba-spinner ba-text-primary" style={{ width: "0.9rem", height: "0.9rem" }}></span>
                                            動画をエンコード中...
                                        </span>
                                        <span class="ba-text-primary ba-font-bold">{progressPercent()}%</span>
                                    </div>
                                    <progress
                                        class="ba-progress"
                                        value={progressPercent()}
                                        max="100"
                                    ></progress>
                                    <div
                                        class="ba-flex ba-justify-between ba-text-muted"
                                        style={{ "font-size": "0.6875rem" }}
                                    >
                                        <span>処理時間: {formatDuration(progressTime())} / {formatDuration(meta().duration)}</span>
                                        <span>ブラウザ内で処理中（通信は発生しません）</span>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        {/* 圧縮結果カード */}
                        <Show when={compressedBlob() && compressedUrl()}>
                            <div
                                class="ba-card ba-stack-6"
                                style={{ "border-color": "var(--ba-success)" }}
                            >
                                <div
                                    class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-flex-wrap"
                                    style={{
                                        "border-bottom": "1px solid var(--ba-border)",
                                        "padding-bottom": "0.75rem",
                                    }}
                                >
                                    <div class="ba-flex ba-items-center ba-gap-2 ba-text-success ba-font-bold ba-text-lg">
                                        <svg class="ba-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>圧縮が完了しました！</span>
                                    </div>
                                    <span class="ba-badge ba-badge--success" style={{ padding: "0.35rem 0.75rem" }}>
                                        {calculateReductionPercent(meta().size, compressedBlob()!.size)}% 削減
                                    </span>
                                </div>

                                {/* 前後比較 */}
                                <div class="ba-grid-3 ba-text-center">
                                    <div class="ba-panel" style={{ padding: "0.75rem" }}>
                                        <div class="ba-text-xs ba-text-muted">元のサイズ</div>
                                        <div
                                            class="ba-text-lg ba-font-bold ba-text-muted"
                                            style={{ "margin-top": "0.25rem", "text-decoration": "line-through" }}
                                        >
                                            {formatBytes(meta().size)}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            padding: "0.75rem",
                                            background: "var(--ba-success-soft)",
                                            border: "1px solid var(--ba-success)",
                                            "border-radius": "var(--ba-radius)",
                                        }}
                                    >
                                        <div class="ba-text-xs ba-text-success ba-font-bold">圧縮後サイズ</div>
                                        <div class="ba-text-xl ba-font-black ba-text-success" style={{ "margin-top": "0.25rem" }}>
                                            {formatBytes(compressedBlob()!.size)}
                                        </div>
                                    </div>
                                    <div class="ba-panel" style={{ padding: "0.75rem" }}>
                                        <div class="ba-text-xs ba-text-muted">削減容量</div>
                                        <div class="ba-text-lg ba-font-bold ba-text-primary" style={{ "margin-top": "0.25rem" }}>
                                            -{formatBytes(meta().size - compressedBlob()!.size)}
                                        </div>
                                    </div>
                                </div>

                                {/* プレビュープレイヤー */}
                                <div
                                    class="ba-flex ba-items-center ba-justify-center ba-w-full"
                                    style={{
                                        "border-radius": "var(--ba-radius)",
                                        overflow: "hidden",
                                        background: "#000000",
                                        "aspect-ratio": "16 / 9",
                                        "max-width": "36rem",
                                        margin: "0 auto",
                                    }}
                                >
                                    <video
                                        src={compressedUrl()}
                                        controls
                                        playsinline
                                        style={{ width: "100%", height: "100%", "object-fit": "contain" }}
                                    />
                                </div>

                                {/* アクションボタン */}
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-center ba-gap-4" style={{ "padding-top": "0.5rem" }}>
                                    <a
                                        href={compressedUrl()}
                                        download={getDownloadFilename()}
                                        class="ba-btn ba-btn--success"
                                        style={{ "padding-inline": "2rem" }}
                                    >
                                        <svg class="ba-icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        圧縮動画をダウンロード
                                    </a>
                                    <button
                                        type="button"
                                        onClick={resetAll}
                                        class="ba-btn ba-btn--outline"
                                    >
                                        別の動画を圧縮する
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>
                )}
            </Show>

            {/* 解説・FAQセクション */}
            <div class="ba-card ba-stack-6">
                <div>
                    <h2 class="ba-section-title ba-flex ba-items-center ba-gap-2">
                        <BudouX text="動画圧縮ツールの特徴と使い方" />
                    </h2>
                    <p class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.25rem", "margin-bottom": 0 }}>
                        安心してご利用いただける完全クライアントサイド設計です。
                    </p>
                </div>

                <div class="ba-grid-3">
                    <div class="ba-panel">
                        <div class="ba-font-bold ba-text-sm ba-text-primary" style={{ "margin-bottom": "0.25rem" }}>完全ローカル処理</div>
                        <p class="ba-text-xs ba-text-muted" style={{ "line-height": 1.65, margin: 0 }}>
                            動画ファイルは外部サーバーに一切送信されません。すべてお使いのブラウザ内部でエンコードされるため、プライベートな動画や機密動画も安心です。
                        </p>
                    </div>
                    <div class="ba-panel">
                        <div class="ba-font-bold ba-text-sm ba-text-primary" style={{ "margin-bottom": "0.25rem" }}>柔軟なカスタマイズ</div>
                        <p class="ba-text-xs ba-text-muted" style={{ "line-height": 1.65, margin: 0 }}>
                            バランス重視、SNS向けの超高圧縮、画質重視のプリセットに加え、ビットレートや解像度、フレームレート、音声ミュートを自由に指定可能です。
                        </p>
                    </div>
                    <div class="ba-panel">
                        <div class="ba-font-bold ba-text-sm ba-text-success" style={{ "margin-bottom": "0.25rem" }}>スマホ・PC両対応</div>
                        <p class="ba-text-xs ba-text-muted" style={{ "line-height": 1.65, margin: 0 }}>
                            HTML5 CanvasおよびMediaRecorder APIに対応した最新のブラウザ（Chrome, Edge, Safari, Firefoxなど）でそのまま動作します。
                        </p>
                    </div>
                </div>

                <div
                    class="ba-stack-3"
                    style={{
                        "padding-top": "0.75rem",
                        "border-top": "1px solid var(--ba-border)",
                    }}
                >
                    <h2 class="ba-section-title" style={{ "font-size": "0.9375rem" }}>よくある質問 (FAQ)</h2>
                    <details class="ba-accordion">
                        <summary>
                            Q. 動画を圧縮すると画質は落ちますか？
                        </summary>
                        <div class="ba-accordion-body">
                            ファイルサイズを削減するために解像度やビットレートを調整するため、設定によっては多少の画質変化が生じます。「おすすめ（バランス重視）」プリセットをご利用いただくと、人の目には画質の劣化がほとんど気にならない範囲で大幅に容量を抑えられます。
                        </div>
                    </details>
                    <details class="ba-accordion">
                        <summary>
                            Q. 音声を消してさらにファイルサイズを減らすことはできますか？
                        </summary>
                        <div class="ba-accordion-body">
                            はい、可能です。詳細設定の「音声設定」から「音声を削除（無音で軽量化）」を選択していただくと、音声トラック分のデータがカットされ、さらに容量を削減できます。
                        </div>
                    </details>
                </div>
            </div>

            {/* 広告エリア */}
            <AdSense />
            <AdSense />
        </div>
    );
}
