export interface Route {
    path: string;
    title: string;
    description: string;
    hidden?: boolean;
    applicationCategory?:
        | "UtilityApplication"
        | "DeveloperApplication"
        | "DesignApplication"
        | "MultimediaApplication";
    keywords?: string[];
}

export const SITE_URL = "https://tools.blossomsarchive.com";
export const SITE_TITLE = "BlossomsArchive Tools";
export const SITE_DESCRIPTION =
    "BlossomsArchive Toolsは、電卓やQRコード生成、画像変換、動画圧縮、文字コード変換、OGP・SEOメタタグ確認など、日常やWeb制作・開発に役立つ高品質なWebツールを完全無料で提供しています。";
export const SITE_LOGO =
    "https://blossomsarchive.com/wp-content/uploads/2021/10/cropped-d42dee79c2a98cc8da98f9d600398a05-192x192.png";
export const DEFAULT_OG_IMAGE =
    "https://blossomsarchive.com/wp-content/uploads/2021/10/cropped-d42dee79c2a98cc8da98f9d600398a05-192x192.png";
export const PUBLISHER_NAME = "BlossomsArchive";
export const PUBLISHER_URL = "https://blossomsarchive.com";

export const routes: Route[] = [
    {
        path: "/",
        title: "ホーム",
        description: SITE_DESCRIPTION,
        keywords: [
            "Webツール",
            "便利ツール",
            "オンラインツール",
            "無料ツール",
            "BlossomsArchive Tools",
        ],
    },
    {
        path: "/calculator",
        title: "電卓ツール",
        description:
            "計算履歴を確認しながら使える、シンプルで高機能な無料Web電卓です。",
        applicationCategory: "UtilityApplication",
        keywords: ["電卓", "計算機", "計算履歴", "無料電卓", "Web電卓"],
    },
    {
        path: "/qr_code",
        title: "QRコード生成",
        description:
            "URLや任意のテキストから高精細なQRコードをブラウザ上で即座に作成・ダウンロードできる無料ツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["QRコード作成", "QRコード生成", "無料QR", "QRコードダウンロード"],
    },
    {
        path: "/password-generator",
        title: "パスワード生成",
        description:
            "文字種や桁数を指定し、暗号学的に安全性の高い強固なパスワードを即座に生成できる無料ツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["パスワード生成", "パスワード作成", "ランダムパスワード", "セキュリティ"],
    },
    {
        path: "/lottery",
        title: "抽選ツール",
        description:
            "名前や項目リストからランダムに公正に抽選・選定できる無料オンラインツールです。重複なし抽選や複数人同時選出にも対応。",
        applicationCategory: "UtilityApplication",
        keywords: ["抽選ツール", "ランダム抽選", "くじ引き", "ルーレット", "公正抽選"],
    },
    {
        path: "/image_conversion",
        title: "画像形式変換",
        description:
            "PNG、JPEG、WebPなどの画像フォーマットをブラウザ内で安全かつ高速に相互変換できる無料ツールです。",
        applicationCategory: "DesignApplication",
        keywords: ["画像変換", "WebP変換", "PNG変換", "JPEG変換", "フォーマット変換"],
    },
    {
        path: "/video-compressor",
        title: "動画圧縮",
        description:
            "動画ファイルの解像度やビットレートをブラウザ上で調整し、サーバーにアップロードせず完全安全に圧縮・軽量化できる無料ツールです。",
        applicationCategory: "MultimediaApplication",
        keywords: ["動画圧縮", "動画軽量化", "MP4圧縮", "ブラウザ動画圧縮", "ファイル軽量化"],
    },
    {
        path: "/charset-converter",
        title: "文字コード変換",
        description:
            "UTF-8、Shift_JIS、EUC-JP、JIS等の文字コードや改行コードを相互変換。文字化け修復やファイル一括変換も完全ブラウザ内で安全に行えます。",
        applicationCategory: "DeveloperApplication",
        keywords: ["文字コード変換", "Shift_JIS", "UTF-8", "EUC-JP", "文字化け修復"],
    },
    {
        path: "/access-info",
        title: "アクセス情報確認",
        description:
            "現在の接続IPアドレス、ホスト名、ブラウザ（User-Agent）、画面解像度、OSなどのアクセス環境情報を一括確認できます。",
        applicationCategory: "DeveloperApplication",
        keywords: ["IPアドレス確認", "アクセス情報", "ユーザーエージェント", "環境確認"],
    },
    {
        path: "/ogp-checker",
        title: "OGP確認",
        description:
            "URLやHTMLからOGPタグ・Twitterカードの設定状況を解析し、X（旧Twitter）・Facebook・LINE・Discordでのシェアカード表示をリアルタイムにプレビュー確認できます。",
        applicationCategory: "DeveloperApplication",
        keywords: ["OGP確認", "Twitterカードプレビュー", "SNSシェア確認", "Open Graph", "メタタグ"],
    },
    {
        path: "/seo-checker",
        title: "メタタグ(SEO)確認",
        description:
            "URLやHTMLからtitle、description、canonical、robots、JSON-LD構造化データ等のSEOメタタグを解析し、Google検索結果の表示をPC・スマホ表示でプレビュー確認できます。",
        applicationCategory: "DeveloperApplication",
        keywords: ["SEO確認", "メタタグ確認", "Google検索プレビュー", "JSON-LD確認", "検索スニペット"],
    },
    {
        path: "/exif-frame",
        title: "EXIFフレーム生成",
        description:
            "写真に撮影日時、カメラ機種、レンズ、シャッタースピード、F値、ISO感度などのEXIF情報を美しくレイアウトしたフレームを追加できます。",
        applicationCategory: "DesignApplication",
        keywords: ["EXIFフレーム", "カメラ情報", "写真フレーム", "撮影データ", "フィルム風枠"],
    },
    {
        path: "/clock",
        title: "時計",
        description:
            "現在時刻を高精度にデジタル表示とアナログ時計で確認できるフルスクリーン対応のWeb時計ツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["時計", "デジタル時計", "アナログ時計", "現在時刻", "全画面時計"],
    },
    {
        path: "/timer",
        title: "タイマー・ストップウォッチ",
        description:
            "カウントダウンタイマーとラップタイム計測対応のストップウォッチを使えるシンプルで使い勝手の良い無料Webツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["タイマー", "ストップウォッチ", "カウントダウン", "ラップタイム", "Webタイマー"],
    },
    {
        path: "/hyperfocal",
        title: "過焦点距離計算",
        description:
            "カメラのセンサーサイズ、焦点距離、絞り値（F値）からパンフォーカス撮影に役立つ過焦点距離や被写界深度を精密に計算します。",
        applicationCategory: "UtilityApplication",
        keywords: ["過焦点距離", "パンフォーカス", "被写界深度", "カメラ計算", "DOF計算"],
    },
    {
        path: "/headphone-driveability",
        title: "イヤホン・ヘッドホンの鳴らしやすさ",
        description:
            "イヤホンやヘッドホンのインピーダンスと音圧感度から、必要な電圧・電流・出力を計算し、アンプや再生機器のドライブ適性を判定します。",
        applicationCategory: "UtilityApplication",
        keywords: ["ヘッドホン鳴らしやすさ", "インピーダンス", "音圧感度", "アンプ出力", "ポタアン"],
    },
    {
        path: "/text-converter",
        title: "テキスト・マークアップ変換",
        description:
            "MarkdownからHTML、HTMLからプレーンテキスト、全角半角変換、大文字小文字変換など、テキストとマークアップの多彩な変換を行える無料ツールです。",
        applicationCategory: "DeveloperApplication",
        keywords: ["テキスト変換", "Markdown HTML変換", "HTMLプレーンテキスト変換", "全角半角変換"],
    },
    {
        path: "/privacy",
        title: "プライバシーポリシー",
        description: "BlossomsArchive Toolsのプライバシーポリシーです。ユーザーのプライバシー保護に関する方針を掲載しています。",
        hidden: true,
    },
    {
        path: "/credits",
        title: "使用ライブラリ",
        description:
            "BlossomsArchive Toolsで使用しているオープンソースライブラリとライセンス情報の一覧です。",
        hidden: true,
    },
];

