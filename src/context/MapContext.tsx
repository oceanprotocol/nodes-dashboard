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
import { getApiRoute } from '@/config'

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
  totalCountries: number
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
  const [totalCountries, setTotalCountries] = useState<number>(0)

  const fetchUrl = useMemo(() => {
    return getApiRoute('locations')
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await axios.get(fetchUrl)
        const nodes = response.data.locations
        const totalCountries = response.data.totalCountries

        setData(nodes)
        setTotalCountries(totalCountries)
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
        error,
        totalCountries
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
