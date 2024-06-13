import { PlatformType, SupportedStorageType } from './dataTypes'

export type NodeDetailsType = {
  node: string
  host: string
  port: string
  last_seen: string
  enode: string
  client_type: string
  client_version: string
  os: string
  country: string
  city: string
  http: boolean
  p2p: boolean
}

export type DataRowType = {
  nodeId: string
  network: string
  ipAddress: string
  location: string
  blockNumber: string
  uptime: string
  coordinates: [number, number]
  nodeDetails: NodeDetailsType[]
  supportedStorage: SupportedStorageType
  platform: PlatformType
}
