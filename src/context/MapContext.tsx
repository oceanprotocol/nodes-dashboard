import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useMemo
} from 'react'
import axios from 'axios'
import { LocationNode } from '../shared/types/locationNodeType'
import { NodeData } from '../shared/types/RowDataType'

interface CountryNodesInfo {
  country: string
  nodeIds: string[]
  totalNodes: number
}

interface MapContextType {
  data: LocationNode[]
  loading: boolean
  loadingInfo: boolean
  error: any
  setCityName: (term: string) => void
  nodeData: NodeData[]
}

interface MapProviderProps {
  children: ReactNode
}

export const MapContext = createContext<MapContextType | undefined>(undefined)

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const [data, setData] = useState<LocationNode[]>([])
  const [nodeData, setNodeData] = useState<NodeData[]>([])
  const [cityName, setCityName] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [loadingInfo, setLoadingInfo] = useState<boolean>(true)
  const [error, setError] = useState<any>(null)

  const fetchUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://incentive-backend.oceanprotocol.com'
    return `${baseUrl}/locations`
  }, [])

  const fetchUrlInfoNodeByCity = useMemo(() => {
    if (!cityName) return null
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://incentive-backend.oceanprotocol.com'
    return `${baseUrl}/nodes?city=${cityName}`
  }, [cityName])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await axios.get(fetchUrl)
        const nodes = response.data
        setData(nodes)
      } catch (err) {
        console.log('error', err)
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchUrl])

  useEffect(() => {
    const fetchNodeDataByCity = async () => {
      if (!cityName) return

      setLoadingInfo(true)
      try {
        const response = await axios.get(fetchUrlInfoNodeByCity as string)
        setNodeData(response.data.nodes)
      } catch (err) {
        console.log('error fetching node data by city:', err)
        setError(err)
      } finally {
        setLoadingInfo(false)
      }
    }

    fetchNodeDataByCity()
  }, [fetchUrlInfoNodeByCity, cityName])

  return (
    <MapContext.Provider
      value={{
        data,
        loading,
        error,
        setCityName,
        loadingInfo,
        nodeData
      }}
    >
      {children}
    </MapContext.Provider>
  )
}

export const useMapContext = () => {
  const context = useContext(MapContext)
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider')
  }
  return context
}
