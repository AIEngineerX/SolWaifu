// Token Panel Controller
// Handles CA copy, social links, and DexScreener chart embed

document.addEventListener('DOMContentLoaded', () => {
    const config = window.TOKEN_CONFIG || {};

    // Elements
    const caAddress = document.getElementById('ca-address');
    const copyBtn = document.getElementById('copy-ca');
    const twitterLink = document.getElementById('twitter-link');
    const telegramLink = document.getElementById('telegram-link');
    const dexscreenerLink = document.getElementById('dexscreener-link');
    const dexscreenerIframe = document.getElementById('dexscreener-iframe');
    const buyLink = document.getElementById('buy-link');
    const chartLink = document.getElementById('chart-link');

    // Set CA
    if (caAddress && config.CA) {
        caAddress.textContent = config.CA === 'TBA' ? 'TBA' : truncateCA(config.CA);
        caAddress.title = config.CA;
    }

    // Copy CA button
    if (copyBtn && config.CA && config.CA !== 'TBA') {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(config.CA);
                copyBtn.classList.add('copied');
                setTimeout(() => copyBtn.classList.remove('copied'), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }

    // Social links
    if (twitterLink && config.TWITTER) {
        twitterLink.href = config.TWITTER;
        twitterLink.textContent = getTwitterHandle(config.TWITTER);
    }

    if (telegramLink && config.TELEGRAM) {
        telegramLink.href = config.TELEGRAM;
        telegramLink.textContent = getTelegramHandle(config.TELEGRAM);
    }

    // DexScreener
    if (dexscreenerLink && config.DEXSCREENER) {
        dexscreenerLink.href = config.DEXSCREENER;
    }

    if (chartLink && config.DEXSCREENER) {
        chartLink.href = config.DEXSCREENER;
    }

    // Load chart iframe if CA is set
    if (dexscreenerIframe && config.DEXSCREENER_EMBED && config.CA !== 'TBA') {
        dexscreenerIframe.src = config.DEXSCREENER_EMBED;
        dexscreenerIframe.onload = () => {
            dexscreenerIframe.classList.add('loaded');
        };
    }

    // Buy link
    if (buyLink && config.BUY_LINK) {
        buyLink.href = config.BUY_LINK;
    }
});

// Helper functions
function truncateCA(ca) {
    if (ca.length <= 12) return ca;
    return ca.slice(0, 6) + '...' + ca.slice(-4);
}

function getTwitterHandle(url) {
    const match = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
    return match ? '@' + match[1] : url;
}

function getTelegramHandle(url) {
    const match = url.match(/t\.me\/([^\/\?]+)/);
    return match ? 't.me/' + match[1] : url;
}
