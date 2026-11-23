/**
 * ティア表作成ツール (Tier List Maker) ユーティリティ
 */

import { createSignal } from "solid-js";

export type SubTier = "plus" | "normal" | "minus";
export type ItemType = "image" | "text";

export interface Tier {
    id: string;
    label: string;
    color: string;
}

/**
 * リレンダー時のフォーカス喪失を防止する Fine-grained Reactive Tier モデル
 */
export interface TierModel {
    id: string;
    label: () => string;
    setLabel: (val: string) => void;
    color: () => string;
    setColor: (val: string) => void;
}

export function createTierModel(
    id: string,
    initialLabel: string,
    initialColor: string,
): TierModel {
    const [label, setLabel] = createSignal(initialLabel);
    const [color, setColor] = createSignal(initialColor);
    return {
        id,
        label,
        setLabel,
        color,
        setColor,
    };
}

export interface TierItem {
    id: string;
    type: ItemType;
    tierId: string | null; // null = 未分類・未配置プール
    subTier: SubTier; // plus (+), normal, minus (-)
    label: string;
    imageUrl?: string;
    bgColor?: string;
}

export interface TierListState {
    title: string;
    tiers: Tier[];
    items: TierItem[];
}

export const PRESET_COLORS = [
    "#ff7f7f", // 赤
    "#ffbf7f", // オレンジ
    "#ffff7f", // 黄
    "#7fff7f", // 黄緑
    "#7fbfff", // 水色
    "#7f7fff", // 青
    "#ff7fff", // ピンク
    "#bf7fff", // 紫
    "#9ca3af", // グレー
    "#374151", // ダークグレー
];

export const DEFAULT_TIERS: Tier[] = [
    { id: "tier-s", label: "S", color: "#ff7f7f" },
    { id: "tier-a", label: "A", color: "#ffbf7f" },
    { id: "tier-b", label: "B", color: "#ffff7f" },
    { id: "tier-c", label: "C", color: "#7fff7f" },
    { id: "tier-d", label: "D", color: "#7fbfff" },
];

/**
 * 視認性の高い文字色（白 or 黒）を背景色の輝度から自動計算 (WCAG AA基準)
 */
export function getContrastTextColor(hexColor: string): string {
    const cleanHex = hexColor.replace(/^#/, "");
    if (cleanHex.length !== 6 && cleanHex.length !== 3) {
        return "#111827";
    }

    let r = 0;
    let g = 0;
    let b = 0;

    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
    }

    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
        return "#111827";
    }

    // 相対輝度計算 (YIQ formula)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? "#111827" : "#ffffff";
}

/**
 * 一意なIDの安全な生成
 */
export function generateTierId(prefix: string = "id"): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    const rand = Math.floor(Math.random() * 1000000);
    return `${prefix}-${Date.now()}-${rand}`;
}

/**
 * サブティアの巡回トグル ("normal" -> "plus" -> "minus" -> "normal")
 */
export function cycleSubTier(current: SubTier): SubTier {
    if (current === "normal") return "plus";
    if (current === "plus") return "minus";
    return "normal";
}

/**
 * サブティアに応じたラベルとオフセット
 */
export function getSubTierInfo(subTier: SubTier): {
    badgeText: string;
    ariaLabel: string;
    translateYClass: string;
    badgeBgClass: string;
    offsetPx: number;
} {
    switch (subTier) {
        case "plus":
            return {
                badgeText: "+",
                ariaLabel: "上寄り (+)",
                translateYClass: "-translate-y-2",
                badgeBgClass: "bg-emerald-600 text-white",
                offsetPx: -8,
            };
        case "minus":
            return {
                badgeText: "-",
                ariaLabel: "下寄り (-)",
                translateYClass: "translate-y-2",
                badgeBgClass: "bg-amber-600 text-white",
                offsetPx: 8,
            };
        case "normal":
        default:
            return {
                badgeText: "",
                ariaLabel: "通常 (中央)",
                translateYClass: "translate-y-0",
                badgeBgClass: "",
                offsetPx: 0,
            };
    }
}

/**
 * 画像の非同期ロード
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        img.src = src;
    });
}

/**
 * Canvasに角丸矩形を描画する互換関数
 */
function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        return;
    }
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

/**
 * テキストの複数行自動折り返し描画
 */
function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number = 3,
) {
    const chars = Array.from(text);
    let line = "";
    const lines: string[] = [];

    for (let i = 0; i < chars.length; i++) {
        const testLine = line + chars[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            lines.push(line);
            line = chars[i];
            if (lines.length >= maxLines - 1) {
                // 最大行数に達した場合は省略記号付与
                const remaining = chars.slice(i).join("");
                line = remaining.length > 3 ? remaining.slice(0, 3) + "…" : remaining;
                break;
            }
        } else {
            line = testLine;
        }
    }
    if (line.length > 0) {
        lines.push(line);
    }

    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], x, startY + j * lineHeight);
    }
}

/**
 * ティア表をCanvasにエクスポート描画する
 */
