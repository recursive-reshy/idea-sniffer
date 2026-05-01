import 'dotenv/config'
import path from 'node:path'

function requireEnv( key: string ): string {
  const value = process.env[ key ]

  if ( !value ) throw new Error( `Missing required environment variable: ${ key }` )

  return value
}

export const config = {
  brightDataCdpUrl: process.env[ 'BRIGHT_DATA_CDP_URL' ] ?? '',
  firecrawlApiKey: requireEnv( 'FIRECRAWL_API_KEY' ),
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
  g2Products: ( process.env[ 'G2_PRODUCTS' ] ?? '' )
    .split( ',' )
    .map( ( s ) => s.trim() )
    .filter( Boolean ),
  g2PagesPerProduct: Number( process.env[ 'G2_PAGES_PER_PRODUCT' ] ?? 2 ),
} as const
