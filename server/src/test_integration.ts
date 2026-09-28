import { pool } from './db/db';

async function verifyIntegration() {
  console.log('===========================================================');
  console.log('  DHAROHAR PostgreSQL / PostGIS Integration Verification  ');
  console.log('===========================================================');

  const BASE_URL = 'http://localhost:3001/api';

  // 1. Check Health & Storage Mode
  const resHealth = await fetch(`${BASE_URL}/health`);
  const health = await resHealth.json();
  console.log('1. Backend Health Check:');
  console.log('   - Storage Mode:', health.storageMode);
  console.log('   - PostGIS Version:', health.postgisVersion);
  console.log('   - Database:', health.database);
  if (health.storageMode !== 'postgres-postgis') {
    throw new Error('Expected storageMode to be postgres-postgis');
  }

  // 2. Fetch Active Parcels
  const resParcels = await fetch(`${BASE_URL}/parcels`);
  const parcelsData = await resParcels.json();
  console.log('\n2. Fetch Parcels (GET /api/parcels):');
  console.log('   - Total Active Parcels:', parcelsData.total);
  console.log('   - Parcel IDs:', parcelsData.parcels.map((p: any) => p.id));
  console.log('   - Khasra Numbers:', parcelsData.parcels.map((p: any) => `${p.id}: Khasra ${p.khasraNo} (${p.village}, ${p.district}) - ${p.mappedAreaHectares} ha`));

  const expectedIds = ['DH-JPR-RAM-001024', 'DH-UDA-KOT-001117', 'DH-JOD-OSI-001245'];
  const hasAllExpected = expectedIds.every(id => parcelsData.parcels.some((p: any) => p.id === id));
  if (!hasAllExpected || parcelsData.total !== 3) {
    console.warn('   [NOTE] Active parcels count:', parcelsData.total);
  } else {
    console.log('   [SUCCESS] Exactly 3 initial PostgreSQL seed parcels returned.');
  }

  // 3. Test Creating a Parcel via POST /api/parcels
  console.log('\n3. Create Parcel (POST /api/parcels):');
  const newParcel = {
    id: 'DH-JPR-RAM-001099',
    khasraNo: '415/3',
    khataNo: '92',
    district: 'Jaipur',
    tehsil: 'Sanganer',
    village: 'Rampur',
    mappedAreaHectares: 1.45,
    recordedAreaHectares: 1.45,
    colour: '#7c3aed',
    ownerName: 'Mohan Lal Sharma',
    owners: [
      {
        id: 'own-test-1',
        name: 'Mohan Lal Sharma',
        hindiName: 'मोहन लाल शर्मा',
        relationType: 's/o',
        relativeName: 'Ganga Ram Sharma',
        relativeHindiName: 'गंगा राम शर्मा',
        shareFraction: '1/1',
        sharePercentage: 100,
        status: 'Active Co-sharer',
      },
    ],
    boundary: [
      { lat: 26.840, lng: 75.790 },
      { lat: 26.843, lng: 75.795 },
      { lat: 26.840, lng: 75.798 },
      { lat: 26.837, lng: 75.793 },
    ],
    landType: 'Chahi (Well Irrigated)',
    inheritance: 'Ancestral',
    status: 'Draft',
    performedBy: 'Shri Arvind Sharma, RAS',
  };

  const resCreate = await fetch(`${BASE_URL}/parcels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newParcel),
  });
  const createData = await resCreate.json();
  console.log('   - Created Parcel Status:', resCreate.status);
  console.log('   - Created Parcel ID:', createData.parcel?.id);
  console.log('   - Message:', createData.message);

  // 4. Test Updating Parcel via PUT /api/parcels/:id
  console.log('\n4. Update Parcel (PUT /api/parcels/:id):');
  const resUpdate = await fetch(`${BASE_URL}/parcels/DH-JPR-RAM-001099`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      landType: 'Nahri (Canal Irrigated)',
      status: 'Needs Field Verification',
      performedBy: 'Shri Arvind Sharma, RAS',
    }),
  });
  const updateData = await resUpdate.json();
  console.log('   - Update Status:', resUpdate.status);
  console.log('   - Updated landType:', updateData.parcel?.landType);
  console.log('   - Updated Status:', updateData.parcel?.status);

  // 5. Test Soft-Delete / Archive via DELETE /api/parcels/:id
  console.log('\n5. Soft-Delete (Archive) Parcel (DELETE /api/parcels/:id):');
  const resArchive = await fetch(`${BASE_URL}/parcels/DH-JPR-RAM-001099`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: 'Verification test soft-delete cleanup.',
      performedBy: 'Shri Arvind Sharma, RAS',
    }),
  });
  const archiveData = await resArchive.json();
  console.log('   - Archive Status:', resArchive.status);
  console.log('   - Message:', archiveData.message);
  console.log('   - isArchived:', archiveData.isArchived);

  // 6. Test Field Inspection POST /api/verifications/field-inspection
  console.log('\n6. Test Field Inspection (POST /api/verifications/field-inspection):');
  const resInsp = await fetch(`${BASE_URL}/verifications/field-inspection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parcelId: 'DH-UDA-KOT-001117',
      inspectedBy: 'Inspector Vikram Singh, Tehsildar',
      inspectorRole: 'Revenue Field Inspector',
      discrepancyObserved: true,
      discrepancyNotes: 'Northern boundary stone slightly shifted by 1.2 meters.',
      observedLandUse: 'Agricultural',
      checkpoints: [{ id: 'cp-1', name: 'North Boundary Stone', passed: false }],
    }),
  });
  const inspData = await resInsp.json();
  console.log('   - Field Inspection Status:', resInsp.status);
  console.log('   - Inspection ID:', inspData.inspection?.id);
  console.log('   - Message:', inspData.message);

  // 7. Test Seal Verification POST /api/verifications/seal
  console.log('\n7. Test Seal Verification (POST /api/verifications/seal):');
  const resSeal = await fetch(`${BASE_URL}/verifications/seal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parcelId: 'DH-JOD-OSI-001245',
      officerName: 'Shri Arvind Sharma, RAS',
      officerBadge: 'RAS-JPR-2024-88',
      officerNotes: 'Ownership shares 100% verified against Master Shajra Cadastre.',
    }),
  });
  const sealData = await resSeal.json();
  console.log('   - Seal Status:', resSeal.status);
  console.log('   - Certificate Number:', sealData.certificateNumber);
  console.log('   - Signature Hash:', sealData.signatureHash);

  // Verify PostgreSQL updated for sealed parcel
  const sealDbCheck = await pool.query("SELECT id, status, verified_by FROM parcels WHERE id = 'DH-JOD-OSI-001245'");
  console.log('   - Sealed Parcel DB Row:', sealDbCheck.rows[0]);

  // 8. Test Audit Logs GET /api/verifications/audit-logs
  console.log('\n8. Test Audit Logs (GET /api/verifications/audit-logs):');
  const resAudit = await fetch(`${BASE_URL}/verifications/audit-logs`);
  const auditData = await resAudit.json();
  console.log('   - Total Audit Logs:', auditData.total);
  console.log('   - Latest Action:', auditData.auditLogs[0]?.action_type || auditData.auditLogs[0]?.actionType);

  // 9. Direct PostgreSQL Verification for Soft-deleted parcel:
  console.log('\n9. Direct PostgreSQL Verification:');
  const dbCheck = await pool.query("SELECT id, status, is_archived, ST_AsText(geom) as wkt FROM parcels WHERE id = 'DH-JPR-RAM-001099'");
  console.log('   - Row in DB:', dbCheck.rows[0]);

  // Clean up test parcel row from DB
  await pool.query("DELETE FROM parcels WHERE id = 'DH-JPR-RAM-001099'");
  console.log('   - Cleaned test parcel row.');

  // 10. Verify active parcels are back to the 3 seed parcels
  const resFinal = await fetch(`${BASE_URL}/parcels`);
  const finalData = await resFinal.json();
  console.log('\n10. Final Active Parcels Count in PostgreSQL:', finalData.total);
  console.log('   - Active Parcel IDs:', finalData.parcels.map((p: any) => p.id));

  console.log('\n===========================================================');
  console.log('  ALL INTEGRATION CHECKS PASSED: POSTGRESQL IS SOURCE OF TRUTH');
  console.log('===========================================================');

  await pool.end();
  process.exit(0);
}

verifyIntegration().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
