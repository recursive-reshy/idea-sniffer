import { RedditProvider } from './providers/reddit.js'
import { G2Provider } from './providers/g2.js'
import type { IProvider } from './types/provider.js'

export const enabledProviders: IProvider[] = [
  // new RedditProvider(),
  new G2Provider(),
]
