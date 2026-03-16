import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import type { CacheOptions } from './cache.constants';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private client: RedisClientType | null = null;
    private readonly serviceName: string;
    private readonly logger = new Logger(CacheService.name);

    constructor(private readonly options: CacheOptions) {
        this.serviceName = options.name || 'default';
    }

    async onModuleInit() {
        this.client = createClient({
            url: this.options.redisUrl,
            password: this.options.password,
        });

        this.client.on('error', (err) =>
            console.error(
                `Redis Client Error [${this.serviceName} - ${this.options.redisUrl}]:`,
                err,
            ),
        );

        try {
            await this.client.connect();
            this.logger.verbose(
                `Connected to Redis [${this.serviceName}] at ${this.options.redisUrl}`,
            );
        } catch (err) {
            console.error(
                `Failed to connect to Redis [${this.serviceName} - ${this.options.redisUrl}]:`,
                err,
            );
        }
    }

    async onModuleDestroy() {
        if (this.client?.isOpen) {
            await this.client.quit();
            this.client = null;
            this.logger.verbose(
                `Disconnected from Redis [${this.serviceName}] at ${this.options.redisUrl}`,
            );
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.client?.isReady) return null;
        try {
            const value = await this.client.get(key);
            return value ? (JSON.parse(value) as T) : null;
        } catch (error) {
            console.error(`Error in GET from Redis, key: ${key}:`, error);
            return null;
        }
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        if (!this.client?.isReady) return;
        try {
            const stringValue = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.set(key, stringValue, { EX: ttlSeconds });
            } else {
                await this.client.set(key, stringValue);
            }
        } catch (error) {
            console.error(`Error in SET to Redis, key: ${key}:`, error);
        }
    }

    async del(key: string | string[]): Promise<void> {
        if (!this.client?.isReady) return;
        try {
            await this.client.del(key);
        } catch (error) {
            console.error(`Error in DEL from Redis, key: ${key}:`, error);
        }
    }

    async exists(key: string): Promise<boolean> {
        if (!this.client?.isReady) return false;
        try {
            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            console.error(`Error in EXISTS from Redis, key: ${key}:`, error);
            return false;
        }
    }

    async keys(pattern: string): Promise<string[]> {
        if (!this.client?.isReady) return [];
        try {
            return await this.client.keys(pattern);
        } catch (error) {
            console.error(`Error in KEYS from Redis, pattern: ${pattern}:`, error);
            return [];
        }
    }

    async ttl(key: string): Promise<number> {
        if (!this.client?.isReady) return -1;
        try {
            return await this.client.ttl(key);
        } catch (error) {
            console.error(`Error in TTL from Redis, key: ${key}:`, error);
            return -1;
        }
    }

    async expire(key: string, seconds: number): Promise<void> {
        if (!this.client?.isReady) return;
        try {
            await this.client.expire(key, seconds);
        } catch (error) {
            console.error(`Error in EXPIRE from Redis, key: ${key}:`, error);
        }
    }

    async incrWithExpire(key: string, expireSeconds: number): Promise<number> {
        if (!this.client?.isReady) return -1;
        try {
            const exists = await this.client.exists(key);
            const value = await this.client.incr(key);
            if (!exists) {
                await this.client.expire(key, expireSeconds);
            }
            return value;
        } catch (error) {
            console.error(`Error in INCR/EXPIRE from Redis, key: ${key}:`, error);
            return -1;
        }
    }
}
