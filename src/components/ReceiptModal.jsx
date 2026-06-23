import { Receipt, ExternalLink } from 'lucide-react'
import { useSignedUrl } from '../lib/signedUrl'

// Receipt viewer used by Sales/TerapiaSales/RaportointiTerapia/RaportointiOma.
// Accepts either a bare object path ("terapia/123.jpg") from new uploads or
// a legacy full URL string from older rows; the hook handles both.
export default function ReceiptModal({ stored, onClose }) {
  const url = useSignedUrl('receipts', stored)
  if (!stored) return null
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <Receipt size={16} /> Kuitti
          </span>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--violet)', fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: '.25rem', textDecoration: 'none' }}>
              Avaa <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '1rem', minHeight: 200 }}>
          {url ? (
            <img src={url} alt="Kuitti"
              style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 16px rgba(0,0,0,.12)' }} />
          ) : (
            <div style={{ color: 'var(--text3)', padding: '2rem' }}>Ladataan…</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Sulje</button>
        </div>
      </div>
    </div>
  )
}
