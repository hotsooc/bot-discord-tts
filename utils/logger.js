const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new transports.Console(),

    new DailyRotateFile({
      filename: 'logs/bot-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d', 
      zippedArchive: false, 
    }),
  ],
});

module.exports = logger;
