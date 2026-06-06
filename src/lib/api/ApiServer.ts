import express from 'express';
import fs from 'fs';
import path from 'path';

import { LoginTypeEnum } from '../../@types/index.js';
import { problem } from './http.js';
import { AuthMiddleware } from './middleware/AuthMiddleware.js';
import { AuthRouter } from './routes/AuthRouter.js';
import { BotInfoRouter } from './routes/BotInfoRouter.js';
import { LocalNodeRouter } from './routes/LocalNodeRouter.js';
import { LoggerRouter } from './routes/LoggerRouter.js';
import { MaintenanceRouter } from './routes/MaintenanceRouter.js';
import { MediaRouter } from './routes/MediaRouter.js';
import { NodeRouter } from './routes/NodeRouter.js';
import { ServerRouter } from './routes/ServerRouter.js';

import type { Application } from 'express';
import type { ShardingManager } from 'discord.js';
import type { Bot } from '../../@types/index.js';
import type { LocalNodeController } from '../localnode/LocalNodeController.js';
import type { SessionManager } from '../session-manager/SessionManager.js';
import type { RouterDependencies } from './routes/BaseRouter.js';


/**
 * Main API server class.
 *
 * Wires together the Express application, all route modules,
 * and authentication middleware. The static Nuxt dashboard is served
 * from the `dashboard/dist` directory at the root path.
 *
 * Route tree:
 *   /api/auth/...         - AuthRouter
 *   /api/bot/...          - BotInfoRouter  (requires auth)
 *   /api/nodes            - NodeRouter     (requires auth)
 *   /api/servers/...      - ServerRouter   (requires auth)
 *   /api/localnode/...    - LocalNodeRouter (requires auth)
 *   /api/logs/...         - LoggerRouter   (requires auth)
 *   /api/maintenance/...  - MaintenanceRouter (requires auth)
 *   /api/media/...        - MediaRouter    (requires auth)
 *   /*                   - Nuxt static files (SPA fallback)
 */
export class ApiServer {
    readonly #app: Application;
    readonly #bot: Bot;
    readonly #port: number;
    readonly #authMiddleware: AuthMiddleware;
    readonly #deps: RouterDependencies;

    /** Absolute path to the compiled Nuxt dashboard static output. */
    static readonly DASHBOARD_DIST = path.join(process.cwd(), 'dashboard', '.output', 'public');

    constructor(
        bot: Bot,
        shardManager: ShardingManager,
        localNodeController: LocalNodeController,
        sessionManager: SessionManager,
    ) {
        this.#app = express();
        this.#bot = bot;
        this.#port = bot.config.webDashboard.port || 33333;
        this.#authMiddleware = new AuthMiddleware(sessionManager);
        this.#deps = { bot, shardManager, localNodeController, sessionManager };

        this.#setupMiddleware();
        this.#registerRoutes();
        this.#setupStaticFallback();
    }

    // -------------------------------------------------------------------------
    // Public methods
    // -------------------------------------------------------------------------

    /** 
     * Start listening on the configured port. 
     * Returns a Promise that resolves once the server is ready.
     */
    public listen(): Promise<void> {
        return new Promise((resolve) => {
            this.#app.listen(this.#port, () => {
                this.#bot.logger.api( `Server start listening port on ${this.#port}`);
                resolve();
            });
        });
    }

    // -------------------------------------------------------------------------
    // Private setup methods
    // -------------------------------------------------------------------------

    /** 
     * Register global Express middleware (body parsing, trust proxy, etc.).
     * @private
     */
    #setupMiddleware(): void {
        // Trust the first proxy hop so req.ip reflects the real client IP
        this.#app.set('trust proxy', 1);

        this.#app.use(express.json({ limit: '1mb' }));
        this.#app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    }

    /** 
     * Mount all API routers under /api.
     * @private
     */
    #registerRoutes(): void {
        const auth = this.#authMiddleware.handle();

        // Auth routes – no session required (login/logout/verify/oauth2)
        this.#app.use('/api/auth', new AuthRouter(this.#deps).getRouter());

        // When OAuth2 is enabled, Discord redirects the user back to the
        // configured redirect_uri (e.g. /login) with ?code=...&state=...
        // Intercept those requests before the SPA fallback can swallow them,
        // and forward them to the actual API callback handler.
        if (this.#bot.config.webDashboard.loginType === LoginTypeEnum.OAUTH2) {
            this.#app.get('/login', (req, res, next) => {
                if (req.query['code'] && req.query['state']) {
                    const code = req.query['code'] as string;
                    const state = req.query['state'] as string;
                    res.redirect(
                        `/api/auth/oauth2/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
                    );
                    return;
                }
                next();
            });
        }

        // All routes below require a valid session
        this.#app.use('/api/bot', auth, new BotInfoRouter(this.#deps).getRouter());
        this.#app.use('/api/nodes', auth, new NodeRouter(this.#deps).getRouter());
        this.#app.use('/api/servers', auth, new ServerRouter(this.#deps).getRouter());
        this.#app.use('/api/localnode', auth, new LocalNodeRouter(this.#deps).getRouter());
        this.#app.use('/api/logs', auth, new LoggerRouter(this.#deps).getRouter());
        this.#app.use('/api/maintenance', auth, new MaintenanceRouter(this.#deps).getRouter());
        this.#app.use('/api/media', auth, new MediaRouter(this.#deps).getRouter());
    }

    /**
     * Serve the compiled Nuxt static files and fall back to `index.html`
     * for all non-API routes (SPA client-side routing support).
     * @private
     */
    #setupStaticFallback(): void {
        const distPath = ApiServer.DASHBOARD_DIST;

        /** 
         * Resolve the SPA entry file once at startup.
         * `nuxt generate` (ssr: false) produces 200.html as the catch-all;
         * `nuxt build` produces index.html. Support both.
         */
        const spaEntry = (() => {
            for (const candidate of ['200.html', 'index.html']) {
                if (fs.existsSync(path.join(distPath, candidate))) {
                    return `/${candidate}`;
                }
            }
            return null;
        })();

        /** 
         * Rewrite non-API, non-asset page routes to the SPA entry file BEFORE
         * express.static runs. This allows express.static to serve the SPA shell
         * with correct ETag/304 handling for all client-side routes.
         * Paths containing a dot are treated as static asset requests and left alone.
         */
        this.#app.use((req, _res, next) => {
            if (spaEntry && !req.path.startsWith('/api/') && !req.path.includes('.')) {
                req.url = spaEntry;
            }
            next();
        });

        // Serve static assets produced by `nuxt generate`
        this.#app.use(express.static(distPath));

        // OAuth2 callback handled by AuthRouter — no extra redirect needed here.

        // Return 404 JSON for unmatched API routes instead of falling through to the SPA
        this.#app.use('/api/*path', (_req, res) => {
            problem(res, {
                status: 404,
                title: 'Not Found',
                detail: 'The requested API resource does not exist.',
                code: 'API_ROUTE_NOT_FOUND',
            });
        });

        // Final fallback when the dashboard has not been built yet
        this.#app.use((_req, res) => {
            res.status(404).send('Dashboard not found. Please build the Nuxt dashboard first.');
        });
    }
}
