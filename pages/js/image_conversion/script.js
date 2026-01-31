document.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (target.id === "convertBtn") {
        const fileInput = /** @type {HTMLInputElement | null} */ (document.getElementById("inputFile"));
        const formatSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("formatSelect"));
        const preview = document.getElementById("previewArea");

        if (!fileInput || !formatSelect || !preview) return;
        if (!fileInput.files || !fileInput.files.length) {
            alert("画像ファイルを選択してください。");
            return;
        }

        const format = formatSelect.value;
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                ctx.drawImage(img, 0, 0);

                try {
                    // canvasの内容をBlobに変換
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            alert("変換に失敗しました。");
                            return;
                        }
                        const url = URL.createObjectURL(blob);
                        const extension = format.split("/")[1].toUpperCase();

                        preview.innerHTML = `
                            <p>変換結果（${extension}）</p>
                            <div>
                            <a href="${url}" download="converted.${extension.toLowerCase()}">
                                <button>
                                    <i>download</i>
                                    <span>ダウンロード</span>
                                </button>
                                </a>
                            </div>
                            <hr class="small">
                            <img src="${url}" style="max-width: 100%;">
                        `;
                    }, format, 0.92);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    alert("変換エラー: " + message);
                }
            };
            img.src = String(event.target?.result || "");
        };

        reader.readAsDataURL(file);
    }
});
