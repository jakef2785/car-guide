// US MPG (EPA, US gallons) -> UK imperial MPG conversion.
//
// 1 US gallon = 3.785411784 litres (exact, defined). 1 UK (imperial) gallon = 4.54609 litres
// (exact, defined). MPG is miles per gallon, so converting US MPG to UK MPG means converting
// the "per gallon" part — a US-gallon MPG figure covers fewer miles per (larger) imperial
// gallon... actually the imperial gallon is *larger* than the US gallon, so for the same fuel
// efficiency, UK MPG > US MPG. Conversion factor: UK_MPG = US_MPG * (4.54609 / 3.785411784).
const LITRES_PER_US_GALLON = 3.785411784;
const LITRES_PER_UK_GALLON = 4.54609;
const US_TO_UK_MPG_FACTOR = LITRES_PER_UK_GALLON / LITRES_PER_US_GALLON; // ≈ 1.20095

export function usMpgToUkMpg(usMpg: number): number {
  return usMpg * US_TO_UK_MPG_FACTOR;
}

export function ukMpgToUsMpg(ukMpg: number): number {
  return ukMpg / US_TO_UK_MPG_FACTOR;
}

// Rounds to one decimal place, matching the NUMERIC(5,1) precision used for mpg_* columns
// in prisma/schema.prisma.
export function roundMpg(value: number): number {
  return Math.round(value * 10) / 10;
}
