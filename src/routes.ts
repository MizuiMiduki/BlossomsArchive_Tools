export interface Route {
    path: string;
    title: string;
    description?: string;
    hidden?: boolean;
}

export const routes: Route[] = [
    {
        path: "/",
        title: "ホーム",
        description: "便利なツール一覧です",
    },
    {
        path: "/calculator",
        title: "電卓ツール",
        description: "計算をパパッと済ませるツールです",
    },
    {
        path: "/qr",
        title: "QRコード生成",
        description: "URLをQRコードに変換します",
    },
    {
        path: "/password",
        title: "パスワード生成",
        description: "強固なパスワードを生成します",
    },
    {
        path: "/lottery",
        title: "抽選ツール",
        description: "運試しに抽選をします",
    },
    {
        path: "/image-conversion",
        title: "画像形式変換",
        description: "画像をサクッと変換します",
    },
    {
        path: "/access-info",
        title: "アクセス情報確認",
        description: "ブラウザ情報を確認します",
    },
    {
        path: "/exif-frame",
        title: "EXIFフレーム生成",
        description: "写真にEXIF情報を焼き付けます",
    },
    {
        path: "/clock",
        title: "時計",
        description: "現在時刻をデジタルとアナログで表示します",
    },
    {
        path: "/hyperfocal",
        title: "過焦点距離計算",
        description: "パンフォーカスに最適な過焦点距離を計算します",
    },
    {
        path: "/headphone-driveability",
        title: "イヤホン・ヘッドホンの鳴らしやすさ",
        description: "インピーダンスと音圧感度から必要な出力を見積もります",
    },
    {
        path: "/privacy",
        title: "プライバシーポリシー",
        hidden: true,
    },
    {
        path: "/credits",
        title: "使用ライブラリ",
        hidden: true,
    },
];
