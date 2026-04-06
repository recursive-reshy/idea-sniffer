import 'dotenv/config'
import path from 'node:path'

function requireEnv( key: string ): string {
  const value = process.env[ key ]

  if ( !value ) throw new Error( `Missing required environment variable: ${ key }` )

  return value
}

export const config = {
  brightDataCdpUrl: requireEnv( 'BRIGHT_DATA_CDP_URL' ),
  subreddits: ( process.env[ 'SUBREDDITS' ] ?? 'SaaS,startups,webdev' )
    .split( ',' )
    .map( ( subReddit ) => subReddit.trim() )
    .filter( Boolean ),
  rateLimitMs: Number( process.env[ 'RATE_LIMIT_MS' ] ?? 2000 ),
  retryAttempts: 3,
  retryBaseDelayMs: 1000,
  dataDir: path.resolve( './data/bronze' ),
  cachePath: path.resolve( './data/seen_ids.json' ),
  logsDir: path.resolve( './logs' ),
} as const
