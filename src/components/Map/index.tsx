'use client'
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerIcon from '../../assets/marker_map_icon.png'
import L, { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './style.module.css'
import { useMapContext } from '../../context/MapContext'
import { Alert, Box, LinearProgress, Skeleton } from '@mui/material'
import { LocationNode } from '../../shared/types/locationNodeType'

export default function Map() {
  const [isClient, setIsClient] = useState(false)
  const { data, loading, error } = useMapContext()

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (loading || !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Skeleton
          variant="rectangular"
          width="100%"
          height={500}
          sx={{
            borderRadius: '20px',
            bgcolor: 'rgba(207, 31, 177, 0.1)' // Matches our theme
          }}
        />
      </Box>
    )
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert
          severity="error"
          sx={{
            width: '100%',
            maxWidth: '500px',
            '& .MuiAlert-icon': {
              color: '#e000cf'
            }
          }}
        >
          Error loading map data: {error?.message || 'Something went wrong'}
        </Alert>
      </Box>
    )
  }

  const center: [number, number] = [25, 0]

  const customIcon = L.icon({
    iconUrl: MarkerIcon.src,
    iconSize: [36, 36],
    iconAnchor: [19, 36],
    popupAnchor: [0, -36]
  })

  const getRandomOffset = (): number => {
    const min = 0.0002
    const max = 0.0006
    const randomValue = Math.random() * (max - min) + min
    return Math.random() < 0.5 ? -randomValue : randomValue
  }

  const offsetCoordinates = (latitude: number, longitude: number): LatLngExpression => {
    const latOffset = getRandomOffset()
    const lngOffset = getRandomOffset()
    return [latitude + latOffset, longitude + lngOffset]
  }

  const groupedNodesByCity = data.reduce(
    (
      acc: Record<string, { lat: number; lon: number; country: string; count: number }>,
      node: LocationNode
    ) => {
      const { city, lat, lon, country, count } = node

      if (city) {
        if (!acc[city]) {
          acc[city] = { lat, lon, country, count }
        } else {
          acc[city].count += count
        }
      }

      return acc
    },
    {}
  )

  return (
    isClient && (
      <MapContainer
        center={center}
        zoom={2}
        className={styles.mapContainer}
        style={{ height: '500px', width: '100%', borderRadius: '20px' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {!loading &&
          !error &&
          Object.entries(groupedNodesByCity).map(
            ([city, { lat, lon, country, count }]) => {
              if (
                typeof lat !== 'number' ||
                typeof lon !== 'number' ||
                isNaN(lat) ||
                isNaN(lon)
              ) {
                console.warn(
                  `Invalid coordinates for city: ${city}, lat: ${lat}, lon: ${lon}`
                )
                return null
              }

              return (
                <Marker
                  key={city}
                  icon={customIcon}
                  position={offsetCoordinates(lat, lon)}
                >
                  <Popup className={styles.popup}>
                    <strong>City:</strong> {city}
                    <br />
                    <strong>Country:</strong> {country}
                    <br />
                    <strong>Total Nodes:</strong> {count}
                    <br />
                  </Popup>
                </Marker>
              )
            }
          )}
        {loading && <LinearProgress />}
      </MapContainer>
    )
  )
}
