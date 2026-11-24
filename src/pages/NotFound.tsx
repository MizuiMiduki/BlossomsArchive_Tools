import { onSettled } from "solid-js";
import { Meta } from "@solidjs/meta";
import { playPageEntrance } from "../utils/animations";

export default function NotFound() {
    let containerRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
    });

    return (
        <div ref={containerRef} class="ba-page ba-text-center" style={{ "max-width": "32rem", padding: "2rem 1rem" }}>
            <Meta name="robots" content="noindex" />

            <h1 class="ba-title" style={{ "font-size": "2.5rem" }}>404</h1>
            <p class="ba-text-muted" style={{ margin: 0 }}>お探しのページは見つかりませんでした。</p>
            <div>
                <a href="/" class="ba-text-primary ba-font-bold ba-underline">
                    ホームに戻る
                </a>
            </div>
        </div>
    );
}
