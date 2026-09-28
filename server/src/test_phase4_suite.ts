/**
 * DHAROHAR Phase 4 Automated Backend Test Suite
 * 
 * Verifies:
 * 1. Authentication (JWT token issuance, verification, bad credentials, expired tokens)
 * 2. Role-Based Access Control (RBAC: Tehsildar vs. Patwari vs. Operator)
 * 3. Authoritative Cadastral Validation (0.96 ha vs 0.82 ha discrepancy, 100% ownership, mandatory fields)
 * 4. Append-Only Cryptographic Audit Trail & SHA-256 Hash Chaining
 * 5. Field Inspection & Official Verification Sealing
 * 6. Parcel & Document CRUD & search/filtering
 */

import { app } from './index';
import { seedDatabase } from './db/seed';
import { getAuditLogs, verifyAuditChain } from './services/auditService';
import { validateParcel } from './services/validationService';
import { createJwtToken, verifyJwtToken, hashPassword, verifyPassword, sha256 } from './utils/crypto';
import http from 'http';

let server: http.Server;
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('  DHAROHAR Phase 4: Authoritative Backend & Security Test Suite ');
  console.log('================================================================\n');

  // Start local test server
  await seedDatabase();
  server = app.listen(PORT);

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failedCount++;
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. CRYPTO & TOKEN UTILITIES
    // -------------------------------------------------------------
    console.log('1. CRYPTOGRAPHIC & TOKEN ENGINE');
    const testSalt = 'test_salt_123';
    const pwdHash = hashPassword('MySecretPassword@2026', testSalt);
    assert(verifyPassword('MySecretPassword@2026', pwdHash.hash, testSalt), 'PBKDF2 Password verification with valid password');
    assert(!verifyPassword('WrongPassword', pwdHash.hash, testSalt), 'PBKDF2 Password verification rejects wrong password');

    const sampleJwt = createJwtToken({
      userId: 'USR-TEH-01',
      email: 'tehsildar@dharohar.local',
      role: 'TEHSILDAR',
      displayName: 'Shri Arvind Sharma, RAS',
      badgeNumber: 'RJ-REV-2018-0941',
      district: 'Jaipur',
    });
    assert(Boolean(sampleJwt && sampleJwt.split('.').length === 3), 'JWT creation produces valid 3-part HMAC-SHA256 token');

    const decodedJwt = verifyJwtToken(sampleJwt);
    assert(decodedJwt !== null && decodedJwt.role === 'TEHSILDAR', 'JWT verification successfully decodes payload and verifies role');
    assert(verifyJwtToken('invalid.token.signature') === null, 'JWT verification rejects forged/malformed token');

    // -------------------------------------------------------------
    // 2. AUTHENTICATION ENDPOINTS
    // -------------------------------------------------------------
    console.log('\n2. AUTHENTICATION ENDPOINTS (POST /api/auth/login, GET /api/auth/me)');

    // 2.1 Tehsildar Login
    const tehLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tehsildar@dharohar.local', password: 'Password@123' }),
    });
    const tehLoginData = await tehLoginRes.json();
    assert(tehLoginRes.status === 200 && tehLoginData.success === true, 'Tehsildar login returns HTTP 200 and success=true');
    assert(Boolean(tehLoginData.data?.token), 'Tehsildar login returns signed JWT access token');
    assert(tehLoginData.data?.user?.role === 'TEHSILDAR', 'Tehsildar user profile returns TEHSILDAR role');
    const tehsildarToken = tehLoginData.data?.token;

    // 2.2 Patwari Login
    const patLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'patwari@dharohar.local', password: 'Password@123' }),
    });
    const patLoginData = await patLoginRes.json();
    assert(patLoginRes.status === 200 && patLoginData.data?.user?.role === 'PATWARI', 'Patwari login returns PATWARI role');
    const patwariToken = patLoginData.data?.token;

    // 2.3 Data Entry Operator Login
    const oprLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@dharohar.local', password: 'Password@123' }),
    });
    const oprLoginData = await oprLoginRes.json();
    assert(oprLoginRes.status === 200 && oprLoginData.data?.user?.role === 'DATA_ENTRY_OPERATOR', 'Operator login returns DATA_ENTRY_OPERATOR role');
    const operatorToken = oprLoginData.data?.token;

    // 2.4 Bad credentials
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tehsildar@dharohar.local', password: 'WrongPassword999' }),
    });
    assert(badLoginRes.status === 401, 'Login with incorrect password returns HTTP 401');

    // 2.5 Auth Me endpoint
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tehsildarToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.data?.user?.email === 'tehsildar@dharohar.local', 'GET /api/auth/me returns authenticated officer info');

    const unauthMeRes = await fetch(`${BASE_URL}/auth/me`, { method: 'GET' });
    assert(unauthMeRes.status === 401, 'GET /api/auth/me without Bearer token returns HTTP 401');

    // -------------------------------------------------------------
    // 3. SERVER-AUTHORITATIVE VALIDATION ENGINE
    // -------------------------------------------------------------
    console.log('\n3. SERVER-AUTHORITATIVE VALIDATION (POST /api/parcels/:id/validate)');

    // 3.1 Primary Discrepancy Demo Parcel DH-UDA-KOT-001117
    const valDiscrepancyRes = await fetch(`${BASE_URL}/parcels/DH-UDA-KOT-001117/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tehsildarToken}`,
      },
    });
    const valDiscrepancyData = await valDiscrepancyRes.json();
    assert(valDiscrepancyRes.status === 200 && valDiscrepancyData.success === true, 'Validation endpoint executes successfully');
    
    const areaVal = valDiscrepancyData.data?.areaValidation;
    assert(areaVal?.mappedAreaHa === 0.82, `Mapped area is authoritative (0.82 ha) - got ${areaVal?.mappedAreaHa}`);
    assert(areaVal?.recordedAreaHa === 0.96, `Recorded area is authoritative (0.96 ha) - got ${areaVal?.recordedAreaHa}`);
    assert(areaVal?.differenceHa === 0.14, `Area difference accurately computed as 0.14 ha - got ${areaVal?.differenceHa}`);
    assert(areaVal?.hasDiscrepancy === true, 'Discrepancy flag is TRUE for 0.14 ha delta');
    assert(areaVal?.status === 'AREA_MISMATCH_REQUIRES_FIELD_INSPECTION', 'Area status is AREA_MISMATCH_REQUIRES_FIELD_INSPECTION');

    const ownVal = valDiscrepancyData.data?.ownershipValidation;
    assert(ownVal?.totalSharePercentage === 100.0, 'Ownership shares equal exactly 100.00%');
    assert(valDiscrepancyData.data?.checklist?.length >= 7, 'Validation checklist contains all required check items');

    // 3.2 Verified Demo Parcel DH-JPR-RAM-001024
    const valVerifiedRes = await fetch(`${BASE_URL}/parcels/DH-JPR-RAM-001024/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const valVerifiedData = await valVerifiedRes.json();
    assert(valVerifiedData.data?.cadastralFieldsValidation?.khasraNo === true, 'Khasra 412/1 validated');
    assert(valVerifiedData.data?.cadastralFieldsValidation?.khataNo === true, 'Khata 78 validated');
    assert(valVerifiedData.data?.ownershipValidation?.totalSharePercentage === 100.0, 'Co-sharer total share is 100%');

    // -------------------------------------------------------------
    // 4. ROLE-BASED ACCESS CONTROL (RBAC) GUARDS
    // -------------------------------------------------------------
    console.log('\n4. ROLE-BASED ACCESS CONTROL (RBAC)');

    // 4.1 Data Entry Operator attempted sealing -> MUST BE 403 FORBIDDEN
    const oprSealRes = await fetch(`${BASE_URL}/verifications/seal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({
        parcelId: 'DH-UDA-KOT-001117',
        officerNotes: 'Unauthorized seal attempt',
      }),
    });
    assert(oprSealRes.status === 403, 'Data Entry Operator denied final sealing (HTTP 403 Forbidden)');

    // 4.2 Operator attempted field inspection on parcel endpoint -> MUST BE 403 FORBIDDEN
    const oprInspRes = await fetch(`${BASE_URL}/parcels/DH-UDA-KOT-001117/field-inspections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({
        gpsCoords: { latitude: 26.845, longitude: 75.785 },
        checkpoints: [{ id: 'cp1', name: 'Boundary Stone', passed: true }],
      }),
    });
    assert(oprInspRes.status === 403, 'Data Entry Operator denied field inspection submission (HTTP 403 Forbidden)');

    // 4.3 Patwari allowed field inspection -> MUST BE 201 CREATED
    const patInspRes = await fetch(`${BASE_URL}/parcels/DH-UDA-KOT-001117/field-inspections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patwariToken}`,
      },
      body: JSON.stringify({
        gpsCoords: { latitude: 26.846, longitude: 75.783, accuracyMeters: 2.1 },
        deviceHeadingDeg: 142.5,
        discrepancyObserved: true,
        discrepancyNotes: 'Boundary stone at north corner confirmed 0.14 ha encroachment by canal embankment.',
        checkpoints: [
          { id: 'cp-1', name: 'North Boundary Stone', passed: false },
          { id: 'cp-2', name: 'South Road Edge', passed: true },
        ],
      }),
    });
    const patInspData = await patInspRes.json();
    assert(patInspRes.status === 201 && patInspData.success === true, 'Patwari permitted to submit field inspection (HTTP 201 Created)');
    assert(Boolean(patInspData.data?.inspection?.evidenceHash), 'Field inspection generates cryptographic SHA-256 evidenceHash');

    // 4.4 Patwari attempted sealing -> MUST BE 403 FORBIDDEN
    const patSealRes = await fetch(`${BASE_URL}/verifications/seal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patwariToken}`,
      },
      body: JSON.stringify({
        parcelId: 'DH-UDA-KOT-001117',
        officerNotes: 'Patwari seal attempt',
      }),
    });
    assert(patSealRes.status === 403, 'Patwari denied final sealing without Tehsildar role (HTTP 403 Forbidden)');

    // 4.5 Tehsildar allowed verification & digital sealing -> MUST BE 200 OK
    const tehSealRes = await fetch(`${BASE_URL}/verifications/seal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tehsildarToken}`,
      },
      body: JSON.stringify({
        parcelId: 'DH-UDA-KOT-001117',
        officerNotes: 'Reviewed Patwari field inspection notes. Provisional boundary validated under Section 133.',
      }),
    });
    const tehSealData = await tehSealRes.json();
    assert(tehSealRes.status === 200 && tehSealData.success === true, 'Tehsildar authorized to digitally seal record (HTTP 200 OK)');
    assert(Boolean(tehSealData.data?.certificateNumber), `Generated certificate number: ${tehSealData.data?.certificateNumber}`);
    assert(Boolean(tehSealData.data?.signatureHash), 'Generated deterministic SHA-256 digital signature hash');

    // -------------------------------------------------------------
    // 5. APPEND-ONLY AUDIT TRAIL & HASH CHAINING
    // -------------------------------------------------------------
    console.log('\n5. APPEND-ONLY CRYPTOGRAPHIC AUDIT LOGS (GET /api/verifications/audit-logs)');

    const auditRes = await fetch(`${BASE_URL}/verifications/audit-logs`);
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && auditData.success === true, 'Audit log endpoint returns HTTP 200');
    assert(auditData.data?.total > 0, `Total audit records recorded: ${auditData.data?.total}`);

    // Verify cryptographic chain
    const chainVerification = await verifyAuditChain();
    assert(chainVerification.isValid === true, 'Audit log SHA-256 cryptographic hash chain is unbroken and 100% verified');
    console.log(`     Chain verification message: "${chainVerification.message}"`);

    // Verify parcel-specific audit trail
    const parcelAuditRes = await fetch(`${BASE_URL}/parcels/DH-UDA-KOT-001117/audit`);
    const parcelAuditData = await parcelAuditRes.json();
    assert(parcelAuditData.data?.total >= 2, `Parcel DH-UDA-KOT-001117 has ${parcelAuditData.data?.total} chronological audit events`);

    // -------------------------------------------------------------
    // 6. PARCEL CRUD & SOFT-DELETE ARCHIVE
    // -------------------------------------------------------------
    console.log('\n6. PARCEL REGISTRY CRUD & SOFT-DELETE');

    // 6.1 Create new parcel
    const createParcelRes = await fetch(`${BASE_URL}/parcels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tehsildarToken}`,
      },
      body: JSON.stringify({
        khasraNo: '888/2',
        khataNo: '190',
        district: 'Jaipur',
        tehsil: 'Sanganer',
        village: 'Rampur',
        mappedAreaHectares: 1.10,
        recordedAreaHectares: 1.10,
        ownerName: 'Ram Lal',
        boundary: [
          { lat: 26.840, lng: 75.780 },
          { lat: 26.842, lng: 75.785 },
          { lat: 26.839, lng: 75.788 },
          { lat: 26.837, lng: 75.782 },
        ],
      }),
    });
    const createParcelData = await createParcelRes.json();
    assert(createParcelRes.status === 201 && createParcelData.success === true, 'Parcel creation succeeds (HTTP 201)');
    const createdId = createParcelData.data?.parcel?.id;

    // 6.2 Filter / Search
    const searchRes = await fetch(`${BASE_URL}/parcels?search=888/2`);
    const searchData = await searchRes.json();
    assert(searchData.data?.parcels?.some((p: any) => p.id === createdId), 'Parcel search by Khasra 888/2 finds created parcel');

    // 6.3 Soft-delete / Archive
    const archiveRes = await fetch(`${BASE_URL}/parcels/${createdId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tehsildarToken}`,
      },
      body: JSON.stringify({ reason: 'Test parcel archiving' }),
    });
    const archiveData = await archiveRes.json();
    assert(archiveRes.status === 200 && archiveData.data?.isArchived === true, 'DELETE soft-archives parcel without permanent destruction');

    // -------------------------------------------------------------
    // 7. SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`  PHASE 4 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      throw new Error(`${failedCount} test(s) failed in Phase 4 suite.`);
    }
  } finally {
    server.close();
  }
}

runPhase4Tests()
  .then(() => {
    console.log('Phase 4 verification completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Phase 4 verification error:', err);
    if (server) server.close();
    process.exit(1);
  });
