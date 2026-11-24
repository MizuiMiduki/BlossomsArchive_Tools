// src/pages/PrivacyPolicy.tsx
import { onSettled } from "solid-js";
import { playPageEntrance } from "../utils/animations";

export default function PrivacyPolicy() {
    let containerRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
    });

    return (
        <div ref={containerRef} class="ba-page ba-page--narrow">
            <h1 class="ba-title">プライバシーポリシー</h1>

            <section class="ba-stack-3">
                <h2 class="ba-section-title">1. 運営について</h2>
                <p style={{ margin: 0 }}>
                    「BlossomsArchive
                    Tools」（以下「当アプリ」といいます）は、BlossomsArchive
                    (以下「当運営」といいます)
                    が提供するウェブアプリケーションです。
                </p>
            </section>

            <section class="ba-stack-3">
                <h2 class="ba-section-title">2. データの取り扱いについて</h2>
                <p style={{ margin: 0 }}>
                    当アプリは、ユーザーが入力したデータ、設定値、計算結果等の情報を、外部のサーバーへ送信・保存することはありません。すべてのデータ処理はユーザーのブラウザ（クライアントサイド）内でのみ完結します。当運営がユーザーのデータを収集・解析・蓄積することはありません。
                </p>
            </section>

            <section class="ba-stack-3">
                <h2 class="ba-section-title">3. 広告配信とアクセス解析ツールについて</h2>
                <p style={{ margin: 0 }}>
                    当アプリでは、第三者配信の広告サービス「Google AdSense」およびアクセス解析ツール「Google アナリティクス」を利用しています。
                </p>
                <p class="ba-font-bold" style={{ margin: 0 }}>【Google AdSenseについて】</p>
                <p style={{ "padding-left": "1rem", margin: 0 }}>
                    Googleなどの第三者配信事業者は、Cookie（クッキー）を使用して、ユーザーが当アプリや他のウェブサイトに過去にアクセスした際の情報に基づいて適切な広告を配信します。
                </p>
                <p class="ba-font-bold" style={{ margin: 0 }}>【Google アナリティクスについて】</p>
                <p style={{ "padding-left": "1rem", margin: 0 }}>
                    Google アナリティクスはデータの収集のためにCookieを使用しています。このデータは匿名で収集されており、個人を特定するものではありません。
                </p>
                <p style={{ margin: 0 }}>
                    これらのサービスにおいてデータが収集・利用される方法の詳細については、Googleの
                    <a
                        href="https://policies.google.com/technologies/partner-sites"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ba-text-primary ba-underline ba-font-bold"
                    >
                        ポリシーと規約
                    </a>
                    をご覧ください。
                </p>
            </section>

            <section class="ba-stack-3">
                <h2 class="ba-section-title">4. 免責事項</h2>
                <p style={{ margin: 0 }}>
                    当アプリの利用によりユーザーに生じた損害（データの消失、端末の不具合、外部サービスとの通信トラブルを含む）について、当運営は一切の責任を負いません。ご利用の際はご自身の責任において行ってください。
                </p>
            </section>

            <section class="ba-stack-3">
                <h2 class="ba-section-title">5. お問い合わせ</h2>
                <p style={{ margin: 0 }}>
                    本ポリシーに関するお問い合わせは、BlossomsArchive
                    公式ウェブサイトよりご連絡ください。
                </p>
                <p style={{ margin: 0 }}>
                    ウェブサイト:{" "}
                    <a
                        href="https://blossomsarchive.com"
                        class="ba-text-primary ba-underline ba-font-bold"
                    >
                        https://blossomsarchive.com
                    </a>
                </p>
            </section>

            <div style={{ "padding-top": "1.5rem", "border-top": "1px solid var(--ba-border)" }}>
                <a href="/" class="ba-btn ba-btn--outline">
                    トップへ戻る
                </a>
            </div>
        </div>
    );
}
