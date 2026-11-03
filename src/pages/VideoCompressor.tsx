import { createSignal, createMemo, onMount, onCleanup, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/gsapAnimations";
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

    onMount(() => {
        document.title = "動画圧縮ツール | ブラウザ完結で容量削減・軽量化（サーバー送信なし）";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "ブラウザ上で安全に動画ファイルを圧縮・軽量化できる無料Webツール。MP4やWebM動画の解像度、ビットレート、フレームレートを調整して容量を大幅削減。サーバーに動画を一切アップロードせず、お使いの端末内で完全ローカル処理するためプライバシーも安心です。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "video-compressor-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "動画圧縮・軽量化ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5 Canvas and MediaRecorder API.",
            description:
                "サーバーへアップロードすることなくブラウザ上で完結する、高機能で安全な動画圧縮・サイズ軽量化ツール。",
        });
        document.head.appendChild(script);

        // コーデック検出
        const codecs = getSupportedVideoCodecs();
        setSupportedCodecs(codecs);
        if (codecs.length > 0) {
            setSelectedMimeType(codecs[0].mimeType);
        }

        if (containerRef) {
            playPageEntrance(containerRef, ".card");
        }
    });

    onCleanup(() => {
        const script = document.getElementById("video-compressor-jsonld");
        if (script) {
            script.remove();
        }
        if (previewUrl()) {
            URL.revokeObjectURL(previewUrl());
        }
        if (compressedUrl()) {
            URL.revokeObjectURL(compressedUrl());
        }
        if (abortController) {
            abortController.abort();
        }
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
            const currentFile = selectedFile();
            if (!currentFile) return;
            const meta = await extractVideoMetadata(currentFile);
            setMetadata(meta);
            setPreviewUrl(createSafeObjectUrl(currentFile));
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
        <div ref={containerRef} class="max-w-4xl mx-auto space-y-8 p-4">
            {/* タイトルヘッダー */}
            <div class="card bg-base-100 border border-base-300 shadow-sm p-6 text-center">
                <h1 class="text-3xl font-extrabold text-primary mb-2 flex items-center justify-center gap-2">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <BudouX text="動画圧縮・軽量化ツール" />
                </h1>
                <p class="text-base-content/70 max-w-2xl mx-auto text-sm leading-relaxed">
                    <BudouX text="動画の解像度やビットレートをブラウザ上で最適化し、ファイルサイズを削減します。サーバーにアップロードせず端末内で安全に完結します。" />
                </p>
                <div class="flex flex-wrap justify-center gap-2 mt-3">
                    <span class="badge badge-outline badge-primary text-xs">完全ブラウザ完結</span>
                    <span class="badge badge-outline badge-secondary text-xs">サーバー送信ゼロで安心</span>
                    <span class="badge badge-outline badge-accent text-xs">解像度・音声を自由調整</span>
                </div>
            </div>

            {/* エラーメッセージ */}
            <Show when={errorMessage()}>
                <div class="alert alert-error shadow-sm text-sm">
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errorMessage()}</span>
                </div>
            </Show>

            {/* ファイル未選択時のドロップゾーン */}
            <Show when={!selectedFile()}>
                <div
                    class={`card border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer bg-base-100 ${
                        isDragging() ? "border-primary bg-primary/5 scale-[1.01]" : "border-base-300 hover:border-primary/50"
                    }`}
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
                        class="hidden"
                        onChange={(e) => handleFiles((e.target as HTMLInputElement).files)}
                    />
                    <div class="flex flex-col items-center justify-center space-y-4">
                        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <p class="font-bold text-lg text-base-content">
                                動画ファイルをドラッグ＆ドロップ
                            </p>
                            <p class="text-sm text-base-content/60 mt-1">
                                またはクリックしてファイルを選択（MP4, WebM, MOV等に対応）
                            </p>
                        </div>
                        <button type="button" class="btn btn-primary btn-sm px-6">
                            ファイルを選択
                        </button>
                    </div>
                </div>
            </Show>

            {/* ファイル選択後のエリア */}
            <Show when={selectedFile() && metadata()}>
                {(meta) => (
                    <div class="space-y-6">
                        {/* 元動画情報 & プレビュー */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm p-6">
                            <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-base-200">
                                <div>
                                    <h2 class="text-lg font-bold flex items-center gap-2">
                                        <span>🎬</span> 元の動画ファイル
                                    </h2>
                                    <p class="text-xs text-base-content/60 truncate max-w-md mt-0.5 font-mono">
                                        {meta().name}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={resetAll}
                                    disabled={isCompressing()}
                                    class="btn btn-ghost btn-sm text-error"
                                >
                                    別の動画に変更
                                </button>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                {/* プレビュー動画 */}
                                <div class="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                                    <video
                                        src={previewUrl()}
                                        controls
                                        playsinline
                                        class="w-full h-full object-contain"
                                    />
                                </div>

                                {/* メタデータ詳細 */}
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div class="bg-base-200/50 p-3 rounded-lg">
                                        <div class="text-xs text-base-content/60">ファイルサイズ</div>
                                        <div class="text-base font-bold text-primary mt-1">
                                            {formatBytes(meta().size)}
                                        </div>
                                    </div>
                                    <div class="bg-base-200/50 p-3 rounded-lg">
                                        <div class="text-xs text-base-content/60">解像度</div>
                                        <div class="text-base font-bold mt-1">
                                            {meta().width} × {meta().height}
                                        </div>
                                    </div>
                                    <div class="bg-base-200/50 p-3 rounded-lg">
                                        <div class="text-xs text-base-content/60">再生時間</div>
                                        <div class="text-base font-bold mt-1">
                                            {formatDuration(meta().duration)}
                                        </div>
                                    </div>
                                    <div class="bg-base-200/50 p-3 rounded-lg">
                                        <div class="text-xs text-base-content/60">形式</div>
                                        <div class="text-base font-bold mt-1 truncate" title={meta().type}>
                                            {meta().type.replace("video/", "").toUpperCase() || "MP4"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 圧縮設定 */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-6">
                            <div>
                                <h2 class="text-lg font-bold flex items-center gap-2 mb-1">
                                    <span>⚙️</span> 圧縮設定
                                </h2>
                                <p class="text-xs text-base-content/60">
                                    目的に合わせたプリセットを選択するか、自由に数値をカスタマイズできます。
                                </p>
                            </div>

                            {/* プリセット選択タブ */}
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <For each={COMPRESS_PRESETS}>
                                    {(preset) => (
                                        <button
                                            type="button"
                                            onClick={() => handlePresetChange(preset.id)}
                                            disabled={isCompressing()}
                                            class={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                selectedPresetId() === preset.id
                                                    ? "border-primary bg-primary/10 shadow-sm"
                                                    : "border-base-300 hover:border-base-content/20 bg-base-100"
                                            }`}
                                        >
                                            <div>
                                                <div class="font-bold text-sm text-base-content flex items-center justify-between">
                                                    <span>{preset.label}</span>
                                                    <Show when={selectedPresetId() === preset.id}>
                                                        <span class="text-primary font-bold">✓</span>
                                                    </Show>
                                                </div>
                                                <p class="text-xs text-base-content/60 mt-1 leading-relaxed">
                                                    {preset.description}
                                                </p>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>

                            {/* 詳細設定（カスタムまたは調整時） */}
                            <div class="bg-base-200/40 rounded-xl p-4 space-y-4 border border-base-200">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 解像度スケーリング */}
                                    <div>
                                        <div class="flex justify-between items-center text-xs font-semibold mb-1">
                                            <span>解像度スケーリング: {scalePercent()}%</span>
                                            <span class="text-primary">
                                                {targetDimensions().width} × {targetDimensions().height}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="25"
                                            max="100"
                                            step="5"
                                            value={scalePercent()}
                                            onInput={(e) => {
                                                setScalePercent(Number(e.currentTarget.value));
                                                setSelectedPresetId("custom");
                                            }}
                                            disabled={isCompressing()}
                                            class="range range-xs range-primary w-full"
                                        />
                                        <div class="flex justify-between text-[10px] text-base-content/50 mt-1">
                                            <span>25%（超小型）</span>
                                            <span>50%</span>
                                            <span>75%</span>
                                            <span>100%（元のサイズ）</span>
                                        </div>
                                    </div>

                                    {/* ビットレート調整 */}
                                    <div>
                                        <div class="flex justify-between items-center text-xs font-semibold mb-1">
                                            <span>映像ビットレート</span>
                                            <span class="text-primary font-bold">
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
                                            onInput={(e) => {
                                                setVideoBitrateKbps(Number(e.currentTarget.value));
                                                setSelectedPresetId("custom");
                                            }}
                                            disabled={isCompressing()}
                                            class="range range-xs range-primary w-full"
                                        />
                                        <div class="flex justify-between text-[10px] text-base-content/50 mt-1">
                                            <span>300 kbps (高圧縮)</span>
                                            <span>1.5 Mbps</span>
                                            <span>3.5 Mbps</span>
                                            <span>6.0 Mbps (高品質)</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-base-200">
                                    {/* フレームレート */}
                                    <div>
                                        <label class="label py-1">
                                            <span class="label-text text-xs font-semibold">フレームレート (FPS)</span>
                                        </label>
                                        <select
                                            class="select select-bordered select-sm w-full"
                                            value={fps()}
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
                                    <div>
                                        <label class="label py-1">
                                            <span class="label-text text-xs font-semibold">音声設定</span>
                                        </label>
                                        <select
                                            class="select select-bordered select-sm w-full"
                                            value={includeAudio() ? "include" : "mute"}
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
                                    <div>
                                        <label class="label py-1">
                                            <span class="label-text text-xs font-semibold">出力フォーマット</span>
                                        </label>
                                        <select
                                            class="select select-bordered select-sm w-full"
                                            value={selectedMimeType()}
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
                            <div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                                <div>
                                    <div class="text-xs text-base-content/60">予想圧縮後サイズ（目安）</div>
                                    <div class="flex items-baseline gap-2 mt-0.5">
                                        <span class="text-xl font-extrabold text-primary">
                                            {formatBytes(estimatedSize())}
                                        </span>
                                        <Show when={estimatedReduction() > 0}>
                                            <span class="badge badge-sm badge-success font-bold">
                                                約 {estimatedReduction()}% 削減
                                            </span>
                                        </Show>
                                    </div>
                                </div>

                                <Show
                                    when={!isCompressing()}
                                    fallback={
                                        <div class="flex items-center gap-3">
                                            <span class="loading loading-spinner text-primary"></span>
                                            <button
                                                type="button"
                                                onClick={cancelCompression}
                                                class="btn btn-outline btn-error btn-sm"
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    }
                                >
                                    <button
                                        type="button"
                                        onClick={startCompression}
                                        class="btn btn-primary px-8"
                                    >
                                        圧縮を開始する
                                    </button>
                                </Show>
                            </div>

                            {/* 圧縮進捗表示 */}
                            <Show when={isCompressing()}>
                                <div class="bg-base-200/70 p-4 rounded-xl space-y-2 border border-base-300">
                                    <div class="flex justify-between items-center text-xs font-semibold">
                                        <span class="flex items-center gap-2">
                                            <span class="loading loading-ring loading-xs text-primary"></span>
                                            動画をエンコード中...
                                        </span>
                                        <span class="text-primary font-bold">{progressPercent()}%</span>
                                    </div>
                                    <progress
                                        class="progress progress-primary w-full"
                                        value={progressPercent()}
                                        max="100"
                                    ></progress>
                                    <div class="flex justify-between text-[11px] text-base-content/60">
                                        <span>処理時間: {formatDuration(progressTime())} / {formatDuration(meta().duration)}</span>
                                        <span>ブラウザ内で処理中（通信は発生しません）</span>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        {/* 圧縮結果カード */}
                        <Show when={compressedBlob() && compressedUrl()}>
                            <div class="card bg-base-100 border border-success shadow-md p-6 space-y-6">
                                <div class="flex items-center justify-between border-b border-base-200 pb-3">
                                    <div class="flex items-center gap-2 text-success font-bold text-lg">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>圧縮が完了しました！</span>
                                    </div>
                                    <span class="badge badge-success font-bold text-xs p-3">
                                        {calculateReductionPercent(meta().size, compressedBlob()!.size)}% 削減
                                    </span>
                                </div>

                                {/* 前後比較 */}
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                    <div class="p-3 bg-base-200/50 rounded-lg">
                                        <div class="text-xs text-base-content/60">元のサイズ</div>
                                        <div class="text-lg font-bold mt-1 text-base-content/70 line-through">
                                            {formatBytes(meta().size)}
                                        </div>
                                    </div>
                                    <div class="p-3 bg-success/10 border border-success/30 rounded-lg">
                                        <div class="text-xs text-success font-semibold">圧縮後サイズ</div>
                                        <div class="text-xl font-extrabold text-success mt-1">
                                            {formatBytes(compressedBlob()!.size)}
                                        </div>
                                    </div>
                                    <div class="p-3 bg-base-200/50 rounded-lg">
                                        <div class="text-xs text-base-content/60">削減容量</div>
                                        <div class="text-lg font-bold text-primary mt-1">
                                            -{formatBytes(meta().size - compressedBlob()!.size)}
                                        </div>
                                    </div>
                                </div>

                                {/* プレビュープレイヤー */}
                                <div class="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center max-w-xl mx-auto w-full">
                                    <video
                                        src={compressedUrl()}
                                        controls
                                        playsinline
                                        class="w-full h-full object-contain"
                                    />
                                </div>

                                {/* アクションボタン */}
                                <div class="flex flex-wrap items-center justify-center gap-4 pt-2">
                                    <a
                                        href={compressedUrl()}
                                        download={getDownloadFilename()}
                                        class="btn btn-success px-8 text-white shadow-sm"
                                    >
                                        <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        圧縮動画をダウンロード
                                    </a>
                                    <button
                                        type="button"
                                        onClick={resetAll}
                                        class="btn btn-outline"
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
            <div class="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-6">
                <div>
                    <h3 class="text-lg font-bold text-base-content flex items-center gap-2">
                        <span>💡</span>
                        <BudouX text="動画圧縮ツールの特徴と使い方" />
                    </h3>
                    <p class="text-xs text-base-content/60 mt-1">
                        安心してご利用いただける完全クライアントサイド設計です。
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-base-200/40 p-4 rounded-xl border border-base-200">
                        <div class="font-bold text-sm text-primary mb-1">🔒 完全ローカル処理</div>
                        <p class="text-xs text-base-content/70 leading-relaxed">
                            動画ファイルは外部サーバーに一切送信されません。すべてお使いのブラウザ内部でエンコードされるため、プライベートな動画や機密動画も安心です。
                        </p>
                    </div>
                    <div class="bg-base-200/40 p-4 rounded-xl border border-base-200">
                        <div class="font-bold text-sm text-secondary mb-1">⚡ 柔軟なカスタマイズ</div>
                        <p class="text-xs text-base-content/70 leading-relaxed">
                            バランス重視、SNS向けの超高圧縮、画質重視のプリセットに加え、ビットレートや解像度、フレームレート、音声ミュートを自由に指定可能です。
                        </p>
                    </div>
                    <div class="bg-base-200/40 p-4 rounded-xl border border-base-200">
                        <div class="font-bold text-sm text-accent mb-1">📱 スマホ・PC両対応</div>
                        <p class="text-xs text-base-content/70 leading-relaxed">
                            HTML5 CanvasおよびMediaRecorder APIに対応した最新のブラウザ（Chrome, Edge, Safari, Firefoxなど）でそのまま動作します。
                        </p>
                    </div>
                </div>

                <div class="space-y-3 pt-2 border-t border-base-200">
                    <h4 class="font-bold text-sm text-base-content">よくある質問 (FAQ)</h4>
                    <div class="collapse collapse-plus bg-base-200/30 rounded-lg">
                        <input type="checkbox" />
                        <div class="collapse-title text-xs font-semibold">
                            Q. 動画を圧縮すると画質は落ちますか？
                        </div>
                        <div class="collapse-content text-xs text-base-content/70 leading-relaxed">
                            ファイルサイズを削減するために解像度やビットレートを調整するため、設定によっては多少の画質変化が生じます。「おすすめ（バランス重視）」プリセットをご利用いただくと、人の目には画質の劣化がほとんど気にならない範囲で大幅に容量を抑えられます。
                        </div>
                    </div>
                    <div class="collapse collapse-plus bg-base-200/30 rounded-lg">
                        <input type="checkbox" />
                        <div class="collapse-title text-xs font-semibold">
                            Q. 音声を消してさらにファイルサイズを減らすことはできますか？
                        </div>
                        <div class="collapse-content text-xs text-base-content/70 leading-relaxed">
                            はい、可能です。詳細設定の「音声設定」から「音声を削除（無音で軽量化）」を選択していただくと、音声トラック分のデータがカットされ、さらに容量を削減できます。
                        </div>
                    </div>
                </div>
            </div>

            {/* 広告エリア */}
            <AdSense />
            <AdSense />
        </div>
    );
}
