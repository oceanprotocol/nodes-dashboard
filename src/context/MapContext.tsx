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

interface CountryNodesInfo {
  country: string
  nodeIds: string[]
  totalNodes: number
}

interface MapContextType {
  data: LocationNode[]
  countryNodesInfo: CountryNodesInfo[]
  loading: boolean
  error: any
}

interface MapProviderProps {
  children: ReactNode
}

export const MapContext = createContext<MapContextType | undefined>(undefined)

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const [data, setData] = useState<LocationNode[]>([])
  const [countryNodesInfo, setCountryNodesInfo] = useState<CountryNodesInfo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<any>(null)

  const fetchUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://incentive-backend.oceanprotocol.com'
    return `${baseUrl}/locations`
  }, [])

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

  return (
    <MapContext.Provider
      value={{
        data,
        countryNodesInfo,
        loading,
        error
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
