import { config } from './config.js'
import { logger } from './utils/logger.js'
import { CacheManager } from './utils/cacheManager.js'
import { appendBronze } from './utils/fileStore.js'
import { RedditProvider } from './providers/reddit.js'
import type { IProvider } from './types/provider.js'

async function main() {
  logger.info( { subreddits: config.subreddits }, 'Idea Sniffer starting' )

  const cache = new CacheManager()
  const providers: IProvider[] = [ new RedditProvider() ]

  const runStats = { totalFetched: 0, skipped: 0, failed: 0, newStored: 0 }

  for ( const provider of providers ) {
    logger.info( { provider: provider.name }, 'Running provider' )

    let signals

    try {
      signals = await provider.fetch()
    } catch (error) {
      logger.error( { provider: provider.name, error, timestamp: new Date().toISOString() }, 'Provider fetch failed' )
      continue
    }

    runStats.totalFetched += signals.length

    for ( const signal of signals ) {
      if ( cache.has( signal.sourceId ) ) {
        runStats.skipped++
        continue
      }

      try {
        appendBronze( signal )
        cache.add( signal.sourceId ) // checkpoint write after every successful record
        runStats.newStored++
      } catch (error) {
        runStats.failed++
        logger.error(
          { provider: provider.name, sourceId: signal.sourceId, error, timestamp: new Date().toISOString() },
          'Failed to store signal',
        )
      }
    }
  }

  logger.info( runStats, 'Run complete' )
}

main().catch( ( error ) => {
  logger.error( { error }, 'Fatal error — exiting' )
  process.exit( 1 )
} )
