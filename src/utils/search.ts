import type { Route } from "../routes";

/**
 * ひらがなをカタカナに変換
 */
export function toKatakana(str: string): string {
    return str.replace(/[\u3041-\u3096]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) + 0x60)
    );
}

/**
 * カタカナをひらがなに変換
 */
export function toHiragana(str: string): string {
    return str.replace(/[\u30a1-\u30f6]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
}

/**
 * ツール（Route）が検索キーワードにマッチするか判定する
 * タイトル、説明文、パス、キーワード配列を対象に、大文字小文字・ひらがなカタカナを吸収して検索
 */
export function filterRoutesByQuery(routesList: Route[], query: string): Route[] {
    const rawQ = query.trim();
    if (!rawQ) return routesList;

    const lowerQ = rawQ.toLowerCase();
    const hiraQ = toHiragana(lowerQ);
    const kataQ = toKatakana(lowerQ);

    return routesList.filter((route) => {
        const fullText = [
            route.title,
            route.description,
            route.path,
            ...(route.keywords ?? []),
        ]
            .join(" ")
            .toLowerCase();

        if (fullText.includes(lowerQ)) return true;

        const fullHira = toHiragana(fullText);
        const fullKata = toKatakana(fullText);

        return (
            fullText.includes(hiraQ) ||
            fullText.includes(kataQ) ||
            fullHira.includes(hiraQ) ||
            fullKata.includes(kataQ)
        );
    });
}
