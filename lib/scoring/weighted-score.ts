// Weighted scoring algorithm. Spec: vault 01-Specification/Scoring-System.md
//
// final_score = Σ (criterion_score × user_weight) / Σ user_weights
// Criteria: performance, fuel economy, estimated running cost, recall history, complaint volume.
// Ties resolved by complaint volume ascending.
// TODO Phase 3: implement + unit tests.
export {};
