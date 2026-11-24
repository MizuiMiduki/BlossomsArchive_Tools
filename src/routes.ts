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
export const SITE_FAVICON = "https://tools.blossomsarchive.com/icon-32.png";
export const SITE_LOGO =
    "https://tools.blossomsarchive.com/icon-192.png";
export const DEFAULT_OG_IMAGE =
    "https://tools.blossomsarchive.com/icon-192.png";
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
            "計算履歴を自動保存・クリック再利用しながら使えるシンプルで高機能な無料Web電卓です。四則演算や小数計算、連続計算、丸め誤差の自動補正にも対応し、ブラウザ完結で安全に動作します。",
        applicationCategory: "UtilityApplication",
        keywords: ["電卓", "計算機", "計算履歴", "無料電卓", "Web電卓"],
    },
    {
        path: "/qr_code",
        title: "QRコード生成",
        description:
            "URLや任意のテキストから高精細なQRコードをブラウザ上で即座に作成・ダウンロードできる無料ツールです。PNG・JPEG・WebPのほか印刷に最適なベクターSVG出力にも対応しています。",
        applicationCategory: "UtilityApplication",
        keywords: ["QRコード作成", "QRコード生成", "無料QR", "QRコードダウンロード"],
    },
    {
        path: "/password-generator",
        title: "パスワード生成",
        description:
            "文字種（大文字・小文字・数字・記号）や桁数を自由に指定し、Web Crypto API（CSPRNG）を用いて暗号学的に安全性の高い強固なパスワードを一括生成できる無料Webツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["パスワード生成", "パスワード作成", "ランダムパスワード", "セキュリティ"],
    },
    {
        path: "/lottery",
        title: "抽選ツール",
        description:
            "名前や項目リストから暗号学的疑似乱数（CSPRNG）を用いて公正・ランダムに抽選・選定できる無料ツールです。重複なし抽選や複数人同時選出、実行履歴の記録・コピーにも対応しています。",
        applicationCategory: "UtilityApplication",
        keywords: ["抽選ツール", "ランダム抽選", "くじ引き", "ルーレット", "公正抽選"],
    },
    {
        path: "/image_conversion",
        title: "画像形式変換",
        description:
            "PNG・JPEG・WebPなどの画像フォーマットをサーバーへアップロードせずブラウザ内のCanvas APIで安全かつ高速に相互変換できる無料ツールです。透過画像の白背景補完にも対応します。",
        applicationCategory: "DesignApplication",
        keywords: ["画像変換", "WebP変換", "PNG変換", "JPEG変換", "フォーマット変換"],
    },
    {
        path: "/video-compressor",
        title: "動画圧縮",
        description:
            "動画ファイルの解像度やビットレート、フレームレートをブラウザ上で調整し、サーバーへアップロードせず完全ローカル処理で安全に圧縮・軽量化できる無料Webツールです。音声有無も設定可能です。",
        applicationCategory: "MultimediaApplication",
        keywords: ["動画圧縮", "動画軽量化", "MP4圧縮", "ブラウザ動画圧縮", "ファイル軽量化"],
    },
    {
        path: "/charset-converter",
        title: "文字コード変換",
        description:
            "UTF-8・Shift_JIS・EUC-JP・JIS等の文字コードや改行コードを相互変換。16進数HEXやUnicode表記、Base64変換、Unicode正規化、文字化け修復もブラウザ内で安全に行えます。",
        applicationCategory: "DeveloperApplication",
        keywords: ["文字コード変換", "Shift_JIS", "UTF-8", "EUC-JP", "文字化け修復"],
    },
    {
        path: "/access-info",
        title: "アクセス情報確認",
        description:
            "現在のグローバルIPアドレス、プロバイダ(ISP)、ブラウザ(User-Agent)、論理解像度・物理解像度、回線種別、バッテリー残量などのアクセス環境情報を一括確認・コピーできる無料ツールです。",
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
            "写真に撮影日時、カメラ機種、レンズ名、焦点距離、F値、シャッタースピード、ISO感度などのEXIF情報を美しくレイアウトしたフレーム画像をブラウザ完結で生成・保存できる無料ツールです。",
        applicationCategory: "DesignApplication",
        keywords: ["EXIFフレーム", "カメラ情報", "写真フレーム", "撮影データ", "フィルム風枠"],
    },
    {
        path: "/clock",
        title: "時計",
        description:
            "現在時刻を高精度なデジタル表示と滑らかなSVGアナログ時計でリアルタイムに確認できる無料Web時計ツールです。PCやスマホの見やすい画面表示とダークモード切り替えにも対応しています。",
        applicationCategory: "UtilityApplication",
        keywords: ["時計", "デジタル時計", "アナログ時計", "現在時刻", "全画面時計"],
    },
    {
        path: "/timer",
        title: "タイマー・ストップウォッチ",
        description:
            "カウントダウンタイマー、1/100秒単位のラップタイム計測対応ストップウォッチ、25分集中＋5分休憩のポモドーロタイマーをひとつにまとめたシンプルで使いやすい無料Webツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["タイマー", "ストップウォッチ", "カウントダウン", "ラップタイム", "Webタイマー"],
    },
    {
        path: "/hyperfocal",
        title: "過焦点距離計算",
        description:
            "カメラのセンサーサイズ、レンズ焦点距離、絞り値（F値）からパンフォーカス撮影に最適な過焦点距離と被写界深度（前方・後方ピント限界）を精密にシミュレーション計算できる無料ツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["過焦点距離", "パンフォーカス", "被写界深度", "カメラ計算", "DOF計算"],
    },
    {
        path: "/headphone-driveability",
        title: "イヤホン・ヘッドホン鳴らしやすさ",
        description:
            "イヤホンやヘッドホンのインピーダンスと音圧感度から、目標音圧に必要な出力電圧・電流・電力を計算し、スマホ直挿しやポタアン・据置アンプの駆動適性を判定できる無料ツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["ヘッドホン鳴らしやすさ", "インピーダンス", "音圧感度", "アンプ出力", "ポタアン"],
    },
    {
        path: "/text-converter",
        title: "テキスト・マークアップ変換",
        description:
            "MarkdownからHTML、HTMLからMarkdown・プレーンテキスト抽出、HTML特殊文字エスケープ・アンエスケープ、URLエンコード・デコードをブラウザ内で安全に相互変換できる無料ツールです。",
        applicationCategory: "DeveloperApplication",
        keywords: ["テキスト変換", "Markdown HTML変換", "HTMLプレーンテキスト変換", "全角半角変換"],
    },
    {
        path: "/exposure-calculator",
        title: "カメラ露出計算機",
        description:
            "スマホカメラでのリアルタイム露出計(測光)からND長秒露光・星空撮影まで、絞り(F値)・シャッター速度・ISO・NDの適正露出をシミュレーション・換算できる無料Webツールです。",
        applicationCategory: "MultimediaApplication",
        keywords: [
            "カメラ露出計算",
            "適正露出",
            "カメラ露出計",
            "スマホ露出計",
            "長秒露光",
            "NDフィルター計算",
            "シャッタースピード",
            "F値",
            "ISO感度",
            "露出換算",
        ],
    },
    {
        path: "/timelapse-calculator",
        title: "タイムラプス撮影計算機",
        description:
            "完成動画の長さや撮影間隔、実撮影時間から、タイムラプスに必要な総撮影枚数とSDカード容量を相互シミュレーションできる無料Web計算ツールです。",
        applicationCategory: "MultimediaApplication",
        keywords: ["タイムラプス計算", "インターバル撮影", "撮影間隔", "SDカード容量", "タイムラプス動画"],
    },
    {
        path: "/bpm-calculator",
        title: "BPMディレイ換算機",
        description:
            "テンポ（BPM）から音符ごとのディレイタイム（ms）やLFO周波数（Hz）を瞬時に算出。タップテンポ機能も備えたDTMや音響制作に役立つ無料Webツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["BPM計算", "ディレイタイム", "タップテンポ", "DTMツール", "LFO周波数"],
    },
    {
        path: "/json-formatter",
        title: "JSON整形・検証ツール",
        description:
            "JSONデータの構文エラー検証やインデント整形、1行圧縮（Minify）、データ統計をブラウザ内で安全に行える無料ツールです。サーバー通信なしの完全ローカル処理。",
        applicationCategory: "DeveloperApplication",
        keywords: ["JSON整形", "JSONバリデーター", "JSON検証", "JSONミニファイ", "JSONフォーマッター"],
    },
    {
        path: "/word-counter",
        title: "文字数カウント・原稿用紙換算",
        description:
            "入力テキストの文字数（空白除外）、行数、原稿用紙枚数、読了時間、文字種別（ひらがな・漢字等）の割合をリアルタイムに集計・分析できる無料Webツールです。",
        applicationCategory: "UtilityApplication",
        keywords: ["文字数カウント", "原稿用紙換算", "文字数チェッカー", "読了時間", "文章分析"],
    },
    {
        path: "/tier-maker",
        title: "ティア表作成ツール (Tier List)",
        description:
            "画像や文字を自由に並べてオリジナルのティア表を作成できる無料Webツールです。ランク数の増減や配色変更、アイテムごとのA+やA-などの上下微調整、高画質画像エクスポートに対応。ブラウザ完結で安全に動作します。",
        applicationCategory: "DesignApplication",
        keywords: ["ティア表", "Tier表", "TierMaker", "ランキング作成", "ティアリスト"],
    },
    {
        path: "/json-ld-viewer",
        title: "JSON-LD構造可視化・検証",
        description:
            "Schema.orgやJSON-LD構造化データのツリー構造・プロパティ・ネストを視覚的に表示・検証できる無料Webツールです。HTMLからの抽出、構文エラー診断、Googleリッチリザルト連携、整形・コピーに完全ローカルで対応します。",
        applicationCategory: "DeveloperApplication",
        keywords: [
            "JSON-LD",
            "構造化データ",
            "Schema.org",
            "リッチリザルト",
            "JSON-LD検証",
            "ツリー表示",
        ],
    },
    {
        path: "/privacy",
        title: "プライバシーポリシー",
        description: "BlossomsArchive Toolsのプライバシーポリシーです。ユーザーの入力データやファイルの完全クライアントサイド処理および個人情報保護に関する基本方針を掲載しています。",
        hidden: true,
    },
    {
        path: "/credits",
        title: "使用ライブラリ",
        description:
            "BlossomsArchive Toolsの開発・動作に使用しているオープンソースライブラリ（Solid.js・Tailwind CSS・DaisyUI等）とアイコンのライセンス情報一覧です。",
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
            primaryImageOfPage: {
                "@type": "ImageObject",
                url: DEFAULT_OG_IMAGE,
            },
            speakable: {
                "@type": "SpeakableSpecification",
                cssSelector: ["h1", "header p"],
            },
            isPartOf: {
                "@id": `${SITE_URL}/#website`,
            },
            about: {
                "@id": `${PUBLISHER_URL}#organization`,
            },
            hasPart: routes
                .filter((r) => r.path !== "/" && !r.hidden)
                .map((r) => ({
                    "@type": "WebApplication",
                    name: r.title,
                    url: `${SITE_URL}${r.path}`,
                    description: r.description,
                })),
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
                primaryImageOfPage: {
                    "@type": "ImageObject",
                    url: DEFAULT_OG_IMAGE,
                },
                speakable: {
                    "@type": "SpeakableSpecification",
                    cssSelector: ["h1", "p"],
                },
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

            // 各Webアプリケーションツール (AI/GEO・検索エンジン向け完全仕様)
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
                isAccessibleForFree: true,
                softwareVersion: "1.0.0",
                featureList: route.description,
                keywords: route.keywords ? route.keywords.join(", ") : undefined,
                author: {
                    "@id": `${PUBLISHER_URL}#organization`,
                },
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
                primaryImageOfPage: {
                    "@type": "ImageObject",
                    url: DEFAULT_OG_IMAGE,
                },
                speakable: {
                    "@type": "SpeakableSpecification",
                    cssSelector: ["h1", "p"],
                },
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
