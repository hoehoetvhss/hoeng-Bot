import child_process, { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import { cst } from '../../utils/constants.js';
import { formatBytes } from '../../utils/functions/unitConverter.js';

import type { Logger } from '../Logger.js';


export class LocalNodeController {
    static readonly MAX_LOG_LINES = 5_000;

    /** Local node download link */
    public readonly downloadLink: string;

    /** Automatically restart when node crashes (default: true) */
    public readonly autoRestart: boolean;

    /** Local node lavalink logs */
    public lavalinkLogs: string[];

    /** Local node lavalink pid */
    public lavalinkPid: number | null;

    /** Local node listenong port */
    public port: number | null;

    /** @inner Manually set up the logger */
    public logger: Logger;

    #lavalinkProcessController: ChildProcess | null;
    #lavalinkProcessFileName: string;
    #isStarting: boolean;
    #logGeneration: number;
    #manualRestart: boolean;
    #startupPromise: Promise<void> | null;

    constructor(downloadLink: string, logger: Logger, autoRestart: boolean = true) {
        const __filename = fileURLToPath(import.meta.url);

        this.downloadLink = downloadLink;
        this.autoRestart = autoRestart;
        this.logger = logger;

        this.lavalinkLogs = [];
        this.lavalinkPid = null;
        this.port = null;

        this.#lavalinkProcessController = null;
        this.#lavalinkProcessFileName = (path.extname(__filename) === '.ts') ? 'LavalinkProcess.ts' : 'LavalinkProcess.js';
        this.#isStarting = false;
        this.#logGeneration = 0;
        this.#manualRestart = false;
        this.#startupPromise = null;
    }


    public async checkJavaVersion(output: boolean = false) {
        return new Promise<boolean>((resolve, _reject) => {
            child_process.exec('java -version', (error, stdout, stderr) => {
                if (output) {
                    this.logger.localNode( stdout);
                    this.logger.localNode( stderr);
                }

                if (error) {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }

    public async restart() {
        if (this.#manualRestart) {
            return false;
        }

        this.#manualRestart = true;

        if (this.isProcessActive()) {
            await this.stop();
        }

        await this.initialize();
        return true;
    }

    public async stop() {
        return new Promise<boolean>((resolve, _reject) => {
            if (this.#lavalinkProcessController) {
                this.#lavalinkProcessController.once('exit', async (_code, _signal) => {
                    this.logger.localNode( 'Local Lavalink node stopped.');

                    this.#lavalinkProcessController = null;
                    this.#isStarting = false;
                    if (this.lavalinkPid) {
                        await this.#killProcess(this.lavalinkPid);
                    }
                    this.lavalinkPid = null;
                    this.port = null;
                    this.#manualRestart = false;

                    return resolve(true);
                });

                this.#manualRestart = true;
                this.#lavalinkProcessController.kill('SIGINT');
            }
            else {
                this.logger.localNode( 'Local Lavalink node does not exist.');
                return resolve(false);
            }
        });
    }

    public async initialize() {
        if (this.#startupPromise) {
            return this.#startupPromise;
        }

        if (this.#lavalinkProcessController !== null || this.lavalinkPid !== null) {
            return;
        }

        this.#startupPromise = this.#startProcess();

        try {
            await this.#startupPromise;
        }
        finally {
            if (this.#lavalinkProcessController === null) {
                this.#isStarting = false;
                this.#manualRestart = false;
            }

            this.#startupPromise = null;
        }
    }

    public getLogSourceId(): string {
        return `localnode-${this.#logGeneration}`;
    }

    public isProcessActive(): boolean {
        return this.#isStarting || this.#lavalinkProcessController !== null || this.lavalinkPid !== null;
    }

    public isStarting(): boolean {
        return this.#isStarting;
    }

    async #startProcess(): Promise<void> {
        const filename = 'Lavalink.jar';
        await this.#downloadFile(this.downloadLink, filename);

        this.#isStarting = true;
        this.#logGeneration += 1;
        this.lavalinkLogs = [];

        return new Promise<void>((resolve, reject) => {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            let ready = false;
            let pidReady = false;
            let settled = false;

            const maybeResolve = () => {
                if (ready && pidReady) {
                    settleResolve();
                }
            };

            const settleResolve = () => {
                if (settled) {
                    return;
                }

                settled = true;
                this.#isStarting = false;
                resolve();
            };

            const settleReject = (error: Error) => {
                if (settled) {
                    return;
                }

                settled = true;
                this.#isStarting = false;
                this.#manualRestart = false;
                reject(error);
            };

            this.#lavalinkProcessController = child_process.fork(path.resolve(__dirname, this.#lavalinkProcessFileName));
            this.#lavalinkProcessController.once('error', (error) => {
                this.#lavalinkProcessController = null;
                settleReject(error instanceof Error ? error : new Error(String(error)));
            });

            this.#lavalinkProcessController.once('spawn', () => {
                this.#lavalinkProcessController!.send(`./server/${filename}`);
            });

            this.#lavalinkProcessController.on('message', (message: string) => {
                if (message.includes('LAVALINK_')) {
                    if (message === 'LAVALINK_STARTED') {
                        this.logger.localNode( 'The local node is starting ...');
                    }
                    else if (message === 'LAVALINK_READY') {
                        this.logger.localNode( 'The local node started successfully.');
                        this.#manualRestart = false;
                        ready = true;
                        maybeResolve();
                        return;
                    }
                    else if ((/^LAVALINK_PORT_(\d+)$/).test(message)) {
                        const portRegex = /^LAVALINK_PORT_(\d+)$/;
                        const portMatch = message.match(portRegex);
                        this.port = Number(portMatch![1]);

                        this.logger.localNode( `The local node listening on port ${this.port}`);
                    }
                    else if (/^LAVALINK_PID_(\d+)$/.test(message)) {
                        const pidRegex = /^LAVALINK_PID_(\d+)$/;
                        const pidMatch = message.match(pidRegex);

                        this.lavalinkPid = Number(pidMatch![1]);
                        pidReady = true;
                        maybeResolve();
                    }

                    return;
                }

                this.#appendLog(message);
            });

            this.#lavalinkProcessController.on('exit', async (code, signal) => {
                this.logger.localNode( cst.color.yellow + `Local Lavalink node exited with code ${code ?? signal}` + cst.color.white);

                this.#lavalinkProcessController = null;

                if (this.lavalinkPid) {
                    await this.#killProcess(this.lavalinkPid);
                }
                this.lavalinkPid = null;
                this.port = null;

                if (!ready) {
                    settleReject(new Error(`Local Lavalink node exited before ready: ${code ?? signal}`));
                    return;
                }

                if (this.autoRestart && !this.#manualRestart) {
                    this.logger.localNode( 'Try to restart automatically.');
                    void this.initialize().catch((error) => {
                        this.logger.localNode( `Automatic restart failed: ${error}`);
                    });
                }
            });
        });
    }

    /**
     * @private
     */
    async #downloadFile(url: string, filename: string) {
        await fs.promises.mkdir('server', { recursive: true });

        const destination = path.resolve('./server', filename);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`[localNode] Failed to fetch the file: ${response.statusText}`);
        }


        const contentLength = Number(response.headers.get('content-length'));
        const tragetSize = formatBytes(contentLength);

        if (fs.existsSync(destination)) {
            const existingFileSize = fs.statSync(destination).size;

            if (existingFileSize === contentLength) {
                this.logger.localNode( 'File already exists. Skipping download.');
                return;
            }
            else {
                fs.unlinkSync(destination);
            }
        }


        const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
        const reader = response.body!.getReader();
        let downloadedBytes = 0;

        this.logger.localNode( `Download Lavalink from: ${this.downloadLink}`);
        this.logger.localNode( 'Start downloading file ...');

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                process.stdout.write('\n');
                break;
            }

            if (!fileStream.write(value)) {
                await new Promise<void>((resolve) => fileStream.once('drain', resolve));
            }
            downloadedBytes += value.length;

            // Calculate and log download progress
            if (contentLength) {
                const progress = (downloadedBytes / contentLength) * 100;
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                process.stdout.write(`Download Progress: ${~~progress} % (${formatBytes(downloadedBytes)} / ${tragetSize})`);
            }
        }

        await new Promise<void>((resolve, reject) => {
            fileStream.once('finish', resolve);
            fileStream.once('error', reject);
            fileStream.end();
        });

        this.logger.localNode( 'File downloaded successfully.');
    }

    #appendLog(message: string): void {
        this.lavalinkLogs.push(message);

        if (this.lavalinkLogs.length > LocalNodeController.MAX_LOG_LINES) {
            this.lavalinkLogs.splice(0, this.lavalinkLogs.length - LocalNodeController.MAX_LOG_LINES);
        }
    }

    /**
     * Oracle JDK for windows platform
     * @private
     */
    async #winGetPid(port: number): Promise<number[]> {
        return new Promise((resolve, _reject) => {
            child_process.exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
                if (error) {
                    this.logger.localNode( `[error] winGetPid error executing command: ${error.message}`);
                    return resolve([]);
                }

                if (stderr) {
                    this.logger.localNode( `[error] winGetPid stderr: ${stderr}`);
                    return resolve([]);
                }

                const lines = stdout.trim().split('\n');
                const pidSet: Set<number> = new Set();

                lines.forEach((line) => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parseInt(parts[parts.length - 1], 10);

                    /**
                     * process.pid is the main process
                     * Pid 0 is the parent process
                     */
                    if (!isNaN(pid) && pid !== process.pid && pid !== 0) {
                        pidSet.add(pid);
                    }
                });

                const pidList = Array.from(pidSet);
                return resolve(pidList);
            });
        });
    }

    /**
     * @private
     */
    async #killProcess(pid: number) {
        try {
            /**
             * In Windows, you can terminate a child process and release the port directly 
             * by using `ChildProcess.kill('SIGINT')`, without the need for `process.kill(pid)`.
             * 
             * OpenJDK normal.
             * However, Oracle JDK will open two processes, 
             * making it impossible to completely shut down the child process. 
             * It is necessary to scan all pid occupying the port to forcefully terminate all pid.
             */
            if (process.platform === 'win32') {
                if (!this.port) {
                    return false;
                }

                const winPidList = await this.#winGetPid(this.port);

                for (const winPid of winPidList) {
                    process.kill(winPid, 'SIGINT');
                }

                return true;
            }


            /**
             * MacOS, Linux need to kill pid to release port
             */
            process.kill(pid, 'SIGINT');
            return true;
        } catch (_) {
            return false;
        }
    }
}