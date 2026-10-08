export interface Route {
    path: string;
    title: string;
    description: string;
    hidden?: boolean;
}

export const SITE_URL = "https://tools.blossomsarchive.com";
export const SITE_TITLE = "BlossomsArchive Tools";

export const routes: Route[] = [
    {
        path: "/",
        title: "ホーム",
        description:
            "電卓やQRコード生成など、日常で使える便利なWebツールを無料で利用できます。",
    },
    {
        path: "/calculator",
        title: "電卓ツール",
        description:
            "計算履歴を確認しながら使える、シンプルな無料Web電卓です。",
    },
    {
        path: "/qr_code",
        title: "QRコード生成",
        description: "URLやテキストからQRコードを作成できる無料ツールです。",
    },
    {
        path: "/password-generator",
        title: "パスワード生成",
        description:
            "安全性の高いパスワードを条件に合わせて生成できる無料ツールです。",
    },
    {
        path: "/lottery",
        title: "抽選ツール",
        description: "名前や項目からランダムに抽選できる無料ツールです。",
    },
    {
        path: "/image_conversion",
        title: "画像形式変換",
        description: "画像ファイルを別の形式に変換できる無料ツールです。",
    },
    {
        path: "/access-info",
        title: "アクセス情報確認",
        description:
            "IPアドレスやブラウザなど、現在のアクセス情報を確認できます。",
    },
    {
        path: "/exif-frame",
        title: "EXIFフレーム生成",
        description:
            "写真に撮影日時やカメラ情報などのEXIF情報を表示したフレームを追加できます。",
    },
    {
        path: "/clock",
        title: "時計",
        description: "現在時刻をデジタル表示とアナログ時計で確認できます。",
    },
    {
        path: "/timer",
        title: "タイマー・ストップウォッチ",
        description:
            "カウントダウンタイマーとストップウォッチを使える無料ツールです。",
    },
    {
        path: "/hyperfocal",
        title: "過焦点距離計算",
        description:
            "焦点距離や絞り値から、パンフォーカス撮影に役立つ過焦点距離を計算します。",
    },
    {
        path: "/headphone-driveability",
        title: "イヤホン・ヘッドホンの鳴らしやすさ",
        description:
            "インピーダンスと音圧感度から、イヤホンやヘッドホンに必要な出力を計算します。",
    },
    {
        path: "/privacy",
        title: "プライバシーポリシー",
        description: "BlossomsArchive Toolsのプライバシーポリシーです。",
        hidden: true,
    },
    {
        path: "/credits",
        title: "使用ライブラリ",
        description:
            "BlossomsArchive Toolsで使用しているライブラリとライセンスの一覧です。",
        hidden: true,
    },
];

export interface PageMetadata {
    title: string;
    description: string;
    url: string;
}

export function getPageMetadata(pathname: string): PageMetadata {
    const route = routes.find((item) => item.path === pathname);
    const title =
        !route || route.path === "/"
            ? SITE_TITLE
            : `${route.title} | ${SITE_TITLE}`;

    return {
        title,
        description:
            route?.description ??
            "BlossomsArchive Toolsの便利な無料Webツールをご利用ください。",
        url: `${SITE_URL}${pathname}`,
    };
}
