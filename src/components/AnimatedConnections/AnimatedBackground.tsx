import React from 'react'
import styles from './Animated.module.css'
import dynamic from 'next/dynamic'
import JParticleAnimation from './JParticleAnimation'

const AnimatedNet = dynamic(() => import('../AnimatedConnections/AnimatedNet'), {
  ssr: false
})

const AnimatedBackground: React.FC = () => {
  return (
    <div className={styles.backgroundWrapper}>
      {/* <AnimatedNet /> */}
      <JParticleAnimation />
    </div>
  )
}

export default AnimatedBackground
