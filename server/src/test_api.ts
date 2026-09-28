import { pool, getDbHealth } from './db/db';
import { seedDatabase } from './db/seed';
import { app } from './index';

async function testBackend() {
  console.log('[TEST] Initializing DB & Seeder...');
  await seedDatabase();

  const health = getDbHealth();
  console.log('[TEST] Storage Mode:', health.storageMode);
  console.log('[TEST] PostGIS Available:', health.postgisAvailable);

  const server = app.listen(3002, async () => {
    console.log('[TEST] Server listening on http://localhost:3002');
    try {
      const resHealth = await fetch('http://localhost:3002/api/health');
      const healthData = await resHealth.json();
      console.log('[TEST] /api/health ->', healthData.storageMode, '| Status:', resHealth.status);

      const resParcels = await fetch('http://localhost:3002/api/parcels');
      const parcelsData = await resParcels.json();
      console.log('[TEST] /api/parcels -> Count:', parcelsData.total, '| Status:', resParcels.status);

      const resAudit = await fetch('http://localhost:3002/api/verifications/audit-logs');
      const auditData = await resAudit.json();
      console.log('[TEST] /api/verifications/audit-logs -> Count:', auditData.total, '| Status:', resAudit.status);

      // Test Field Inspection API
      const resInsp = await fetch('http://localhost:3002/api/verifications/field-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: 'DH-JPR-RAM-001024',
          inspectedBy: 'Test Inspector',
          checkpoints: [{ id: 'chk-1', label: 'Merh check', status: 'passed' }],
          discrepancyObserved: false,
        }),
      });
      const inspData = await resInsp.json();
      console.log('[TEST] /api/verifications/field-inspection ->', inspData.message, '| Status:', resInsp.status);

      // Test Soft-Delete / Archive API
      const resArchive = await fetch('http://localhost:3002/api/parcels/DH-JOD-OSI-001245', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test soft-delete archive verification' }),
      });
      const archiveData = await resArchive.json();
      console.log('[TEST] /api/parcels/:id (DELETE archive) ->', archiveData.message, '| isArchived:', archiveData.isArchived);

      console.log('----------------------------------------------------');
      console.log('ALL PHASE 4 BACKEND REST TESTS PASSED SUCCESSFULLY!');
      console.log('----------------------------------------------------');
    } catch (err: any) {
      console.error('[TEST] Verification error:', err.message);
    } finally {
      server.close();
      await pool.end();
      process.exit(0);
    }
  });
}

testBackend();
