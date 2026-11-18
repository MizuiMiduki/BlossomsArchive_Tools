import { For, onSettled } from "solid-js";
import { routes } from "../routes";
import AdSense from "../components/AdSense";
import { playPageEntrance } from "../utils/gsapAnimations";

export default function Home() {
    let containerRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".card");
        }
    });

    return (
        <div ref={containerRef} class="max-w-5xl mx-auto space-y-6 sm:space-y-8 min-w-0 w-full">
            <header class="mb-4 sm:mb-6">
                <h1 class="text-xl sm:text-2xl md:text-3xl font-black">
                    Webツール一覧
                </h1>
                <p class="text-xs sm:text-sm text-base-content/70 mt-1 sm:mt-2">
                    日常やWeb制作・開発に役立つ高品質な便利ツールを完全無料でご利用いただけます。
                </p>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <For each={routes.filter((r) => r.path !== "/" && !r.hidden)}>
                    {(route) => (
                        <div class="card bg-base-100 border border-base-300 shadow-sm min-w-0">
                            <div class="card-body p-4 sm:p-6">
                                <h2 class="card-title text-base sm:text-lg text-primary">
                                    {route.title}
                                </h2>
                                <p class="text-xs sm:text-sm text-base-content/60 leading-relaxed mb-4">
                                    {route.description || "便利なツールです"}
                                </p>

                                <div class="card-actions justify-end mt-auto">
                                    <a
                                        href={route.path}
                                        class="btn btn-primary btn-sm px-4 sm:px-6"
                                        aria-label={`${route.title} を使ってみる`}
                                    >
                                        使ってみる →
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
            <AdSense />
            <AdSense />
        </div>
    );
}
