import type { Signal } from './signal.js'

export interface IProvider {
  name: string
  fetch(): Promise< Signal[] >
}
