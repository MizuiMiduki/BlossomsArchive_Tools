import { describe, it, expect } from "vitest";
import { filterRoutesByQuery, toHiragana, toKatakana } from "../utils/search";
import type { Route } from "../routes";

describe("search utility", () => {
    it("toKatakana と toHiragana の相互変換が正しく機能すること", () => {
        expect(toKatakana("でんたく")).toBe("デンタク");
        expect(toHiragana("デンタク")).toBe("でんたく");
        expect(toKatakana("きごう")).toBe("キゴウ");
        expect(toHiragana("キゴウ")).toBe("きごう");
    });

    const mockRoutes: Route[] = [
        {
            path: "/calculator",
            title: "電卓ツール",
            description: "計算履歴を自動保存しながら使えるWeb電卓",
            keywords: ["計算機", "四則演算"],
        },
        {
            path: "/qr_code",
            title: "QRコード生成",
            description: "高精細なQRコードをブラウザ上で作成・ダウンロード",
            keywords: ["無料QR", "ベクターSVG"],
        },
        {
            path: "/timer",
            title: "タイマー・ストップウォッチ",
            description: "プリセット付きタイマーとラップタイム計測",
            keywords: ["アラーム", "カウントダウン"],
        },
    ];

    it("空文字・空白クエリの場合は全件返却されること", () => {
        expect(filterRoutesByQuery(mockRoutes, "")).toHaveLength(3);
        expect(filterRoutesByQuery(mockRoutes, "   ")).toHaveLength(3);
    });

    it("タイトルによる検索（漢字・ひらがな・カタカナ・部分一致）ができること", () => {
        // 漢字
        expect(filterRoutesByQuery(mockRoutes, "電卓")).toHaveLength(1);
        expect(filterRoutesByQuery(mockRoutes, "電卓")[0].path).toBe("/calculator");

        // ひらがなでカタカナタイトル（タイマー）をヒット
        expect(filterRoutesByQuery(mockRoutes, "たいまー")).toHaveLength(1);
        expect(filterRoutesByQuery(mockRoutes, "たいまー")[0].path).toBe("/timer");

        // カタカナで検索
        expect(filterRoutesByQuery(mockRoutes, "コード")).toHaveLength(1);
        expect(filterRoutesByQuery(mockRoutes, "コード")[0].path).toBe("/qr_code");
    });

    it("キーワードによる検索（タイトルに含まれない類義語）ができること", () => {
        // 「計算機」はkeywordsにある
        const result = filterRoutesByQuery(mockRoutes, "計算機");
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe("/calculator");

        // カタカナキーワード「カウントダウン」をひらがな「かうんとだうん」で検索
        const resultHira = filterRoutesByQuery(mockRoutes, "かうんとだうん");
        expect(resultHira).toHaveLength(1);
        expect(resultHira[0].path).toBe("/timer");
    });

    it("パス文字列（英字・大文字小文字）で検索できること", () => {
        expect(filterRoutesByQuery(mockRoutes, "qr")).toHaveLength(1);
        expect(filterRoutesByQuery(mockRoutes, "QR")).toHaveLength(1);
        expect(filterRoutesByQuery(mockRoutes, "calc")).toHaveLength(1);
    });

    it("一致しないクエリでは空配列が返ること", () => {
        expect(filterRoutesByQuery(mockRoutes, "存在しないツールXYZ")).toHaveLength(0);
    });
});
