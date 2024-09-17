'use client'
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerIcon from '../../assets/marker_map_icon.png'
import L, { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './style.module.css'
import { useMapContext } from '../../context/MapContext'
import { LinearProgress } from '@mui/material'
import { LocationNode } from '../../shared/types/locationNodeType'

export default function Map() {
  const [isClient, setIsClient] = useState(false)
  const { data, loading, error } = useMapContext()

  useEffect(() => {
    setIsClient(true)
  }, [])

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

  return (
    isClient && (
      <MapContainer center={center} zoom={2} style={{ height: '500px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {!loading &&
          !error &&
          data.map((node: LocationNode) => {
            const { lat, lon, country, city } = node._source

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
                key={node._id}
                icon={customIcon}
                position={offsetCoordinates(lat, lon)}
              >
                <Popup className={styles.popup}>
                  <strong>City:</strong> {city}
                  <br />
                  <strong>Country:</strong> {country}
                  <br />
                </Popup>
              </Marker>
            )
          })}
        {loading && <LinearProgress />}
      </MapContainer>
    )
  )
}
