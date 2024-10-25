// components/ThreeScene.tsx

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let camera: THREE.PerspectiveCamera
    let scene: THREE.Scene
    let renderer: THREE.WebGLRenderer
    let group: THREE.Group
    let particlesData: any[] = []
    let positions: Float32Array
    let colors: Float32Array
    let particles: THREE.BufferGeometry
    let pointCloud: THREE.Points
    let particlePositions: Float32Array
    let linesMesh: THREE.LineSegments

    const maxParticleCount = 200 // Adjusted for performance
    let particleCount = 150
    const r = 800
    const rHalf = r / 2

    const effectController = {
      showDots: true,
      showLines: true,
      minDistance: 150,
      limitConnections: false,
      maxConnections: 75,
      particleCount: particleCount,
      minSize: 15, // Minimum particle size
      maxSize: 20 // Maximum particle size
    }

    const gridSize = 20 // For spatial partitioning
    const grid: Map<string, number[]> = new Map()

    const neighborOffsets = [-1, 0, 1]

    const desiredFPS = 30
    let lastRenderTime = 0

    const init = () => {
      if (!mountRef.current) return
      const container = mountRef.current

      // Camera
      camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        4000
      )
      camera.position.z = 1750

      // Scene
      scene = new THREE.Scene()
      scene.background = null

      // Group
      group = new THREE.Group()
      scene.add(group)

      // Particles
      const segments = maxParticleCount * maxParticleCount
      positions = new Float32Array(segments * 3)
      colors = new Float32Array(segments * 3)

      // Define shaders for custom point sizes and colors
      const particleVertexShader = `
        attribute float size;
        varying float vAlpha;

        void main() {
          vAlpha = 1.0;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (600.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `

      const particleFragmentShader = `
        uniform vec3 color;
        varying float vAlpha;

        void main() {
          gl_FragColor = vec4(color, vAlpha);

          // Render particles as circles
          float dist = length(gl_PointCoord - vec2(0.5, 0.5));
          if (dist > 0.5) discard;
        }
      `

      // Particle material with custom shaders
      const pMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color('#CF1FB1') } // Node color set here
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending
      })

      particles = new THREE.BufferGeometry()
      particlePositions = new Float32Array(maxParticleCount * 3)
      const sizes = new Float32Array(maxParticleCount)

      for (let i = 0; i < maxParticleCount; i++) {
        const x = Math.random() * r - r / 2
        const y = Math.random() * r - r / 2
        const z = Math.random() * r - r / 2

        particlePositions[i * 3] = x
        particlePositions[i * 3 + 1] = y
        particlePositions[i * 3 + 2] = z

        // Assign random sizes using effectController.minSize and maxSize
        sizes[i] =
          effectController.minSize +
          Math.random() * (effectController.maxSize - effectController.minSize)

        particlesData.push({
          velocity: new THREE.Vector3(
            -1 + Math.random() * 2,
            -1 + Math.random() * 2,
            -1 + Math.random() * 2
          ),
          numConnections: 0
        })
      }

      particles.setDrawRange(0, particleCount)
      particles.setAttribute(
        'position',
        new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage)
      )
      particles.setAttribute(
        'size',
        new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage)
      )

      pointCloud = new THREE.Points(particles, pMaterial)
      group.add(pointCloud)

      // Lines
      const geometry = new THREE.BufferGeometry()

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
      )
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage)
      )

      geometry.computeBoundingSphere()
      geometry.setDrawRange(0, 0)

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true
      })

      linesMesh = new THREE.LineSegments(geometry, material)
      group.add(linesMesh)

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(0.75) // Adjusted for performance
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setClearColor(0x0e001a, 1)
      container.appendChild(renderer.domElement)

      // Start animation
      requestAnimationFrame(animate)

      // Handle window resize
      window.addEventListener('resize', onWindowResize)
    }

    const onWindowResize = () => {
      if (!mountRef.current) return

      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()

      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    const getGridCell = (x: number, y: number, z: number) => {
      const cellSize = r / gridSize
      const xi = Math.floor((x + rHalf) / cellSize)
      const yi = Math.floor((y + rHalf) / cellSize)
      const zi = Math.floor((z + rHalf) / cellSize)
      return `${xi},${yi},${zi}`
    }

    const animate = (time: number) => {
      const delta = time - lastRenderTime

      if (delta < 1000 / desiredFPS) {
        requestAnimationFrame(animate)
        return
      }
      lastRenderTime = time

      let vertexpos = 0
      let colorpos = 0
      let numConnected = 0
      const maxConnections = effectController.limitConnections
        ? effectController.maxConnections
        : Infinity
      const minDistanceSq = effectController.minDistance * effectController.minDistance

      particlesData.forEach((particleData) => {
        particleData.numConnections = 0
      })

      // Clear the grid
      grid.clear()

      // Update particles and assign to grid cells
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        let dx = 0,
          dy = 0,
          dz = 0,
          distSq = 0

        const particleData = particlesData[i]

        // Update particle positions
        particlePositions[i3] += particleData.velocity.x
        particlePositions[i3 + 1] += particleData.velocity.y
        particlePositions[i3 + 2] += particleData.velocity.z

        // Bounce particles off walls
        if (particlePositions[i3] < -rHalf || particlePositions[i3] > rHalf)
          particleData.velocity.x = -particleData.velocity.x
        if (particlePositions[i3 + 1] < -rHalf || particlePositions[i3 + 1] > rHalf)
          particleData.velocity.y = -particleData.velocity.y
        if (particlePositions[i3 + 2] < -rHalf || particlePositions[i3 + 2] > rHalf)
          particleData.velocity.z = -particleData.velocity.z

        // Assign to grid
        const x = particlePositions[i3]
        const y = particlePositions[i3 + 1]
        const z = particlePositions[i3 + 2]

        const cell = getGridCell(x, y, z)
        if (!grid.has(cell)) {
          grid.set(cell, [])
        }
        grid.get(cell)!.push(i)
      }

      // Update particle attributes
      particles.attributes.position.needsUpdate = true

      // Check connections
      for (let i = 0; i < particleCount; i++) {
        const particleDataA = particlesData[i]
        const i3 = i * 3

        if (particleDataA.numConnections >= maxConnections) continue

        // Get the cell indices
        const cellSize = r / gridSize
        const xi = Math.floor((particlePositions[i3] + rHalf) / cellSize)
        const yi = Math.floor((particlePositions[i3 + 1] + rHalf) / cellSize)
        const zi = Math.floor((particlePositions[i3 + 2] + rHalf) / cellSize)

        // Iterate over neighboring cells
        for (let dxCell of neighborOffsets) {
          for (let dyCell of neighborOffsets) {
            for (let dzCell of neighborOffsets) {
              const neighborCell = `${xi + dxCell},${yi + dyCell},${zi + dzCell}`
              if (grid.has(neighborCell)) {
                const neighbors = grid.get(neighborCell)!
                for (let j of neighbors) {
                  if (j <= i) continue // Avoid duplicates and self-check
                  const particleDataB = particlesData[j]
                  if (particleDataB.numConnections >= maxConnections) continue

                  const j3 = j * 3

                  const dx = particlePositions[i3] - particlePositions[j3]
                  const dy = particlePositions[i3 + 1] - particlePositions[j3 + 1]
                  const dz = particlePositions[i3 + 2] - particlePositions[j3 + 2]
                  const distSq = dx * dx + dy * dy + dz * dz

                  if (distSq < minDistanceSq) {
                    particleDataA.numConnections++
                    particleDataB.numConnections++

                    const alpha = 1.0 - Math.sqrt(distSq) / effectController.minDistance

                    positions[vertexpos++] = particlePositions[i3]
                    positions[vertexpos++] = particlePositions[i3 + 1]
                    positions[vertexpos++] = particlePositions[i3 + 2]

                    positions[vertexpos++] = particlePositions[j3]
                    positions[vertexpos++] = particlePositions[j3 + 1]
                    positions[vertexpos++] = particlePositions[j3 + 2]

                    colors[colorpos++] = alpha
                    colors[colorpos++] = alpha
                    colors[colorpos++] = alpha

                    colors[colorpos++] = alpha
                    colors[colorpos++] = alpha
                    colors[colorpos++] = alpha

                    numConnected++
                  }
                }
              }
            }
          }
        }
      }

      linesMesh.geometry.setDrawRange(0, numConnected * 2)

      if (numConnected > 0) {
        linesMesh.geometry.attributes.position.needsUpdate = true
        linesMesh.geometry.attributes.color.needsUpdate = true
      }

      render()

      requestAnimationFrame(animate)
    }

    const render = () => {
      group.rotation.y += 0.002
      renderer.render(scene, camera)
    }

    init()

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', onWindowResize)
      renderer.dispose()
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1
      }}
    />
  )
}

export default ThreeScene
