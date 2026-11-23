import { routes, type Route } from "../routes";

export type ToolCategoryId = "all" | "camera" | "utility" | "developer" | "audio";

export interface CategoryDefinition {
    id: ToolCategoryId;
    name: string;
    icon: string;
    badgeClass: string;
}

export const CATEGORIES: CategoryDefinition[] = [
    { id: "all", name: "すべて", icon: "🌟", badgeClass: "badge-ghost border-base-300 text-base-content font-bold" },
    { id: "camera", name: "写真・カメラ", icon: "📷", badgeClass: "bg-blue-700 text-white font-bold border-transparent" },
    { id: "utility", name: "日常・便利", icon: "🛠️", badgeClass: "bg-emerald-700 text-white font-bold border-transparent" },
    { id: "developer", name: "開発者・Web", icon: "💻", badgeClass: "bg-purple-700 text-white font-bold border-transparent" },
    { id: "audio", name: "音響・オーディオ", icon: "🎵", badgeClass: "bg-amber-700 text-white font-bold border-transparent" },
];

export const TOOL_CATEGORIES_CONFIG: Record<string, { category: ToolCategoryId; icon: string }> = {
    // 日常・便利ツール
    "/calculator": { category: "utility", icon: "🔢" },
    "/qr_code": { category: "utility", icon: "📱" },
    "/password-generator": { category: "utility", icon: "🔑" },
    "/lottery": { category: "utility", icon: "🎲" },
    "/word-counter": { category: "utility", icon: "📝" },
    "/clock": { category: "utility", icon: "⏰" },
    "/timer": { category: "utility", icon: "⏱️" },

    // 写真・カメラ・メディア
    "/exif-frame": { category: "camera", icon: "🖼️" },
    "/exposure-calculator": { category: "camera", icon: "📷" },
    "/timelapse-calculator": { category: "camera", icon: "⏳" },
    "/hyperfocal": { category: "camera", icon: "📐" },
    "/image_conversion": { category: "camera", icon: "🎨" },
    "/video-compressor": { category: "camera", icon: "🎬" },

    // 開発者・Web制作
    "/json-formatter": { category: "developer", icon: "⚙️" },
    "/charset-converter": { category: "developer", icon: "🔤" },
    "/text-converter": { category: "developer", icon: "📑" },
    "/ogp-checker": { category: "developer", icon: "🌐" },
    "/seo-checker": { category: "developer", icon: "🔍" },
    "/access-info": { category: "developer", icon: "📡" },

    // 音響・オーディオ
    "/bpm-calculator": { category: "audio", icon: "🎵" },
    "/headphone-driveability": { category: "audio", icon: "🎧" },
};

export function getToolIcon(path: string): string {
    return TOOL_CATEGORIES_CONFIG[path]?.icon || "🔧";
}

export function getToolCategory(path: string): CategoryDefinition {
    const catId = TOOL_CATEGORIES_CONFIG[path]?.category || "utility";
    return CATEGORIES.find((c) => c.id === catId) || CATEGORIES[1];
}

export function getRoutesByCategory(routesList: Route[], categoryId: ToolCategoryId): Route[] {
    if (categoryId === "all") return routesList;
    return routesList.filter((r) => TOOL_CATEGORIES_CONFIG[r.path]?.category === categoryId);
}
