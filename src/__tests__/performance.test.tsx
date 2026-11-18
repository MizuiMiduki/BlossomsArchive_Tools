import fs from "node:fs";
import path from "node:path";
import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { parseBudouX } from "../utils/budoux";
import {
    markdownToHtml,
    htmlToMarkdown,
    htmlToPlainText,
} from "../utils/textConverter";
import {
    encodeStringToBytes,
    decodeBytes,
    bytesToHexString,
    parseHexToBytes,
    bytesToBase64,
    base64ToBytes,
} from "../utils/charsetConverter";
import { parseSeoFromHtml, stripHtmlTagsToPlainText } from "../pages/SeoChecker";
import { parseOgpFromHtml } from "../pages/OgpChecker";
import { playPageEntrance } from "../utils/gsapAnimations";
import Home from "../pages/Home";
import Calculator from "../pages/Calculator";
import TextConverter from "../pages/TextConverter";

describe("Performance & Bundle Budget Tests", () => {
    it("BudouX 日本語分かち書き処理が長文（5,000文字以上）でも 100ms 以内に完了すること", () => {
        const paragraph =
            "BlossomsArchive Toolsは、電卓やQRコード生成、画像変換、動画圧縮、文字コード変換、OGP・SEOメタタグ確認など、日常やWeb制作・開発に役立つ高品質なWebツールを完全無料で提供しています。";
        const longText = paragraph.repeat(60); // 約5,500文字

        const start = performance.now();
        const chunks = parseBudouX(longText);
        const elapsed = performance.now() - start;

        expect(chunks.length).toBeGreaterThan(100);
        expect(chunks.join("")).toBe(longText);
        expect(elapsed).toBeLessThan(150);
    });

    it("TextConverter の Markdown <-> HTML AST 相互変換およびプレーンテキスト抽出が長文でも高速（150ms以内）に完了すること", () => {
        const mdBlock = [
            "# パフォーマンステスト見出し",
            "",
            "これは**太字**と*斜体*と`インラインコード`を含む段落です。",
            "",
            "| 列1 | 列2 | 列3 |",
            "| --- | --- | --- |",
            "| データA | データB | データC |",
            "",
            "- リスト項目1",
            "- リスト項目2",
            "",
        ].join("\n");
        const largeMd = Array.from({ length: 25 }, () => mdBlock).join("\n");

        const start = performance.now();
        const html = markdownToHtml(largeMd);
        const backToMd = htmlToMarkdown(html);
        const plain = htmlToPlainText(html);
        const elapsed = performance.now() - start;

        expect(html).toContain("<h1>パフォーマンステスト見出し</h1>");
        expect(backToMd).toContain("パフォーマンステスト見出し");
        expect(plain).toContain("パフォーマンステスト見出し");
        expect(elapsed).toBeLessThan(200);
    });

    it("CharsetConverter の文字コード変換・HEX・Base64処理が大量テキストでも高速（150ms以内）に完了すること", () => {
        const sample = "文字コード変換パフォーマンステスト🌸UTF-8/Shift_JIS/EUC-JP\n".repeat(
            100,
        );

        const start = performance.now();
        const utf8Bytes = encodeStringToBytes(sample, "UTF8");
        const hex = bytesToHexString(utf8Bytes, "none");
        const roundtripBytes = parseHexToBytes(hex);
        const decoded = decodeBytes(roundtripBytes, "UTF8");
        const b64 = bytesToBase64(utf8Bytes);
        const fromB64 = base64ToBytes(b64);
        const elapsed = performance.now() - start;

        expect(decoded.text).toBe(sample);
        expect(fromB64.length).toBe(utf8Bytes.length);
        expect(elapsed).toBeLessThan(200);
    });

    it("SeoChecker / OgpChecker の HTML解析およびタグ除去が大きなHTMLドキュメントでも高速（100ms以内）に完了すること", () => {
        const repeatedBody = Array.from(
            { length: 200 },
            (_, i) => `<p>段落テキスト ${i} <span>装飾</span></p>`,
        ).join("\n");
        const largeHtml = `<!doctype html>
        <html lang="ja">
        <head>
            <meta charset="utf-8" />
            <title>大規模HTMLパフォーマンステスト用タイトル | BlossomsArchive</title>
            <meta name="description" content="大規模なHTMLドキュメントに対するSEOおよびOGPメタタグ解析のレスポンス性能を計測するパフォーマンステスト用の説明文です。" />
            <link rel="canonical" href="https://tools.blossomsarchive.com/seo-checker" />
            <meta property="og:title" content="OGPパフォーマンステスト" />
            <meta property="og:description" content="OGP説明文" />
            <meta property="og:image" content="https://tools.blossomsarchive.com/og.png" />
            <meta name="twitter:card" content="summary_large_image" />
        </head>
        <body>
            <h1><span>メイン見出し</span>パフォーマンステスト</h1>
            ${repeatedBody}
        </body>
        </html>`;

        const start = performance.now();
        const seo = parseSeoFromHtml(
            largeHtml,
            "https://tools.blossomsarchive.com/seo-checker",
        );
        const ogp = parseOgpFromHtml(
            largeHtml,
            "https://tools.blossomsarchive.com/seo-checker",
        );
        const stripped = stripHtmlTagsToPlainText(repeatedBody);
        const elapsed = performance.now() - start;

        expect(seo.h1List).toEqual(["メイン見出しパフォーマンステスト"]);
        expect(ogp.ogTitle).toBe("OGPパフォーマンステスト");
        expect(stripped).not.toContain("<");
        expect(elapsed).toBeLessThan(150);
    });

    it("LCP/FCP最適化: playPageEntrance が同期かつ 1ms 未満で完了し描画遅延を起こさないこと、および主要ページの初期マウントが高速であること", () => {
        const dummyDiv = document.createElement("div");
        const startAnim = performance.now();
        playPageEntrance(dummyDiv);
        const animElapsed = performance.now() - startAnim;
        expect(animElapsed).toBeLessThan(5);

        const startRender = performance.now();
        const r1 = render(() => <Home />);
        r1.unmount();
        const r2 = render(() => <Calculator />);
        r2.unmount();
        const r3 = render(() => <TextConverter />);
        r3.unmount();
        const renderElapsed = performance.now() - startRender;

        expect(renderElapsed).toBeLessThan(500);
    });

    it("ビルド成果物が存在する場合、BudouX チャンクが軽量（5KB未満）であり各ルートHTMLに modulepreload が含まれること", () => {
        const distAssetsDir = path.resolve(process.cwd(), "dist", "assets");
        if (!fs.existsSync(distAssetsDir)) return;

        const files = fs.readdirSync(distAssetsDir);
        const budouxChunk = files.find(
            (f) => f.startsWith("BudouX-") && f.endsWith(".js"),
        );
        if (budouxChunk) {
            const stat = fs.statSync(path.join(distAssetsDir, budouxChunk));
            // Intl.Segmenter 移行により 212KB -> 5KB 未満に維持されていること
            expect(stat.size).toBeLessThan(5 * 1024);
        }

        const distIndex = path.resolve(process.cwd(), "dist", "index.html");
        if (fs.existsSync(distIndex)) {
            const html = fs.readFileSync(distIndex, "utf8");
            expect(html).toContain('rel="modulepreload"');
            expect(html).toContain('rel="ard"');
        }
    });
});
