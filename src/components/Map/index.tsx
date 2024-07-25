'use client'
import React, { useState, useEffect, useContext } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerIcon from '../../assets/marker_map_icon.png'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DataContext } from '@/context/DataContext'
import { NodeData } from '@/shared/types/RowDataType'
import styles from './style.module.css'

export default function Map() {
  const [isClient, setIsClient] = useState(false)
  const { data, loading, error } = useContext(DataContext);
  console.log('Tsable data: ', data)

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

  return (
    isClient && (
      <MapContainer center={center} zoom={2} style={{ height: '500px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {data.map((node:NodeData) => (
          <Marker icon={customIcon} position={[node.location.latitude, node.location.longitude]} key={node.id}>
            <Popup className={styles.popup}>
              <strong>Node ID:</strong> {node.id}
              <br />
              <strong>Network:</strong> {node?.indexer?.[0]?.network}
              <br />
              <strong>Location:</strong> {node.location.country}
              <br />
              <strong>City:</strong> {node.location.city}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    )
  )
}
