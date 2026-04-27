// Reusable modal dialog — rendered in a fixed overlay above all other content.
// Closes on Escape key or backdrop click. Width is configurable via the `width` prop.
import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string  // Tailwind max-width class, e.g. "max-w-lg"
}

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Register Escape key listener while modal is open; clean it up on close or unmount.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className={`bg-white rounded-lg shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}>
        {/* Header row with title and close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
