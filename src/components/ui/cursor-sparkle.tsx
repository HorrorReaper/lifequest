'use client'

import { useEffect } from 'react'

export function CursorSparkle() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    let lastTime = 0

    function spawnParticle(x: number, y: number) {
      const el = document.createElement('div')
      const size = 3 + Math.random() * 5
      const angle = Math.random() * Math.PI * 2
      const distance = 8 + Math.random() * 18

      el.className = 'sparkle-particle'
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.setProperty('--tx', `${Math.cos(angle) * distance}px`)
      el.style.setProperty('--ty', `${Math.sin(angle) * distance}px`)

      document.body.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }

    function onMouseMove(e: MouseEvent) {
      const now = performance.now()
      if (now - lastTime < 30) return
      lastTime = now
      spawnParticle(e.clientX, e.clientY)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  return null
}
