document.addEventListener('DOMContentLoaded', () => {
    const kofiScript = document.createElement('script');
    kofiScript.type = 'text/javascript';
    kofiScript.src = 'https://storage.ko-fi.com/cdn/scripts/widget.js';
    kofiScript.async = true;
    document.head.appendChild(kofiScript);

    kofiScript.onload = () => {
        if (window.kofiwidget2) {
            kofiwidget2.init('Support me on Ko-fi', '#72a4f2', 'W7W81CIPSX');
            kofiwidget2.draw();
        }
    };
});
