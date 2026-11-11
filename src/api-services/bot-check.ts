import { SUBSIDY_BOT_BLOCKED_ERROR } from '@/types/subsidy';
import { checkBotId } from 'botid/server';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Responds 403 and returns `true` when BotID flags the request. Fails open if BotID itself errors.
 * Routes must also be listed in `src/instrumentation-client.ts`.
 */
export const blockBots = async (request: NextApiRequest, response: NextApiResponse, walletAddress: string) => {
  try {
    const { isBot, isVerifiedBot } = await checkBotId({ advancedOptions: { headers: request.headers } });
    if (!isBot) {
      return false;
    }
    console.warn('BotID blocked request', { isVerifiedBot, route: request.url, walletAddress });
  } catch (error) {
    console.error('BotID check failed', { error, route: request.url });
    return false;
  }
  response.status(403).json({
    error: SUBSIDY_BOT_BLOCKED_ERROR,
    message: "We couldn't verify your request. Refresh the page or try another browser.",
  });
  return true;
};
