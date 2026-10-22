/**
 * BudouX (Google の機械学習ベースの日本語分かち書き器) ラッパー
 * 自然な文節単位での改行（ワードラップ）を提供します。
 */
import { loadDefaultJapaneseParser, HTMLProcessingParser } from "budoux";

let parserInstance: HTMLProcessingParser | null = null;

export function getBudouXParser(): HTMLProcessingParser {
    if (!parserInstance) {
        parserInstance = loadDefaultJapaneseParser();
    }
    return parserInstance;
}

/**
 * 対象の DOM 要素に BudouX を適用します。
 * 要素に `word-break: keep-all; overflow-wrap: anywhere;` を付与し、
 * 文節ごとにゼロ幅スペース(U+200B)を挿入して自然な改行を実現します。
 */
export function applyBudouX(el: HTMLElement): void {
    if (!el) return;
    try {
        const parser = getBudouXParser();
        parser.applyToElement(el);
    } catch (e) {
        console.warn("BudouX apply error:", e);
    }
}

/**
 * 文字列を文節ごとの配列に分割します。
 */
export function parseBudouX(text: string): string[] {
    if (!text) return [];
    const parser = getBudouXParser();
    return parser.parse(text);
}

/**
 * Solid.js カスタムディレクティブ
 * 使用法: `<p use:budoux>長いテキスト...</p>`
 */
export function budoux(el: Element) {
    if (el instanceof HTMLElement) {
        applyBudouX(el);
    }
}

// Solid.js の JSX 名前空間拡張（use:budoux の型定義）
declare module "solid-js" {
    namespace JSX {
        interface Directives {
            budoux: boolean | undefined;
        }
    }
}
