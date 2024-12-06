import React, { useEffect, useRef, useState } from 'react'
import jparticles from 'jparticles'

const JParticleAnimation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [JParticles, setJParticles] = useState<any>(null)
  const particleInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const initJParticles = async () => {
      try {
        const JParticlesModule = await import('jparticles')

        setJParticles(JParticlesModule)
      } catch (error) {
        console.error('Error initializing JParticles:', error)
      }
    }

    initJParticles()
  }, [])

  useEffect(() => {
    if (!JParticles || !containerRef.current) return

    const createParticle = () => {
      if (!particleInstanceRef.current) {
        particleInstanceRef.current = new JParticles.Particle(containerRef.current, {
          num: 90,
          color: ['#7b1173', '#cf1fb14d'],
          lineShape: 'cube',
          lineWidth: 1,
          range: 2000,
          proximity: 150,
          parallax: true,
          maxR: 20.5,
          minR: 10.5,
          minSpeed: 0.1,
          maxSpeed: 0.2,
          parallaxLayer: [1, 3, 5, 10],
          parallaxStrength: 5
        })
      }
    }

    createParticle()

    const handleResize = () => {
      if (
        particleInstanceRef.current &&
        typeof particleInstanceRef.current.resize === 'function'
      ) {
        particleInstanceRef.current.resize()
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return
      const { clientX, clientY } = event
      const { width, height } = containerRef.current.getBoundingClientRect()
      const x = (clientX / width - 0.5) * 2
      const y = (clientY / height - 0.5) * 2

      if (particleInstanceRef.current && particleInstanceRef.current.setOptions) {
        particleInstanceRef.current.setOptions({
          parallaxX: x * 100,
          parallaxY: y * 100
        })
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      if (
        particleInstanceRef.current &&
        typeof particleInstanceRef.current.destroy === 'function'
      ) {
        particleInstanceRef.current.destroy()
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [JParticles])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

export default JParticleAnimation
