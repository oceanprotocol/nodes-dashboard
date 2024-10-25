import React, { useEffect, useRef } from 'react'
import NET from './vanta.net.js'
import * as THREE from 'three'

const AnimatedNet: React.FC = () => {
  const vantaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let vantaEffect: any
    if (vantaRef.current) {
      vantaEffect = NET({
        el: vantaRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.5,
        scaleMobile: 1.0,
        points: 3.0,
        maxDistance: 16.0,
        spacing: 20.0,
        color: 0xbd2881, // Node color
        linkColor: 0x7b1173, // Link color
        nodeSize: 1.4, // Node size
        lineThickness: 0.1, // Line thickness
        backgroundColor: 0x0e001a,
        THREE: THREE
      })
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy()
    }
  }, [])

  return <div ref={vantaRef} style={{ width: '100%', height: '100%' }} />
}

export default AnimatedNet
