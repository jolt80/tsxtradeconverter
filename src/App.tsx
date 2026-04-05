import { useState, useCallback } from 'react'
import { convertOrdersToTrades } from './converter'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.name.endsWith('.csv')) {
      setFile(droppedFile)
      setStatus('idle')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile?.name.endsWith('.csv')) {
      setFile(selectedFile)
      setStatus('idle')
    }
  }

  const handleConvert = async () => {
    if (!file) return
    setStatus('processing')
    try {
      const content = await file.text()
      const converted = convertOrdersToTrades(content)
      const blob = new Blob([converted], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace('.csv', '_to_trades.csv')
      a.click()
      URL.revokeObjectURL(url)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-zinc-100">TopstepX Trade Converter</h1>
        <p className="text-zinc-400 mb-6 text-sm">TopstepX live accounts lack trade export functionality. This converter reconstructs trades from order exports, reverse-engineered from sim account data where both exports are available. The converted file can be imported into journaling tools like Tradezella.</p>
        
        <div className="bg-zinc-800 rounded-lg p-4 mb-8 text-sm">
          <h2 className="text-zinc-200 font-semibold mb-2">Limitations</h2>
          <ul className="text-zinc-400 space-y-1 list-disc list-inside">
            <li>Trade IDs are generated from order IDs - not original platform trade IDs</li>
            <li>Entry/exit timestamps have lower resolution than platform</li>
            <li>Only tested with NQ and MNQ contracts</li>
          </ul>
        </div>
        
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-zinc-400 bg-zinc-800' : 'border-zinc-600 hover:border-zinc-500'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <p className="text-zinc-400 mb-2">Drag & drop a CSV exported from the Orders tab</p>
            <p className="text-zinc-500 text-sm">or click to select</p>
          </label>
        </div>

        {file && (
          <div className="mt-6">
            <p className="text-zinc-400 mb-4">Selected: <span className="text-zinc-200">{file.name}</span></p>
            <button
              onClick={handleConvert}
              disabled={status === 'processing'}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 px-6 py-2 rounded transition-colors"
            >
              {status === 'processing' ? 'Converting...' : 'Convert'}
            </button>
            {status === 'done' && <p className="text-green-500 mt-3">Download started!</p>}
            {status === 'error' && <p className="text-red-500 mt-3">Conversion failed</p>}
          </div>
        )}
        
        <div className="text-zinc-500 text-sm mt-12 text-center space-y-2">
          <p>All processing runs client-side in your browser. No data is uploaded or stored.</p>
          <p><a href="https://github.com/jolt80/tsxtradeconverter/issues/new?title=%3CBug%20Report%3E&body=%23%23%20Description%0A%3CDescribe%20what's%20wrong%20with%20the%20conversion.%20Include%20expected%20values%20from%20the%20platform%20for%20comparison%20-%20issues%20are%20hard%20to%20debug%20without%20this.%3E%0A%0A%3CAttach%20the%20orders%20CSV%20file.%3E%0A%0A%23%23%20Contact%20email%20(optional)%0A" target="_blank" rel="noopener" className="text-zinc-400 hover:text-zinc-300 underline">Report an issue</a> <span className="text-zinc-600">(requires GitHub login)</span></p>
        </div>
      </div>
    </div>
  )
}

export default App
