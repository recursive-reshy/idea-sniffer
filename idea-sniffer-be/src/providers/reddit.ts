import { chromium } from 'playwright'
import { config } from '../config.js'
import { sleep, withRetry } from '../core/retry.js'
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

    // Connect to the browser via CDP, with retry logic and error handling
    const browser = await withRetry(
      () => chromium.connectOverCDP( config.brightDataCdpUrl ),
      { provider: this.name, operation: 'connectOverCDP' },
    ).catch( ( error ) => {
      logger.error( { provider: this.name, error }, 'CDP connection failed — aborting. Never run without proxy.' )
      throw error
    } )

    const signals: Signal[] = []

    try {
      for ( let i = 0; i < config.subreddits.length; i++ ) {
        const subreddit = config.subreddits[ i ]!
        if ( i > 0 ) {
          logger.info( { provider: this.name, subreddit, delayMs: config.rateLimitMs }, 'Rate limiting — waiting' )
          // Apply rate limiting between subreddit requests to avoid hitting Reddit's rate limits
          await sleep( config.rateLimitMs )
        }

        const posts = await withRetry(
          // Wrap the subreddit scraping in retry logic to handle transient errors
          () => this.scrapeSubreddit( browser, subreddit ),
          { provider: this.name, operation: `scrape:${ subreddit }` },
        )

        signals.push( ...posts )
        logger.info( { provider: this.name, subreddit, count: posts.length }, 'Scraped subreddit' )
      }
    } finally {
      await browser.close()
    }

    return signals
  }

  // Scrape a single subreddit for new posts, extracting relevant data and formatting it as signals
  private async scrapeSubreddit(
    browser: Awaited< ReturnType< typeof chromium.connectOverCDP > >,
    subreddit: string,
  ): Promise< Signal[] > {
    // Create a new browser context and page for scraping the subreddit
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await page.goto( `https://www.reddit.com/r/${ subreddit }/new.json?limit=100`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      } )

      const raw = await page.evaluate( () => document.body.innerText )
      const json = JSON.parse( raw ) as { data: { children: Array< { data: RedditPost } > } }
      const posts = json.data.children.map( ( child ) => child.data )

      return posts.map( ( post ) => ( {
        sourceId: post.id,
        rawText: [ post.title, post.selftext ].filter( Boolean ).join( '\n\n' ),
        originUrl: `https://www.reddit.com${ post.permalink }`,
        metadata: {
          score: post.score,
          num_comments: post.num_comments,
          subreddit,
        },
        fetchedAt: new Date().toISOString(),
        provider: this.name,
      } ) )
    } finally {
      await context.close()
    }
  }
}
