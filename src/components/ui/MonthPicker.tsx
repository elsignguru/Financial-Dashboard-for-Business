// Compact month/year picker — a button showing the selected month that opens
// a small calendar-style popover (year stepper + month grid) instead of a
// single flat <select> listing every available month, which gets unwieldy
// once a company has years of history synced from QuickBooks.
import { useEffect, useRef, useState } from 'react'
import { MONTHS_SHORT, formatDateFull } from '../../utils/dateUtils'

interface MonthPickerProps {
  value: string                 // "YYYY-MM"
  onChange: (value: string) => void
  availableDates: string[]      // sorted "YYYY-MM" strings — only these are selectable
  className?: string
}

export default function MonthPicker({ value, onChange, availableDates, className = '' }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parseInt(value.split('-')[0], 10))
  const rootRef = useRef<HTMLDivElement>(null)

  const availableSet = new Set(availableDates)
  const years = Array.from(new Set(availableDates.map(d => parseInt(d.split('-')[0], 10)))).sort((a, b) => a - b)
  const minYear = years[0] ?? viewYear
  const maxYear = years[years.length - 1] ?? viewYear

  // Reset the visible year to match the current value each time the popover opens.
  const toggleOpen = () => {
    setOpen(v => {
      const next = !v
      if (next) setViewYear(parseInt(value.split('-')[0], 10))
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selectMonth = (month: number) => {
    const next = `${viewYear}-${String(month).padStart(2, '0')}`
    if (!availableSet.has(next)) return
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`border border-gray-200 rounded px-2 py-1 text-left truncate hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 ${className}`}
      >
        {formatDateFull(value)}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-44">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <button
              type="button"
              onClick={() => setViewYear(y => y - 1)}
              disabled={viewYear <= minYear}
              className="px-1.5 py-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-gray-700">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear(y => y + 1)}
              disabled={viewYear >= maxYear}
              className="px-1.5 py-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_SHORT.map((label, i) => {
              const month = i + 1
              const dateStr = `${viewYear}-${String(month).padStart(2, '0')}`
              const isAvailable = availableSet.has(dateStr)
              const isSelected = dateStr === value
              return (
                <button
                  type="button"
                  key={label}
                  disabled={!isAvailable}
                  onClick={() => selectMonth(month)}
                  className={`text-xs rounded py-1 transition-colors ${
                    isSelected ? 'bg-blue-600 text-white'
                    : isAvailable ? 'text-gray-700 hover:bg-blue-50'
                    : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
