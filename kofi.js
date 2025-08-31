document.addEventListener('DOMContentLoaded', () => {
    // Sørg for at skriptet bare kjører én gang
    if (document.querySelector('script[src="https://storage.ko-fi.com/cdn/scripts/widget.js"]')) {
        return;
    }

    const kofiScript = document.createElement('script');
    kofiScript.type = 'text/javascript';
    kofiScript.src = 'https://storage.ko-fi.com/cdn/scripts/widget.js';
    kofiScript.async = true;
    document.head.appendChild(kofiScript);

    kofiScript.onload = () => {
        if (window.kofiwidget2) {
            kofiwidget2.init('Support me on Ko-fi', '#72a4f2', 'W7W81CIPSX');
            kofiwidget2.draw();
            
            // Juster posisjonen til Ko-fi-knappen for å flytte den til nederst venstre
            const kofiButtonWrapper = document.getElementById('kofi-widget-wrapper');
            if (kofiButtonWrapper) {
                kofiButtonWrapper.style.position = 'fixed';
                kofiButtonWrapper.style.bottom = '20px';
                kofiButtonWrapper.style.left = '20px';
                kofiButtonWrapper.style.right = 'auto'; // Fjern høyre-justering
                kofiButtonWrapper.style.zIndex = '1000'; // Sørg for at den ligger over annet innhold
            }
        }
    };
});
