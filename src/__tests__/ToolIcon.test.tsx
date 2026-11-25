import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import ToolIcon, { type ToolIconName } from "../components/ToolIcon";

describe("ToolIcon Component", () => {
    afterEach(() => {
        cleanup();
    });

    it("代表的なアイコン名ごとに単色SVGをaria-hidden付きで描画すること", () => {
        const names: ToolIconName[] = [
            "grid",
            "camera",
            "wrench",
            "code",
            "music",
            "braces",
            "globe",
            "search",
            "sun",
            "moon",
            "volume-on",
            "volume-off",
            "alert",
        ];

        for (const name of names) {
            const { container } = render(() => <ToolIcon name={name} class="w-5 h-5" />);
            const svg = container.querySelector("svg");
            expect(svg).not.toBeNull();
            expect(svg?.getAttribute("aria-hidden")).toBe("true");
            expect(svg?.getAttribute("width")).toBe("24");
            expect(svg?.getAttribute("height")).toBe("24");
            expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
            expect(svg?.getAttribute("stroke")).toBe("currentColor");
            expect(svg?.getAttribute("class")).toContain("w-5 h-5");
            cleanup();
        }
    });

    it("未知のアイコン名でもフォールバックSVGを描画すること", () => {
        const { container } = render(() => <ToolIcon name="unknown-icon" />);
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        expect(svg?.querySelector("path")).not.toBeNull();
    });
});
