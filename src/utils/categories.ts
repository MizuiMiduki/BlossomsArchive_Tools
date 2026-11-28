import { routes, type Route } from "../routes";
import type { ToolIconName } from "../components/ToolIcon";

export type ToolCategoryId = "all" | "camera" | "utility" | "developer" | "audio";

export interface CategoryDefinition {
    id: ToolCategoryId;
    name: string;
    icon: ToolIconName;
    badgeClass: string;
}

export const CATEGORIES: CategoryDefinition[] = [
    { id: "all", name: "すべて", icon: "grid", badgeClass: "ba-badge ba-badge--neutral" },
    { id: "camera", name: "写真・カメラ", icon: "camera", badgeClass: "ba-badge ba-badge--camera" },
    { id: "utility", name: "日常・便利", icon: "wrench", badgeClass: "ba-badge ba-badge--utility" },
    { id: "developer", name: "開発者・Web", icon: "code", badgeClass: "ba-badge ba-badge--developer" },
    { id: "audio", name: "音響・オーディオ", icon: "music", badgeClass: "ba-badge ba-badge--audio" },
];

export const TOOL_CATEGORIES_CONFIG: Record<string, { category: ToolCategoryId; icon: ToolIconName }> = {
    // 日常・便利ツール
    "/calculator": { category: "utility", icon: "calculator" },
    "/qr_code": { category: "utility", icon: "qr" },
    "/password-generator": { category: "utility", icon: "key" },
    "/lottery": { category: "utility", icon: "shuffle" },
    "/word-counter": { category: "utility", icon: "text" },
    "/tier-maker": { category: "utility", icon: "trophy" },
    "/clock": { category: "utility", icon: "clock" },
    "/timer": { category: "utility", icon: "timer" },

    // 写真・カメラ・メディア
    "/ar-camera": { category: "camera", icon: "camera" },
    "/photo-composite": { category: "camera", icon: "image" },
    "/exif-frame": { category: "camera", icon: "frame" },
    "/exposure-calculator": { category: "camera", icon: "camera" },
    "/timelapse-calculator": { category: "camera", icon: "hourglass" },
    "/hyperfocal": { category: "camera", icon: "ruler" },
    "/image_conversion": { category: "camera", icon: "image" },
    "/video-compressor": { category: "camera", icon: "video" },
    "/mosaic-art": { category: "camera", icon: "grid" },

    // 開発者・Web制作
    "/json-formatter": { category: "developer", icon: "code" },
    "/json-ld-viewer": { category: "developer", icon: "braces" },
    "/sitemap-visualizer": { category: "developer", icon: "sitemap" },
    "/charset-converter": { category: "developer", icon: "type" },
    "/text-converter": { category: "developer", icon: "file-text" },
    "/ogp-checker": { category: "developer", icon: "globe" },
    "/seo-checker": { category: "developer", icon: "search" },
    "/access-info": { category: "developer", icon: "radio" },

    // 音響・オーディオ
    "/bpm-calculator": { category: "audio", icon: "music" },
    "/headphone-driveability": { category: "audio", icon: "headphones" },
};

export function getToolIcon(path: string): ToolIconName {
    return TOOL_CATEGORIES_CONFIG[path]?.icon || "wrench";
}

export function getToolCategory(path: string): CategoryDefinition {
    const catId = TOOL_CATEGORIES_CONFIG[path]?.category || "utility";
    return CATEGORIES.find((c) => c.id === catId) || CATEGORIES[1];
}

export function getRoutesByCategory(routesList: Route[], categoryId: ToolCategoryId): Route[] {
    if (categoryId === "all") return routesList;
    return routesList.filter((r) => TOOL_CATEGORIES_CONFIG[r.path]?.category === categoryId);
}
