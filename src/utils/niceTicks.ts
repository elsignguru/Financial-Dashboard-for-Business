// Computes a Y-axis domain + evenly-spaced tick values, so chart gridlines
// land on clean round numbers (e.g. 0 / 20M / 40M / 60M) instead of
// Recharts' default auto-ticks, which can look uneven. Uses the classic
// "nice numbers for graph labels" algorithm (Heckbert, Graphics Gems).

function niceNumber(value: number, round: boolean): number {
  if (value === 0) return 0
  const exponent = Math.floor(Math.log10(value))
  const fraction = value / Math.pow(10, exponent)
  let niceFraction: number
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }
  return niceFraction * Math.pow(10, exponent)
}

export interface YAxisScale {
  domain: [number, number]
  ticks: number[]
}

// Auto mode: rounds the data range outward to clean bounds and a clean step.
function autoNiceTicks(dataMin: number, dataMax: number, tickCount = 5): YAxisScale {
  if (dataMin === dataMax) {
    dataMin = dataMin === 0 ? 0 : dataMin - Math.abs(dataMin) * 0.1
    dataMax = dataMax === 0 ? 1 : dataMax + Math.abs(dataMax) * 0.1
  }
  const range = niceNumber(dataMax - dataMin, false) || 1
  const step = niceNumber(range / (tickCount - 1), true) || 1
  const niceMin = Math.floor(dataMin / step) * step
  const niceMax = Math.ceil(dataMax / step) * step

  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round((v + Number.EPSILON) * 1e6) / 1e6)
  }
  return { domain: [niceMin, niceMax], ticks }
}

// Manual mode: evenly spaced ticks across the user's exact chosen bounds
// (not rounded outward — they asked for this specific range).
function manualTicks(min: number, max: number, tickCount = 5): YAxisScale {
  const step = (max - min) / (tickCount - 1)
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.round((min + step * i + Number.EPSILON) * 1e6) / 1e6)
  return { domain: [min, max], ticks }
}

// Main entry point: uses the manual range if both bounds are set and valid,
// otherwise auto-computes a nice range from the data.
export function computeYAxisScale(
  dataMin: number,
  dataMax: number,
  manualMin?: number | null,
  manualMax?: number | null,
  tickCount = 5,
): YAxisScale {
  if (manualMin != null && manualMax != null && manualMin < manualMax) {
    return manualTicks(manualMin, manualMax, tickCount)
  }
  return autoNiceTicks(dataMin, dataMax, tickCount)
}
