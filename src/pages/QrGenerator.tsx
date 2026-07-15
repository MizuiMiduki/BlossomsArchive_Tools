// 1. Solid-js からのインポートに「For」を追加しました
import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import QRCode from "qrcode";

// ボタンオプション用の型を定義して TypeScript に型を教えます
interface FormatOption {
    value: string;
    label: string;
    desc: string;
}

export default function QrGenerator() {
    const [text, setText] = createSignal("");
    const [qrData, setQrData] = createSignal("");
    const [isLarge, setIsLarge] = createSignal(false);
    const [fileFormat, setFileFormat] = createSignal("png");

    // SEO対策：メタデータおよび構造化データの動的注入
    onMount(() => {
        document.title =
            "QRコード作成・生成ツール｜商用利用可・高画質SVG対応";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "完全無料・登録不要・商用利用可能なQRコード作成ツールです。入力した文字列やURLから瞬時にQRコードを自動生成。PNG、JPEG、WebPに加え、印刷・デザインに最適な高画質のSVG形式での無料ダウンロードに対応しています。安心のブラウザ完結（オフライン）処理。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "qr-generator-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "高画質QRコード生成・作成ツール（無料・商用利用可）",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "ブラウザ上で安全に動作する登録不要のQRコード作成ツール。チラシや名刺の印刷にも適した高解像度のSVG・PNG・JPEG・WebP形式でのダウンロード機能を提供します。",
        });
        document.head.appendChild(script);
    });

    onCleanup(() => {
        const script = document.getElementById("qr-generator-jsonld");
        if (script) {
            script.remove();
        }
    });

    const getMimeType = (format: string) => {
        switch (format) {
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            default:
                return "image/png";
        }
    };

    const generate = async () => {
        if (!text()) return;
        try {
            const data = await QRCode.toDataURL(text(), {
                width: 600,
                type: getMimeType(fileFormat()),
            });
            setQrData(data);
        } catch (err) {
            console.error(err);
        }
    };

    const getFormattedDateTime = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
    };

    const download = async () => {
        if (!qrData() || !text()) return;

        const safeInput = text()
            .replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龠_-]/g, "_")
            .substring(0, 20);
        const dateTimeStr = getFormattedDateTime();
        const fileName = `qrcode_${safeInput}_${dateTimeStr}.${fileFormat()}`;

        const link = document.createElement("a");
        link.download = fileName;

        if (fileFormat() === "svg") {
            try {
                const svgString = await QRCode.toString(text(), {
                    type: "svg",
                    width: 600,
                });
                const blob = new Blob([svgString], { type: "image/svg+xml" });
                link.href = URL.createObjectURL(blob);
            } catch (err) {
                console.error(err);
                return;
            }
        } else {
            try {
                const data = await QRCode.toDataURL(text(), {
                    width: 600,
                    type: getMimeType(fileFormat()),
                });
                link.href = data;
            } catch (err) {
                console.error(err);
                return;
            }
        }

        link.click();
    };

    // ループ用のボタン形式リストに型アサーションを適用するため定数化します
    const formatOptions: FormatOption[] = [
        { value: "png", label: "PNG", desc: "標準・Web向け" },
        { value: "jpeg", label: "JPEG", desc: "汎用画像" },
        { value: "webp", label: "WebP", desc: "軽量・次世代" },
        { value: "svg", label: "SVG", desc: "ベクター・印刷用" },
    ];

    return (
        <div class="h-full w-full p-4 md:p-8 flex flex-col items-center bg-base-300/30 overflow-x-hidden">
            <div class="w-full max-w-7xl flex flex-col gap-8">
                {/* メインツールカード */}
                <div class="card bg-base-100 shadow-xl p-6 md:p-10 w-full border border-slate-200">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-slate-200 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2">
                            🔗 QRコード作成・高画質生成ツール
                        </h1>
                        <p class="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
                            URLや任意の文字列から高精度なQRコードを即座に生成します。
                            高解像度の<strong>SVG形式（ベクターデータ）</strong>
                            にも対応しており、Web用から印刷用のデザインまで幅広くご利用いただけます。
                        </p>
                    </div>

                    {/* グリッドコンテナ：左右2カラム */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：入力コントロール */}
                        <div class="lg:col-span-7 flex flex-col justify-between gap-6">
                            <div class="flex flex-col gap-6">
                                {/* 入力エリア */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-slate-700">
                                            QRコード化する文字列・URL
                                        </span>
                                    </label>
                                    <textarea
                                        value={text()}
                                        onInput={(e) =>
                                            setText(e.currentTarget.value)
                                        }
                                        class="textarea textarea-bordered w-full h-28 text-base bg-white border-2 border-slate-300 text-slate-900 focus:border-slate-500 font-medium"
                                        placeholder="https://example.com"
                                    />
                                </div>

                                {/* 保存オプション設定 */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-slate-700">
                                            出力フォーマット
                                        </span>
                                    </label>
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {/* item に FormatOption 型が適用されるように修正しました */}
                                        <For each={formatOptions}>
                                            {(item: FormatOption) => (
                                                <button
                                                    onClick={() => {
                                                        setFileFormat(
                                                            item.value,
                                                        );
                                                        if (qrData())
                                                            generate();
                                                    }}
                                                    class={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                                                        fileFormat() ===
                                                        item.value
                                                            ? "border-slate-700 bg-slate-100 text-slate-900 font-bold"
                                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <span class="text-sm font-black">
                                                        {item.label}
                                                    </span>
                                                    <span class="text-[9px] opacity-75 mt-0.5 whitespace-nowrap">
                                                        {item.desc}
                                                    </span>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>

                            {/* 生成ボタン */}
                            <div class="mt-4">
                                <button
                                    onClick={generate}
                                    disabled={!text()}
                                    class="btn bg-slate-800 hover:bg-slate-900 border-none text-white w-full text-lg h-16 font-black transition-all shadow-md"
                                >
                                    QRコードを作成する
                                </button>
                            </div>
                        </div>

                        {/* 右側：生成プレビュー */}
                        <div class="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-6 border border-slate-200 min-h-[300px]">
                            <Show
                                when={qrData()}
                                fallback={
                                    <div class="text-center p-8 space-y-2 text-slate-400">
                                        <span class="text-5xl block mb-2">
                                            📊
                                        </span>
                                        <p class="text-xs font-semibold leading-relaxed">
                                            文字列を入力して生成ボタンを押すと、
                                            <br />
                                            ここにプレビューが表示されます。
                                        </p>
                                    </div>
                                }
                            >
                                <div class="flex flex-col items-center gap-5 w-full animate-fade-in">
                                    <div class="relative group bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                        <img
                                            src={qrData()}
                                            alt="QRコード プレビュー"
                                            class="rounded-lg w-52 h-52 md:w-60 md:h-60 cursor-pointer hover:opacity-95 transition-all duration-300"
                                            onClick={() => setIsLarge(true)}
                                        />
                                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl pointer-events-none">
                                            <span class="text-white text-xs font-medium bg-slate-900/80 px-2 py-1 rounded">
                                                🔍 プレビューを拡大
                                            </span>
                                        </div>
                                    </div>

                                    <div class="flex gap-3 w-full max-w-sm">
                                        <button
                                            onClick={() => setIsLarge(true)}
                                            class="btn btn-outline border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex-1"
                                        >
                                            表示拡大
                                        </button>
                                        <button
                                            onClick={download}
                                            class="btn bg-slate-800 hover:bg-slate-900 text-white flex-1 text-base font-black border-none shadow-md"
                                        >
                                            保存 ({fileFormat().toUpperCase()})
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* 💡 お役立ちインフォメーションセクション */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* ツールならではのメリット */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-slate-200 shadow-sm justify-between">
                        <div>
                            <h2 class="text-lg font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-2">
                                ⚙️ 技術的な特徴と処理方式について
                            </h2>
                            <div class="space-y-4 text-xs text-slate-600 leading-relaxed font-medium">
                                <p>
                                    本ツールは、入力されたデータを外部のWebサーバーに転送することなく、
                                    <strong>
                                        お使いの端末（ブラウザ）内部のみでQRコードの画像データへ直接変換
                                    </strong>
                                    します。
                                </p>
                                <p>
                                    そのため、サーバーとの通信ラグが発生せず、常に一瞬で安全に生成が完了します（インターネットを切断したオフライン環境でも動作します）。
                                </p>
                                <p>
                                    生成したQRコードは商用・非商用問わず、印刷物やWebサイトなどに無制限かつ無料で永続的にご利用いただけます。
                                </p>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                            ※データの取り扱い方針に関する詳細は、当サイトの
                            <a
                                href="/privacy-policy"
                                class="text-slate-800 font-bold underline ml-1 hover:text-slate-950"
                            >
                                プライバシーポリシー
                            </a>
                            をご確認ください。
                        </div>
                    </div>

                    {/* FAQ：アコーディオン（Collapse） */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-slate-200 shadow-sm">
                        <h2 class="text-lg font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-2">
                            ❓ 技術的な仕様について（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q.
                                    生成したQRコードにアクセス期限や料金は発生しますか？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    いいえ。本ツールで生成するQRコードは、入力された情報がそのまま画像に埋め込まれている「静的なコード」です。当サイトを経由しないため、期限切れや後から課金されるような心配は一切ございません。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q.
                                    印刷・グラフィックデザインに適した形式はどれですか？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    パンフレットや大型ポスター、名刺など印刷用途で使用される場合は、縮小・拡大しても線の輪郭が絶対にぼやけないベクターデータ形式である
                                    <strong>「SVG形式」</strong>
                                    での保存を強く推奨します。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q.
                                    カメラでQRコードが正しく読み取れない場合の対処法は？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    入力したURLや文字列が長すぎる場合、コードのドットパターンが極限まで細密になり、カメラでピントが合わずに認識しづらくなることがあります。その場合は、短縮URLサービスなどを一度経由させてからQRコードを生成することをお試しください。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 拡大表示用モーダル */}
            <Show when={isLarge()}>
                <div
                    class="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 cursor-pointer"
                    onClick={() => setIsLarge(false)}
                >
                    <div class="relative max-w-full max-h-full bg-white p-5 rounded-2xl shadow-2xl flex flex-col items-center border border-slate-200">
                        <img
                            src={qrData()}
                            alt="QRコード 拡大表示"
                            class="max-w-[80vw] max-h-[75vh] object-contain"
                        />
                        <button
                            class="mt-4 btn btn-sm bg-slate-800 hover:bg-slate-900 border-none text-white text-xs font-bold px-4"
                            onClick={() => setIsLarge(false)}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
}
