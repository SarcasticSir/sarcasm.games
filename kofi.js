document.addEventListener('DOMContentLoaded', () => {
    // Denne sjekken forhindrer at skriptet lastes flere ganger
    if (document.querySelector('script[src="https://storage.ko-fi.com/cdn/scripts/widget.js"]')) {
        return;
    }

    // Lag det første skript-elementet som Ko-fi trenger
    const kofiMainScript = document.createElement('script');
    kofiMainScript.type = 'text/javascript';
    kofiMainScript.src = 'https://storage.ko-fi.com/cdn/scripts/widget.js';
    kofiMainScript.async = true;
    
    // Legg til skriptet i body-taggen
    document.body.appendChild(kofiMainScript);

    // Når Ko-fi-skriptet er lastet, kjør init-funksjonen
    kofiMainScript.onload = () => {
        if (window.kofiwidget2) {
            // Initialiser Ko-fi-widgeten
            window.kofiwidget2.init('Support me on Ko-fi', '#72a4f2', 'W7W81CIPSX');
            window.kofiwidget2.draw();
            
            // Gi Ko-fi-knappen en stilig posisjon nederst til venstre
            const kofiButtonWrapper = document.getElementById('kofi-widget-wrapper');
            if (kofiButtonWrapper) {
                kofiButtonWrapper.style.position = 'fixed';
                kofiButtonWrapper.style.bottom = '20px';
                kofiButtonWrapper.style.left = '20px';
                kofiButtonWrapper.style.right = 'auto'; 
                kofiButtonWrapper.style.zIndex = '1000';
            }
        }
    };
});
