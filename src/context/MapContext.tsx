import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useMemo
} from 'react'
import axios from 'axios'
import { getApiRoute } from '@/config'
import { LocationNode } from '../shared/types/locationNodeType'

interface MapContextType {
  data: LocationNode[]
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
        const locationsFromAPI = response.data.locations
        const totalCountries = response.data.totalCountries

        const transformedNodes = locationsFromAPI.map((location: any) => ({
          city: location.location,
          lat: location.coordinates.lat,
          lon: location.coordinates.lon,
          country: location.country || location.location,
          count: location.count
        }))

        setData(transformedNodes)
        setTotalCountries(totalCountries)
      } catch (err) {
        console.error('Error fetching locations:', err)
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
