import fs, { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { ShardingManager } from 'discord.js';


/**
 * IPC message sent from shard processes to the main process.
 * The main process is the single writer for the log file.
 */
export interface LogIPCMessage {
    type: 'LOGGER_LOG';
    message: string;
}

function isLogIPCMessage(msg: unknown): msg is LogIPCMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as LogIPCMessage).type === 'LOGGER_LOG' &&
        typeof (msg as LogIPCMessage).message === 'string'
    );
}


export class Logger {
    public readonly logDir: string;
    public format: string;

    /** True when running inside a Discord.js shard worker process. */
    readonly #isShardProcess: boolean;

    // Main-process-only state (unused in shard mode)
    #cachedLogLines: string[];
    #logFilePath: string;
    #currentLogDate: string;
    #isWriting: boolean;
    #logQueue: Array<{ date: string; message: string }>;

    // Common state
    #formatTokens: string[];


    /**
     * @param {string} format  - Time format string, e.g. `YYYY-MM-DD HH:mm:ss.l`
     * @param {string} logDir  - Directory for log files (main process only). Default: `./logs`
     */
    constructor(format: string = 'YYYY-MM-DD HH:mm:ss.l', logDir: string = './logs') {
        this.format = format;
        this.logDir = logDir;
        this.#formatTokens = this.#parseFormatTokens();

        // Detect whether we are inside a shard worker process spawned by Discord.js.
        // process.send is only defined in child processes, not in the main process.
        this.#isShardProcess = typeof process.send === 'function';

        // Initialize all fields with defaults (required for definite assignment)
        this.#cachedLogLines = [];
        this.#logFilePath = '';
        this.#currentLogDate = '';
        this.#isWriting = false;
        this.#logQueue = [];

        console.log(this.getFormatTime(), 'Initialize Logger ......');

        if (!this.#isShardProcess) {
            // Main process: set up the log file and archive stale entries
            this.#currentLogDate = this.getCurrentDate();

            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            this.#logFilePath = path.join(logDir, 'bot.log');
            this.#checkAndArchiveLogFile();
            this.#cachedLogLines = this.#loadCachedLogLines();
        }
    }


    // -------------------------------------------------------------------------
    // Public logging methods (work in both main and shard processes)
    // -------------------------------------------------------------------------

    /**
     * Logs a general shard message: `[TIMESTAMP] [#shardId] message`
     */
    public log(shardId: number, message: string): void {
        this.#write(`${this.getFormatTime()} [#${shardId}] ${message}`);
    }

    /**
     * Logs a shard error message: `[TIMESTAMP] [#shardId] [error] message`
     */
    public error(shardId: number, message: string): void {
        this.#write(`${this.getFormatTime()} [#${shardId}] [error] ${message}`);
    }

    /**
     * Logs a shard Discord event message: `[TIMESTAMP] [#shardId] [discord] message`
     */
    public discord(shardId: number, message: string): void {
        this.#write(`${this.getFormatTime()} [#${shardId}] [discord] ${message}`);
    }

    /**
     * Logs a shard LavaShark event message: `[TIMESTAMP] [#shardId] [lavashark] message`
     */
    public lavashark(shardId: number, message: string): void {
        this.#write(`${this.getFormatTime()} [#${shardId}] [lavashark] ${message}`);
    }

    /**
     * Logs a system-level API message: `[TIMESTAMP] [api] message`
     */
    public api(message: string): void {
        this.#write(`${this.getFormatTime()} [api] ${message}`);
    }

    /**
     * Logs a system-level i18n message: `[TIMESTAMP] [i18n] message`
     */
    public i18n(message: string): void {
        this.#write(`${this.getFormatTime()} [i18n] ${message}`);
    }

    /**
     * Logs a system-level local node message: `[TIMESTAMP] [localNode] message`
     */
    public localNode(message: string): void {
        this.#write(`${this.getFormatTime()} [localNode] ${message}`);
    }

    /**
     * Logs a system-level shard controller message: `[TIMESTAMP] [shard] message`
     */
    public shard(message: string): void {
        this.#write(`${this.getFormatTime()} [shard] ${message}`);
    }


    // -------------------------------------------------------------------------
    // Public utility methods
    // -------------------------------------------------------------------------

