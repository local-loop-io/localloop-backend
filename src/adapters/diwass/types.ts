/**
 * Type shapes for the EU Digital Waste Shipment System (DIWASS), established under the
 * Waste Shipment Regulation (EU) 2024/1157 and Commission Implementing Regulation (EU)
 * 2025/1290 (API/interconnection technical requirements). These are a best-effort
 * approximation from the Implementing Regulation's articles — roles (Art. 10(1)),
 * attachment limits (Art. 13), authentication logging (Art. 14(2)), document-number format
 * (Art. 15(3)/(5)-(6)) — NOT a verified mirror of the actual Annex II message schema,
 * which is SOAP/XML and distributed only via the restricted CIRCABC platform to already
 * -registered DIWASS operators. See README.md for what this adapter does and does not do.
 */

export const DIWASS_ROLES = ['notifier', 'consignee', 'facility', 'carrier', 'competent_authority'] as const;
export type DiwassRole = (typeof DIWASS_ROLES)[number];

export const DIWASS_DOCUMENT_TYPES = ['notification', 'movement_document', 'completion_certificate'] as const;
export type DiwassDocumentType = (typeof DIWASS_DOCUMENT_TYPES)[number];

export const DIWASS_ATTACHMENT_MIME_TYPES = ['application/pdf', 'image/jpeg'] as const;
export type DiwassAttachmentMimeType = (typeof DIWASS_ATTACHMENT_MIME_TYPES)[number];

// Art. 13: attachments are capped at PDF/JPEG, <= 32MB.
export const DIWASS_MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;

export interface DiwassParty {
  role: DiwassRole;
  operatorId: string;
  name?: string;
  countryCode?: string;
}

export interface DiwassAttachment {
  mimeType: DiwassAttachmentMimeType;
  sizeBytes: number;
  /** LOOP-side reference to the file; DIWASS itself stores the binary, not this adapter. */
  reference: string;
}

/**
 * documentNumber is optional here because DIWASS assigns it on real submission, which this
 * adapter cannot perform (see README.md — no live transport). These shapes represent what a
 * LOOP record maps to *before* a human submits it through the real DIWASS GUI or API.
 */
export interface DiwassShipmentNotification {
  documentType: 'notification';
  documentNumber?: string;
  parties: DiwassParty[];
  wasteClassification: {
    ewcCode?: string;
    wasteFrameworkCode?: string;
  };
  attachments: DiwassAttachment[];
  /** Annex VII (Green List) paper-parallel transition runs through December 31, 2026. */
  greenListParallelPaperEligible: boolean;
}

export interface DiwassMovementDocument {
  documentType: 'movement_document';
  documentNumber?: string;
  notificationDocumentNumber?: string;
  parties: DiwassParty[];
  handoffAt: string;
  receivedAt?: string;
}

/** Retention window (WSR's confirmed minimum: 5 years) runs from issuedAt. */
export interface DiwassCompletionCertificate {
  documentType: 'completion_certificate';
  documentNumber: string;
  movementDocumentNumber: string;
  issuedAt: string;
}

export type DiwassDraftDocument = DiwassShipmentNotification | DiwassMovementDocument;

/**
 * A document number a node already holds — from a real, human-submitted DIWASS
 * notification/movement/certificate — that it wants to attach to a LOOP record. Unlike
 * DiwassDraftDocument, documentNumber is required here: this type represents a document
 * that already exists in DIWASS, not one this adapter is drafting.
 */
export interface DiwassDocumentReference {
  documentType: DiwassDocumentType;
  documentNumber: string;
}

/**
 * Every authentication action against DIWASS must log timestamp+timezone, user name, and
 * user function (Art. 14(2)). This adapter has no live transport, so nothing constructs or
 * reads this type today — it exists only to document what a future real integration's audit
 * log entry would need to carry.
 */
export interface DiwassAuthLogEntry {
  timestamp: string;
  timezoneOffset: string;
  userName: string;
  userFunction: string;
}
