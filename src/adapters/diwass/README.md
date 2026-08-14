# DIWASS Adapter (Prototype)

Data-shape prototype for the EU Digital Waste Shipment System (DIWASS), established under
the Waste Shipment Regulation (EU) 2024/1157 and Commission Implementing Regulation (EU)
2025/1290. Part of loop-protocol's regulatory-alignment-roadmap.md Horizon 3 scope: DIWASS
is the only regime tracked there with a live (if access-gated) published API, so it is
prototyped first, ahead of Battery Passport and ESPR DPP.

## What this is

Pure functions mapping between LOOP's `Transfer`/`MaterialDNA` waste-shipment fields
(`waste_shipment_doc_ref`, `traceability.*`, `classification.ewc_code`/`waste_framework_code`
— see loop-protocol's `profiles/waste-shipment/README.md`) and DIWASS-shaped document types
(notification, movement document, completion certificate), modeled on the roles and
constraints in Commission Implementing Regulation (EU) 2025/1290 Articles 10, 13, 14, and 15.

## What this is not

- **Not a live integration.** There is no HTTP/SOAP client, no network call, anywhere in this
  directory. DIWASS's API is SOAP/XML (Annex II to Implementing Regulation (EU) 2025/1290),
  documented only via the restricted CIRCABC platform. Access requires an operator already
  registered in DIWASS through a competent authority, whose GUI-authorized representative
  then contacts the Commission Helpdesk (SANTE-TRACES@ec.europa.eu) for API credentials —
  there is no public sandbox, no published OpenAPI/WSDL, and no self-serve test operator ID.
  A real integration is not possible without that access, so this adapter does not attempt
  one.
- **Not a verified mirror of Annex II.** The type shapes in `types.ts` are a best-effort
  approximation built from the Implementing Regulation's articles (party roles, Art. 10(1);
  attachment limits, Art. 13; auth-log fields, Art. 14(2); document-number format,
  Art. 15(3)/(5)-(6)) — not a byte-for-byte reproduction of the actual message schema, which
  was not reachable during research. Field names and shapes here may not match what DIWASS
  actually expects on the wire.
- **Not a compliance or conformance claim.** localLOOP remains a lab-demo project with no
  public pilots or production deployments. Nothing here is evidence that a shipment was
  reported to DIWASS, that a document number is valid, or that this mapping would be
  accepted by the real system.
- **Not Battery Passport or ESPR DPP.** Those adapters remain deliberately un-built: Battery
  Passport stays gated behind Article 77's still-unadopted implementing/delegated acts
  (expected ~Q4 2026, adopted piecemeal rather than as a single act — see
  loop-protocol's `profiles/battery/README.md`); ESPR DPP stays gated behind the first
  product-group delegated act (iron & steel furthest along, indicative Q4 2026 adoption —
  see loop-protocol's `docs/regulatory-alignment-roadmap.md`). Revisit either once its
  gating act lands.

## Usage

```ts
import { materialToDiwassNotification, transferToDiwassMovementDocument } from './mapper';

const notification = materialToDiwassNotification(material); // material.passport.supported_regimes must include "waste-shipment"
const movement = transferToDiwassMovementDocument(transfer); // transfer.waste_shipment_doc_ref must be set
```

Both throw `DiwassMappingError` if the record isn't tagged/populated for this regime — this
adapter never silently guesses at waste-shipment relevance.

## Sources

- Waste Shipment Regulation (EU) 2024/1157: https://eur-lex.europa.eu/eli/reg/2024/1157/oj/eng
- Commission Implementing Regulation (EU) 2025/1290: https://eur-lex.europa.eu/eli/reg_impl/2025/1290/oj
- DIWASS overview and technical documentation (CIRCABC pointer): https://green-forum.ec.europa.eu/green-business/digital-waste-shipment-system-diwass_en
