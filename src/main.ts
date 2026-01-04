import { startBot } from './bot';
import { botConfig } from './config';
import { initCookies } from './cookie';
import { logger } from './utils/logger';
import type { LogLevel } from './utils/logger';
import express from 'express';

const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  logger.info(`Dummy server listening at http://localhost:${port}`);
});

logger.setConfig({
  level: botConfig.logger.level as LogLevel,
  enableColors: botConfig.logger.enableColors,
  enableTimestamp: botConfig.logger.enableTimestamp
});

// Initialize global cookies
initCookies();

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
  logger.error('Unhandled Rejection:', reason);
});

const showBanner = (): void => {
};

const main = async (): Promise<void> => {
  try {
    showBanner();
    const { connectDB } = await import('../database/index');
    await connectDB();
    startBot();
  } catch (error) {
    console.error('ERROR:', error);
    logger.error('Lỗi khởi động bot:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
};

main();
