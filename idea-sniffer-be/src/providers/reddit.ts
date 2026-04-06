import { chromium } from 'playwright';
import { config } from '../config.js';
import { withRetry } from '../core/retry.js';
import { logger } from '../utils/logger.js';
import type { IProvider } from '../types/provider.js';
import type { Signal } from '../types/signal.js';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  permalink: string;
  score: number;
  num_comments: number;
}

export class RedditProvider implements IProvider {
  readonly name = 'reddit';

  async fetch(): Promise<Signal[]> {
    const browser = await withRetry(
      () => chromium.connectOverCDP(config.brightDataCdpUrl),
      { provider: this.name, operation: 'connectOverCDP' },
    ).catch((err) => {
      logger.error({ provider: this.name, err }, 'CDP connection failed — aborting. Never run without proxy.');
      throw err;
    });

    const signals: Signal[] = [];

    try {
      for (let i = 0; i < config.subreddits.length; i++) {
        const subreddit = config.subreddits[i]!;
        if (i > 0) {
          logger.info({ provider: this.name, subreddit, delayMs: config.rateLimitMs }, 'Rate limiting — waiting');
          await sleep(config.rateLimitMs);
        }

        const posts = await withRetry(
          () => this.scrapeSubreddit(browser, subreddit),
          { provider: this.name, operation: `scrape:${subreddit}` },
        );

        signals.push(...posts);
        logger.info({ provider: this.name, subreddit, count: posts.length }, 'Scraped subreddit');
      }
    } finally {
      await browser.close();
    }

    return signals;
  }

  private async scrapeSubreddit(
    browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>,
    subreddit: string,
  ): Promise<Signal[]> {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`https://www.reddit.com/r/${subreddit}/new.json?limit=100`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      const raw = await page.evaluate(() => document.body.innerText);
      const json = JSON.parse(raw) as { data: { children: Array<{ data: RedditPost }> } };
      const posts = json.data.children.map((c) => c.data);

      return posts.map((post) => ({
        sourceId: post.id,
        rawText: [post.title, post.selftext].filter(Boolean).join('\n\n'),
        originUrl: `https://www.reddit.com${post.permalink}`,
        metadata: {
          score: post.score,
          num_comments: post.num_comments,
          subreddit,
        },
        fetchedAt: new Date().toISOString(),
        provider: this.name,
      }));
    } finally {
      await context.close();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
