'use client'

export default function PrintProjectPortfolioButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/25"
    >
      🖨️ Imprimir / Guardar PDF
    </button>
  )
}
