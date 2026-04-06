export interface Signal {
  sourceId: string;
  rawText: string;
  originUrl: string;
  metadata: Record< string, unknown >;
  fetchedAt: string;
  provider: string;
}
