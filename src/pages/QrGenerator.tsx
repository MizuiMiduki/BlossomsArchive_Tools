import { createSignal, onSettled, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { animatePop, delayedCall, playPageEntrance } from "../utils/animations";

// ボタンオプション用の型を定義して TypeScript に型を教えます
interface FormatOption {
    value: string;
    label: string;
    desc: string;
}

export default function QrGenerator() {
    const [mode, setMode] = createSignal<"text" | "wifi">("text");
    const [text, setText] = createSignal("");
    const [wifiSsid, setWifiSsid] = createSignal("");
    const [wifiPassword, setWifiPassword] = createSignal("");
    const [wifiAuth, setWifiAuth] = createSignal<"WPA" | "WEP" | "nopass">("WPA");
    const [wifiHidden, setWifiHidden] = createSignal(false);
    const [showPassword, setShowPassword] = createSignal(false);

    const [qrData, setQrData] = createSignal("");
    const [isLarge, setIsLarge] = createSignal(false);
    const [fileFormat, setFileFormat] = createSignal("png");

    let containerRef: HTMLDivElement | undefined;
    let generateButtonRef: HTMLButtonElement | undefined;

    const escapeWifiStr = (str: string) => {
        return str.replace(/([\\;,":])/g, "\\$1");
    };

    const getPayload = () => {
        if (mode() === "wifi") {
            const ssid = escapeWifiStr(wifiSsid());
            const pass = escapeWifiStr(wifiPassword());
            const auth = wifiAuth();
            const hidden = wifiHidden() ? "true" : "false";
            return `WIFI:S:${ssid};T:${auth};P:${pass};H:${hidden};;`;
        }
        return text();
    };

    const isPayloadValid = () => {
        if (mode() === "wifi") {
            return wifiSsid().trim().length > 0;
        }
        return text().trim().length > 0;
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
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
        const payload = getPayload();
        if (!payload) return;
        if (generateButtonRef) animatePop(generateButtonRef);
        try {
            const { default: QRCode } = await import("qrcode");
            const data = await QRCode.toDataURL(payload, {
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
        const payload = getPayload();
        if (!qrData() || !payload) return;

        const safePrefix = mode() === "wifi" ? `wifi_${wifiSsid()}` : text();
        const safeInput = safePrefix
            .replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龠_-]/g, "_")
            .substring(0, 20);
        const dateTimeStr = getFormattedDateTime();
        const fileName = `qrcode_${safeInput}_${dateTimeStr}.${fileFormat()}`;

        const link = document.createElement("a");
        link.download = fileName;

        let revokeUrl = "";

        if (fileFormat() === "svg") {
            try {
                const { default: QRCode } = await import("qrcode");
                const svgString = await QRCode.toString(payload, {
                    type: "svg",
                    width: 600,
                });
                const blob = new Blob([svgString], { type: "image/svg+xml" });
                revokeUrl = URL.createObjectURL(blob);
                link.href = revokeUrl;
            } catch (err) {
                console.error(err);
                return;
            }
        } else {
            try {
                const { default: QRCode } = await import("qrcode");
                const data = await QRCode.toDataURL(payload, {
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
        if (revokeUrl) {
            const urlToRevoke = revokeUrl;
            delayedCall(1, () => URL.revokeObjectURL(urlToRevoke));
        }
    };

    // ループ用のボタン形式リストに型アサーションを適用するため定数化します
    const formatOptions: FormatOption[] = [
        { value: "png", label: "PNG", desc: "標準・Web向け" },
        { value: "jpeg", label: "JPEG", desc: "汎用画像" },
        { value: "webp", label: "WebP", desc: "軽量・次世代" },
        { value: "svg", label: "SVG", desc: "ベクター・高品質" },
    ];

    return (
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                {/* メインツールカード */}
                <div class="card bg-base-100 shadow-xl p-3 sm:p-6 md:p-10 w-full border border-base-300 min-w-0">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-base-300 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="QRコード作成・生成ツール" />
                        </h1>
                        <BudouX
                            as="p"
                            class="text-xs font-semibold text-base-content/70 mt-2 leading-relaxed"
                            text="WebサイトのURLや任意のテキストから、高品質なQRコードをブラウザ内で瞬時に作成します。高解像度PNGに加え、拡大しても画質が荒れないベクター（SVG）出力に対応しています。"
                        />
                    </div>

                    {/* 2カラムレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：設定コントロール */}
                        <div class="lg:col-span-7 flex flex-col justify-between gap-6">
                            <div class="flex flex-col gap-6">
                                {/* 種別タブ（テキスト・URL / Wi-Fi） */}
                                <div class="tabs tabs-boxed bg-base-200/80 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        class={`tab flex-1 font-bold text-xs sm:text-sm transition-all rounded-lg ${
                                            mode() === "text"
                                                ? "tab-active bg-primary text-white shadow-sm"
                                                : "text-base-content/80 hover:text-base-content"
                                        }`}
                                        onClick={() => setMode("text")}
                                    >
                                        テキスト・URL
                                    </button>
                                    <button
                                        type="button"
                                        class={`tab flex-1 font-bold text-xs sm:text-sm transition-all rounded-lg ${
                                            mode() === "wifi"
                                                ? "tab-active bg-primary text-white shadow-sm"
                                                : "text-base-content/80 hover:text-base-content"
                                        }`}
                                        onClick={() => setMode("wifi")}
                                    >
                                        Wi-Fi接続設定
                                    </button>
                                </div>

                                {/* 1. 文字列入力フォーム or Wi-Fi入力 */}
                                <Show
                                    when={mode() === "wifi"}
                                    fallback={
                                        <div class="form-control w-full">
                                            <label class="label py-1">
                                                <span class="label-text font-bold text-sm text-base-content/90">
                                                    QRコードに埋め込む文字列・URL
                                                </span>
                                            </label>
                                            <textarea
                                                value={text()}
                                                aria-label="QRコードに埋め込む文字列・URL"
                                                onInput={(e) =>
                                                    setText(e.currentTarget.value)
                                                }
                                                class="textarea textarea-bordered w-full h-32 text-sm bg-base-100 border-2 border-base-300 text-base-content font-medium p-3 focus:outline-none shadow-sm"
                                                placeholder="https://example.com または 任意のテキストを入力してください"
                                            />
                                        </div>
                                    }
                                >
                                    <div class="space-y-3 bg-base-200/50 p-4 rounded-xl border border-base-300">
                                        <div class="form-control w-full">
                                            <label class="label py-1">
                                                <span class="label-text font-bold text-xs text-base-content/90">
                                                    ネットワーク名 (SSID) *
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                value={wifiSsid()}
                                                onInput={(e) => setWifiSsid(e.currentTarget.value)}
                                                class="input input-bordered input-sm w-full bg-base-100"
                                                placeholder="My-Home-WiFi"
                                                aria-label="SSID (ネットワーク名)"
                                            />
                                        </div>

                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div class="form-control w-full">
                                                <label class="label py-1">
                                                    <span class="label-text font-bold text-xs text-base-content/90">
                                                        セキュリティ方式
                                                    </span>
                                                </label>
                                                <select
                                                    value={wifiAuth()}
                                                    onChange={(e) => setWifiAuth(e.currentTarget.value as any)}
                                                    class="select select-bordered select-sm w-full bg-base-100"
                                                    aria-label="セキュリティ方式"
                                                >
                                                    <option value="WPA">WPA / WPA2 / WPA3</option>
                                                    <option value="WEP">WEP</option>
                                                    <option value="nopass">パスワードなし (オープン)</option>
                                                </select>
                                            </div>

                                            <Show when={wifiAuth() !== "nopass"}>
                                                <div class="form-control w-full">
                                                    <label class="label py-1">
                                                        <span class="label-text font-bold text-xs text-base-content/90">
                                                            パスワード
                                                        </span>
                                                    </label>
                                                    <div class="relative">
                                                        <input
                                                            type={showPassword() ? "text" : "password"}
                                                            value={wifiPassword()}
                                                            onInput={(e) => setWifiPassword(e.currentTarget.value)}
                                                            class="input input-bordered input-sm w-full bg-base-100 pr-9"
                                                            placeholder="パスワードを入力"
                                                            aria-label="Wi-Fiパスワード"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword())}
                                                            class="btn btn-ghost btn-xs btn-square absolute right-1 top-1 text-base-content/60"
                                                            aria-label={showPassword() ? "パスワードを隠す" : "パスワードを表示"}
                                                        >
                                                            <Show
                                                                when={showPassword()}
                                                                fallback={
                                                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                    </svg>
                                                                }
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                                </svg>
                                                            </Show>
                                                        </button>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>

                                        <label class="label cursor-pointer justify-start gap-2 py-0">
                                            <input
                                                type="checkbox"
                                                checked={wifiHidden()}
                                                onChange={(e) => setWifiHidden(e.currentTarget.checked)}
                                                class="checkbox checkbox-xs checkbox-primary"
                                                aria-label="非公開ネットワーク (ステルスSSID)"
                                            />
                                            <span class="label-text text-xs text-base-content/80 font-medium">
                                                非公開ネットワーク (ステルスSSID)
                                            </span>
                                        </label>
                                    </div>
                                </Show>

                                {/* 2. 保存フォーマットの選択 */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            保存形式の選択
                                        </span>
                                    </label>
                                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <For each={formatOptions}>
                                            {(opt) => (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setFileFormat(opt.value)
                                                    }
                                                    class={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                                                        fileFormat() ===
                                                        opt.value
                                                            ? "border-primary bg-primary/25 text-primary dark:text-white font-black shadow-sm"
                                                            : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content font-bold"
                                                    }`}
                                                >
                                                    <span class="font-black text-sm">
                                                        {opt.label}
                                                    </span>
                                                    <span class="text-[10px] text-base-content/85 font-semibold mt-0.5">
                                                        {opt.desc}
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
                                    ref={generateButtonRef}
                                    onClick={generate}
                                    disabled={!isPayloadValid()}
                                    class="btn btn-primary text-white w-full text-lg h-16 font-black transition-all shadow-md"
                                >
                                    QRコードを作成する
                                </button>
                            </div>
                        </div>

                        {/* 右側：生成プレビュー */}
                        <div class="lg:col-span-5 flex flex-col items-center justify-center bg-base-200/60 rounded-2xl p-6 border border-base-300 min-h-[300px]">
                            <Show
                                when={qrData()}
                                fallback={
                                    <div class="text-center p-8 space-y-2 text-base-content/60">
                                        <div class="flex justify-center mb-2 text-base-content/60">
                                            <ToolIcon name="qr" class="w-10 h-10" />
                                        </div>
                                        <p class="text-xs font-semibold leading-relaxed">
                                            文字列を入力して生成ボタンを押すと、
                                            <br />
                                            ここにプレビューが表示されます。
                                        </p>
                                    </div>
                                }
                            >
                                <div
                                    class="flex flex-col items-center gap-5 w-full"
                                >
                                    <div class="relative group bg-white p-4 rounded-2xl shadow-sm border border-base-300">
                                        <img
                                            src={qrData()}
                                            alt="QRコード プレビュー"
                                            class="rounded-lg w-52 h-52 md:w-60 md:h-60 cursor-pointer hover:opacity-95 transition-all duration-300"
                                            onClick={() => setIsLarge(true)}
                                        />
                                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl pointer-events-none">
                                            <span class="text-white text-xs font-medium bg-neutral/90 px-2 py-1 rounded">
                                                プレビューを拡大
                                            </span>
                                        </div>
                                    </div>

                                    <div class="flex gap-3 w-full max-w-sm">
                                        <button
                                            onClick={() => setIsLarge(true)}
                                            class="btn btn-outline border-base-300 text-base-content hover:bg-base-200 font-bold flex-1"
                                        >
                                            表示拡大
                                        </button>
                                        <button
                                            onClick={download}
                                            class="btn btn-primary text-white flex-1 text-base font-black border-none shadow-md"
                                        >
                                            保存 ({fileFormat().toUpperCase()})
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* お役立ちインフォメーションセクション */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* ツールならではのメリット */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm justify-between">
                        <div>
                            <h2 class="text-lg font-bold text-base-content border-b border-base-300 pb-3 mb-5 flex items-center gap-2">
                                技術的な特徴と処理方式について
                            </h2>
                            <div class="space-y-4 text-xs text-base-content/80 leading-relaxed font-medium">
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
                        <div class="mt-6 pt-4 border-t border-base-200 text-xs text-base-content/60">
                            ※データの取り扱い方針に関する詳細は、当サイトの
                            <a
                                href="/privacy"
                                class="text-base-content font-bold underline ml-1 hover:text-primary"
                            >
                                プライバシーポリシー
                            </a>
                            をご確認ください。
                        </div>
                    </div>

                    {/* FAQ：アコーディオン（Collapse） */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm">
                        <h2 class="text-lg font-bold text-base-content border-b border-base-300 pb-3 mb-5 flex items-center gap-2">
                            技術的な仕様について（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="アクセス期限や料金についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    生成したQRコードにアクセス期限や料金は発生しますか？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    いいえ。本ツールで生成するQRコードは、入力された情報がそのまま画像に埋め込まれている「静的なコード」です。当サイトを経由しないため、期限切れや後から課金されるような心配は一切ございません。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="印刷・グラフィックデザインに適した形式についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    印刷・グラフィックデザインに適した形式はどれですか？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    パンフレットや大型ポスター、名刺など印刷用途で使用される場合は、縮小・拡大しても線の輪郭が絶対にぼやけないベクターデータ形式である
                                    <strong>「SVG形式」</strong>
                                    での保存を強く推奨します。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="カメラでQRコードが正しく読み取れない場合の対処法についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    カメラでQRコードが正しく読み取れない場合の対処法は？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    入力したURLや文字列が長すぎる場合、コードのドットパターンが極限まで細密になり、カメラでピントが合わずに認識しづらくなることがあります。その場合は、短縮URLサービスなどを一度経由させてからQRコードを生成することをお試しください。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />

            {/* 拡大表示用モーダル */}
            <Show when={isLarge()}>
                <div
                    class="fixed inset-0 bg-neutral/80 flex items-center justify-center z-50 p-4 cursor-pointer"
                    onClick={() => setIsLarge(false)}
                >
                    <div
                        class="relative max-w-full max-h-full bg-base-100 p-5 rounded-2xl shadow-2xl flex flex-col items-center border border-base-300"
                    >
                        <img
                            src={qrData()}
                            alt="QRコード 拡大表示"
                            class="max-w-[80vw] max-h-[75vh] object-contain bg-white p-2 rounded-lg"
                        />
                        <button
                            class="mt-4 btn btn-sm btn-primary text-white text-xs font-bold px-4"
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
