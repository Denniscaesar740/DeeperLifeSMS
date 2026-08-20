export interface JobData {
    id: string;
    type: 'SMS' | 'EMAIL' | 'WHATSAPP';
    recipient: string;
    payload: Record<string, any>;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: string;
}

class RedisClientMock {
    private cache: Map<string, { value: string; expiresAt?: number }> = new Map();
    private queue: JobData[] = [];
    private rateLimiters: Map<string, { count: number; resetAt: number }> = new Map();

    // Cache operations
    async get(key: string): Promise<string | null> {
        const item = this.cache.get(key);
        if (!item) return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
        this.cache.set(key, { value, expiresAt });
    }

    async del(key: string): Promise<void> {
        this.cache.delete(key);
    }

    // Rate Limiting Middleware Helper
    async checkRateLimit(ip: string, limit: number = 100, windowMs: number = 60000): Promise<{ allowed: boolean; remaining: number }> {
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
    async pushQueueJob(job: Omit<JobData, 'id' | 'status' | 'createdAt'>): Promise<JobData> {
        const fullJob: JobData = {
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

    private async processQueue() {
        const pendingJob = this.queue.find((j) => j.status === 'QUEUED');
        if (!pendingJob) return;

        pendingJob.status = 'PROCESSING';
        // Simulate Gateway dispatch
        setTimeout(() => {
            pendingJob.status = 'COMPLETED';
        }, 1000);
    }

    async getQueueJobs(): Promise<JobData[]> {
        return this.queue;
    }
}

export const redis = new RedisClientMock();
