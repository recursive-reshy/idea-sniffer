import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { logger } from './logger.js'

export class CacheManager {
  private seen: Set< string > = new Set()
  private readonly tmpPath: string

  constructor() {
    // Load existing cache on initialization
    this.tmpPath = `${ config.cachePath }.tmp`
    this.load()
  }

  // Load seen IDs from cache file
  private load(): void {
    // If cache file doesn't exist, start with an empty set
    if ( !fs.existsSync( config.cachePath ) ) return

    try {
      const raw = fs.readFileSync( config.cachePath, 'utf-8' )
      const ids: string[] = JSON.parse( raw )
      this.seen = new Set( ids )

      logger.info( { count: this.seen.size }, 'CacheManager: loaded seen_ids' )

    } catch (err) {
      logger.error( { err }, 'CacheManager: failed to load seen_ids.json — starting fresh' )
      this.seen = new Set()
    }
  }

  // Helper to check if an ID has been seen before
  has( id: string ): boolean {
    return this.seen.has( id )
  }

  // Add a new ID to the seen set and update the cache file
  add( id: string ): void {
    this.seen.add( id )
    this.checkpoint()
  }

  private checkpoint(): void {
    const dir = path.dirname( config.cachePath )

    // Check if the directory exists; if not, create it. 
    // { recursive: true } ensures all parent folders in the path are created if they are missing.
    if ( !fs.existsSync( dir ) ) fs.mkdirSync( dir, { recursive: true } )

    // First, write the data to a temporary "buffer" file. 
    // We spread 'this.seen' (likely a Set) into an array so it can be serialized to a JSON string.
    fs.writeFileSync( this.tmpPath, JSON.stringify( [ ...this.seen ] ), 'utf-8' )
    // Then, atomically rename the temporary file to the actual cache file.
    fs.renameSync( this.tmpPath, config.cachePath )
  }
}
