import { Meta } from "@solidjs/meta";

export default function NotFound() {
    return (
        <div class="p-10 text-center">
            <Meta name="robots" content="noindex" />

            <h1 class="text-4xl font-bold">404</h1>
            <p class="mt-4">お探しのページは見つかりませんでした。</p>
            <a href="/" class="text-blue-500 underline mt-4 block">
                ホームに戻る
            </a>
        </div>
    );
}
