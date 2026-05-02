import crypto from 'node:crypto'
import FirecrawlApp from '@mendable/firecrawl-js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import type { IProvider } from '../types/provider.js'
import type { Signal } from '../types/signal.js'

interface G2Review {
  id: string
  dislikeText: string
  likeText: string
  productSlug: string
}

export class G2Provider implements IProvider {
  readonly name = 'g2'
  private readonly firecrawl = new FirecrawlApp( { apiKey: config.firecrawlApiKey } )
  private BASE_URL = 'https://www.g2.com/products'

  // Main fetch function to retrieve reviews from configured G2 products
  async fetch(): Promise< Signal[] > {
    if ( !config.g2Products.length ) {
      logger.warn( { provider: this.name }, 'No G2_PRODUCTS configured — skipping' )
      return []
    }

    const signals: Signal[] = []

    for ( const product of config.g2Products ) {
      // Crawl each product page and extract reviews, applying error handling to ensure one failure doesn't stop the entire provider
      const productSignals = await this.fetchProduct( product )
      signals.push( ...productSignals )
      logger.info( { provider: this.name, product, count: productSignals.length }, 'Fetched G2 product' )
    }

    return signals
  }

  // Function to crawl a G2 product's reviews and extract signals
  private async fetchProduct( productSlug: string ): Promise< Signal[] > {
    const startUrl = `${ this.BASE_URL }/${ productSlug }/reviews`

    logger.info( { provider: this.name, product: productSlug }, 'Starting Firecrawl crawl' )

    const crawlResult = await this.firecrawl.crawl( startUrl, {
      includePaths: [ `/products/${ productSlug }/reviews*` ],
      limit: config.g2PagesPerProduct,
      scrapeOptions: {
        formats: [ 'markdown' ],
        onlyMainContent: true,
      },
    } )

    if ( crawlResult.status != 'completed' ) {
      logger.error( { provider: this.name, product: productSlug, status: crawlResult.status }, 'Firecrawl crawl failed' )
      return []
    }

    const signals: Signal[] = []

    for ( const page of crawlResult.data ) {
      // We do not want formats that are not markdown, as they won't contain the review text in a consistent format for parsing.
      if ( !page.markdown ) continue

      const reviews = this.parseReviews( page.markdown, productSlug )
      signals.push( ...reviews.map( ( review ) => this.toSignal( review ) ) )
    }

    return signals
  }

  // Function to parse the markdown content of a G2 review page and extract individual reviews
  private parseReviews( markdown: string, productSlug: string ): G2Review[] {
    const reviews: G2Review[] = []

    // Split markdown into review blocks by detecting the "What do you like best" heading
    const reviewBlocks = markdown.split( /(?=#+\s*What do you like best)/i )

    for ( const block of reviewBlocks ) {
      const likeMatch = block.match( /#+\s*What do you like best[^?]*\?\s*\n+([\s\S]*?)(?=#+|$)/i )
      const dislikeMatch = block.match( /#+\s*What do you dislike[^?]*\?\s*\n+([\s\S]*?)(?=#+|$)/i )

      const likeText = likeMatch?.[ 1 ]?.trim() ?? ''
      const dislikeText = dislikeMatch?.[ 1 ]?.trim() ?? ''

      // Pain signal requires a dislike section
      if ( !dislikeText ) continue

      const id = crypto
        .createHash( 'sha256' )
        .update( dislikeText )
        .digest( 'hex' )
        .slice( 0, 12 )

      reviews.push( { id, dislikeText, likeText, productSlug } )
    }

    return reviews
  }

  // Function to convert a G2Review into a standardized Signal format for storage and processing
  private toSignal( review: G2Review ): Signal {
    return {
      sourceId: `g2_${ review.productSlug }_${ review.id }`,
      rawText: review.dislikeText,
      originUrl: `${ this.BASE_URL }/${ review.productSlug }/reviews`,
      metadata: {
        likeText: review.likeText,
        productSlug: review.productSlug,
      },
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    }
  }
}
