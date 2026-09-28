# DHAROHAR — Spatial Land Record Registry

DHAROHAR keeps the existing land-record digitization, ownership, mutation, document and verification workflow, while making the **map + parcel** the primary product.

## Demo workflow

**MAP LAND → CREATE PARCEL → ENTER/EXTRACT RECORD → ATTACH ORIGINAL DOCUMENT → VERIFY → SEARCH/FILTER → ANALYSE LAND**

### What is implemented

- Real Leaflet + OpenStreetMap basemap with point-by-point parcel polygon creation
- Automatic mapped-area calculation
- Unique DHAROHAR Parcel IDs and colour-coded parcels
- Parcel-linked owner, Khasra/Survey, Khata, land type, inheritance and mutation data
- Direct original-document upload/linking from the parcel workflow, plus linking to existing document records
- Parcel detail view with discrepancy and incomplete-record warnings
- Explicit parcel lifecycle: Draft → Mapped → Needs Field Verification → Verified
- Multi-owner shares with proportional owner-area aggregation
- Structured “Ask the Registry” queries for common spatial questions
- Search/filter with map highlighting
- Owner-level mapped-area aggregation
- Existing OCR/extraction and human-verification screens retained as optional assistance workflow

### Prototype honesty

This is a demonstration using sample data. The OpenStreetMap basemap is real, but parcel geometry is a **provisional spatial representation** created by the user and is **not official cadastral boundary data**. A parcel must be field-verified before it is treated as verified within the prototype. OCR metrics, government integrations and external registry checks shown elsewhere in the original prototype are simulations/mock workflow elements, not measured production results.

AI/OCR is optional. The core parcel registry works through manual mapping and record entry; the demo does not require an external AI call for every document.

## Run locally

Prerequisite: Node.js

```bash
npm install
npm run dev
```

No AI API key is required for the core spatial registry demo. Direct parcel uploads use **prototype-local document storage** in the browser; this is not secure permanent production storage. Production architecture should use controlled object storage, access control and encryption.

## Intended future extensions

- AR-assisted field boundary/measurement verification
- ULPIN/3D parcel identification integration
- Tribal/community land-record workflows
- Real cadastral/GIS data and controlled government integrations


## Parcel-first positioning

The primary digital unit is the **land parcel**, not the source document:

**Parcel → boundary → owners/shares → Khasra/Khata → area → inheritance → mutation → documents → verification**

### Verification semantics

- **Draft:** boundary is being created.
- **Mapped:** user-created provisional geometry has been saved.
- **Needs Field Verification:** geometry or record needs on-site review.
- **Verified:** field verification has been recorded in the prototype.

A mapped boundary is never presented as an official cadastral boundary.

### Structured registry queries

The prototype includes predefined “Ask the Registry” queries for:
- owner-based land lookup
- agricultural land above a chosen area
- area mismatch
- missing documents
- village-based lookup

These are deterministic filters over the registry, not an AI agent.

### Document storage limitation

Direct parcel uploads are converted to browser-local data URLs for the demo and persisted with the parcel in local browser storage when space permits. This is **prototype-local document storage**, not secure permanent production storage. Production architecture should use controlled object storage, access control and encryption.


## V8 polish
- Ask the Registry owner query preserves the selected owner filter.
- Parcel editing preserves co-owner percentage shares.
- Field verification is explicitly labelled as prototype verification; mapped boundaries remain provisional.


## V10 final polish

The audit addressed the full product checklist. This pass only addresses final polish and demo integrity; it does not add new product scope:
- Real Leaflet/OpenStreetMap mapping retained, with Street/Satellite basemap toggle.
- Boundary vertices are draggable; selected vertices can be deleted; polygons can be explicitly closed/reopened; clear/undo controls remain.
- Mapped area uses geographic coordinates with a geodesic spherical calculation; perimeter is also calculated in metres.
- Existing parcel boundaries can be edited and recalculated; edited geometry returns to Needs Field Verification.
- Search now includes parcel/document identifiers and document names; area filters support minimum and maximum.
- Newly created parcel IDs use a district/village-coded format and are persisted with the parcel; editing or reloading a parcel does not regenerate its ID.
- Parcel verification stores verifier, timestamp and prototype verification notes.
- Direct uploads expose a local demo document reference, type and upload time; production controlled object storage remains explicitly out of scope.
- Village-wise area analytics is included alongside owner-share analytics.
- The existing OCR/verification application remains intact and optional to the parcel-first workflow.


