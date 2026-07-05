// src/pages/PrivacyPolicy.tsx

export default function PrivacyPolicy() {
    return (
        <div class="max-w-2xl mx-auto p-6 space-y-8">
            <h1 class="text-3xl font-bold">プライバシーポリシー</h1>

            <section class="space-y-4">
                <h2 class="text-xl font-bold">1. 運営について</h2>
                <p>
                    「BlossomsArchive
                    Tools」（以下「当アプリ」といいます）は、BlossomsArchive
                    (以下「当運営」といいます)
                    が提供するウェブアプリケーションです。
                </p>
            </section>

            <section class="space-y-4">
                <h2 class="text-xl font-bold">2. データの取り扱いについて</h2>
                <p>
                    当アプリは、ユーザーが入力したデータ、設定値、計算結果等の情報を、外部のサーバーへ送信・保存することはありません。すべてのデータ処理はユーザーのブラウザ（クライアントサイド）内でのみ完結します。当運営がユーザーのデータを収集・解析・蓄積することはありません。
                </p>
            </section>

            <section class="space-y-4">
                <h2 class="text-xl font-bold">3. 外部サービスの利用と例外</h2>
                <p>
                    当アプリでは、利便性の向上やアクセス解析等を目的として、Google
                    Analytics等の外部サービスやAPIを利用する場合があります。
                </p>
                <p>
                    これらのサービスにおいてデータが収集・利用される場合、当該データの管理および取り扱いは、各サービス提供者が定めるプライバシーポリシーおよび利用規約に基づきます。当アプリは、外部サービス側の仕様変更やデータ収集により発生した結果について一切の責任を負いません。
                </p>
            </section>

            <section class="space-y-4">
                <h2 class="text-xl font-bold">4. 免責事項</h2>
                <p>
                    当アプリの利用によりユーザーに生じた損害（データの消失、端末の不具合、外部サービスとの通信トラブルを含む）について、当運営は一切の責任を負いません。ご利用の際はご自身の責任において行ってください。
                </p>
            </section>

            <section class="space-y-4">
                <h2 class="text-xl font-bold">5. お問い合わせ</h2>
                <p>
                    本ポリシーに関するお問い合わせは、BlossomsArchive
                    公式ウェブサイトよりご連絡ください。
                </p>
                <p>
                    ウェブサイト:{" "}
                    <a
                        href="https://blossomsarchive.com"
                        class="text-primary hover:underline"
                    >
                        https://blossomsarchive.com
                    </a>
                </p>
            </section>

            <div class="pt-6 border-t border-base-200">
                <a href="/" class="btn btn-outline">
                    トップへ戻る
                </a>
            </div>
        </div>
    );
}
