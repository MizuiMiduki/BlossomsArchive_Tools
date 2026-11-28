import {
    createSignal,
    createMemo,
    onSettled,
    For,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";
import {
    calculateAverageColorFromPixels,
    generateMosaicGridIndices,
    calculateCoverCrop,
    calculateGridDimensions,
    createSafeObjectUrl,
    type MosaicTile,
    type ColorRgb,
    type TileAspectRatio,
} from "../utils/mosaicArt";

interface TargetInfo {
    file: File;
    previewUrl: string;
    width: number;
    height: number;
    imgElement: HTMLImageElement;
}

export default function MosaicArt() {
    const { title: pageTitle, description } = usePageI18n("/mosaic-art", {
        defaultTitle: "モザイクアート作成",
        defaultDescription:
            "完成させたい画像と複数の構成画像から、色味の加工なしで素材本来の写真を並べた高精細モザイクアート（フォトモザイク）をブラウザ完結で安全に生成できる無料ツールです。",
    });

    let containerRef: HTMLDivElement | undefined;
    let targetInputRef: HTMLInputElement | undefined;
    let tilesInputRef: HTMLInputElement | undefined;
    let resultCanvasRef: HTMLCanvasElement | undefined;

    // 状態管理
    let tileIdCounter = 0;
    const [targetImage, setTargetImage] = createSignal<TargetInfo | null>(null);
    const [tiles, setTiles] = createSignal<MosaicTile[]>([]);
    const [columns, setColumns] = createSignal<number>(40);
    const [outputWidth, setOutputWidth] = createSignal<number>(1800);
    const [avoidAdjacent, setAvoidAdjacent] = createSignal<boolean>(true);
    const [duplicatePenalty, setDuplicatePenalty] = createSignal<number>(1);
    const [tileAspect, setTileAspect] = createSignal<TileAspectRatio>("square");
    const [showTileThumbnails, setShowTileThumbnails] = createSignal<boolean>(true);
    const [outputFormat, setOutputFormat] = createSignal<string>("image/png");

    // 実行・進捗状態
    const [isProcessing, setIsProcessing] = createSignal<boolean>(false);
    const [progress, setProgress] = createSignal<number>(0);
    const [statusMessage, setStatusMessage] = createSignal<string>("");

    // 生成結果
    const [resultUrl, setResultUrl] = createSignal<string | null>(null);
    const [resultDimensions, setResultDimensions] = createSignal<{ width: number; height: number } | null>(null);
    const [zoomLevel, setZoomLevel] = createSignal<number>(1);
    const [showCompare, setShowCompare] = createSignal<boolean>(false);

    // リソース解放
    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }
        return () => {
            const currentTarget = targetImage();
            if (currentTarget?.previewUrl) {
                URL.revokeObjectURL(currentTarget.previewUrl);
            }
            for (const tile of tiles()) {
                if (tile.previewUrl) {
                    URL.revokeObjectURL(tile.previewUrl);
                }
            }
            const currentResult = resultUrl();
            if (currentResult) {
                URL.revokeObjectURL(currentResult);
            }
        };
    });

    // ターゲット画像選択ハンドラ
    const handleTargetFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;

        const prev = targetImage();
        if (prev?.previewUrl) {
            URL.revokeObjectURL(prev.previewUrl);
        }

        const previewUrl = createSafeObjectUrl(file);
        const img = new Image();
        img.onload = () => {
            setTargetImage({
                file,
                previewUrl,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                imgElement: img,
            });
        };
        img.src = previewUrl;
    };

    // 構成画像追加ハンドラ
    const handleTileFiles = async (fileList: FileList | File[]) => {
        const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return;

        setIsProcessing(true);
        setStatusMessage("構成画像を読み込み・色分析中...");

        const newTiles: MosaicTile[] = [];
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const previewUrl = createSafeObjectUrl(file);

            await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    let avgColor: ColorRgb = { r: 128, g: 128, b: 128 };
                    if (ctx) {
                        ctx.clearRect(0, 0, 16, 16);
                        ctx.drawImage(img, 0, 0, 16, 16);
                        try {
                            const imgData = ctx.getImageData(0, 0, 16, 16);
                            avgColor = calculateAverageColorFromPixels(imgData.data, 16 * 16);
                        } catch {
                            // フォールバック
                        }
                    }
                    tileIdCounter += 1;
                    newTiles.push({
                        id: `tile-${Date.now()}-${tileIdCounter}`,
                        name: file.name,
                        avgColor,
                        previewUrl,
                        source: img,
                    });
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(previewUrl);
                    resolve();
                };
                img.src = previewUrl;
            });
        }

        setTiles((prev) => [...prev, ...newTiles]);
        setIsProcessing(false);
        setStatusMessage("");
    };

    // タイル削除
    const removeTile = (id: string) => {
        setTiles((prev) => {
            const target = prev.find((t) => t.id === id);
            if (target?.previewUrl) {
                URL.revokeObjectURL(target.previewUrl);
            }
            return prev.filter((t) => t.id !== id);
        });
    };

    // 全タイル削除
    const clearAllTiles = () => {
        for (const t of tiles()) {
            if (t.previewUrl) URL.revokeObjectURL(t.previewUrl);
        }
        setTiles([]);
    };

    // ターゲット画像のクリア
    const clearTargetImage = () => {
        const current = targetImage();
        if (current?.previewUrl) {
            URL.revokeObjectURL(current.previewUrl);
        }
        setTargetImage(null);
    };

    // モザイクアート生成
    const generateMosaic = async () => {
        const target = targetImage();
        const tileList = tiles();
        if (!target || tileList.length === 0) return;

        setIsProcessing(true);
        setProgress(5);
        setStatusMessage("ターゲット画像の色グリッドを解析中...");

        // 描画更新用ディレイ
        await new Promise((r) => setTimeout(r, 20));

        try {
            const { cols, rows } = calculateGridDimensions(
                target.width,
                target.height,
                columns(),
                tileAspect(),
            );
            const aspect = target.height / target.width;

            // 1. ターゲット画像のセルごとの平均色を解析
            const gridCanvas = document.createElement("canvas");
            gridCanvas.width = cols;
            gridCanvas.height = rows;
            const gridCtx = gridCanvas.getContext("2d", { willReadFrequently: true });
            if (!gridCtx) throw new Error("Canvasコンテキストの初期化に失敗しました");

            gridCtx.drawImage(target.imgElement, 0, 0, cols, rows);
            const gridImgData = gridCtx.getImageData(0, 0, cols, rows);
            const cellColors: ColorRgb[] = [];
            for (let i = 0; i < cols * rows; i++) {
                const off = i * 4;
                cellColors.push({
                    r: gridImgData.data[off],
                    g: gridImgData.data[off + 1],
                    b: gridImgData.data[off + 2],
                });
            }

            setProgress(25);
            setStatusMessage("各セルに最適なタイル画像を配置中...");
            await new Promise((r) => setTimeout(r, 20));

            // 2. モザイク配置インデックスの計算
            const isNoReuse = duplicatePenalty() < 0;
            const gridIndices = generateMosaicGridIndices(
                cellColors,
                cols,
                rows,
                tileList,
                {
                    avoidAdjacent: avoidAdjacent(),
                    duplicatePenaltyWeight: isNoReuse ? 0 : duplicatePenalty(),
                    noReuse: isNoReuse,
                },
            );

            setProgress(45);
            setStatusMessage("高解像度キャンバスへ描画中...");
            await new Promise((r) => setTimeout(r, 20));

            // 3. 出力キャンバスへ描画（※構成画像の色味は一切加工・着色せず素材本来のままで描画）
            const outW = Math.max(400, Math.min(4000, Math.round(Number(outputWidth()))));
            const outH = Math.max(1, Math.round(outW * aspect));
            const cellW = outW / cols;
            const cellH = outH / rows;

            const outCanvas = resultCanvasRef || document.createElement("canvas");
            outCanvas.width = outW;
            outCanvas.height = outH;
            const outCtx = outCanvas.getContext("2d");
            if (!outCtx) throw new Error("出力Canvasコンテキストの取得に失敗しました");

            outCtx.fillStyle = "#ffffff";
            outCtx.fillRect(0, 0, outW, outH);

            const totalRows = rows;
            const chunkSize = Math.max(1, Math.floor(totalRows / 10));

            for (let r = 0; r < totalRows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    const tileIdx = gridIndices[idx];
                    const tile = tileList[tileIdx];

                    if (tile?.source) {
                        const imgElem = tile.source as HTMLImageElement;
                        const srcW = imgElem.naturalWidth || imgElem.width || 100;
                        const srcH = imgElem.naturalHeight || imgElem.height || 100;

                        // タイルをアスペクト比維持で中央切り抜き配置
                        const crop = calculateCoverCrop(srcW, srcH, cellW, cellH);
                        const dx = c * cellW;
                        const dy = r * cellH;

                        outCtx.drawImage(
                            tile.source,
                            crop.sx,
                            crop.sy,
                            crop.sw,
                            crop.sh,
                            dx,
                            dy,
                            cellW,
                            cellH,
                        );
                    }
                }

                // 定期的にUIスレッドに制御を戻し進捗バーを更新
                if (r % chunkSize === 0 || r === totalRows - 1) {
                    const pct = Math.round(45 + ((r + 1) / totalRows) * 50);
                    setProgress(pct);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            setProgress(98);
            setStatusMessage("画像ファイルを作成中...");

            // 4. 画像Blob生成
            outCanvas.toBlob(
                (blob) => {
                    if (blob) {
                        const prevResult = resultUrl();
                        if (prevResult) URL.revokeObjectURL(prevResult);

                        const url = URL.createObjectURL(blob);
                        setResultUrl(url);
                        setResultDimensions({ width: outW, height: outH });
                    }
                    setIsProcessing(false);
                    setProgress(100);
                    setStatusMessage("");
                },
                outputFormat(),
                0.92,
            );
        } catch {
            setIsProcessing(false);
            setStatusMessage("生成処理中にエラーが発生しました。");
        }
    };

    // 現在の設定で必要な総セル数
    const estimatedTotalCells = createMemo(() => {
        const target = targetImage();
        if (!target) return null;
        const { cols, rows } = calculateGridDimensions(
            target.width,
            target.height,
            columns(),
            tileAspect(),
        );
        return cols * rows;
    });

    // ダウンロードファイル名の決定
    const downloadFileName = createMemo(() => {
        const ext = outputFormat() === "image/jpeg" ? "jpg" : outputFormat() === "image/webp" ? "webp" : "png";
        return `mosaic-art-${Date.now()}.${ext}`;
    });

    return (
        <div ref={containerRef} class="ba-stack-6">
            {/* ヘッダーエリア */}
            <div class="ba-card ba-card--border ba-stack-3">
                <div class="ba-flex ba-items-center ba-gap-3">
                    <div class="ba-icon-box ba-icon-box--primary">
                        <ToolIcon name="grid" class="ba-icon-md" />
                    </div>
                    <div>
                        <h1 class="ba-title-h1">{pageTitle()}</h1>
                        <p class="ba-text-subtle ba-text-sm">
                            <BudouX text={description()} />
                        </p>
                    </div>
                </div>
            </div>

            <AdSense />

            {/* メイン操作エリア */}
            <form
                {...({
                    toolname: "mosaic_art_generator",
                    tooldescription:
                        "完成させたい画像と構成画像を選択して色味加工なしのモザイクアートを生成するツール",
                } as Record<string, string>)}
                onSubmit={(e) => {
                    e.preventDefault();
                    generateMosaic();
                }}
                class="ba-stack-6"
            >
                {/* 2カラム構成：ターゲット画像 ＆ 構成画像 */}
                <div class="ba-grid ba-grid-cols-1 md:ba-grid-cols-2 ba-gap-4">
                    {/* ステップ1: 完成させたい画像 */}
                    <div class="ba-card ba-card--border ba-stack-4">
                        <div class="ba-flex ba-items-center ba-justify-between">
                            <h2 class="ba-title-h2 ba-text-base">
                                1. 完成させたい画像（ターゲット）
                            </h2>
                            <Show when={targetImage()}>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--ghost ba-btn--xs"
                                    onClick={clearTargetImage}
                                    aria-label="選択画像をクリア"
                                >
                                    クリア
                                </button>
                            </Show>
                        </div>

                        <Show
                            when={targetImage()}
                            fallback={
                                <div
                                    class="ba-border-dashed ba-p-6 ba-text-center ba-rounded-lg ba-stack-2"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer?.files?.[0]) {
                                            handleTargetFile(e.dataTransfer.files[0]);
                                        }
                                    }}
                                >
                                    <div class="ba-flex ba-justify-center">
                                        <ToolIcon name="image" class="ba-icon-xl ba-text-subtle" />
                                    </div>
                                    <p class="ba-text-sm ba-font-medium">
                                        完成目標のメイン画像をドロップ
                                    </p>
                                    <p class="ba-text-xs ba-text-subtle">
                                        PNG, JPG, WebP に対応
                                    </p>
                                    <div>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--secondary ba-btn--sm"
                                            onClick={() => targetInputRef?.click()}
                                            aria-label="完成させたい画像を選択"
                                        >
                                            画像ファイルを選択
                                        </button>
                                    </div>
                                </div>
                            }
                        >
                            {(target) => (
                                <div class="ba-stack-3">
                                    <div
                                        class="ba-relative ba-rounded-md ba-overflow-hidden ba-bg-surface-2 ba-flex ba-items-center ba-justify-center"
                                        style={{ "max-height": "220px" }}
                                    >
                                        <img
                                            src={target().previewUrl}
                                            alt="ターゲット画像プレビュー"
                                            style={{
                                                "max-height": "220px",
                                                "max-width": "100%",
                                                width: "auto",
                                                "object-fit": "contain",
                                            }}
                                        />
                                    </div>
                                    <div class="ba-flex ba-items-center ba-justify-between ba-text-xs ba-text-subtle">
                                        <span>{target().file.name}</span>
                                        <span>
                                            {target().width} × {target().height} px
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--sm ba-w-full"
                                        onClick={() => targetInputRef?.click()}
                                        aria-label="完成させたい画像を変更"
                                    >
                                        別の画像に変更
                                    </button>
                                </div>
                            )}
                        </Show>

                        <input
                            ref={targetInputRef}
                            type="file"
                            accept="image/*"
                            class="ba-hidden"
                            onChange={(e) => {
                                if (e.currentTarget.files?.[0]) {
                                    handleTargetFile(e.currentTarget.files[0]);
                                }
                            }}
                            aria-label="ターゲット画像ファイル"
                        />
                    </div>

                    {/* ステップ2: 構成する画像群 */}
                    <div class="ba-card ba-card--border ba-stack-4">
                        <div class="ba-flex ba-items-center ba-justify-between">
                            <div>
                                <h2 class="ba-title-h2 ba-text-base">
                                    2. 構成する画像（タイル素材）
                                </h2>
                                <span class="ba-text-xs ba-text-subtle">
                                    {tiles().length} 枚選択中
                                </span>
                            </div>
                            <Show when={tiles().length > 0}>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--ghost ba-btn--xs ba-text-danger"
                                    onClick={clearAllTiles}
                                    aria-label="構成画像をすべてクリア"
                                >
                                    全削除
                                </button>
                            </Show>
                        </div>

                        <div
                            class="ba-border-dashed ba-p-4 ba-text-center ba-rounded-lg ba-stack-2"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer?.files) {
                                    handleTileFiles(e.dataTransfer.files);
                                }
                            }}
                        >
                            <p class="ba-text-xs ba-text-subtle">
                                複数枚の写真をドラッグ＆ドロップまたはファイル選択（何十枚でも追加可能）
                            </p>
                            <div class="ba-flex ba-flex-wrap ba-justify-center ba-gap-2">
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--secondary ba-btn--sm"
                                    onClick={() => tilesInputRef?.click()}
                                    aria-label="構成画像を追加選択"
                                >
                                    画像を追加選択（複数可）
                                </button>
                            </div>
                        </div>

                        <input
                            ref={tilesInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            class="ba-hidden"
                            onChange={(e) => {
                                if (e.currentTarget.files) {
                                    handleTileFiles(e.currentTarget.files);
                                }
                            }}
                            aria-label="構成画像ファイル群"
                        />

                        {/* サムネイル一覧 */}
                        <Show when={tiles().length > 0}>
                            <div class="ba-stack-2">
                                <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-text-xs ba-text-subtle">
                                    <span>素材サムネイル一覧（{tiles().length}枚）</span>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs"
                                        onClick={() => setShowTileThumbnails((v) => !v)}
                                    >
                                        {showTileThumbnails() ? "一覧を折りたたむ" : "一覧を表示する"}
                                    </button>
                                </div>
                                <Show when={showTileThumbnails()}>
                                    <div
                                        class="ba-p-2 ba-bg-surface-2 ba-rounded-md"
                                        style={{
                                            display: "grid",
                                            "grid-template-columns": "repeat(auto-fill, minmax(56px, 1fr))",
                                            gap: "0.4rem",
                                            "max-height": "180px",
                                            "overflow-y": "auto",
                                        }}
                                    >
                                        <For each={tiles()}>
                                            {(tile) => (
                                                <div
                                                    class="ba-relative ba-rounded ba-overflow-hidden ba-bg-surface-3"
                                                    style={{
                                                        position: "relative",
                                                        "aspect-ratio": "1 / 1",
                                                        width: "100%",
                                                    }}
                                                >
                                                    <img
                                                        src={tile.previewUrl}
                                                        alt={tile.name}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            "object-fit": "cover",
                                                            display: "block",
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTile(tile.id)}
                                                        aria-label={`${tile.name}を削除`}
                                                        style={{
                                                            position: "absolute",
                                                            top: "2px",
                                                            right: "2px",
                                                            width: "18px",
                                                            height: "18px",
                                                            "border-radius": "9999px",
                                                            background: "rgba(0, 0, 0, 0.72)",
                                                            color: "#ffffff",
                                                            border: "none",
                                                            "font-size": "12px",
                                                            "line-height": "1",
                                                            display: "flex",
                                                            "align-items": "center",
                                                            "justify-content": "center",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* 生成設定オプション */}
                <div class="ba-card ba-card--border ba-stack-4">
                    <h2 class="ba-title-h2 ba-text-base">3. 生成オプション</h2>

                    <div class="ba-grid ba-grid-cols-1 md:ba-grid-cols-3 ba-gap-4">
                        {/* 分割数 */}
                        <div class="ba-stack-2">
                            <div class="ba-flex ba-items-center ba-justify-between">
                                <label for="input-mosaic-columns" class="ba-label ba-text-xs ba-font-medium">
                                    タイルの分割数（横の列数）
                                </label>
                                <span class="ba-badge ba-badge--neutral ba-text-xs">
                                    {columns()} 列
                                </span>
                            </div>
                            <input
                                id="input-mosaic-columns"
                                type="range"
                                min="10"
                                max="200"
                                step="5"
                                value={columns()}
                                onInput={(e) => {
                                    const val = Number(e.currentTarget.value);
                                    if (Number.isFinite(val)) {
                                        setColumns(Math.max(10, Math.min(200, Math.round(val))));
                                    }
                                }}
                                class="ba-range"
                                aria-label="タイルの分割数"
                            />
                            <p class="ba-text-xs ba-text-subtle">
                                多いほど細密に、少ないほど個々の写真が見やすくなります。
                            </p>
                        </div>

                        {/* 出力解像度 */}
                        <div class="ba-stack-2">
                            <label for="select-mosaic-width" class="ba-label ba-text-xs ba-font-medium">
                                出力画像サイズ（横幅）
                            </label>
                            <select
                                id="select-mosaic-width"
                                value={outputWidth()}
                                onChange={(e) => {
                                    const val = Number(e.currentTarget.value);
                                    if (Number.isFinite(val)) setOutputWidth(val);
                                }}
                                class="ba-select ba-w-full"
                                aria-label="出力画像サイズ"
                            >
                                <option value="1200">標準 (1200 px)</option>
                                <option value="1800">高画質 (1800 px - 推奨)</option>
                                <option value="2400">超高画質 (2400 px)</option>
                                <option value="3200">ポスター級 (3200 px)</option>
                            </select>
                            <p class="ba-text-xs ba-text-subtle">
                                高解像度にするほど個々のタイルが拡大しても鮮明になります。
                            </p>
                        </div>

                        {/* 重複設定 */}
                        <div class="ba-stack-2">
                            <label for="select-mosaic-penalty" class="ba-label ba-text-xs ba-font-medium">
                                重複利用の制限
                            </label>
                            <select
                                id="select-mosaic-penalty"
                                value={duplicatePenalty()}
                                onChange={(e) => {
                                    const val = Number(e.currentTarget.value);
                                    if (Number.isFinite(val)) setDuplicatePenalty(val);
                                }}
                                class="ba-select ba-w-full"
                                aria-label="重複利用の制限"
                            >
                                <option value="0">重複制限なし（色の再現度優先）</option>
                                <option value="1">バランス（推奨）</option>
                                <option value="3">均等配置（全画像をまんべんなく使用）</option>
                                <option value="-1">同一画像を再利用しない（各画像1回まで）</option>
                            </select>
                            <Show
                                when={
                                    duplicatePenalty() < 0 &&
                                    estimatedTotalCells() !== null &&
                                    tiles().length > 0 &&
                                    tiles().length < (estimatedTotalCells() ?? 0)
                                }
                            >
                                <p class="ba-text-xs ba-text-warning">
                                    ※ 総セル数（{estimatedTotalCells()}個）に対して構成画像（{tiles().length}枚）が不足しているため、全画像を使い切った後は最小回数で均等補完されます。分割数を下げると重複なしで生成できます。
                                </p>
                            </Show>
                            <div class="ba-flex ba-items-center ba-gap-2 ba-mt-1">
                                <input
                                    type="checkbox"
                                    id="checkbox-avoid-adjacent"
                                    checked={avoidAdjacent()}
                                    onChange={(e) => setAvoidAdjacent(e.currentTarget.checked)}
                                    class="ba-checkbox"
                                    aria-label="隣接セルでの同一画像重複を防止"
                                />
                                <label for="checkbox-avoid-adjacent" class="ba-text-xs">
                                    隣接セルで同じ画像の連続を防止
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 追加オプション: タイル形状 */}
                    <div class="ba-pt-2 ba-border-t ba-border-base-300">
                        <div class="ba-stack-2" style={{ "max-width": "360px" }}>
                            <label for="select-mosaic-tile-aspect" class="ba-label ba-text-xs ba-font-medium">
                                タイル形状（縦横比）
                            </label>
                            <select
                                id="select-mosaic-tile-aspect"
                                value={tileAspect()}
                                onChange={(e) => setTileAspect(e.currentTarget.value as TileAspectRatio)}
                                class="ba-select ba-w-full"
                            >
                                <option value="square">正方形 (1:1 - 標準)</option>
                                <option value="landscape">横長 (4:3 - 風景写真向け)</option>
                                <option value="portrait">縦長 (3:4 - ポートレート向け)</option>
                            </select>
                            <p class="ba-text-xs ba-text-subtle">
                                素材写真の向きに合わせてタイルの切り抜き比率を調整できます。
                            </p>
                        </div>
                    </div>
                </div>

                {/* 生成アクションボタン＆プログレス */}
                <div class="ba-stack-3">
                    <button
                        type="submit"
                        disabled={!targetImage() || tiles().length === 0 || isProcessing()}
                        class="ba-btn ba-btn--primary ba-btn--lg ba-w-full"
                        aria-label="モザイクアートを生成"
                    >
                        <Show
                            when={!isProcessing()}
                            fallback={`生成処理中 (${progress()}%)...`}
                        >
                            モザイクアートを生成する
                        </Show>
                    </button>

                    <Show when={isProcessing()}>
                        <div class="ba-stack-2 ba-p-4 ba-bg-surface-2 ba-rounded-md ba-text-center">
                            <div class="ba-flex ba-items-center ba-justify-between ba-text-xs ba-text-subtle">
                                <span>{statusMessage()}</span>
                                <span>{progress()}%</span>
                            </div>
                            <div class="ba-w-full ba-h-2 ba-bg-surface-3 ba-rounded-full ba-overflow-hidden">
                                <div
                                    class="ba-h-full ba-bg-primary ba-transition-all"
                                    style={{ width: `${progress()}%` }}
                                />
                            </div>
                        </div>
                    </Show>
                </div>
            </form>

            {/* 生成結果エリア */}
            <Show when={resultUrl()}>
                {(url) => (
                    <div class="ba-card ba-card--border ba-stack-4">
                        <div class="ba-flex ba-items-center ba-justify-between ba-flex-wrap ba-gap-2">
                            <div>
                                <h2 class="ba-title-h2 ba-text-lg">生成完了！モザイクアート</h2>
                                <Show when={resultDimensions()}>
                                    {(dims) => (
                                        <p class="ba-text-xs ba-text-subtle">
                                            解像度: {dims().width} × {dims().height} px
                                        </p>
                                    )}
                                </Show>
                            </div>

                            {/* ズーム & 比較コントロール */}
                            <div class="ba-flex ba-items-center ba-gap-2">
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--secondary ba-btn--sm"
                                    onClick={() => setShowCompare(!showCompare())}
                                    aria-label="元画像と比較表示"
                                >
                                    {showCompare() ? "モザイクのみ表示" : "元画像と比較"}
                                </button>

                                <div class="ba-flex ba-items-center ba-gap-1 ba-border ba-rounded-md ba-p-1">
                                    <span class="ba-text-xs ba-text-subtle ba-px-1">ズーム:</span>
                                    <For each={[1, 2, 3]}>
                                        {(lvl) => (
                                            <button
                                                type="button"
                                                class={`ba-btn ba-btn--xs ${
                                                    zoomLevel() === lvl
                                                        ? "ba-btn--primary"
                                                        : "ba-btn--ghost"
                                                }`}
                                                onClick={() => setZoomLevel(lvl)}
                                                aria-label={`拡大率 ${lvl}倍`}
                                            >
                                                {lvl}x
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </div>

                        {/* プレビュー表示枠 */}
                        <div class="ba-relative ba-rounded-lg ba-overflow-hidden ba-bg-surface-2 ba-border ba-max-h-[600px] ba-overflow-auto ba-p-2 ba-flex ba-items-center ba-justify-center">
                            <Show
                                when={!showCompare()}
                                fallback={
                                    <div class="ba-grid ba-grid-cols-2 ba-gap-2 ba-w-full">
                                        <div class="ba-stack-1 ba-text-center">
                                            <span class="ba-text-xs ba-text-subtle">元画像</span>
                                            <img
                                                src={targetImage()?.previewUrl}
                                                alt="元画像"
                                                class="ba-max-h-[500px] ba-mx-auto ba-object-contain"
                                            />
                                        </div>
                                        <div class="ba-stack-1 ba-text-center">
                                            <span class="ba-text-xs ba-text-subtle">モザイクアート</span>
                                            <img
                                                src={url()}
                                                alt="生成モザイクアート"
                                                class="ba-max-h-[500px] ba-mx-auto ba-object-contain"
                                            />
                                        </div>
                                    </div>
                                }
                            >
                                <div
                                    class="ba-transition-transform ba-origin-center"
                                    style={{
                                        transform: `scale(${zoomLevel()})`,
                                        "transform-origin": "top center",
                                    }}
                                >
                                    <img
                                        src={url()}
                                        alt="完成モザイクアートプレビュー"
                                        class="ba-max-h-[550px] ba-object-contain ba-shadow-md"
                                    />
                                </div>
                            </Show>
                        </div>

                        {/* ダウンロードエリア */}
                        <div class="ba-flex ba-items-center ba-justify-between ba-flex-wrap ba-gap-3 ba-pt-2">
                            <div class="ba-flex ba-items-center ba-gap-2">
                                <label for="select-result-format" class="ba-text-xs ba-text-subtle">
                                    保存形式:
                                </label>
                                <select
                                    id="select-result-format"
                                    value={outputFormat()}
                                    onChange={(e) => setOutputFormat(e.currentTarget.value)}
                                    class="ba-select ba-select--sm"
                                    aria-label="画像保存形式"
                                >
                                    <option value="image/png">PNG（最高画質）</option>
                                    <option value="image/jpeg">JPEG（ファイル軽量）</option>
                                    <option value="image/webp">WebP（次世代形式）</option>
                                </select>
                            </div>

                            <a
                                href={url()}
                                download={downloadFileName()}
                                class="ba-btn ba-btn--success ba-btn--md"
                                aria-label="モザイクアート画像をダウンロード"
                            >
                                <ToolIcon name="download" class="ba-icon-sm" />
                                画像をダウンロード
                            </a>
                        </div>
                    </div>
                )}
            </Show>

            {/* 隠しキャンバス（オフスクリーン描画用） */}
            <canvas ref={resultCanvasRef} class="ba-hidden" />

            {/* 使い方＆Tipsガイド */}
            <div class="ba-card ba-card--border ba-stack-3">
                <h2 class="ba-title-h2 ba-text-base">綺麗に作るためのポイント</h2>
                <ul class="ba-stack-2 ba-text-xs ba-text-subtle ba-list-disc ba-pl-4">
                    <li>
                        <strong>構成画像の枚数を増やす：</strong>
                        色味の加工（着色オーバーレイ）を一切行わないため、構成画像が多様な色合い（明るい写真、暗い写真、赤系、青系、緑系など）を多く含んでいるほど、完成画像の色が忠実に再現されます（目安：30枚〜100枚以上）。
                    </li>
                    <li>
                        <strong>タイルの分割数の調整：</strong>
                        遠目で見たときの再現度を高めたい場合は列数を多め（50〜80列）に、1枚1枚の写真の内容を楽しみたい場合は列数を少なめ（25〜40列）に設定するのがおすすめです。
                    </li>
                    <li>
                        <strong>完全ブラウザ完結：</strong>
                        すべての画像解析・モザイク生成処理はお使いの端末（ブラウザ）上で実行され、外部サーバーへ写真が送信されることはありません。
                    </li>
                </ul>
            </div>

            <AdSense />
        </div>
    );
}
