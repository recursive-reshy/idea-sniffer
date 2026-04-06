import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import type { Signal } from '../types/signal.js'

// Helper function to get the bronze file path for a given provider and current date
function getBronzePath( provider: string ): string {
  const date = new Date().toISOString().slice( 0, 10 ) // YYYY-MM-DD
  return path.join( config.dataDir, `${ provider }_${ date }.jsonl`)
}

// Helper function to append a signal to the appropriate bronze file
export function appendBronze( signal: Signal ): void {
  const filePath = getBronzePath( signal.provider )
  const dir = path.dirname( filePath )

  if ( !fs.existsSync( dir ) ) fs.mkdirSync( dir, { recursive: true } )

  fs.appendFileSync( filePath, JSON.stringify( signal ) + '\n', 'utf-8' )
}