    /**
     * Registers a Discord.js ShardingManager so the main-process Logger can receive
     * log messages forwarded from all shard worker processes via IPC.
     *
     * Must be called in the main process before shards are spawned.
     */
    public attachShardManager(manager: ShardingManager): void {
        manager.on('shardCreate', (shard) => {
            shard.on('message', (msg: unknown) => {
                if (isLogIPCMessage(msg)) {
                    this.#receiveShardLog(msg.message);
                }
            });
        });
    }

    /**
     * Returns all log lines from the current log file.
     * Reads directly from disk to include entries from all processes.
     */
    public async getAllLogs(): Promise<string[] | false> {
        try {
            const fileContent = await fsPromises.readFile(this.#logFilePath, 'utf-8');
            const trimmedContent = fileContent.trim();
            return trimmedContent ? trimmedContent.split('\n') : [];
        } catch (error) {
            console.error(this.getFormatTime(), 'Failed to read log file:', error);
            return false;
        }
    }

    /**
     * Returns all cached log lines strictly before the given 1-based line number.
     * Line N is at cache index N-1; this returns indices 0 … N-2 (i.e. lines 1 … N-1).
     * @param {number} lineNumber - 1-based exclusive upper bound.
     */
    public getLogsBeforeLine(lineNumber: number): string[] | false {
        if (lineNumber < 1) {
            return false;
        }

        // slice(0, lineNumber - 1) yields lines 1 … lineNumber-1
        return this.#cachedLogLines.slice(0, lineNumber - 1);
    }

    /**
     * Returns all cached log lines strictly after the given 1-based line number.
     * Line N is at cache index N-1; this returns indices N … end (i.e. lines N+1 … end).
     * @param {number} lineNumber - 1-based exclusive lower bound.
     */
    public getLogsAfterLine(lineNumber: number): string[] | false {
        if (lineNumber < 1) {
            return false;
        }

        // slice(lineNumber) yields lines lineNumber+1 … end
        return this.#cachedLogLines.slice(lineNumber);
    }

    /**
     * Returns the total number of log lines currently held in the in-process cache.
     * Useful for computing cursor offsets without reading from disk.
     */
    public getLogsCount(): number {
        return this.#cachedLogLines.length;
    }

    /**
     * Returns a stable identifier for the currently active log source.
     * Always returns today's date so all processes agree on the same ID.
     */
    public getActiveLogSourceId(): string {
        return this.getCurrentDate();
    }

    /**
     * Returns the current date in 'YYYY-MM-DD' format.
     */
    public getCurrentDate(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    /**
     * Returns the formatted current timestamp, e.g. `[2026-01-01 12:00:00.000]`.
     */
    public getFormatTime(): string {
        const now = new Date();

        const timeValues: { [token: string]: string } = {
            'YYYY': String(now.getFullYear()),
            'MM': String(now.getMonth() + 1).padStart(2, '0'),
            'DD': String(now.getDate()).padStart(2, '0'),
            'HH': String(now.getHours()).padStart(2, '0'),
            'hh': String(now.getHours() % 12 || 12).padStart(2, '0'),
            'mm': String(now.getMinutes()).padStart(2, '0'),
            'ss': String(now.getSeconds()).padStart(2, '0'),
            'l': String(now.getMilliseconds()).padStart(3, '0'),
        };

        const formattedTime = this.#formatTokens.reduce(
            (result, token) => result.replace(token, timeValues[token]),
            this.format
        );

        if (this.#formatTokens.includes('hh')) {
            const period = Number(timeValues['HH']) < 12 ? 'AM' : 'PM';
            return formattedTime + ` ${period}`;
        }

        return '[' + formattedTime + ']';
    }


    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Core dispatch point for every log message.
     *
     * - Shard process: prints to stdout and forwards to the main process via IPC.
     * - Main process: prints to stdout and enqueues for sequential file writing.
     * @private
     */
    #write(message: string): void {
        console.log(message);

        if (this.#isShardProcess) {
            // Forward to the main process; it owns the log file.
            const ipcMsg: LogIPCMessage = { type: 'LOGGER_LOG', message };
            process.send!(ipcMsg);
        } else {
            // Extract date from the timestamp in the message (e.g. '2026-01-01')
            const date = message
                .replace(/\r\n|\r|\n/g, ' ')
                .replace(/.*\[(\d{4}-\d{2}-\d{2}).*\].*/, '$1');

            this.#logQueue.push({ date, message });
            this.#processLogQueue();
        }
    }

