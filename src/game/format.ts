const UNITS = ['', 'k', 'M', 'Md', 'T']

/** Nombres fr-FR ; au-delà de 10 000 → k, M, Md, T. */
export function fmt(n: number): string {
  n = Math.floor(n)
  if (n < 10000) return n.toLocaleString('fr-FR')
  let i = 0
  while (n >= 1000 && i < UNITS.length - 1) {
    n /= 1000
    i++
  }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0).replace('.', ',') + ' ' + UNITS[i]
}

/** Pour les taux (/s) : garde une décimale. */
export function fmtRate(n: number): string {
  if (n >= 10000) return fmt(n)
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}