export async function renderTierListToCanvas(
    canvas: HTMLCanvasElement,
    state: TierListState,
): Promise<void> {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context is not available");

    // 画像のプリロード
    const imageMap = new Map<string, HTMLImageElement>();
    const imageLoadPromises = state.items
        .filter((item) => item.type === "image" && item.imageUrl)
        .map(async (item) => {
            try {
                const img = await loadImage(item.imageUrl!);
                imageMap.set(item.id, img);
            } catch {
                // 画像読み込み失敗時は描画時にプレースホルダー対応
            }
        });

    await Promise.all(imageLoadPromises);

    const scale = 2; // 高解像度レンダリング (Retina対応)
    const exportWidth = 1000;
    const tierLabelWidth = 140;
    const itemAreaWidth = exportWidth - tierLabelWidth;

    const itemSize = 80;
    const itemGap = 10;
    const minTierHeight = 100;
    const titleHeight = state.title.trim().length > 0 ? 60 : 0;
    const footerHeight = 28;

    // 各ティアの行のアイテム配置計算
    const itemsPerRow = Math.max(1, Math.floor((itemAreaWidth - itemGap) / (itemSize + itemGap)));

    const tierLayouts = state.tiers.map((tier) => {
        const tierItems = state.items.filter((item) => item.tierId === tier.id);
        const rowsCount = Math.max(1, Math.ceil(tierItems.length / itemsPerRow));
        const rowHeight = Math.max(minTierHeight, rowsCount * (itemSize + itemGap) + itemGap + 16);
        return {
            tier,
            items: tierItems,
            height: rowHeight,
        };
    });

    const totalTiersHeight = tierLayouts.reduce((acc, curr) => acc + curr.height, 0);
    const totalHeight = titleHeight + totalTiersHeight + footerHeight;

    canvas.width = exportWidth * scale;
    canvas.height = totalHeight * scale;
    ctx.scale(scale, scale);

    // 全体背景
    ctx.fillStyle = "#111827"; // ダークテーマ基準背景
    ctx.fillRect(0, 0, exportWidth, totalHeight);

    let currentY = 0;

    // タイトル描画
    if (titleHeight > 0) {
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(0, 0, exportWidth, titleHeight);

        ctx.fillStyle = "#f9fafb";
        ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(state.title.trim(), exportWidth / 2, titleHeight / 2);

        // 区切り線
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, titleHeight);
        ctx.lineTo(exportWidth, titleHeight);
        ctx.stroke();

        currentY += titleHeight;
    }

    // 各ティアの描画
    for (const layout of tierLayouts) {
        const { tier, items, height } = layout;

        // ティア行の枠線
        ctx.fillStyle = "#18202f";
        ctx.fillRect(0, currentY, exportWidth, height);

        // ティアラベル背景
        ctx.fillStyle = tier.color;
        ctx.fillRect(0, currentY, tierLabelWidth, height);

        // ティアラベルテキスト
        ctx.fillStyle = getContrastTextColor(tier.color);
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        drawWrappedText(
            ctx,
            tier.label,
            tierLabelWidth / 2,
            currentY + height / 2,
            tierLabelWidth - 20,
            26,
            3,
        );

        // アイテム描画
        items.forEach((item, idx) => {
            const col = idx % itemsPerRow;
            const row = Math.floor(idx / itemsPerRow);

            const itemX = tierLabelWidth + itemGap + col * (itemSize + itemGap);
            const baseY = currentY + itemGap + 8 + row * (itemSize + itemGap);

            // サブティアの上下オフセット
            const { offsetPx, badgeText, badgeBgClass } = getSubTierInfo(item.subTier);
            const itemY = baseY + offsetPx;

            ctx.save();

            // カード外枠シャドウ & 背景
            ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;

            if (item.type === "image" && imageMap.has(item.id)) {
                const img = imageMap.get(item.id)!;
                // 角丸クリッピング
                drawRoundedRect(ctx, itemX, itemY, itemSize, itemSize, 6);
                ctx.clip();

                // object-fit: cover 計算
                const imgAspect = img.width / img.height;
                let sWidth = img.width;
                let sHeight = img.height;
                let sx = 0;
                let sy = 0;

                if (imgAspect > 1) {
                    sWidth = img.height;
                    sx = (img.width - sWidth) / 2;
                } else {
                    sHeight = img.width;
                    sy = (img.height - sHeight) / 2;
                }

                ctx.drawImage(img, sx, sy, sWidth, sHeight, itemX, itemY, itemSize, itemSize);
            } else {
                // テキストカードまたは画像なし
                drawRoundedRect(ctx, itemX, itemY, itemSize, itemSize, 6);
                ctx.fillStyle = item.bgColor || "#374151";
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                drawWrappedText(
                    ctx,
                    item.label || "Item",
                    itemX + itemSize / 2,
                    itemY + itemSize / 2,
                    itemSize - 8,
                    16,
                    4,
                );
            }

            ctx.restore();

            // カード枠線
            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, itemX, itemY, itemSize, itemSize, 6);
            ctx.stroke();
            ctx.restore();

            // サブティアバッジ (+ / -) 描画
            if (badgeText) {
                ctx.save();
                const badgeRadius = 9;
                let badgeX = itemX + itemSize - badgeRadius;
                let badgeY = itemY + badgeRadius;

                if (item.subTier === "minus") {
                    badgeY = itemY + itemSize - badgeRadius;
                }

                ctx.fillStyle = item.subTier === "plus" ? "#10b981" : "#f59e0b";
                ctx.beginPath();
                ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(badgeText, badgeX, badgeY + (item.subTier === "plus" ? 0.5 : -0.5));
                ctx.restore();
            }
        });

        // ティア下部の区切り線
        ctx.strokeStyle = "#2d3748";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, currentY + height);
        ctx.lineTo(exportWidth, currentY + height);
        ctx.stroke();

        currentY += height;
    }

    // フッター (ウォーターマーク)
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, currentY, exportWidth, footerHeight);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("BlossomsArchive Tools - tools.blossomsarchive.com", exportWidth - 12, currentY + footerHeight / 2);
}