export interface PageMetadata {
    title: string;
    description: string;
    url: string;
    keywords?: string[];
}

export function normalizePath(pathname: string): string {
    if (!pathname || pathname === "/") return "/";
    return pathname.replace(/\/+$/, "");
}

export function getPageMetadata(pathname: string): PageMetadata {
    const normalized = normalizePath(pathname);
    const route = routes.find((item) => item.path === normalized);
    const title =
        !route || route.path === "/"
            ? SITE_TITLE
            : `${route.title} | ${SITE_TITLE}`;

    return {
        title,
        description:
            route?.description ??
            SITE_DESCRIPTION,
        url: `${SITE_URL}${normalized}`,
        keywords: route?.keywords ?? [],
    };
}

export interface JsonLdGraph {
    "@context": "https://schema.org";
    "@graph": any[];
}

/**
 * ページパスに応じた完全なJSON-LD構造化データ（Schema.org）を生成する。
 * Organization, WebSite, WebApplication, BreadcrumbList などを網羅。
 */
export function getPageJsonLd(pathname: string): JsonLdGraph {
    const normalized = normalizePath(pathname);
    const route = routes.find((r) => r.path === normalized);
    const currentUrl = `${SITE_URL}${normalized === "/" ? "" : normalized}`;

    const graph: any[] = [
        {
            "@type": "Organization",
            "@id": `${PUBLISHER_URL}#organization`,
            name: PUBLISHER_NAME,
            url: PUBLISHER_URL,
            logo: {
                "@type": "ImageObject",
                url: SITE_LOGO,
            },
        },
        {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: `${SITE_URL}/`,
            name: SITE_TITLE,
            description: SITE_DESCRIPTION,
            publisher: {
                "@id": `${PUBLISHER_URL}#organization`,
            },
            inLanguage: "ja",
        },
    ];

    if (normalized === "/") {
        // トップページ
        graph.push({
            "@type": "WebPage",
            "@id": `${SITE_URL}/#webpage`,
            url: `${SITE_URL}/`,
            name: SITE_TITLE,
            description: SITE_DESCRIPTION,
            inLanguage: "ja",
            isPartOf: {
                "@id": `${SITE_URL}/#website`,
            },
            about: {
                "@id": `${PUBLISHER_URL}#organization`,
            },
        });

        return {
            "@context": "https://schema.org",
            "@graph": graph,
        };
    }

    if (route) {
        if (!route.hidden) {
            // 各WebツールのWebPage
            graph.push({
                "@type": "WebPage",
                "@id": `${currentUrl}#webpage`,
                url: currentUrl,
                name: `${route.title} | ${SITE_TITLE}`,
                description: route.description,
                inLanguage: "ja",
                isPartOf: {
                    "@id": `${SITE_URL}/#website`,
                },
                breadcrumb: {
                    "@id": `${currentUrl}#breadcrumb`,
                },
                mainEntity: {
                    "@id": `${currentUrl}#webapp`,
                },
            });

            // 各Webアプリケーションツール
            graph.push({
                "@type": "WebApplication",
                "@id": `${currentUrl}#webapp`,
                name: `${route.title} | ${SITE_TITLE}`,
                url: currentUrl,
                description: route.description,
                applicationCategory:
                    route.applicationCategory || "UtilityApplication",
                operatingSystem: "All",
                browserRequirements: "Requires JavaScript. Requires HTML5.",
                inLanguage: "ja",
                offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "JPY",
                },
                provider: {
                    "@id": `${PUBLISHER_URL}#organization`,
                },
            });
        } else {
            // プライバシーポリシー等の静的ページ
            graph.push({
                "@type": "WebPage",
                "@id": `${currentUrl}#webpage`,
                name: `${route.title} | ${SITE_TITLE}`,
                url: currentUrl,
                description: route.description,
                inLanguage: "ja",
                isPartOf: {
                    "@id": `${SITE_URL}/#website`,
                },
                breadcrumb: {
                    "@id": `${currentUrl}#breadcrumb`,
                },
            });
        }

        // パンくずリスト (BreadcrumbList)
        graph.push({
            "@type": "BreadcrumbList",
            "@id": `${currentUrl}#breadcrumb`,
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "ホーム",
                    item: `${SITE_URL}/`,
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: route.title,
                    item: currentUrl,
                },
            ],
        });
    }

    return {
        "@context": "https://schema.org",
        "@graph": graph,
    };
}
