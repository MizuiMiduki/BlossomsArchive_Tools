const fetchAccessInfo = () => {
    fetch('https://api.ipbase.com/v1/json/')
        .then(res => res.json())
        .then(data => {
            const infoElement = document.getElementById("accessInfo");

            if (infoElement) {
                infoElement.innerHTML = `
                    IPアドレス: ${data.ip || '不明'}<br>
                    国: ${data.country_name || '不明'} (${data.country_code || '--'})<br>
                    都道府県: ${data.region_name || '不明'} (${data.region_code || '--'})<br>
                    都市: ${data.city || '不明'}<br>
                    郵便番号: ${data.zip_code || '不明'}<br>
                    タイムゾーン: ${data.time_zone || '不明'}<br>
                    緯度: ${data.latitude || '0'}<br>
                    経度: ${data.longitude || '0'}<br>
                `;
            }
        })
        .catch(error => {
            console.error("IP Base Error:", error);
            const infoElement = document.getElementById("accessInfo");
            if (infoElement) {
                infoElement.innerText = "情報を取得できませんでした";
            }
        });
};

fetchAccessInfo();
