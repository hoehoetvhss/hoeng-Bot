import { ApiServer } from '../lib/api/ApiServer.js';
import { SessionManager } from '../lib/session-manager/SessionManager.js';

import type { ShardingManager } from 'discord.js';
import type { Bot } from './../@types/index.js';
import type { LocalNodeController } from '../lib/localnode/LocalNodeController.js';


const loadSite = async (bot: Bot, shardManager: ShardingManager, localNodeController: LocalNodeController): Promise<void> => {
    bot.logger.api( `-> loading Web Framework ......`);

    const sessionManager = new SessionManager(
        bot.config.webDashboard.sessionManager,
        bot.config.webDashboard.ipBlocker,
    );

    const server = new ApiServer(bot, shardManager, localNodeController, sessionManager);
    await server.listen();
};

export { loadSite };