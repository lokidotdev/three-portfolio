import { useEffect, useRef, useState } from 'react'

/**
 * Tracks the mouse position, normalized to a -0.5 to 0.5 range on both axes.
 * -0.5 = left/top edge, 0 = center, 0.5 = right/bottom edge.
 */
const useMouseCoordinates = () => {
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const frame = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (frame.current) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        setCoords({
          x: e.clientX / window.innerWidth - 0.5,
          y: e.clientY / window.innerHeight - 0.5,
        })
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  return coords
}

export default useMouseCoordinates
