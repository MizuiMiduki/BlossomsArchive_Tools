import { For } from "solid-js";
import { routes } from "../routes";

export default function Home() {
    return (
        <div class="max-w-5xl mx-auto space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={routes.filter((r) => r.path !== "/")}>
                    {(route) => (
                        /* カードはただの囲み要素にする */
                        <div class="card bg-base-100 border border-base-300 shadow-sm transition-all duration-300">
                            <div class="card-body p-6">
                                <h2 class="card-title text-primary">
                                    {route.title}
                                </h2>
                                <p class="text-sm text-base-content/60 leading-relaxed mb-4">
                                    {route.description || "便利なツールです"}
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
        </div>
    );
}
