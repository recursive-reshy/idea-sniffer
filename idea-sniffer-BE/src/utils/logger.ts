import pino from 'pino'

const isDev = process.env[ 'NODE_ENV' ] !== 'production'

export const logger = pino(
  { level: 'info' },
  isDev
    ? pino.transport( { target: 'pino-pretty', options: { colorize: true } } ) // Configures a "transport" to process logs before they are output.
    : process.stdout,
)
