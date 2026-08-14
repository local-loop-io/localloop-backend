import { describe, expect, it } from 'bun:test';
import {
  DiwassMappingError,
  diwassDocumentReferenceToDocRef,
  materialToDiwassNotification,
  transferToDiwassMovementDocument,
  validateDiwassAttachment,
} from '../src/adapters/diwass/mapper';
import { DIWASS_MAX_ATTACHMENT_BYTES } from '../src/adapters/diwass/types';

describe('materialToDiwassNotification', () => {
  const wasteShipmentMaterial = {
    id: 'MAT-DE-MUC-2026-EWASTE-9C3F02',
    classification: { ewc_code: '16 02 14', waste_framework_code: 'WFD-16-02-14' },
    traceability: {
      source_operator_id: 'OP-DE-MUC-WSR-005',
      facility_id: 'FAC-NL-RTM-RCY-03',
      document_refs: ['https://example.com/diwass/movement-documents/DE-MUC-2026-9C3F02.pdf'],
    },
    passport: { supported_regimes: ['waste-shipment'] },
  };

  it('maps a waste-shipment-tagged material to a notification shape', () => {
    const notification = materialToDiwassNotification(wasteShipmentMaterial);

    expect(notification.documentType).toBe('notification');
    expect(notification.documentNumber).toBeUndefined();
    expect(notification.parties).toEqual([
      { role: 'notifier', operatorId: 'OP-DE-MUC-WSR-005' },
      { role: 'facility', operatorId: 'FAC-NL-RTM-RCY-03' },
    ]);
    expect(notification.wasteClassification).toEqual({ ewcCode: '16 02 14', wasteFrameworkCode: 'WFD-16-02-14' });
    expect(notification.attachments).toEqual([
      { mimeType: 'application/pdf', sizeBytes: 0, reference: 'https://example.com/diwass/movement-documents/DE-MUC-2026-9C3F02.pdf' },
    ]);
    expect(notification.greenListParallelPaperEligible).toBe(false);
  });

  it('throws DiwassMappingError when supported_regimes omits waste-shipment', () => {
    const untagged = { ...wasteShipmentMaterial, passport: { supported_regimes: ['ppwr'] } };
    expect(() => materialToDiwassNotification(untagged)).toThrow(DiwassMappingError);
  });

  it('throws DiwassMappingError when passport is absent entirely', () => {
    const { passport: _passport, ...withoutPassport } = wasteShipmentMaterial;
    expect(() => materialToDiwassNotification(withoutPassport)).toThrow(DiwassMappingError);
  });

  it('omits parties and attachments cleanly when traceability is absent', () => {
    const minimal = { id: 'MAT-DE-MUC-2026-EWASTE-0000AA', passport: { supported_regimes: ['waste-shipment'] } };
    const notification = materialToDiwassNotification(minimal);
    expect(notification.parties).toEqual([]);
    expect(notification.attachments).toEqual([]);
  });
});

describe('transferToDiwassMovementDocument', () => {
  const shipmentTransfer = {
    id: 'TRF-WSR5C1D82',
    waste_shipment_doc_ref: 'https://example.com/diwass/notifications/DE-MUC-2026-9C3F02',
    handoff_at: '2026-08-14T06:00:00Z',
    received_at: '2026-08-16T09:00:00Z',
    traceability: { source_operator_id: 'OP-DE-MUC-WSR-005', facility_id: 'FAC-NL-RTM-RCY-03' },
  };

  it('maps a Transfer carrying waste_shipment_doc_ref to a movement-document shape', () => {
    const movement = transferToDiwassMovementDocument(shipmentTransfer);

    expect(movement.documentType).toBe('movement_document');
    expect(movement.handoffAt).toBe('2026-08-14T06:00:00Z');
    expect(movement.receivedAt).toBe('2026-08-16T09:00:00Z');
    expect(movement.parties).toEqual([
      { role: 'notifier', operatorId: 'OP-DE-MUC-WSR-005' },
      { role: 'facility', operatorId: 'FAC-NL-RTM-RCY-03' },
    ]);
  });

  it('throws DiwassMappingError when waste_shipment_doc_ref is missing', () => {
    const { waste_shipment_doc_ref: _ref, ...withoutDocRef } = shipmentTransfer;
    expect(() => transferToDiwassMovementDocument(withoutDocRef)).toThrow(DiwassMappingError);
  });
});

describe('diwassDocumentReferenceToDocRef', () => {
  it('builds a node-local reference URI, not a DIWASS URL', () => {
    const url = diwassDocumentReferenceToDocRef('https://munich.loop', {
      documentType: 'notification',
      documentNumber: 'DEBY26000123',
    });
    expect(url).toBe('https://munich.loop/diwass/notification/DEBY26000123');
  });

  it('strips a trailing slash from the base URL before joining', () => {
    const url = diwassDocumentReferenceToDocRef('https://munich.loop/', {
      documentType: 'movement_document',
      documentNumber: 'DEBY26000124',
    });
    expect(url).toBe('https://munich.loop/diwass/movement_document/DEBY26000124');
  });

  it('URI-encodes the document number', () => {
    const url = diwassDocumentReferenceToDocRef('https://munich.loop', {
      documentType: 'notification',
      documentNumber: 'DE BY/26 000125',
    });
    expect(url).toBe('https://munich.loop/diwass/notification/DE%20BY%2F26%20000125');
  });
});

describe('validateDiwassAttachment', () => {
  it('accepts an attachment at or under the 32MB Art. 13 cap', () => {
    const failures = validateDiwassAttachment({
      mimeType: 'application/pdf',
      sizeBytes: DIWASS_MAX_ATTACHMENT_BYTES,
      reference: 'https://example.com/docs/ok.pdf',
    });
    expect(failures).toEqual([]);
  });

  it('rejects an attachment over the 32MB Art. 13 cap', () => {
    const failures = validateDiwassAttachment({
      mimeType: 'application/pdf',
      sizeBytes: DIWASS_MAX_ATTACHMENT_BYTES + 1,
      reference: 'https://example.com/docs/too-big.pdf',
    });
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain('32MB');
  });
});
