// Drag-and-drop / click-to-upload zone for importing a company's CSV file.
// After a file is selected the user is prompted to confirm or edit the company name
// (pre-filled from the filename) before the CSV is parsed and saved to the store.
import { useRef, useState } from 'react'
import { parseCSV } from '../../parser/CSVParser'
import { useDataStore } from '../../store/useDataStore'
import Modal from '../ui/Modal'

export default function UploadZone() {
  const [dragging, setDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const addCompany = useDataStore(s => s.addCompany)

  // Validates the file type and extracts a cleaned company name from the filename.
  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Por favor sube un archivo .csv'); return }
    // Pre-fill company name from filename: strip path, extension, trailing numbers/parens
    const baseName = file.name
      .replace(/\.csv$/i, '')
      .replace(/_Pérdidas y ganancias.*$/i, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim()
    setCompanyName(baseName)
    setPendingFile(file)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Reads the file, parses the CSV, and adds the resulting company to the store.
  const handleConfirm = async () => {
    if (!pendingFile || !companyName.trim()) return
    setLoading(true)
    try {
      const text = await pendingFile.text()
      const report = parseCSV(text, companyName.trim())
      addCompany(report)
      setPendingFile(null)
      setCompanyName('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Drop target — changes border color while dragging */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-sm
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="text-gray-400 mb-1 text-lg">↑</div>
        <p className="text-gray-600 font-medium">Subir CSV de empresa</p>
        <p className="text-gray-400 text-xs mt-0.5">Arrastra o haz clic</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Confirmation modal — lets user review/edit the company name before importing */}
      <Modal open={!!pendingFile} onClose={() => setPendingFile(null)} title="Nombre de la empresa">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿A qué empresa corresponde este archivo?
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setPendingFile(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!companyName.trim() || loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Importar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