### Product roadmap
**Phase 1 — MVP:** 2D parcel mapping, linked land records, documents, verification and analytics.
**Phase 2:** AR-assisted field measurement and boundary verification.
**Phase 3:** ULPIN-linked parcel identity.
**Phase 4:** 3D/advanced spatial representation and specialized community/tribal workflows.


### V10 final polish
- Removed simulated AI performance figures from the main dashboard; headline metrics now use registry-derived values.
- Kept parcel IDs persisted with records so editing/reloading does not regenerate them.
- Clarified direct uploads as prototype-local document storage, not secure permanent storage.
- Promoted the selected parcel summary with owners, proportional mapped area, mutation/document counts and record-vs-map status.


## Final stability notes
- Authentication/session, active workflow view, selected parcel, parcel records, and prototype document metadata are persisted locally in the browser where feasible.
- Direct document uploads are **prototype-local document storage** (browser/localStorage). Production should use controlled object storage, access control, encryption, and audit logging.
- DHAROHAR Parcel IDs such as `DH-JPR-RAM-001024` are **prototype identifiers, not official ULPINs**.
- Map-drawn parcel boundaries are provisional until field verification; they are not asserted to be official cadastral boundaries.
- AI/OCR is optional assistance and is not required for parcel creation, storage, search, verification, or analytics.


## Phase 4: Authoritative Backend, Security & GIS Integration

DHAROHAR Phase 4 converts the prototype foundation into an authoritative, secure, full-stack land registry architecture.

### Architecture Overview
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Leaflet
- **Backend:** Express + TypeScript + Node.js
- **Database:** PostgreSQL + PostGIS (with resilient dev-fallback in-memory store)
- **Security:** Signed JWT Access Tokens (HMAC-SHA256), Salted PBKDF2 Password Hashing, Server-Side RBAC
- **Audit Engine:** Append-only cryptographic hash chaining (`entry_hash = SHA256(previous_hash + payload)`)
- **Document Intelligence:** Tesseract.js Indic OCR + Deterministic Cadastral Revenue Extraction

---

### Environment Variables (.env)
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=dharohar_revenue_secret_key_sih2026_prototype_secure_token
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=dharohar_db
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dharohar_db
```

---

### Database Setup & Migrations
To run migrations and seed the PostgreSQL database with PostGIS spatial tables:
```bash
# Apply PostGIS schema migrations
npm run db:migrate

# Seed demo users, authoritative parcels, and genesis audit logs
npm run db:seed

