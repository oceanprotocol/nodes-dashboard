'use client'
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerIcon from '../../assets/marker_map_icon.png'
import L, { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useDataContext } from '@/context/DataContext'
import { NodeData } from '@/shared/types/RowDataType'
import styles from './style.module.css'

export default function Map() {
  const [isClient, setIsClient] = useState(false)
  const { data, loading, error } = useDataContext()
  console.log('Table data: ', data)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const center: [number, number] = [51.505, -0.09]

  const customIcon = L.icon({
    iconUrl: MarkerIcon.src,
    iconSize: [36, 36],
    iconAnchor: [19, 36],
    popupAnchor: [0, -36]
  })

  const offsetCoordinates = (latitude: number, longitude: number, index: number, total: number): LatLngExpression => {
    const offset = 0.0003 * index
    return [
      latitude + offset,
      longitude + offset
    ]
  }

  const groupedNodes = data.reduce((acc, node: NodeData) => {
    if (node?.location?.latitude && node?.location?.longitude) {
      const key = `${node.location.latitude},${node.location.longitude}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(node)
    }
    return acc
  }, {} as Record<string, NodeData[]>)

  return (
    isClient && (
      <MapContainer center={center} zoom={2} style={{ height: '500px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {Object.entries(groupedNodes).map(([key, nodes]) => (
          nodes.map((node, index) => (
            <Marker
              icon={customIcon}
              position={offsetCoordinates(node.location.latitude, node.location.longitude, index, nodes.length)}
              key={`${node.id}-${index}`}
            >
              <Popup className={styles.popup}>
                <strong>Node ID:</strong> {node.id}
                <br />
                <strong>Network:</strong> {node.indexer?.[0]?.network}
                <br />
                <strong>Location:</strong> {node.location.country}
                <br />
                <strong>City:</strong> {node.location.city}
              </Popup>
            </Marker>
          ))
        ))}
      </MapContainer>
    )
  )
}
