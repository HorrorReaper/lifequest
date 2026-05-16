"use client"

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { format, parseISO } from 'date-fns'

interface DatePickerProps {
  value: string | null
  onChange: (isoDate: string | null) => void
  placeholder?: string
  className?: string
}

export function DatePicker({ value, onChange, placeholder = 'Select date', className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const portalRef = useRef<HTMLDivElement | null>(null)
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({})
  const selected = value ? parseISO(value) : undefined

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return
      const target = e.target as Node
      // if the click is inside the button/container or inside the portal, ignore
      if (containerRef.current.contains(target)) return
      if (portalRef.current && portalRef.current.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function updatePosition() {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const buttonWidth = rect.width
    const minWidth = 288 // 18rem default previously used (w-72)
    const popupWidth = Math.max(minWidth, buttonWidth)
    let left = rect.left
    // Clamp to viewport so popup doesn't overflow to the right
    if (left + popupWidth > window.innerWidth) left = Math.max(8, window.innerWidth - popupWidth - 8)
    if (left < 8) left = 8
    setPortalStyle({
      position: 'fixed',
      top: rect.bottom,
      left,
      minWidth: popupWidth,
      maxWidth: Math.min(popupWidth, window.innerWidth - 16),
      zIndex: 2147483647,
      pointerEvents: 'auto',
    })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  return (
    <div className={`relative z-50 inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        className="w-full text-left rounded-md border border-input px-3 py-2 bg-background"
        onClick={() => setOpen((s) => !s)}
      >
        <span className="text-sm">{value ? format(parseISO(value), 'PPP') : placeholder}</span>
      </button>

      {open && createPortal(
        <div ref={portalRef} style={portalStyle} className="mt-2 rounded-md border bg-card p-2 shadow-lg">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (!d) {
                onChange(null)
                return
              }
              const iso = d.toISOString().split('T')[0]
              onChange(iso)
              setOpen(false)
            }}
            pagedNavigation={false}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md border px-2 py-1 text-sm"
              onClick={() => { onChange(null); setOpen(false) }}
            >
              Clear
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-primary/10 px-2 py-1 text-sm"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
