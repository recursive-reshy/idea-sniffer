import { logger } from '../utils/logger.js'
import { config } from '../config.js'

// Executes the provided async function with retry logic and exponential backoff.
// Waits longer between each retry to avoid overwhelming the service and to give it time to recover from transient issues.
export async function withRetry< T >(
  fn: () => Promise< T >,
  context: { provider: string; operation: string },
): Promise< T > {
  let lastError: unknown

  for ( let attempt = 1; attempt <= config.retryAttempts; attempt++ ) {
    try {
      return await fn()
    } catch ( err ) {
      lastError = err

      // Calculate the delay using exponential backoff: baseDelay * 2^(attempt - 1), 1s, 2s, 4s 
      const delay = config.retryBaseDelayMs * Math.pow( 2, attempt - 1 )

      logger.warn(
        { ...context, attempt, delay, err },
        `Retry attempt ${ attempt }/${ config.retryAttempts } failed — waiting ${ delay }ms`,
      )

      if ( attempt < config.retryAttempts ) {
        // Wait for the calculated delay before the next retry attempt.
        await sleep( delay )
      }
    }
  }

  throw lastError
}

// Helper function to create a delay.
function sleep( ms: number ): Promise< void > {
  return new Promise( ( resolve ) => setTimeout( resolve, ms ) )
}
