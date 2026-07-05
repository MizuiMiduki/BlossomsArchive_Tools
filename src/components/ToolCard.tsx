// src/components/ToolCard.tsx
export default function ToolCard(props: {
    title: string;
    desc: string;
    href: string;
}) {
    return (
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all border border-base-200">
            <div class="card-body">
                <h2 class="card-title text-xl font-bold">{props.title}</h2>
                <p class="text-base-content/70">{props.desc}</p>
                <div class="card-actions justify-end mt-4">
                    <a href={props.href} class="btn btn-primary btn-sm">
                        開く
                    </a>
                </div>
            </div>
        </div>
    );
}
