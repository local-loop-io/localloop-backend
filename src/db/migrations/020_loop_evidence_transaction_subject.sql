-- 020_loop_evidence_transaction_subject.sql
-- Core-DP evidence-entry.schema.json (loop-protocol >= 0.5.2) allows `transaction` as a
-- subject type, so POST /api/v1/transaction can write to the append-only evidence log
-- like every other lifecycle write. Widen the CHECK constraint accordingly (re-runnable).
ALTER TABLE loop_evidence DROP CONSTRAINT IF EXISTS loop_evidence_subject_type_check;
ALTER TABLE loop_evidence ADD CONSTRAINT loop_evidence_subject_type_check
  CHECK (subject_type IN ('material', 'product', 'offer', 'match', 'transfer', 'envelope', 'transaction'));
