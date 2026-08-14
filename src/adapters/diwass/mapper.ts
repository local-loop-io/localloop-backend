import {
  DIWASS_MAX_ATTACHMENT_BYTES,
  type DiwassAttachment,
  type DiwassAttachmentMimeType,
  type DiwassDocumentReference,
  type DiwassMovementDocument,
  type DiwassParty,
  type DiwassShipmentNotification,
} from './types';

export class DiwassMappingError extends Error {}

interface LoopTraceability {
  source_operator_id?: string;
  facility_id?: string;
  document_refs?: string[];
  due_diligence_ref?: string;
  retention_until?: string;
}

interface LoopPassport {
  supported_regimes?: string[];
  visible_to?: 'public' | 'operator' | 'regulator';
}

interface LoopMaterialForDiwass {
  id: string;
  classification?: {
    ewc_code?: string;
    waste_framework_code?: string;
  };
  traceability?: LoopTraceability;
  passport?: LoopPassport;
}

interface LoopTransferForDiwass {
  id: string;
  waste_shipment_doc_ref?: string;
  handoff_at: string;
  received_at?: string;
  traceability?: LoopTraceability;
}

function requireWasteShipmentRegime(passport: LoopPassport | undefined, recordId: string): void {
  if (!passport?.supported_regimes?.includes('waste-shipment')) {
    throw new DiwassMappingError(
      `${recordId}: passport.supported_regimes must include "waste-shipment" before mapping to a DIWASS document shape.`,
    );
  }
}

function partyFromOperatorId(operatorId: string | undefined, role: DiwassParty['role']): DiwassParty | null {
  return operatorId ? { role, operatorId } : null;
}

function attachmentsFromDocumentRefs(documentRefs: string[] | undefined): DiwassAttachment[] {
  return (documentRefs ?? []).map((reference) => ({
    // LOOP's document_refs carries no mime-type metadata; pdf is Art. 13's more common case
    // for shipment paperwork. A node with a real jpeg attachment should override this field.
    mimeType: 'application/pdf' as DiwassAttachmentMimeType,
    sizeBytes: 0,
    reference,
  }));
}

/**
 * Maps a MaterialDNA record tagged passport.supported_regimes: ["waste-shipment"] to a
 * best-effort DIWASS notification document shape. Pure data transform — see README.md. It
 * does not submit anything anywhere and produces no documentNumber (DIWASS assigns that on
 * real submission, which this adapter cannot perform).
 */
export function materialToDiwassNotification(material: LoopMaterialForDiwass): DiwassShipmentNotification {
  requireWasteShipmentRegime(material.passport, material.id);

  const parties = [
    partyFromOperatorId(material.traceability?.source_operator_id, 'notifier'),
    partyFromOperatorId(material.traceability?.facility_id, 'facility'),
  ].filter((party): party is DiwassParty => party !== null);

  return {
    documentType: 'notification',
    parties,
    wasteClassification: {
      ewcCode: material.classification?.ewc_code,
      wasteFrameworkCode: material.classification?.waste_framework_code,
    },
    attachments: attachmentsFromDocumentRefs(material.traceability?.document_refs),
    greenListParallelPaperEligible: false,
  };
}

/**
 * Maps a Transfer record carrying waste_shipment_doc_ref to a best-effort DIWASS movement
 * document shape. Pure data transform — see README.md.
 */
export function transferToDiwassMovementDocument(transfer: LoopTransferForDiwass): DiwassMovementDocument {
  if (!transfer.waste_shipment_doc_ref) {
    throw new DiwassMappingError(`${transfer.id}: waste_shipment_doc_ref must be set before mapping to a DIWASS movement document.`);
  }

  const parties = [
    partyFromOperatorId(transfer.traceability?.source_operator_id, 'notifier'),
    partyFromOperatorId(transfer.traceability?.facility_id, 'facility'),
  ].filter((party): party is DiwassParty => party !== null);

  return {
    documentType: 'movement_document',
    parties,
    handoffAt: transfer.handoff_at,
    receivedAt: transfer.received_at,
  };
}

/**
 * Reverse direction: given a document number a node already holds from a real, human
 * -submitted DIWASS document, builds the waste_shipment_doc_ref URI LOOP expects — a stable
 * reference into the node's own record, per profiles/waste-shipment/README.md, not a DIWASS
 * URL (DIWASS exposes no public lookup, so no such URL scheme exists to construct).
 */
export function diwassDocumentReferenceToDocRef(nodeBaseUrl: string, reference: DiwassDocumentReference): string {
  const trimmedBase = nodeBaseUrl.replace(/\/+$/, '');
  return `${trimmedBase}/diwass/${reference.documentType}/${encodeURIComponent(reference.documentNumber)}`;
}

/** Art. 13: attachments must be PDF or JPEG and no larger than 32MB. */
export function validateDiwassAttachment(attachment: DiwassAttachment): string[] {
  const failures: string[] = [];
  if (attachment.sizeBytes > DIWASS_MAX_ATTACHMENT_BYTES) {
    failures.push(`attachment "${attachment.reference}" is ${attachment.sizeBytes} bytes, over the ${DIWASS_MAX_ATTACHMENT_BYTES}-byte (32MB) Art. 13 cap.`);
  }
  return failures;
}