# Start the Express backend server
npm run server
```

---

### Demo Personas & Credentials
| Role | Display Name | Designation | Email Identifier | Password |
|---|---|---|---|---|
| **TEHSILDAR** | Shri Arvind Sharma, RAS | Revenue Officer / Tehsildar | `tehsildar@dharohar.local` | `Password@123` |
| **PATWARI** | Smt. Sunita Choudhary | Senior Verification Officer / Patwari | `patwari@dharohar.local` | `Password@123` |
| **DATA_ENTRY_OPERATOR** | Vikram Singh Rathore | Verification Operator | `operator@dharohar.local` | `Password@123` |
| **AUDITOR** | Dr. Meenakshi Sundaram, IAS | State Land Records Auditor | `auditor@dharohar.local` | `Password@123` |

*Note: These are seeded prototype demonstration accounts for the SIH 2026 evaluation environment.*

---

### Server-Side Role-Based Access Control (RBAC) Matrix
| Action | DATA_ENTRY_OPERATOR | PATWARI | TEHSILDAR | AUDITOR |
|---|:---:|:---:|:---:|:---:|
| **Login & View Parcels** | Allowed | Allowed | Allowed | Allowed |
| **Register Documents / OCR** | Allowed | Allowed | Allowed | Read-only |
| **Submit Field Inspections** | Denied (403) | Allowed | Allowed | Read-only |
| **Run Authoritative Validation** | Allowed | Allowed | Allowed | Allowed |
| **Apply Final Digital Seal** | Denied (403) | Denied (403) | **Allowed** | Read-only |
| **View Audit Trail & Verify Chain**| Allowed | Allowed | Allowed | Allowed |

---

### Authoritative API Endpoints Reference
| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates officer and issues signed JWT access token |
| `GET` | `/api/auth/me` | Authenticated | Retrieves current authenticated officer profile |
| `GET` | `/api/auth/users` | Public | Lists demo personas (no password hashes exposed) |
| `GET` | `/api/parcels` | Public/Optional | Lists registered parcels with search and GIS filters |
| `GET` | `/api/parcels/:id` | Public/Optional | Single parcel details with owners, inspections & audit |
| `POST` | `/api/parcels` | Authenticated | Registers new parcel polygon with geodesic area calculation |
| `PATCH` | `/api/parcels/:id` | Authenticated | Updates parcel attributes (khasra, khata, owners, etc.) |
| `POST` | `/api/parcels/:id/validate` | Authenticated | Server-side validation of area delta, ownership 100%, and fields |
| `GET` | `/api/parcels/:id/documents` | Authenticated | Retrieves documents linked to a parcel |
| `POST` | `/api/parcels/:id/documents` | Authenticated | Links land document to parcel |
| `GET` | `/api/parcels/:id/field-inspections` | Authenticated | Retrieves assisted GPS/camera inspection records |
| `POST` | `/api/parcels/:id/field-inspections` | PATWARI, TEHSILDAR | Submits field inspection with SHA-256 evidence hash |
| `POST` | `/api/parcels/:id/verify` | TEHSILDAR | Digitally seals parcel and records tamper-evident audit entry |
| `GET` | `/api/parcels/:id/audit` | Authenticated | Retrieves chronological chained audit log for parcel |
| `DELETE` | `/api/parcels/:id` | Authenticated | Soft-deletes (archives) parcel with reason logged in audit |
| `GET` | `/api/documents` | Authenticated | Lists all registered land documents |
| `GET` | `/api/documents/:id` | Authenticated | Retrieves single document metadata with OCR text and hash |
| `POST` | `/api/documents` | Authenticated | Registers document metadata, raw OCR text, and SHA-256 hash |
| `GET` | `/api/verifications/audit-logs` | Authenticated | Retrieves system-wide append-only audit trail |
| `GET` | `/api/verifications/audit-logs/verify-chain` | Authenticated | Verifies cryptographic integrity of the SHA-256 audit chain |
| `POST` | `/api/verifications/field-inspection` | PATWARI, TEHSILDAR | Records assisted field inspection |
| `POST` | `/api/verifications/seal` | TEHSILDAR | Applies official revenue digital seal |
| `GET` | `/api/health` | Public | Detailed health status, PostGIS detection, and uptime |

---

### Authoritative Validation Rules
1. **Area Discrepancy Detection:** Computes geodesic polygon mapped area vs recorded revenue Rakba. For parcel `DH-UDA-KOT-001117`, 0.82 ha mapped vs 0.96 ha recorded flags a 0.14 ha mismatch (14.58%) triggering `AREA_MISMATCH_REQUIRES_FIELD_INSPECTION`.
2. **Co-Sharer Mathematical Sum:** Enforces that `sum(share_percentage) === 100.00%`.
3. **Mandatory Cadastral Identifiers:** Validates presence of Khasra No, Khata No, Khewat No, Mauza/Village, Tehsil, District, Area, and closed Polygon geometry.
4. **9-Point Record Integrity Checklist:** Complete evaluation across Geometry, Area, Document, Mandatory Fields, Ownership, Area Consistency, Field Verification, Officer Verification, and Audit Trail.

---

### Cryptographic Append-Only Audit Trail
Audit entries are chained sequentially using SHA-256:
$$\text{entry\_hash} = \text{SHA-256}(\text{previous\_hash} : \text{entity\_id} : \text{action\_type} : \text{performed\_by} : \text{timestamp} : \text{SHA-256}(\text{details}))$$
- Root genesis hash: `0000000000000000000000000000000000000000000000000000000000000000`
- Zero DELETE or UPDATE queries exist on `append_only_audit_logs`.
- Verified at runtime via `/api/verifications/audit-logs/verify-chain`.

---

### Technical Limitations & Prototype Honesty
- Map boundaries remain provisional until verified by an authorized field officer.
- ULPINs are displayed with honest status `"Pending Government Linkage"`; no fabricated government identifiers are generated.
- Assisted AR/GPS camera checkpoints are prototype decision-support tools, not survey-grade cadastral total station instruments.
- Verified records generate a prototype digital seal and certificate, not an official government gazette.

