import { For, onMount } from "solid-js";
import { routes } from "../routes";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/gsapAnimations";

export default function Home() {
    let containerRef: HTMLDivElement | undefined;

    onMount(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".card");
        }
    });

    return (
        <div ref={containerRef} class="max-w-5xl mx-auto space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={routes.filter((r) => r.path !== "/" && !r.hidden)}>
                    {(route) => (
                        /* カードはただの囲み要素にする */
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-6">
                                <h2 class="card-title text-primary">
                                    <BudouX text={route.title} />
                                </h2>
                                <p class="text-sm text-base-content/60 leading-relaxed mb-4">
                                    <BudouX text={route.description || "便利なツールです"} />
                                </p>

                                <div class="card-actions justify-end mt-auto">
                                    {/* ボタンだけにリンクをつける */}
                                    <a
                                        href={route.path}
                                        class="btn btn-primary btn-sm px-6"
                                    >
                                        Open →
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
