'use client'
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerIcon from '../../assets/marker_map_icon.png'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Data } from '../../components/Table/data'

export default function Map() {
  const [isClient, setIsClient] = useState(false)

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
        {Data.map((node) => (
          <Marker icon={customIcon} position={node.coordinates as [number, number]} key={node.nodeId}>
            <Popup>
              <strong>Node ID:</strong> {node.nodeId}
              <br />
              <strong>Network:</strong> {node.network}
              <br />
              <strong>Location:</strong> {node.location}
              <br />
              <strong>City:</strong> {node.nodeDetails.city}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    )
  )
}
