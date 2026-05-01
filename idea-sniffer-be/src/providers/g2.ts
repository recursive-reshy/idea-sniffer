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

  async fetch(): Promise< Signal[] > {
    if ( !config.g2Products.length ) {
      logger.warn( { provider: this.name }, 'No G2_PRODUCTS configured — skipping' )
      return []
    }

    const signals: Signal[] = []

    for ( const product of config.g2Products ) {
      const productSignals = await this.fetchProduct( product )
      signals.push( ...productSignals )
      logger.info( { provider: this.name, product, count: productSignals.length }, 'Fetched G2 product' )
    }

    return signals
  }

  private async fetchProduct( productSlug: string ): Promise< Signal[] > {
    const startUrl = `https://www.g2.com/products/${ productSlug }/reviews`

    logger.info( { provider: this.name, product: productSlug }, 'Starting Firecrawl crawl' )

    const crawlResult = await this.firecrawl.crawl( startUrl, {
      includePaths: [ `/products/${ productSlug }/reviews*` ],
      limit: config.g2PagesPerProduct,
      scrapeOptions: {
        formats: [ 'markdown' ],
        onlyMainContent: true,
      },
    } )

    if ( crawlResult.status !== 'completed' ) {
      logger.error( { provider: this.name, product: productSlug, status: crawlResult.status }, 'Firecrawl crawl failed' )
      return []
    }

    const signals: Signal[] = []

    for ( const page of crawlResult.data ) {
      if ( !page.markdown ) continue

      const reviews = this.parseReviews( page.markdown, productSlug )
      signals.push( ...reviews.map( ( r ) => this.toSignal( r ) ) )
    }

    return signals
  }

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

  private toSignal( review: G2Review ): Signal {
    return {
      sourceId: `g2_${ review.productSlug }_${ review.id }`,
      rawText: review.dislikeText,
      originUrl: `https://www.g2.com/products/${ review.productSlug }/reviews`,
      metadata: {
        likeText: review.likeText,
        productSlug: review.productSlug,
      },
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    }
  }
}
