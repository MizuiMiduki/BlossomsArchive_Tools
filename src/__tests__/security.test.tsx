import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { markdownToHtml, htmlToPlainText } from "../utils/textConverter";
import { createSafeObjectUrl } from "../utils/videoCompressor";
import {
    parseSeoFromHtml,
    stripHtmlTagsToPlainText,
} from "../pages/SeoChecker";
import { parseOgpFromHtml } from "../pages/OgpChecker";
import Calculator from "../pages/Calculator";
import TextConverter from "../pages/TextConverter";
import PasswordGenerator from "../pages/PasswordGenerator";
import Lottery from "../pages/Lottery";
import Credits from "../pages/Credits";

describe("Security Tests (XSS, Sanitization, Code Injection, CSPRNG & Headers)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("XSS防止: TextConverter の Markdown->HTML 変換およびプレビュー描画で <script>, <iframe>, onerror, javascript: スキームが完全に無害化されること", () => {
        const maliciousInput = [
            "# 安全な見出し",
            '<script>window.__xss_executed = true;</script>',
            '<img src="x" onerror="alert(1)" onload="alert(2)" />',
            '<iframe src="https://evil.example.com"></iframe>',
            '[悪意のあるリンク](javascript:alert(document.cookie))',
            '[データURL攻撃](data:text/html,<script>alert(1)</script>)',
            '<a href="   jAvAsCrIpT:alert(1)" onclick="steal()">クリック</a>',
        ].join("\n\n");

        const sanitizedHtml = markdownToHtml(maliciousInput);
        expect(sanitizedHtml.toLowerCase()).not.toContain("<script");
        expect(sanitizedHtml.toLowerCase()).not.toContain("<iframe");
        // 生のHTMLタグ属性ではなくエンティティエスケープされていること
        expect(sanitizedHtml.toLowerCase()).not.toMatch(/<img[^>]*onerror/);
        expect(sanitizedHtml.toLowerCase()).not.toMatch(/<a[^>]*onclick/);
        expect(sanitizedHtml.toLowerCase()).not.toContain('href="javascript:');
        expect(sanitizedHtml.toLowerCase()).not.toContain('href="data:text/html');

        // TextConverter コンポーネントのHTMLプレビューでも危険な要素が一切DOMに生成されないこと
        const { container } = render(() => <TextConverter />);
        fireEvent.click(
            screen.getByRole("button", { name: /Markdown → HTML/ }),
        );
        const textarea = screen.getByPlaceholderText(
            /変換したいテキスト/,
        ) as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: maliciousInput } });

        const previewBtns = screen
            .getAllByRole("button")
            .filter((b) => b.textContent?.includes("HTMLプレビュー"));
        if (previewBtns.length > 0) {
            fireEvent.click(previewBtns[0]);
        }

        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("iframe")).toBeNull();
        const allElements = Array.from(container.querySelectorAll("*"));
        for (const el of allElements) {
            for (const attr of Array.from(el.attributes)) {
                expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
                if (attr.name === "href" || attr.name === "src") {
                    const val = attr.value.trim().toLowerCase();
                    expect(
                        val.startsWith("javascript:") ||
                            val.startsWith("data:") ||
                            val.startsWith("vbscript:"),
                    ).toBe(false);
                }
            }
        }
    });

    it("多段入れ子タグ除去の安全性: stripHtmlTagsToPlainText と htmlToPlainText が <<<script>script> ペイロードから山括弧を完全に除去すること", () => {
        const payloads = [
            "<<script>script>alert(1)<</script>/script>",
            "<<<script>script>confirm(1)</script>",
            "<!<!--- comment --->><img src=x onerror=alert(1)>安全なテキスト",
            "<scr<script>ipt>alert(1)</scr</script>ipt>見出し",
        ];

        for (const payload of payloads) {
            const plain1 = stripHtmlTagsToPlainText(payload);
            expect(plain1).not.toContain("<");
            expect(plain1).not.toContain(">");
            expect(plain1.toLowerCase()).not.toContain("<script");

            const plain2 = htmlToPlainText(payload);
            expect(plain2).not.toContain("<");
            expect(plain2).not.toContain(">");
            expect(plain2.toLowerCase()).not.toContain("<script");
        }

        const seo = parseSeoFromHtml(
            "<html><head><title>T</title></head><body><h1><<script>script>alert(1)</script>SEO見出し</h1></body></html>",
        );
        expect(seo.h1List[0]).not.toContain("<");
        expect(seo.h1List[0]).not.toContain(">");
        expect(seo.h1List[0]).toContain("SEO見出し");

        const ogp = parseOgpFromHtml(
            '<html><head><meta property="og:title" content="テスト &quot;OGP&quot;" /></head></html>',
        );
        expect(ogp.ogTitle).toBe('テスト "OGP"');
    });

    it("URL無害化: createSafeObjectUrl が blob: URL 以外（javascript:, data:, https: 等）をすべて拒否しメタ文字を除去すること", () => {
        const blob = new Blob(["video"], { type: "video/mp4" });
        globalThis.URL.revokeObjectURL = vi.fn();

        globalThis.URL.createObjectURL = vi
            .fn()
            .mockReturnValue("blob:https://tools.blossomsarchive.com/1234-5678");
        expect(createSafeObjectUrl(blob)).toBe(
            "blob:https://tools.blossomsarchive.com/1234-5678",
        );

        globalThis.URL.createObjectURL = vi
            .fn()
            .mockReturnValue('blob:http://localhost/abc"onerror="alert(1)');
        expect(createSafeObjectUrl(blob)).not.toContain('"');

        for (const badUrl of [
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "https://evil.example.com/malware.mp4",
        ]) {
            globalThis.URL.createObjectURL = vi.fn().mockReturnValue(badUrl);
            expect(() => createSafeObjectUrl(blob)).toThrow();
        }
    });

    it("コードインジェクション防止: 電卓の表示欄がdisabledで任意スクリプト入力を許さず、不正な演算子並びも Error として安全に拒否すること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;
        expect(display).toBeDisabled();

        // 不正な連続演算子 9 × ÷ = Error
        fireEvent.click(screen.getByRole("button", { name: "9" }));
        fireEvent.click(screen.getByRole("button", { name: "×" }));
        fireEvent.click(screen.getByRole("button", { name: "÷" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("Error");
    });

    it("暗号学的乱数 (CSPRNG): パスワード生成と抽選ツールが window.crypto.getRandomValues を使用していること", () => {
        const cryptoSpy = vi.spyOn(window.crypto, "getRandomValues");

        const pwView = render(() => <PasswordGenerator />);
        fireEvent.click(
            screen.getByRole("button", { name: "パスワードを自動生成" }),
        );
        expect(cryptoSpy).toHaveBeenCalled();
        pwView.unmount();

        cryptoSpy.mockClear();

        const lotteryView = render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/);
        fireEvent.input(textarea, { target: { value: "項目1\n項目2\n項目3" } });
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));
        expect(cryptoSpy).toHaveBeenCalled();
        lotteryView.unmount();
    });

    it("外部リンクの安全性 (Tabnabbing防止) と .htaccess セキュリティヘッダーが設定されていること", () => {
        const { container } = render(() => <Credits />);
        const externalLinks = Array.from(
            container.querySelectorAll('a[target="_blank"]'),
        );
        expect(externalLinks.length).toBeGreaterThan(0);
        for (const link of externalLinks) {
            const rel = link.getAttribute("rel") || "";
            expect(rel).toContain("noopener");
            expect(rel).toContain("noreferrer");
        }

        const htaccessPath = path.resolve(
            process.cwd(),
            "public",
            ".htaccess",
        );
        expect(fs.existsSync(htaccessPath)).toBe(true);
        const htaccess = fs.readFileSync(htaccessPath, "utf8");
        expect(htaccess).toContain("X-Content-Type-Options");
        expect(htaccess).toContain("nosniff");
        expect(htaccess).toContain("X-Frame-Options");
        expect(htaccess).toContain("Strict-Transport-Security");
    });
});
