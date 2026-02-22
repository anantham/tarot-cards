type ExportBackupSectionProps = {
  exporting: boolean;
  exportStatus: string;
  generatedCardsCount: number;
  onExportAll: () => void;
};

export function ExportBackupSection({
  exporting,
  exportStatus,
  generatedCardsCount,
  onExportAll,
}: ExportBackupSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#d4af37' }}>
        Export / Backup
      </h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.75 }}>
        Download all generated cards (images/videos) plus a manifest as a zip file you can keep or import elsewhere.
      </p>
      <button
        onClick={onExportAll}
        disabled={exporting || generatedCardsCount === 0}
        style={{
          padding: '0.9rem 1.5rem',
          background: exporting || generatedCardsCount === 0 ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b98c28 100%)',
          border: 'none',
          borderRadius: '8px',
          color: '#ffffff',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: exporting || generatedCardsCount === 0 ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
          opacity: exporting || generatedCardsCount === 0 ? 0.6 : 1,
        }}
      >
        {exporting ? '⏳ Exporting...' : '⬇️ Export All Cards (Zip)'}
      </button>
      {exportStatus && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#e8e8e8', opacity: 0.8 }}>
          {exportStatus}
        </div>
      )}
      {generatedCardsCount === 0 && !exporting && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
          Generate a card first to enable export.
        </div>
      )}
    </section>
  );
}