    /**
     * Called by the IPC listener when a log message arrives from a shard process.
     * Enqueues the message for file writing, just as locally-generated messages are.
     * @private
     */
    #receiveShardLog(message: string): void {
        const date = message
            .replace(/\r\n|\r|\n/g, ' ')
            .replace(/.*\[(\d{4}-\d{2}-\d{2}).*\].*/, '$1');

        this.#logQueue.push({ date, message });
        this.#processLogQueue();
    }

    /**
     * Pre-loads existing log lines from disk into the in-process cache.
     * @private
     */
    #loadCachedLogLines(): string[] {
        if (!fs.existsSync(this.#logFilePath)) {
            return [];
        }

        try {
            const fileContent = fs.readFileSync(this.#logFilePath, 'utf-8');
            const trimmedContent = fileContent.trim();
            return trimmedContent ? trimmedContent.split('\n') : [];
        } catch (error) {
            console.error(this.getFormatTime(), 'Failed to warm log cache:', error);
            return [];
        }
    }

    /**
     * Processes the log queue sequentially.
     * Ensures messages are written in arrival order; rotates the file when the date changes.
     * @private
     */
    #processLogQueue(): void {
        if (this.#isWriting || this.#logQueue.length === 0) {
            return;
        }

        this.#isWriting = true;
        const entry = this.#logQueue.shift();
        if (!entry) {
            this.#isWriting = false;
            return;
        }

        if (entry.date !== this.#currentLogDate) {
            this.#archiveLogFile();
            this.#currentLogDate = entry.date;
            this.#cachedLogLines = [];
        }

        this.#cachedLogLines.push(entry.message);
        const line = entry.message + '\n';

        fs.appendFile(this.#logFilePath, line, 'utf-8', (error) => {
            if (error) {
                console.log('Logger writing error', error);
            }
            this.#isWriting = false;
            this.#processLogQueue();    // Continue processing the queue
        });
    }

    /**
     * Compresses and archives the current log file, then removes it.
     * @private
     */
    #archiveLogFile(archiveDate: string = this.#currentLogDate): void {
        console.log(this.getFormatTime(), `Starting to archive log file: bot.log.${archiveDate}.gz`);

        try {
            const archiveName = `bot.log.${archiveDate}.gz`;
            const archivePath = path.join(this.logDir, archiveName);

            const fileContent = fs.readFileSync(this.#logFilePath, 'utf-8');
            const compressedContent = zlib.gzipSync(fileContent);

            fs.writeFileSync(archivePath, compressedContent);
            fs.unlinkSync(this.#logFilePath);

            console.log(this.getFormatTime(), 'Log file archiving completed.');
        } catch (error) {
            console.error(this.getFormatTime(), 'Failed to archive log file:', error);
        }
    }

    /**
     * On startup, checks whether the existing log file belongs to a previous day.
     * If so, archives it before the new session begins.
     * @private
     */
    #checkAndArchiveLogFile(): void {
        if (!fs.existsSync(this.#logFilePath)) {
            return;
        }

        const fileContent = fs.readFileSync(this.#logFilePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        const lastLine = lines[lines.length - 1];

        if (!lastLine) {
            return;
        }

        // Extract the date from the last line: expects format [YYYY-MM-DD ...]
        const logDateMatch = lastLine.match(/^\[(\d{4}-\d{2}-\d{2})[^]*?\]/);

        if (logDateMatch) {
            const logDate = lastLine
                .replace(/\r\n|\r|\n/g, ' ')
                .replace(/.*\[(\d{4}-\d{2}-\d{2}).*\].*/, '$1');
            const currentDate = this.getFormatTime()
                .replace(/.*\[(\d{4}-\d{2}-\d{2}).*\].*/, '$1');

            if (logDate !== currentDate) {
                this.#archiveLogFile(logDate);
            }
        } else {
            this.#archiveLogFile();
        }
    }

    /**
     * Parses the format string and returns an ordered list of recognised time tokens.
     * @private
     */
    #parseFormatTokens(): string[] {
        const timeTokenRegex = /(YYYY|MM|DD|HH|hh|mm|ss|l)/g;
        const matches = this.format.match(timeTokenRegex);
        return matches ?? [];
    }
}
