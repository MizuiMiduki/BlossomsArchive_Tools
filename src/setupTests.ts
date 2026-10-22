import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import gsap from "gsap";

// 1. window.matchMedia mock
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// 2. HTMLDialogElement mock (jsdom lacks dialog support)
if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
}

// 3. jsdom の getComputedStyle がアンマウント済み要素でクラッシュするのを防ぐ安全パッチ
const origGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
    try {
        return origGetComputedStyle(elt, pseudoElt);
    } catch {
        return (elt as HTMLElement).style || ({} as CSSStyleDeclaration);
    }
};

// 4. 各テスト終了時に GSAP のアクティブなトゥイーンをすべて停止
afterEach(() => {
    gsap.killTweensOf("*");
});
