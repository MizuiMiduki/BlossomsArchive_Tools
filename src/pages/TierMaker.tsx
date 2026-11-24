import { createSignal, createMemo, onSettled, For, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";
import {
    type Tier,
    type TierModel,
    type TierItem,
    type SubTier,
    type ItemType,
    DEFAULT_TIERS,
    PRESET_COLORS,
    createTierModel,
    generateTierId,
    cycleSubTier,
    getSubTierInfo,
    getContrastTextColor,
    renderTierListToCanvas,
} from "../utils/tierMaker";

export default function TierMaker() {
    let containerRef: HTMLDivElement | undefined;
    let fileInputRef: HTMLInputElement | undefined;
    let exportCanvasRef: HTMLCanvasElement | undefined;
    let previewModalRef: HTMLDialogElement | undefined;

    // 状態管理
    const [title, setTitle] = createSignal("ティア表");
    const [tiers, setTiers] = createSignal<TierModel[]>(
        DEFAULT_TIERS.map((t) => createTierModel(t.id, t.label, t.color)),
    );
    const [items, setItems] = createSignal<TierItem[]>([
        {
            id: generateTierId("item"),
            type: "text",
            tierId: "tier-s",
            subTier: "plus",
            label: "S+ 最上位",
            bgColor: "#374151",
        },
        {
            id: generateTierId("item"),
            type: "text",
            tierId: "tier-s",
            subTier: "normal",
            label: "Sランク",
            bgColor: "#374151",
        },
        {
            id: generateTierId("item"),
            type: "text",
            tierId: "tier-s",
            subTier: "minus",
            label: "S- 境界",
            bgColor: "#374151",
        },
        {
            id: generateTierId("item"),
            type: "text",
            tierId: "tier-a",
            subTier: "plus",
            label: "A+ 有力",
            bgColor: "#374151",
        },
        {
            id: generateTierId("item"),
            type: "text",
            tierId: "tier-a",
            subTier: "normal",
            label: "Aランク",
            bgColor: "#374151",
        },
        {
            id: generateTierId("item"),
            type: "text",
            tierId: null,
            subTier: "normal",
            label: "未分類アイテム",
            bgColor: "#374151",
        },
    ]);

    // 入力フォーム状態
    const [textInput, setTextInput] = createSignal("");
    const [draggedItemId, setDraggedItemId] = createSignal<string | null>(null);
    const [dragOverTierId, setDragOverTierId] = createSignal<string | null | "pool">(null);
    const [selectedItemId, setSelectedItemId] = createSignal<string | null>(null);
    const [hoveredItemId, setHoveredItemId] = createSignal<string | null>(null);
    const [templateMenuOpen, setTemplateMenuOpen] = createSignal(false);

    // エクスポート状態
    const [isExporting, setIsExporting] = createSignal(false);
    const [exportImageUrl, setExportImageUrl] = createSignal<string | null>(null);
    const [notification, setNotification] = createSignal<string | null>(null);

    let notificationTimer: number | null = null;
    const showNotification = (msg: string) => {
        if (notificationTimer !== null) clearTimeout(notificationTimer);
        setNotification(msg);
        notificationTimer = window.setTimeout(() => setNotification(null), 3000);
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
        return () => {
            if (notificationTimer !== null) clearTimeout(notificationTimer);
        };
    });

    // 選択中アイテム
    const selectedItem = createMemo(() => {
        const id = selectedItemId();
        if (!id) return null;
        return items().find((it) => it.id === id) || null;
    });

    // 未分類プールアイテム
    const poolItems = createMemo(() => {
        return items().filter((it) => it.tierId === null);
    });

    // ティア追加
    const addTier = (position: "top" | "bottom" = "bottom") => {
        const newId = generateTierId("tier");
        const availableColors = PRESET_COLORS;
        const currentCount = tiers().length;
        const nextColor = availableColors[currentCount % availableColors.length];
        const newTier = createTierModel(
            newId,
            `Rank ${currentCount + 1}`,
            nextColor,
        );

        if (position === "top") {
            setTiers((prev) => [newTier, ...prev]);
        } else {
            setTiers((prev) => [...prev, newTier]);
        }
        showNotification("新しいランクを追加しました");
    };

    // ティア削除
    const removeTier = (tierId: string) => {
        if (tiers().length <= 1) {
            showNotification("ランクは最低1つ必要です");
            return;
        }
        // 削除されるティアのアイテムをプールに戻す
        setItems((prev) =>
            prev.map((it) => (it.tierId === tierId ? { ...it, tierId: null } : it)),
        );
        setTiers((prev) => prev.filter((t) => t.id !== tierId));
        showNotification("ランクを削除しました（配置アイテムは未分類へ退避）");
    };

    // ティア順序移動
    const moveTier = (index: number, direction: "up" | "down") => {
        const current = [...tiers()];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.length) return;

        const temp = current[index];
        current[index] = current[targetIndex];
        current[targetIndex] = temp;
        setTiers(current);
    };

    // ティアクリア（そのティアのアイテムをプールに戻す）
    const clearTierItems = (tierId: string) => {
        setItems((prev) =>
            prev.map((it) => (it.tierId === tierId ? { ...it, tierId: null } : it)),
        );
        showNotification("段内のアイテムを未分類に戻しました");
    };

    // テキストアイテムの追加
    const handleAddTextItems = (e?: Event) => {
        if (e) e.preventDefault();
        const raw = textInput().trim();
        if (!raw) return;

        const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 0) return;

        const newItems: TierItem[] = lines.map((line) => ({
            id: generateTierId("item"),
            type: "text",
            tierId: null, // 未分類プールに追加
            subTier: "normal",
            label: line,
            bgColor: "#374151",
        }));

        setItems((prev) => [...prev, ...newItems]);
        setTextInput("");
        showNotification(`${newItems.length}件のテキストを追加しました`);
    };

    // 画像ファイルの追加
    const handleAddImages = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const readers: Promise<TierItem>[] = Array.from(files)
            .filter((file) => file.type.startsWith("image/"))
            .map((file) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result as string;
                        resolve({
                            id: generateTierId("item"),
                            type: "image",
                            tierId: null,
                            subTier: "normal",
                            label: file.name.replace(/\.[^/.]+$/, ""),
                            imageUrl: result,
                        });
                    };
                    reader.readAsDataURL(file);
                });
            });

        Promise.all(readers).then((newItems) => {
            if (newItems.length > 0) {
                setItems((prev) => [...prev, ...newItems]);
                showNotification(`${newItems.length}枚の画像を追加しました`);
            }
        });

        if (fileInputRef) fileInputRef.value = "";
    };

    // サブティアの切り替え
    const handleToggleSubTier = (itemId: string, newSubTier?: SubTier) => {
        setItems((prev) =>
            prev.map((it) => {
                if (it.id !== itemId) return it;
                const next = newSubTier !== undefined ? newSubTier : cycleSubTier(it.subTier);
                return { ...it, subTier: next };
            }),
        );
    };

    // アイテムの移動（ティア指定）
    const moveItemToTier = (itemId: string, targetTierId: string | null) => {
        setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, tierId: targetTierId } : it)),
        );
    };

    // アイテムの削除
    const deleteItem = (itemId: string) => {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        if (selectedItemId() === itemId) setSelectedItemId(null);
        showNotification("アイテムを削除しました");
    };

    // ドラッグ＆ドロップ処理
    const handleDragStart = (itemId: string, e: DragEvent) => {
        setDraggedItemId(itemId);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", itemId);
        }
    };

    const handleDragOver = (e: DragEvent, targetTierId: string | null | "pool") => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }
        setDragOverTierId(targetTierId);
    };

    const handleDrop = (e: DragEvent, targetTierId: string | null) => {
        e.preventDefault();
        setDragOverTierId(null);
        const itemId = draggedItemId() || e.dataTransfer?.getData("text/plain");
        if (itemId) {
            moveItemToTier(itemId, targetTierId);
        }
        setDraggedItemId(null);
    };

    // テンプレート適用
    const applyPresetTemplate = (type: "s-d" | "s-f" | "high-low") => {
        if (!confirm("現在のティア構成をリセットしてテンプレートを適用しますか？（アイテムは未分類へ退避します）")) {
            return;
        }

        setItems((prev) => prev.map((it) => ({ ...it, tierId: null })));

        if (type === "s-d") {
            setTiers(
                DEFAULT_TIERS.map((t) => createTierModel(t.id, t.label, t.color)),
            );
        } else if (type === "s-f") {
            setTiers([
                createTierModel("tier-s", "S", "#ff7f7f"),
                createTierModel("tier-a", "A", "#ffbf7f"),
                createTierModel("tier-b", "B", "#ffff7f"),
                createTierModel("tier-c", "C", "#7fff7f"),
                createTierModel("tier-d", "D", "#7fbfff"),
                createTierModel("tier-f", "F", "#9ca3af"),
            ]);
        } else if (type === "high-low") {
            setTiers([
                createTierModel("tier-high", "高 (High)", "#ff7f7f"),
                createTierModel("tier-mid", "中 (Mid)", "#ffff7f"),
                createTierModel("tier-low", "低 (Low)", "#7fbfff"),
            ]);
        }
        showNotification("テンプレートを適用しました");
    };

    // すべてリセット
    const handleResetAll = () => {
        if (!confirm("ティア表をすべて初期状態にリセットしますか？")) return;
        setTitle("ティア表");
        setTiers(
            DEFAULT_TIERS.map((t) => createTierModel(t.id, t.label, t.color)),
        );
        setItems([]);
        showNotification("すべてリセットしました");
    };

    // 全アイテムをプールに戻す
    const handleResetToPool = () => {
        setItems((prev) => prev.map((it) => ({ ...it, tierId: null })));
        showNotification("全アイテムを未分類プールに戻しました");
    };

    // 画像エクスポート
    const handleExportImage = async () => {
        if (!exportCanvasRef) return;
        setIsExporting(true);
        try {
            await renderTierListToCanvas(exportCanvasRef, {
                title: title(),
                tiers: tiers().map((t) => ({
                    id: t.id,
                    label: t.label(),
                    color: t.color(),
                })),
                items: items(),
            });
            const dataUrl = exportCanvasRef.toDataURL("image/png");
            setExportImageUrl(dataUrl);
            if (previewModalRef) {
                previewModalRef.showModal();
            }
        } catch (err) {
            console.error(err);
            alert("画像のエクスポートに失敗しました。");
        } finally {
            setIsExporting(false);
        }
    };

    // 画像ダウンロード実行
    const handleDownloadPng = () => {
        const url = exportImageUrl();
        if (!url) return;
        const link = document.createElement("a");
        link.download = `${title().trim() || "tier_list"}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            {/* SEO & アクセシビリティ用隠しCanvas */}
            <canvas ref={exportCanvasRef} style={{ display: "none" }} />

            {/* 通知トースト */}
            <Show when={notification()}>
                <div
                    style={{
                        position: "fixed",
                        top: "1rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        "z-index": 50,
                    }}
                >
                    <div class="ba-alert ba-alert--info" style={{ "box-shadow": "var(--ba-shadow-md)" }}>
                        <span>{notification()}</span>
                    </div>
                </div>
            </Show>

            {/* ページタイトル & 概要 */}
            <div class="ba-card ba-text-center ba-stack-2">
                <h1 class="ba-title">
                    <BudouX text="ティア表作成ツール (Tier List)" />
                </h1>
                <p
                    class="ba-text-sm ba-text-muted"
                    style={{ "max-width": "42rem", margin: "0 auto", "font-weight": 600, "line-height": 1.6 }}
                >
                    画像やテキストを自由に並べてオリジナルのランキング・ティア表を作成。段数の増減や配色変更、アイテムごとのA+・A-上下微調整、高画質PNG画像の保存に対応しています。
                </p>
            </div>

            {/* コントロールヘッダー */}
            <div class="ba-card">
                <form
                    {...({
                        toolname: "tier-list-maker",
                        tooldescription:
                            "画像やテキストを並べてオリジナルのティア表を作成・画像エクスポートできるツール",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                    class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3"
                >
                    <div class="ba-flex ba-items-center ba-gap-2 ba-flex-1 ba-min-w-0" style={{ "min-width": "14rem" }}>
                        <label for="tier-title-input" class="ba-text-sm ba-font-bold ba-shrink-0">
                            表タイトル:
                        </label>
                        <input
                            id="tier-title-input"
                            type="text"
                            value={title()}
                            onInput={(e) => setTitle(e.currentTarget.value)}
                            placeholder="ティア表のタイトルを入力"
                            class="ba-input ba-input--sm"
                            style={{ "max-width": "24rem" }}
                            aria-label="ティア表タイトル"
                        />
                    </div>

                    <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                        <button
                            type="button"
                            onClick={() => addTier("bottom")}
                            class="ba-btn ba-btn--outline ba-btn--sm"
                            title="新しいランク段を下に追加"
                        >
                            + ランク追加
                        </button>
                        <div style={{ position: "relative" }}>
                            <button
                                type="button"
                                class="ba-btn ba-btn--outline ba-btn--sm"
                                aria-label="テンプレートを選択"
                                aria-expanded={templateMenuOpen() ? "true" : "false"}
                                onClick={() => setTemplateMenuOpen((v) => !v)}
                            >
                                テンプレート
                            </button>
                            <Show when={templateMenuOpen()}>
                                <ul
                                    class="ba-stack-1"
                                    style={{
                                        position: "absolute",
                                        right: 0,
                                        top: "calc(100% + 0.35rem)",
                                        width: "13rem",
                                        padding: "0.4rem",
                                        margin: 0,
                                        "list-style": "none",
                                        "background-color": "var(--ba-surface)",
                                        border: "1px solid var(--ba-border)",
                                        "border-radius": "var(--ba-radius)",
                                        "box-shadow": "var(--ba-shadow-md)",
                                        "z-index": 30,
                                    }}
                                >
                                    <li>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--block"
                                            style={{ "justify-content": "flex-start" }}
                                            onClick={() => {
                                                setTemplateMenuOpen(false);
                                                applyPresetTemplate("s-d");
                                            }}
                                        >
                                            標準 5段階 (S〜D)
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--block"
                                            style={{ "justify-content": "flex-start" }}
                                            onClick={() => {
                                                setTemplateMenuOpen(false);
                                                applyPresetTemplate("s-f");
                                            }}
                                        >
                                            詳細 6段階 (S〜F)
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--block"
                                            style={{ "justify-content": "flex-start" }}
                                            onClick={() => {
                                                setTemplateMenuOpen(false);
                                                applyPresetTemplate("high-low");
                                            }}
                                        >
                                            シンプル 3段階 (高・中・低)
                                        </button>
                                    </li>
                                </ul>
                            </Show>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportImage}
                            disabled={isExporting()}
                            class="ba-btn ba-btn--primary ba-btn--sm"
                        >
                            <Show when={isExporting()} fallback="画像として保存 (PNG)">
                                生成中...
                            </Show>
                        </button>
                        <button
                            type="button"
                            onClick={handleResetAll}
                            class="ba-btn ba-btn--outline ba-btn--sm"
                            title="ティア表全体をリセット"
                        >
                            リセット
                        </button>
                    </div>
                </form>
            </div>

            {/* ティア表メインビュー */}
            <div class="ba-card" style={{ padding: 0, overflow: "hidden" }}>
                <div>
                    <For each={tiers()}>
                        {(tier, index) => (
                            <div
                                class="ba-flex ba-flex-wrap"
                                style={{
                                    "align-items": "stretch",
                                    "min-height": "104px",
                                    "border-bottom": index() < tiers().length - 1 ? "1px solid var(--ba-border)" : "none",
                                    "background-color": dragOverTierId() === tier.id ? "var(--ba-surface-2)" : "transparent",
                                    transition: "background-color 0.15s ease",
                                }}
                                onDragOver={(e) => handleDragOver(e, tier.id)}
                                onDragLeave={() => setDragOverTierId(null)}
                                onDrop={(e) => handleDrop(e, tier.id)}
                            >
                                {/* 左側：ティアラベル & 操作 */}
                                <div
                                    class="ba-flex-col ba-items-center ba-justify-between ba-gap-2 ba-shrink-0"
                                    style={{
                                        width: "clamp(8.5rem, 20%, 11rem)",
                                        padding: "0.75rem",
                                        "background-color": tier.color(),
                                        "user-select": "none",
                                    }}
                                >
                                    <div class="ba-flex-1 ba-w-full ba-flex ba-items-center ba-justify-center">
                                        <input
                                            type="text"
                                            value={tier.label()}
                                            onInput={(e) => tier.setLabel(e.currentTarget.value)}
                                            class="ba-w-full ba-font-black ba-text-center ba-text-lg"
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                "border-bottom": "1px solid transparent",
                                                outline: "none",
                                                padding: "0 0.25rem",
                                                color: getContrastTextColor(tier.color()),
                                            }}
                                            aria-label={`${tier.label()} ランクのラベル名`}
                                        />
                                    </div>

                                    {/* ランク操作ボタン群 */}
                                    <div class="ba-flex ba-items-center ba-gap-1">
                                        <button
                                            type="button"
                                            onClick={() => moveTier(index(), "up")}
                                            disabled={index() === 0}
                                            class="ba-btn ba-btn--xs ba-btn--ghost"
                                            style={{ padding: "0.2rem 0.35rem", color: getContrastTextColor(tier.color()) }}
                                            aria-label={`${tier.label()} ランクを1つ上に移動`}
                                            title="上へ移動"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveTier(index(), "down")}
                                            disabled={index() === tiers().length - 1}
                                            class="ba-btn ba-btn--xs ba-btn--ghost"
                                            style={{ padding: "0.2rem 0.35rem", color: getContrastTextColor(tier.color()) }}
                                            aria-label={`${tier.label()} ランクを1つ下に移動`}
                                            title="下へ移動"
                                        >
                                            ▼
                                        </button>
                                        {/* 色変更 */}
                                        <input
                                            type="color"
                                            value={tier.color()}
                                            onInput={(e) => tier.setColor(e.currentTarget.value)}
                                            style={{
                                                width: "1.5rem",
                                                height: "1.5rem",
                                                "border-radius": "0.25rem",
                                                cursor: "pointer",
                                                border: "none",
                                                padding: 0,
                                                background: "transparent",
                                            }}
                                            aria-label={`${tier.label()} ランクの背景色を変更`}
                                            title="色を変更"
                                        />
                                        {/* 削除 */}
                                        <button
                                            type="button"
                                            onClick={() => removeTier(tier.id)}
                                            class="ba-btn ba-btn--xs ba-btn--ghost"
                                            style={{ padding: "0.2rem 0.35rem", color: getContrastTextColor(tier.color()) }}
                                            aria-label={`${tier.label()} ランクを削除`}
                                            title="ランクを削除"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                {/* 右側：アイテム配置ドロップ領域 */}
                                <div
                                    class="ba-flex-1 ba-flex ba-flex-wrap ba-items-center ba-gap-3 ba-min-w-0"
                                    style={{ padding: "0.75rem", "background-color": "var(--ba-surface-2)" }}
                                >
                                    <For each={items().filter((it) => it.tierId === tier.id)}>
                                        {(item) => {
                                            const subInfo = getSubTierInfo(item.subTier);
                                            const showControls = () =>
                                                hoveredItemId() === item.id || selectedItemId() === item.id;
                                            return (
                                                <div
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(item.id, e)}
                                                    onClick={() => setSelectedItemId(item.id)}
                                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                                    onMouseLeave={() => setHoveredItemId(null)}
                                                    class="ba-flex ba-items-center ba-justify-center"
                                                    style={{
                                                        position: "relative",
                                                        width: "5rem",
                                                        height: "5rem",
                                                        padding: "0.25rem",
                                                        "border-radius": "var(--ba-radius-sm)",
                                                        border: selectedItemId() === item.id
                                                            ? "2px solid var(--ba-primary)"
                                                            : "1px solid var(--ba-border)",
                                                        "background-color": "var(--ba-surface)",
                                                        "box-shadow": "var(--ba-shadow-xs)",
                                                        cursor: "grab",
                                                        "user-select": "none",
                                                        overflow: "visible",
                                                        transform: item.subTier === "plus"
                                                            ? "translateY(-6px)"
                                                            : item.subTier === "minus"
                                                              ? "translateY(6px)"
                                                              : undefined,
                                                        transition: "transform 0.15s ease",
                                                    }}
                                                    title={`${item.label} (${subInfo.ariaLabel})`}
                                                >
                                                    {/* アイテム本体表示（画像 or テキスト） */}
                                                    <Show
                                                        when={item.type === "image" && item.imageUrl}
                                                        fallback={
                                                            <div
                                                                class="ba-w-full ba-flex ba-items-center ba-justify-center ba-text-center ba-text-xs ba-font-bold"
                                                                style={{
                                                                    height: "100%",
                                                                    "border-radius": "0.25rem",
                                                                    padding: "0.25rem",
                                                                    "line-height": 1.2,
                                                                    "word-break": "break-word",
                                                                    "background-color": item.bgColor || "#374151",
                                                                    color: "#ffffff",
                                                                }}
                                                            >
                                                                {item.label}
                                                            </div>
                                                        }
                                                    >
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.label}
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                "object-fit": "cover",
                                                                "border-radius": "0.25rem",
                                                                "pointer-events": "none",
                                                            }}
                                                        />
                                                    </Show>

                                                    {/* サブティア (+ / -) バッジ表示 */}
                                                    <Show when={subInfo.badgeText}>
                                                        <span
                                                            class="ba-flex ba-items-center ba-justify-center ba-font-black"
                                                            style={{
                                                                position: "absolute",
                                                                "z-index": 10,
                                                                width: "1.25rem",
                                                                height: "1.25rem",
                                                                "border-radius": "9999px",
                                                                "font-size": "0.625rem",
                                                                border: "1px solid #ffffff",
                                                                "box-shadow": "var(--ba-shadow-sm)",
                                                                "background-color": item.subTier === "plus" ? "var(--ba-success)" : "var(--ba-warning)",
                                                                color: item.subTier === "plus" ? "var(--ba-success-fg)" : "var(--ba-warning-fg)",
                                                                right: "-0.5rem",
                                                                top: item.subTier === "plus" ? "-0.5rem" : undefined,
                                                                bottom: item.subTier === "minus" ? "-0.5rem" : undefined,
                                                            }}
                                                        >
                                                            {subInfo.badgeText}
                                                        </span>
                                                    </Show>

                                                    {/* ホバー・選択時クイック操作バー（+ / 通常 / -） */}
                                                    <Show when={showControls()}>
                                                        <div
                                                            class="ba-flex ba-items-center ba-gap-1"
                                                            style={{
                                                                position: "absolute",
                                                                top: "-1.75rem",
                                                                left: "50%",
                                                                transform: "translateX(-50%)",
                                                                "background-color": "var(--ba-surface)",
                                                                border: "1px solid var(--ba-border)",
                                                                "border-radius": "var(--ba-radius-sm)",
                                                                padding: "0.15rem 0.25rem",
                                                                "box-shadow": "var(--ba-shadow-sm)",
                                                                "z-index": 20,
                                                                "white-space": "nowrap",
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleSubTier(item.id, "plus");
                                                                }}
                                                                class={`ba-btn ba-btn--xs ${item.subTier === "plus" ? "ba-btn--success" : "ba-btn--ghost"}`}
                                                                style={{ "min-height": "1.25rem", padding: "0 0.35rem" }}
                                                                aria-label="上寄りに設定 (A+)"
                                                                title="上寄り (+)"
                                                            >
                                                                +
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleSubTier(item.id, "normal");
                                                                }}
                                                                class={`ba-btn ba-btn--xs ${item.subTier === "normal" ? "ba-btn--secondary" : "ba-btn--ghost"}`}
                                                                style={{ "min-height": "1.25rem", padding: "0 0.35rem" }}
                                                                aria-label="中央に設定 (通常)"
                                                                title="中央 (通常)"
                                                            >
                                                                •
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleSubTier(item.id, "minus");
                                                                }}
                                                                class={`ba-btn ba-btn--xs ${item.subTier === "minus" ? "ba-btn--warning" : "ba-btn--ghost"}`}
                                                                style={{ "min-height": "1.25rem", padding: "0 0.35rem" }}
                                                                aria-label="下寄りに設定 (A-)"
                                                                title="下寄り (-)"
                                                            >
                                                                -
                                                            </button>
                                                        </div>
                                                    </Show>
                                                </div>
                                            );
                                        }}
                                    </For>

                                    <Show when={items().filter((it) => it.tierId === tier.id).length === 0}>
                                        <div class="ba-text-xs ba-text-muted" style={{ "font-style": "italic", padding: "1rem 0.5rem" }}>
                                            アイテムをここにドラッグ＆ドロップ
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* アイテム管理 & 追加エリア */}
            <div class="ba-flex ba-flex-wrap ba-gap-6 ba-items-start">
                {/* アイテム追加フォーム */}
                <div class="ba-card ba-stack-4 ba-min-w-0" style={{ flex: "1 1 18rem" }}>
                    <h2 class="ba-section-title">アイテムを追加</h2>

                    {/* テキストアイテム追加 */}
                    <form onSubmit={handleAddTextItems} class="ba-stack-2">
                        <label for="text-items-input" class="ba-label ba-text-muted">
                            文字・単語を追加（改行で複数一括登録可）:
                        </label>
                        <textarea
                            id="text-items-input"
                            value={textInput()}
                            onInput={(e) => setTextInput(e.currentTarget.value)}
                            placeholder="アイテム名（例: キャラ名、曲名、単語など）"
                            class="ba-textarea"
                            style={{ "min-height": "5rem", height: "5rem" }}
                            aria-label="追加するテキストアイテム名"
                        />
                        <button type="submit" class="ba-btn ba-btn--outline ba-btn--sm ba-btn--block">
                            + テキストを追加
                        </button>
                    </form>

                    <div class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-text-muted">
                        <hr class="ba-divider ba-flex-1" />
                        <span>または</span>
                        <hr class="ba-divider ba-flex-1" />
                    </div>

                    {/* 画像アイテム追加 */}
                    <div class="ba-stack-2">
                        <label class="ba-label ba-text-muted">
                            画像ファイルを追加（複数可）:
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleAddImages(e.currentTarget.files)}
                            class="ba-input ba-input--sm"
                            aria-label="画像ファイルを選択して追加"
                        />
                        <p class="ba-text-muted" style={{ "font-size": "0.6875rem", margin: 0 }}>
                            ※ 画像はサーバーへ送信されず、お使いの端末内だけで安全に処理されます。
                        </p>
                    </div>
                </div>

                {/* 未分類アイテムプール */}
                <div class="ba-card ba-stack-3 ba-min-w-0" style={{ flex: "2 1 24rem" }}>
                    <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                        <h2 class="ba-section-title">
                            未分類アイテムプール ({poolItems().length})
                        </h2>
                        <button
                            type="button"
                            onClick={handleResetToPool}
                            class="ba-btn ba-btn--ghost ba-btn--xs ba-text-muted"
                        >
                            全てプールに戻す
                        </button>
                    </div>

                    <div
                        class="ba-flex ba-flex-wrap ba-gap-3 ba-items-start"
                        style={{
                            "min-height": "140px",
                            padding: "0.75rem",
                            "border-radius": "var(--ba-radius)",
                            border: dragOverTierId() === "pool"
                                ? "2px dashed var(--ba-primary)"
                                : "2px dashed var(--ba-border-strong)",
                            "background-color": dragOverTierId() === "pool"
                                ? "var(--ba-primary-soft)"
                                : "var(--ba-surface-2)",
                            transition: "border-color 0.15s ease, background-color 0.15s ease",
                        }}
                        onDragOver={(e) => handleDragOver(e, "pool")}
                        onDragLeave={() => setDragOverTierId(null)}
                        onDrop={(e) => handleDrop(e, null)}
                    >
                        <For each={poolItems()}>
                            {(item) => (
                                <div
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(item.id, e)}
                                    onClick={() => setSelectedItemId(item.id)}
                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                    onMouseLeave={() => setHoveredItemId(null)}
                                    class="ba-flex ba-items-center ba-justify-center"
                                    style={{
                                        position: "relative",
                                        width: "4.5rem",
                                        height: "4.5rem",
                                        padding: "0.25rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        border: selectedItemId() === item.id
                                            ? "2px solid var(--ba-primary)"
                                            : "1px solid var(--ba-border)",
                                        "background-color": "var(--ba-surface)",
                                        "box-shadow": "var(--ba-shadow-xs)",
                                        cursor: "grab",
                                        "user-select": "none",
                                    }}
                                    title={`${item.label} (未分類)`}
                                >
                                    <Show
                                        when={item.type === "image" && item.imageUrl}
                                        fallback={
                                            <div
                                                class="ba-w-full ba-flex ba-items-center ba-justify-center ba-text-center ba-text-xs ba-font-bold"
                                                style={{
                                                    height: "100%",
                                                    "border-radius": "0.25rem",
                                                    padding: "0.25rem",
                                                    "line-height": 1.2,
                                                    "word-break": "break-word",
                                                    "background-color": item.bgColor || "#374151",
                                                    color: "#ffffff",
                                                }}
                                            >
                                                {item.label}
                                            </div>
                                        }
                                    >
                                        <img
                                            src={item.imageUrl}
                                            alt={item.label}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                "object-fit": "cover",
                                                "border-radius": "0.25rem",
                                                "pointer-events": "none",
                                            }}
                                        />
                                    </Show>

                                    {/* ホバー・選択時削除ボタン */}
                                    <Show when={hoveredItemId() === item.id || selectedItemId() === item.id}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteItem(item.id);
                                            }}
                                            class="ba-flex ba-items-center ba-justify-center"
                                            style={{
                                                position: "absolute",
                                                top: "-0.375rem",
                                                right: "-0.375rem",
                                                width: "1.1rem",
                                                height: "1.1rem",
                                                "border-radius": "9999px",
                                                border: "none",
                                                "background-color": "var(--ba-danger)",
                                                color: "var(--ba-danger-fg)",
                                                "font-size": "0.625rem",
                                                cursor: "pointer",
                                            }}
                                            aria-label={`${item.label} を削除`}
                                        >
                                            ✕
                                        </button>
                                    </Show>
                                </div>
                            )}
                        </For>

                        <Show when={poolItems().length === 0}>
                            <div class="ba-w-full ba-text-center ba-text-xs ba-text-muted" style={{ "padding-block": "2rem" }}>
                                未分類のアイテムはありません。上のフォームから画像やテキストを追加してください。
                            </div>
                        </Show>
                    </div>

                    {/* 選択アイテムのクイック操作（モバイル・キーボード対応） */}
                    <Show when={selectedItem()}>
                        {(item) => (
                            <div class="ba-panel ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3 ba-text-xs">
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <span class="ba-font-bold">選択中:</span>
                                    <span class="ba-badge ba-badge--neutral">{item().label}</span>
                                </div>

                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                                    {/* 配置先ランク移動 */}
                                    <span class="ba-text-muted">配置先:</span>
                                    <select
                                        value={item().tierId || "pool"}
                                        onChange={(e) => {
                                            const val = e.currentTarget.value;
                                            moveItemToTier(item().id, val === "pool" ? null : val);
                                        }}
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto" }}
                                        aria-label="選択中アイテムの配置先ランク"
                                    >
                                        <option value="pool">未分類プール</option>
                                        <For each={tiers()}>
                                            {(t) => <option value={t.id}>{t.label()} ランク</option>}
                                        </For>
                                    </select>

                                    {/* サブティア微調整 */}
                                    <span class="ba-text-muted" style={{ "margin-left": "0.5rem" }}>微調整:</span>
                                    <div class="ba-flex ba-items-center ba-gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubTier(item().id, "plus")}
                                            class={`ba-btn ba-btn--xs ${item().subTier === "plus" ? "ba-btn--success" : "ba-btn--outline"}`}
                                            aria-label="選択中アイテムを上寄りに設定 (+)"
                                        >
                                            + (上寄り)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubTier(item().id, "normal")}
                                            class={`ba-btn ba-btn--xs ${item().subTier === "normal" ? "ba-btn--secondary" : "ba-btn--outline"}`}
                                            aria-label="選択中アイテムを中央に設定 (通常)"
                                        >
                                            通常
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubTier(item().id, "minus")}
                                            class={`ba-btn ba-btn--xs ${item().subTier === "minus" ? "ba-btn--warning" : "ba-btn--outline"}`}
                                            aria-label="選択中アイテムを下寄りに設定 (-)"
                                        >
                                            - (下寄り)
                                        </button>
                                    </div>

                                    {/* 削除 */}
                                    <button
                                        type="button"
                                        onClick={() => deleteItem(item().id)}
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-danger"
                                        aria-label="選択中アイテムを削除"
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>
                        )}
                    </Show>
                </div>
            </div>

            {/* 使い方ガイド */}
            <div class="ba-card ba-stack-4">
                <h2 class="ba-section-title ba-text-xl">
                    ティア表作成ツールの使い方と便利な機能
                </h2>
                <div class="ba-grid-3 ba-text-sm ba-text-muted">
                    <div class="ba-stack-1">
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0, color: "var(--ba-text)" }}>
                            1. 自由なランク数とカスタマイズ
                        </h3>
                        <p style={{ margin: 0 }}>
                            「+ ランク追加」ボタンで好きな数だけ段を増減できます。段のラベル名や背景色はお好みに合わせて自由に変更可能です。
                        </p>
                    </div>
                    <div class="ba-stack-1">
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0, color: "var(--ba-text)" }}>
                            2. 画像と文字の混在配置
                        </h3>
                        <p style={{ margin: 0 }}>
                            手持ちの画像を複数一括でアップロードしたり、テキストを入力してカードとして並べたり、文字と画像を混在させて自由に配置できます。
                        </p>
                    </div>
                    <div class="ba-stack-1">
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0, color: "var(--ba-text)" }}>
                            3. 「+」「-」上下微調整オプション
                        </h3>
                        <p style={{ margin: 0 }}>
                            各アイテムカードの「+」「-」ボタンを押すと、同じランク内でも少し上にずらして「A+」、下にずらして「A-」といった細かな優劣・強弱を直感的に表現できます。
                        </p>
                    </div>
                </div>
            </div>

            {/* エクスポート画像プレビューモーダル */}
            <dialog
                ref={previewModalRef}
                class="ba-modal"
                onClick={(e) => {
                    if (e.target === previewModalRef) previewModalRef?.close();
                }}
            >
                <div class="ba-modal-box ba-stack-4" style={{ "max-width": "56rem" }}>
                    <h3 class="ba-section-title">ティア表画像のプレビュー</h3>
                    <div
                        class="ba-panel ba-flex ba-justify-center"
                        style={{ "max-height": "65vh", overflow: "auto", padding: "0.5rem" }}
                    >
                        <Show when={exportImageUrl()}>
                            {(url) => (
                                <img
                                    src={url()}
                                    alt="エクスポートされたティア表画像プレビュー"
                                    style={{ "max-width": "100%", height: "auto", "border-radius": "var(--ba-radius-sm)" }}
                                />
                            )}
                        </Show>
                    </div>
                    <div class="ba-flex ba-items-center ba-justify-between">
                        <button
                            type="button"
                            onClick={() => previewModalRef?.close()}
                            class="ba-btn ba-btn--ghost ba-btn--sm"
                        >
                            閉じる
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPng}
                            class="ba-btn ba-btn--primary ba-btn--sm"
                        >
                            PNG画像をダウンロード
                        </button>
                    </div>
                </div>
            </dialog>

            {/* 広告エリア */}
            <AdSense />
        </div>
    );
}
