-- DHAROHAR Land Record Digitization & Verification System
-- PostgreSQL + PostGIS Schema (Phase 4 Authoritative Persistence)
--
-- Supports spatial parcel boundaries (SRID 4326), co-sharers, controlled document references,
-- assisted AR/GPS field inspection logs, user credentials with RBAC, and append-only cryptographic audit records.

-- Enable PostGIS spatial extensions (if permitted on target database)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users & Demo Personas Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL, -- TEHSILDAR, PATWARI, DATA_ENTRY_OPERATOR, AUDITOR
    display_name VARCHAR(256) NOT NULL,
    designation VARCHAR(128) NOT NULL,
    badge_number VARCHAR(64),
    jurisdiction VARCHAR(256),
    district VARCHAR(128) DEFAULT 'Jaipur',
    state VARCHAR(128) DEFAULT 'Rajasthan',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Parcels Table (Spatial Geometry + Area Validation Metrics)
CREATE TABLE IF NOT EXISTS parcels (
    id VARCHAR(64) PRIMARY KEY,
    khasra_no VARCHAR(64) NOT NULL,
    khata_no VARCHAR(64) NOT NULL,
    khewat_no VARCHAR(64) DEFAULT '—',
    patwar_circle VARCHAR(128) DEFAULT '—',
    district VARCHAR(128) DEFAULT 'Jaipur',
    tehsil VARCHAR(128) DEFAULT 'Sanganer',
    village VARCHAR(128) DEFAULT 'Rampur',
    mapped_area_ha NUMERIC(12, 4) NOT NULL,
    recorded_area_ha NUMERIC(12, 4),
    colour VARCHAR(32) DEFAULT '#2563eb',
    owner_name VARCHAR(256) NOT NULL DEFAULT 'Unassigned',
    land_type VARCHAR(128) DEFAULT 'Agricultural',
    inheritance TEXT DEFAULT 'Not recorded',
    document_id VARCHAR(128),
    document_name VARCHAR(256),
    document_type VARCHAR(128),
    document_uploaded_at TIMESTAMPTZ,
    document_display_id VARCHAR(128),
    document_uri TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'Draft',
    ulpin_status VARCHAR(64) DEFAULT 'Pending Government Linkage',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archive_reason TEXT,
    verified_by VARCHAR(128),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for high-performance GIS bounding box and intersection queries
CREATE INDEX IF NOT EXISTS idx_parcels_geom ON parcels USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_district_village ON parcels(district, village);

-- 3. Co-Sharers / Owners Table (Proportional Area & Succession Tracking)
CREATE TABLE IF NOT EXISTS parcel_owners (
    id VARCHAR(64) PRIMARY KEY,
    parcel_id VARCHAR(64) NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    hindi_name VARCHAR(256),
    relation_type VARCHAR(32) DEFAULT 's/o',
    relative_name VARCHAR(256),
    relative_hindi_name VARCHAR(256),
    share_fraction VARCHAR(32) DEFAULT '1/1',
    share_percentage NUMERIC(6, 2) NOT NULL DEFAULT 100.00,
    status VARCHAR(64) NOT NULL DEFAULT 'Active Co-sharer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_owners_parcel_id ON parcel_owners(parcel_id);

-- 4. Mutation History Table
CREATE TABLE IF NOT EXISTS parcel_mutations (
    id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(64) NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    mutation_date VARCHAR(64),
    mutation_type VARCHAR(128),
    note TEXT,
    previous_value TEXT,
    new_value TEXT,
    recorded_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_mutations_parcel ON parcel_mutations(parcel_id);

-- 5. Documents & Extraction Metadata Table
CREATE TABLE IF NOT EXISTS land_documents (
    id VARCHAR(64) PRIMARY KEY,
    parcel_id VARCHAR(64),
    document_code VARCHAR(64),
    file_name VARCHAR(256) NOT NULL,
    record_type VARCHAR(128) NOT NULL,
    ocr_language VARCHAR(32) DEFAULT 'hin+eng',
    raw_ocr_text TEXT,
    district VARCHAR(128),
    tehsil VARCHAR(128),
    village VARCHAR(128),
    patwar_circle VARCHAR(128),
    status VARCHAR(64) NOT NULL DEFAULT 'Uploaded',
    priority VARCHAR(32) DEFAULT 'Medium',
    image_uri TEXT,
    quality_metrics JSONB,
    extracted_data JSONB,
    document_hash VARCHAR(128),
    ocr_confidence NUMERIC(5, 2) DEFAULT 0,
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_docs_parcel ON land_documents(parcel_id);
CREATE INDEX IF NOT EXISTS idx_land_docs_status ON land_documents(status);

-- 6. Field Inspections Table (Assisted GPS/Camera Checkpoints)
CREATE TABLE IF NOT EXISTS field_inspections (
    id VARCHAR(64) PRIMARY KEY,
    parcel_id VARCHAR(64) NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inspected_by VARCHAR(128) NOT NULL,
    inspector_role VARCHAR(128) DEFAULT 'Revenue Field Officer',
    gps_lat NUMERIC(10, 7),
    gps_lng NUMERIC(10, 7),
    gps_accuracy_m NUMERIC(8, 2),
    device_heading_deg NUMERIC(6, 2),
    checkpoints JSONB NOT NULL DEFAULT '[]',
    discrepancy_observed BOOLEAN NOT NULL DEFAULT FALSE,
    discrepancy_notes TEXT,
    observed_land_use VARCHAR(128),
    photo_uri TEXT,
    photo_timestamp TIMESTAMPTZ,
    evidence_hash VARCHAR(128),
    is_provisional BOOLEAN NOT NULL DEFAULT TRUE,
    recommended_action VARCHAR(128) DEFAULT 'Proceed to Officer Seal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_inspections_parcel ON field_inspections(parcel_id);

-- 7. Append-Only Cryptographic Audit Log Table (Hash-Chained)
CREATE TABLE IF NOT EXISTS append_only_audit_logs (
    id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(64),
    document_id VARCHAR(64),
    entity_type VARCHAR(64) NOT NULL DEFAULT 'PARCEL',
    entity_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    performed_by VARCHAR(128) NOT NULL,
    officer_badge VARCHAR(64),
    details JSONB DEFAULT '{}',
    previous_hash VARCHAR(128) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    entry_hash VARCHAR(128) NOT NULL,
    signature_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_parcel ON append_only_audit_logs(parcel_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON append_only_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON append_only_audit_logs(created_at);
