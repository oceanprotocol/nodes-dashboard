export interface LocationNode {
  _index: string
  _id: string
  _score: number
  _source: {
    id: string
    ip: string
    country: string
    city: string
    lat: number
    lon: number
  }
}
