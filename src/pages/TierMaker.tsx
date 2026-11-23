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
        if (containerRef) playPageEntrance(containerRef, ".card");
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
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0 font-sans space-y-6">
            {/* SEO & アクセシビリティ用隠しCanvas */}
            <canvas ref={exportCanvasRef} class="hidden" />

            {/* 通知トースト */}
            <Show when={notification()}>
                <div class="toast toast-top toast-center z-50">
                    <div class="alert alert-info shadow-lg py-2 px-4 text-sm font-medium">
                        <span>{notification()}</span>
                    </div>
                </div>
            </Show>

            {/* ページタイトル & 概要 */}
            <div class="w-full card bg-base-100 shadow-sm p-4 sm:p-6 border border-base-300 min-w-0 text-center space-y-2">
                <h1 class="text-2xl md:text-3xl font-black text-base-content tracking-tight">
                    <BudouX text="ティア表作成ツール (Tier List)" />
                </h1>
                <p class="text-xs sm:text-sm font-semibold text-base-content/70 max-w-2xl mx-auto leading-relaxed">
                    画像やテキストを自由に並べてオリジナルのランキング・ティア表を作成。段数の増減や配色変更、アイテムごとのA+・A-上下微調整、高画質PNG画像の保存に対応しています。
                </p>
            </div>

            {/* コントロールヘッダー */}
            <div class="w-full card bg-base-100 border border-base-300 shadow-sm p-4 space-y-4">
                <form
                    {...({
                        toolname: "tier-list-maker",
                        tooldescription:
                            "画像やテキストを並べてオリジナルのティア表を作成・画像エクスポートできるツール",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                    class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
                >
                    <div class="flex-1 flex items-center gap-2">
                        <label for="tier-title-input" class="text-sm font-semibold whitespace-nowrap">
                            表タイトル:
                        </label>
                        <input
                            id="tier-title-input"
                            type="text"
                            value={title()}
                            onInput={(e) => setTitle(e.currentTarget.value)}
                            placeholder="ティア表のタイトルを入力"
                            class="input input-bordered input-sm w-full max-w-md"
                            aria-label="ティア表タイトル"
                        />
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => addTier("bottom")}
                            class="btn btn-outline btn-sm"
                            title="新しいランク段を下に追加"
                        >
                            + ランク追加
                        </button>
                        <div class="dropdown dropdown-end">
                            <label
                                tabindex={0}
                                class="btn btn-outline btn-sm"
                                aria-label="テンプレートを選択"
                            >
                                テンプレート
                            </label>
                            <ul
                                tabindex={0}
                                class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300 z-30"
                            >
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => applyPresetTemplate("s-d")}
                                    >
                                        標準 5段階 (S〜D)
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => applyPresetTemplate("s-f")}
                                    >
                                        詳細 6段階 (S〜F)
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => applyPresetTemplate("high-low")}
                                    >
                                        シンプル 3段階 (高・中・低)
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportImage}
                            disabled={isExporting()}
                            class="btn btn-primary btn-sm"
                        >
                            <Show when={isExporting()} fallback="画像として保存 (PNG)">
                                生成中...
                            </Show>
                        </button>
                        <button
                            type="button"
                            onClick={handleResetAll}
                            class="btn btn-outline btn-sm text-base-content/80 hover:bg-base-200"
                            title="ティア表全体をリセット"
                        >
                            リセット
                        </button>
                    </div>
                </form>
            </div>

            {/* ティア表メインビュー */}
            <div class="w-full card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
                <div class="divide-y divide-base-300">
                    <For each={tiers()}>
                        {(tier, index) => (
                            <div
                                class={`flex flex-col sm:flex-row items-stretch transition-colors min-h-[104px] ${dragOverTierId() === tier.id ? "bg-base-200/50" : ""}`}
                                onDragOver={(e) => handleDragOver(e, tier.id)}
                                onDragLeave={() => setDragOverTierId(null)}
                                onDrop={(e) => handleDrop(e, tier.id)}
                            >
                                {/* 左側：ティアラベル & 操作 */}
                                <div
                                    class="w-full sm:w-36 md:w-44 p-3 flex sm:flex-col items-center justify-between gap-2 shrink-0 select-none"
                                    style={{ "background-color": tier.color() }}
                                >
                                    <div class="flex-1 w-full flex items-center justify-center">
                                        <input
                                            type="text"
                                            value={tier.label()}
                                            onInput={(e) =>
                                                tier.setLabel(e.currentTarget.value)
                                            }
                                            class="w-full font-black text-center bg-transparent border-b border-transparent hover:border-current focus:border-current focus:outline-none text-lg md:text-xl px-1"
                                            style={{
                                                color: getContrastTextColor(tier.color()),
                                            }}
                                            aria-label={`${tier.label()} ランクのラベル名`}
                                        />
                                    </div>

                                    {/* ランク操作ボタン群 */}
                                    <div class="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => moveTier(index(), "up")}
                                            disabled={index() === 0}
                                            class="btn btn-xs btn-ghost p-1 opacity-75 hover:opacity-100"
                                            style={{ color: getContrastTextColor(tier.color()) }}
                                            aria-label={`${tier.label()} ランクを1つ上に移動`}
                                            title="上へ移動"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveTier(index(), "down")}
                                            disabled={index() === tiers().length - 1}
                                            class="btn btn-xs btn-ghost p-1 opacity-75 hover:opacity-100"
                                            style={{ color: getContrastTextColor(tier.color()) }}
                                            aria-label={`${tier.label()} ランクを1つ下に移動`}
                                            title="下へ移動"
                                        >
                                            ▼
                                        </button>
                                        {/* 色変更 */}
                                        <input
                                            type="color"
                                            value={tier.color()}
                                            onInput={(e) =>
                                                tier.setColor(e.currentTarget.value)
                                            }
                                            class="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                                            aria-label={`${tier.label()} ランクの背景色を変更`}
                                            title="色を変更"
                                        />
                                        {/* 削除 */}
                                        <button
                                            type="button"
                                            onClick={() => removeTier(tier.id)}
                                            class="btn btn-xs btn-ghost p-1 text-error opacity-75 hover:opacity-100"
                                            style={{ color: getContrastTextColor(tier.color()) }}
                                            aria-label={`${tier.label()} ランクを削除`}
                                            title="ランクを削除"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                {/* 右側：アイテム配置ドロップ領域 */}
                                <div class="flex-1 p-3 flex flex-wrap items-center gap-3 bg-base-200/20">
                                    <For
                                        each={items().filter((it) => it.tierId === tier.id)}
                                    >
                                        {(item) => {
                                            const subInfo = getSubTierInfo(item.subTier);
                                            return (
                                                <div
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(item.id, e)}
                                                    onClick={() => setSelectedItemId(item.id)}
                                                    class={`relative group w-20 h-20 rounded-md border border-base-300 shadow-sm cursor-grab active:cursor-grabbing select-none transition-transform duration-150 flex items-center justify-center p-1 overflow-visible ${subInfo.translateYClass} ${selectedItemId() === item.id ? "ring-2 ring-primary" : ""}`}
                                                    title={`${item.label} (${subInfo.ariaLabel})`}
                                                >
                                                    {/* アイテム本体表示（画像 or テキスト） */}
                                                    <Show
                                                        when={item.type === "image" && item.imageUrl}
                                                        fallback={
                                                            <div
                                                                class="w-full h-full rounded flex items-center justify-center text-center p-1 text-xs font-bold leading-tight break-words select-none"
                                                                style={{
                                                                    "background-color":
                                                                        item.bgColor || "#374151",
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
                                                            class="w-full h-full object-cover rounded pointer-events-none"
                                                        />
                                                    </Show>

                                                    {/* サブティア (+ / -) バッジ表示 */}
                                                    <Show when={subInfo.badgeText}>
                                                        <span
                                                            class={`absolute z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border border-white ${subInfo.badgeBgClass} ${item.subTier === "plus" ? "-top-2 -right-2" : "-bottom-2 -right-2"}`}
                                                        >
                                                            {subInfo.badgeText}
                                                        </span>
                                                    </Show>

                                                    {/* ホバー時クイック操作バー（+ / 通常 / -） */}
                                                    <div class="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-0.5 bg-base-300 rounded px-1 py-0.5 shadow-md z-20 whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleSubTier(item.id, "plus");
                                                            }}
                                                            class={`btn btn-xs px-1 min-h-0 h-5 text-[10px] ${item.subTier === "plus" ? "btn-success text-white" : "btn-ghost"}`}
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
                                                            class={`btn btn-xs px-1 min-h-0 h-5 text-[10px] ${item.subTier === "normal" ? "btn-neutral text-white" : "btn-ghost"}`}
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
                                                            class={`btn btn-xs px-1 min-h-0 h-5 text-[10px] ${item.subTier === "minus" ? "btn-warning text-white" : "btn-ghost"}`}
                                                            aria-label="下寄りに設定 (A-)"
                                                            title="下寄り (-)"
                                                        >
                                                            -
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>

                                    <Show
                                        when={
                                            items().filter((it) => it.tierId === tier.id).length === 0
                                        }
                                    >
                                        <div class="text-xs text-base-content/70 italic py-4 px-2">
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
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* アイテム追加フォーム */}
                <div class="card bg-base-100 border border-base-300 shadow-sm p-4 space-y-4">
                    <h2 class="text-lg font-bold text-base-content flex items-center justify-between">
                        <span>アイテムを追加</span>
                    </h2>

                    {/* テキストアイテム追加 */}
                    <form onSubmit={handleAddTextItems} class="space-y-2">
                        <label for="text-items-input" class="text-xs font-semibold block text-base-content/80">
                            文字・単語を追加（改行で複数一括登録可）:
                        </label>
                        <textarea
                            id="text-items-input"
                            value={textInput()}
                            onInput={(e) => setTextInput(e.currentTarget.value)}
                            placeholder="アイテム名（例: キャラ名、曲名、単語など）"
                            class="textarea textarea-bordered w-full h-20 text-sm"
                            aria-label="追加するテキストアイテム名"
                        />
                        <button
                            type="submit"
                            class="btn btn-outline btn-sm w-full"
                        >
                            + テキストを追加
                        </button>
                    </form>

                    <div class="divider my-1 text-xs text-base-content/60">または</div>

                    {/* 画像アイテム追加 */}
                    <div class="space-y-2">
                        <label class="text-xs font-semibold block text-base-content/80">
                            画像ファイルを追加（複数可）:
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleAddImages(e.currentTarget.files)}
                            class="file-input file-input-bordered file-input-sm w-full"
                            aria-label="画像ファイルを選択して追加"
                        />
                        <p class="text-[11px] text-base-content/60">
                            ※ 画像はサーバーへ送信されず、お使いの端末内だけで安全に処理されます。
                        </p>
                    </div>
                </div>

                {/* 未分類アイテムプール */}
                <div class="md:col-span-2 card bg-base-100 border border-base-300 shadow-sm p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-bold text-base-content">
                            未分類アイテムプール ({poolItems().length})
                        </h2>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleResetToPool}
                                class="btn btn-ghost btn-xs text-base-content/70"
                            >
                                全てプールに戻す
                            </button>
                        </div>
                    </div>

                    <div
                        class={`min-h-[140px] p-3 rounded-lg border-2 border-dashed border-base-300 flex flex-wrap gap-3 items-center content-start bg-base-200/30 transition-colors ${dragOverTierId() === "pool" ? "border-primary bg-primary/5" : ""}`}
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
                                    class={`relative group w-18 h-18 rounded border border-base-300 shadow-xs cursor-grab active:cursor-grabbing select-none flex items-center justify-center p-1 ${selectedItemId() === item.id ? "ring-2 ring-primary" : ""}`}
                                    title={`${item.label} (未分類)`}
                                >
                                    <Show
                                        when={item.type === "image" && item.imageUrl}
                                        fallback={
                                            <div
                                                class="w-full h-full rounded flex items-center justify-center text-center p-1 text-xs font-bold leading-tight break-words select-none"
                                                style={{
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
                                            class="w-full h-full object-cover rounded pointer-events-none"
                                        />
                                    </Show>

                                    {/* ホバー時削除ボタン */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteItem(item.id);
                                        }}
                                        class="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 rounded-full bg-error text-white items-center justify-center text-[10px]"
                                        aria-label={`${item.label} を削除`}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </For>

                        <Show when={poolItems().length === 0}>
                            <div class="w-full py-8 text-center text-xs text-base-content/70">
                                未分類のアイテムはありません。上のフォームから画像やテキストを追加してください。
                            </div>
                        </Show>
                    </div>

                    {/* 選択アイテムのクイック操作（モバイル・キーボード対応） */}
                    <Show when={selectedItem()}>
                        {(item) => (
                            <div class="mt-3 p-3 rounded-lg bg-base-200/60 border border-base-300 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold">選択中:</span>
                                    <span class="badge badge-neutral">{item().label}</span>
                                </div>

                                <div class="flex flex-wrap items-center gap-2">
                                    {/* 配置先ランク移動 */}
                                    <span class="text-base-content/70">配置先:</span>
                                    <select
                                        value={item().tierId || "pool"}
                                        onChange={(e) => {
                                            const val = e.currentTarget.value;
                                            moveItemToTier(item().id, val === "pool" ? null : val);
                                        }}
                                        class="select select-bordered select-xs"
                                        aria-label="選択中アイテムの配置先ランク"
                                    >
                                        <option value="pool">未分類プール</option>
                                        <For each={tiers()}>
                                            {(t) => <option value={t.id}>{t.label()} ランク</option>}
                                        </For>
                                    </select>

                                    {/* サブティア微調整 */}
                                    <span class="text-base-content/70 ml-2">微調整:</span>
                                    <div class="join">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubTier(item().id, "plus")}
                                            class={`join-item btn btn-xs ${item().subTier === "plus" ? "btn-success text-white" : "btn-outline"}`}
                                            aria-label="選択中アイテムを上寄りに設定 (+)"
                                        >
                                            + (上寄り)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubTier(item().id, "normal")}
                                            class={`join-item btn btn-xs ${item().subTier === "normal" ? "btn-neutral text-white" : "btn-outline"}`}
                                            aria-label="選択中アイテムを中央に設定 (通常)"
                                        >
                                            通常
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubTier(item().id, "minus")}
                                            class={`join-item btn btn-xs ${item().subTier === "minus" ? "btn-warning text-white" : "btn-outline"}`}
                                            aria-label="選択中アイテムを下寄りに設定 (-)"
                                        >
                                            - (下寄り)
                                        </button>
                                    </div>

                                    {/* 削除 */}
                                    <button
                                        type="button"
                                        onClick={() => deleteItem(item().id)}
                                        class="btn btn-ghost btn-xs text-error ml-2"
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
            <div class="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4">
                <h2 class="text-xl font-bold text-base-content">
                    ティア表作成ツールの使い方と便利な機能
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-base-content/80">
                    <div class="space-y-1">
                        <h3 class="font-bold text-base-content">1. 自由なランク数とカスタマイズ</h3>
                        <p>
                            「+ ランク追加」ボタンで好きな数だけ段を増減できます。段のラベル名や背景色はお好みに合わせて自由に変更可能です。
                        </p>
                    </div>
                    <div class="space-y-1">
                        <h3 class="font-bold text-base-content">2. 画像と文字の混在配置</h3>
                        <p>
                            手持ちの画像を複数一括でアップロードしたり、テキストを入力してカードとして並べたり、文字と画像を混在させて自由に配置できます。
                        </p>
                    </div>
                    <div class="space-y-1">
                        <h3 class="font-bold text-base-content">3. 「+」「-」上下微調整オプション</h3>
                        <p>
                            各アイテムカードの「+」「-」ボタンを押すと、同じランク内でも少し上にずらして「A+」、下にずらして「A-」といった細かな優劣・強弱を直感的に表現できます。
                        </p>
                    </div>
                </div>
            </div>

            {/* エクスポート画像プレビューモーダル */}
            <dialog ref={previewModalRef} class="modal">
                <div class="modal-box max-w-4xl p-4 space-y-4">
                    <h3 class="font-bold text-lg">ティア表画像のプレビュー</h3>
                    <div class="max-h-[65vh] overflow-auto border border-base-300 rounded-lg p-2 bg-base-200 flex justify-center">
                        <Show when={exportImageUrl()}>
                            {(url) => (
                                <img
                                    src={url()}
                                    alt="エクスポートされたティア表画像プレビュー"
                                    class="max-w-full h-auto rounded shadow-sm"
                                />
                            )}
                        </Show>
                    </div>
                    <div class="modal-action flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => previewModalRef?.close()}
                            class="btn btn-ghost btn-sm"
                        >
                            閉じる
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPng}
                            class="btn btn-primary btn-sm"
                        >
                            PNG画像をダウンロード
                        </button>
                    </div>
                </div>
                <div
                    class="modal-backdrop bg-black/50"
                    onClick={() => previewModalRef?.close()}
                />
            </dialog>

            {/* 広告エリア */}
            <AdSense />
        </div>
    );
}
