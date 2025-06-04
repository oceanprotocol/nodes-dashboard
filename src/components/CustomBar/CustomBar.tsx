import React from 'react'

interface CustomBarProps {
  x: number
  y: number
  width: number
  height: number
  foregroundValue: number
  backgroundValue: number
}

const CustomBar: React.FC<CustomBarProps> = (props) => {
  const { x, y, width, height, foregroundValue, backgroundValue } = props
  const gapWidth = 3
  const barWidth = width - gapWidth
  const radius = 3

  const totalHeight = backgroundValue
  const foregroundHeight = totalHeight > 0 ? (foregroundValue / totalHeight) * height : 0
  const backgroundHeight = height - foregroundHeight

  return (
    <g>
      <path
        d={`
          M${x},${y + height}
          L${x},${y + backgroundHeight + radius}
          Q${x},${y + backgroundHeight} ${x + radius},${y + backgroundHeight}
          L${x + barWidth - radius},${y + backgroundHeight}
          Q${x + barWidth},${y + backgroundHeight} ${x + barWidth},${
            y + backgroundHeight + radius
          }
          L${x + barWidth},${y + height}
          Z
        `}
        fill="url(#gradient)"
      />
      <path
        d={`
          M${x},${y + backgroundHeight}
          L${x},${y + radius}
          Q${x},${y} ${x + radius},${y}
          L${x + barWidth - radius},${y}
          Q${x + barWidth},${y} ${x + barWidth},${y + radius}
          L${x + barWidth},${y + backgroundHeight}
          Z
        `}
        fill="#E0E0E0"
      />
    </g>
  )
}

export default CustomBar
