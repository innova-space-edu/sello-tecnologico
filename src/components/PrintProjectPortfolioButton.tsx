'use client'

export default function PrintProjectPortfolioButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50"
    >
      🖨️ Imprimir / Guardar PDF
    </button>
  )
}
