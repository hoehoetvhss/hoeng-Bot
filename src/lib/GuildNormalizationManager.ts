import type { Bot, GuildNormalizationTableRow } from '../@types/index.js';
import type { NormalizationFilterConfig } from './PlayerFilterManager.js';

export class GuildNormalizationManager {
    private readonly bot: Bot;
    private readonly guildNormalization: Map<string, NormalizationFilterConfig> = new Map();

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public initialize(): void {
        try {
            const db = this.bot.databaseManager?.getDatabase();
            if (!db) {
                this.bot.logger.error(this.bot.shardId, '[GuildNormalizationManager] Database is not initialized.');
                return;
            }

            const rows = db
                .prepare('SELECT guild_id, max_amplitude, adaptive FROM guild_normalization')
                .all() as unknown as GuildNormalizationTableRow[];
            for (const row of rows) {
                this.guildNormalization.set(row.guild_id, {
                    maxAmplitude: row.max_amplitude,
                    adaptive: row.adaptive === 1,
                });
            }

            this.bot.logger.log(
                this.bot.shardId,
                `[GuildNormalizationManager] Initialized with ${this.guildNormalization.size} guild-specific normalization setting(s)`,
            );
        } catch (error) {
            this.bot.logger.error(this.bot.shardId, `[GuildNormalizationManager] Failed to initialize: ${error}`);
        }
    }

    public get(guildId: string): NormalizationFilterConfig | null {
        const config = this.guildNormalization.get(guildId);
        return config ? { ...config } : null;
    }

    public set(guildId: string, config: NormalizationFilterConfig): void {
        try {
            if (!this.bot.databaseManager?.getDatabase()) {
                this.bot.logger.error(this.bot.shardId, '[GuildNormalizationManager] Database is not initialized.');
                return;
            }

            this.bot.databaseManager.executeTransaction(
                (db, id: string, maxAmplitude: number, adaptive: number) => {
                    db.prepare(
                        'INSERT OR REPLACE INTO guild_normalization (guild_id, max_amplitude, adaptive) VALUES (?, ?, ?)',
                    ).run(id, maxAmplitude, adaptive);
                },
                guildId,
                config.maxAmplitude,
                config.adaptive ? 1 : 0,
            );
            this.guildNormalization.set(guildId, { ...config });
        } catch (error) {
            this.bot.logger.error(
                this.bot.shardId,
                `[GuildNormalizationManager] Failed to set normalization for guild ${guildId}: ${error}`,
            );
        }
    }

    public clear(guildId: string): void {
        try {
            if (!this.bot.databaseManager?.getDatabase()) {
                this.bot.logger.error(this.bot.shardId, '[GuildNormalizationManager] Database is not initialized.');
                return;
            }

            this.bot.databaseManager.executeTransaction((db, id: string) => {
                db.prepare('DELETE FROM guild_normalization WHERE guild_id = ?').run(id);
            }, guildId);
            this.guildNormalization.delete(guildId);
        } catch (error) {
            this.bot.logger.error(
                this.bot.shardId,
                `[GuildNormalizationManager] Failed to clear normalization for guild ${guildId}: ${error}`,
            );
        }
    }

    public close(): void {
        this.guildNormalization.clear();
    }
}

export default GuildNormalizationManager;
