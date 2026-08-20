class RedisClientMock {
    cache = new Map();
    queue = [];
    rateLimiters = new Map();
    // Cache operations
    async get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    async set(key, value, ttlSeconds) {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
        this.cache.set(key, { value, expiresAt });
    }
    async del(key) {
        this.cache.delete(key);
    }
    // Rate Limiting Middleware Helper
    async checkRateLimit(ip, limit = 100, windowMs = 60000) {
        const now = Date.now();
        let record = this.rateLimiters.get(ip);
        if (!record || now > record.resetAt) {
            record = { count: 1, resetAt: now + windowMs };
            this.rateLimiters.set(ip, record);
            return { allowed: true, remaining: limit - 1 };
        }
        record.count++;
        if (record.count > limit) {
            return { allowed: false, remaining: 0 };
        }
        return { allowed: true, remaining: limit - record.count };
    }
    // Background Async SMS / Email Queue Engine
    async pushQueueJob(job) {
        const fullJob = {
            ...job,
            id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            status: 'QUEUED',
            createdAt: new Date().toISOString(),
        };
        this.queue.push(fullJob);
        // Simulate async processing
        setTimeout(() => this.processQueue(), 500);
        return fullJob;
    }
    async processQueue() {
        const pendingJob = this.queue.find((j) => j.status === 'QUEUED');
        if (!pendingJob)
            return;
        pendingJob.status = 'PROCESSING';
        // Simulate Gateway dispatch
        setTimeout(() => {
            pendingJob.status = 'COMPLETED';
        }, 1000);
    }
    async getQueueJobs() {
        return this.queue;
    }
}
export const redis = new RedisClientMock();
