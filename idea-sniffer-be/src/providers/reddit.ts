import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import type { IProvider } from '../types/provider.js'
import type { Signal } from '../types/signal.js'

interface RedditPost {
  id: string
  title: string
  selftext: string
  permalink: string
  score: number
  num_comments: number
}

export class RedditProvider implements IProvider {
  readonly name = 'reddit'

  // Fetch latest posts from specified subreddits, applying rate limiting between requests
  async fetch(): Promise< Signal[] > {

    const signals: Signal[] = []

    try {
      if( !config.subreddits.length ) {
        logger.warn( { provider: this.name }, 'No SUBREDDITS configured — skipping' )
        return []
      }

      /** Construct payload for Bright data web scraper 
       * i.e Stringified JSON
       * input: { [
       *  { "url": "https://www.reddit.com/r/freelance",
       *    "sort_by": "", // Hot, New, Top, Rising
       *    "sort_by_time":"", // Today, This Week, This Year, All Time
       *    "keyword": "" // Optional param to filter posts by keyword in title or body
       *    "start_date": "", // Optional param to filter posts by date range
       *  }, 
       * ] }
      */

      // TODO:Create payload interface
      const payload = JSON.stringify( {
        input: config.subreddits.map( ( subreddit ) => ( {
          url: `https://www.reddit.com/r/${ subreddit }`,
          sort_by: 'Hot' // TODO: Hardcoded for now, refactor when this is API enabled
        } ) )
      } )
      
      logger.info( { provider: this.name, payload }, 'Constructed Bright Data payload' )
      
      const result = await fetch(
        config.brightDataRedditUrl,
        { method: 'POST',
          headers: {
            'Authorization': `Bearer ${ config.brightDataApiKey }`,
            'Content-Type': 'application/json'
          },
          body: payload
        }
      )

      const snapshotId = await result.json()

      logger.info( { provider: this.name, snapshotId }, 'Received data from Bright Data' )
      
    } catch( error ) {
      logger.error( { provider: this.name, error, timestamp: new Date().toISOString() }, 'Failed to fetch from Reddit' )
    }

    return signals
  }
}
