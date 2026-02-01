try {
    const manifest = await fetch('/lunanthus/pwa/manifest.json');
    const manifest_data = await manifest.json();
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
        versionElement.textContent = manifest_data.version;
    }
} catch (error) {
    console.error('Error :', error);
}

try {
    const lunanthus_about = await fetch('/lunanthus/about/lunanthus_about.json');
    const lunanthus_about_data = await lunanthus_about.json();
    const lunanthusVersionElement = document.getElementById('lunanthus-version');
    if (lunanthusVersionElement) {
        lunanthusVersionElement.textContent = lunanthus_about_data.version;
    }
} catch (error) {
    console.error('Error :', error);
}
export {};

$("#year").text(new Date().getFullYear());
