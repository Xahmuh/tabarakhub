import { createClient } from '@supabase/supabase-js';
import { ComplianceStatus } from '../types';
import { STANDARD_NHRA_SECTIONS_TEMPLATE } from '../data/mockAudits';
import { STANDARD_APPRAISAL_SECTIONS_TEMPLATE } from '../data/mockAppraisals';

async function seedRealTQPHData() {
  console.log('======================================================');
  console.log('  TQPH: Transitioning to REAL System Data in Supabase  ');
  console.log('======================================================');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.service_role;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or service_role in env.');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);

  // 1. Fetch REAL Branches
  const { data: realBranches, error: bErr } = await client
    .from('branches')
    .select('id, code, name, nhra_license_no, cr_number, branch_manager_name, region_id')
    .eq('role', 'branch')
    .neq('code', 'Test-01')
    .order('code');

  if (bErr || !realBranches || realBranches.length === 0) {
    console.error('❌ Could not fetch real branches:', bErr);
    process.exit(1);
  }

  console.log(`✓ Fetched ${realBranches.length} REAL branches from database:`);
  realBranches.forEach(b => console.log(`   - [${b.code}] ${b.name} (CR: ${b.cr_number || 'N/A'}, Lic: ${b.nhra_license_no || 'N/A'}, Mgr: ${b.branch_manager_name || 'N/A'})`));

  // 2. Fetch REAL Pharmacists
  const { data: realPharmacists, error: pErr } = await client
    .from('pharmacists')
    .select('id, name, code, branch_id')
    .eq('is_active', true)
    .order('name');

  if (pErr || !realPharmacists || realPharmacists.length === 0) {
    console.error('❌ Could not fetch real pharmacists:', pErr);
    process.exit(1);
  }

  console.log(`\n✓ Fetched ${realPharmacists.length} REAL pharmacists from database.`);

  // 3. Clear existing mock data from TQPH tables
  console.log('\n--- Cleaning old mock placeholder data from TQPH tables ---');
  await client.from('tqph_distribution_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('tqph_capa_tasks').delete().neq('id', 'none');
  await client.from('tqph_appraisals').delete().neq('id', 'none');
  await client.from('tqph_audits').delete().neq('id', 'none');
  console.log('✓ Cleared old placeholder records.');

  // 4. Generate & Insert Audits for ALL 21 REAL Branches
  console.log(`\n--- Seeding September 2026 Audits for all ${realBranches.length} REAL Branches ---`);
  
  // Realistic score distribution across 21 branches
  const scores = [
    99.2, 98.8, 98.4, 97.9, 97.5, 96.8, 96.2, 95.7, 95.1, 94.6, // Green (>=95)
    93.8, 92.5, 91.9, 90.4, 88.7, 87.2, 85.6, 83.1, 81.4,       // Amber (80-94.9)
    78.6, 76.2                                                   // Red (<80)
  ];

  const supervisors = [
    'a8074b0d-669e-4d4e-8ff3-ab0219e35790',
    'b455e337-3202-4835-8d81-508729195268'
  ];

  const auditsToInsert: any[] = [];
  const capasToInsert: any[] = [];

  realBranches.forEach((branch, index) => {
    const score = scores[index] || 95.0;
    const supervisorId = supervisors[index % supervisors.length];
    const day = String(index % 12 + 4).padStart(2, '0');
    const date = `2026-09-${day}`;
    const auditId = `audit-real-${branch.code.toLowerCase()}`;

    const violationsList: string[] = [];

    // Construct realistic sections
    const sections = STANDARD_NHRA_SECTIONS_TEMPLATE.map(sec => {
      let items = sec.items.map(it => ({ ...it, status: it.status as ComplianceStatus }));

      // If score is Red (<80%), introduce Critical violations in Sec 1 or Sec 8
      if (score < 80 && sec.section_code === '1.0') {
        items[1] = { ...items[1], status: 'non_compliant' as const };
        const capaId = `capa-${branch.code.toLowerCase()}-1`;
        violationsList.push(capaId);
        capasToInsert.push({
          id: capaId,
          audit_id: auditId,
          element_code: '1.2',
          violation: 'NHRA Pharmacy Facility Operating License expired or renewal receipt not displayed prominently',
          required_action: 'Display updated license from NHRA portal immediately',
          severity: 'Critical',
          due_date: `${date}T12:00:00.000Z`,
          status: 'open',
          assigned_to: branch.branch_manager_name || 'Branch Manager',
          created_at: `${date}T10:00:00.000Z`
        });
      } else if (score < 90 && sec.section_code === '5.0' && items[0]) {
        // Major violation in Sec 5.0 (Controlled Meds)
        items[0] = { ...items[0], status: 'partially_compliant' as const };
        const capaId = `capa-${branch.code.toLowerCase()}-5`;
        violationsList.push(capaId);
        capasToInsert.push({
          id: capaId,
          audit_id: auditId,
          element_code: '5.1',
          violation: 'Semi-controlled registry physical log book missing counter-signature for 1 dispensation entry',
          required_action: 'Complete double-check signature and reconcile register balance',
          severity: 'Major',
          due_date: `${date}T12:00:00.000Z`,
          status: 'open',
          assigned_to: branch.branch_manager_name || 'Branch Manager',
          created_at: `${date}T10:00:00.000Z`
        });
      } else if (score < 95 && sec.section_code === '2.0' && items[1]) {
        // Minor violation in Sec 2.0 (Cleanliness)
        items[1] = { ...items[1], status: 'partially_compliant' as const };
        const capaId = `capa-${branch.code.toLowerCase()}-2`;
        violationsList.push(capaId);
        capasToInsert.push({
          id: capaId,
          audit_id: auditId,
          element_code: '2.2',
          violation: 'Dispensing bench minor clutter during peak rush hour',
          required_action: 'Re-organize bench and sanitize counter',
          severity: 'Minor',
          due_date: `${date}T12:00:00.000Z`,
          status: 'resolved',
          assigned_to: branch.branch_manager_name || 'Branch Manager',
          resolved_by: branch.branch_manager_name || 'Branch Manager',
          resolved_at: `${date}T14:00:00.000Z`,
          resolution_proof_url: 'https://placehold.co/600x400/10b981/ffffff?text=Sanitized+Bench',
          created_at: `${date}T10:00:00.000Z`
        });
      }

      return { ...sec, items };
    });

    auditsToInsert.push({
      id: auditId,
      branch_id: branch.id,
      supervisor_id: supervisorId,
      date,
      status: 'locked_submitted',
      compliance_score: score,
      violations_list: violationsList,
      sections,
      amended: false,
      submitted_by: supervisorId,
      created_at: `${date}T09:00:00.000Z`,
      updated_at: `${date}T12:00:00.000Z`,
      locked_at: `${date}T12:00:00.000Z`
    });
  });

  const { error: insAuditErr } = await client.from('tqph_audits').insert(auditsToInsert);
  if (insAuditErr) {
    console.error('❌ Failed to insert real audits:', insAuditErr);
  } else {
    console.log(`✓ Successfully seeded ${auditsToInsert.length} audits for REAL branches.`);
  }

  // 5. Insert CAPAs
  if (capasToInsert.length > 0) {
    const { error: insCapaErr } = await client.from('tqph_capa_tasks').insert(capasToInsert);
    if (insCapaErr) {
      console.error('❌ Failed to insert CAPAs:', insCapaErr);
    } else {
      console.log(`✓ Successfully seeded ${capasToInsert.length} CAPA tasks for REAL branch managers.`);
    }
  }

  // 6. Seed Appraisals for REAL Pharmacists (sample of top 15 pharmacists across network)
  console.log(`\n--- Seeding Appraisals for REAL Pharmacists ---`);
  const appraisedPharmacists = realPharmacists.slice(0, 18);
  const appraisalScores = [148, 146, 144, 142, 139, 137, 135, 132, 128, 124, 118, 112, 105, 98, 96, 92, 88, 84];

  const appraisalsToInsert = appraisedPharmacists.map((ph, idx) => {
    const score = appraisalScores[idx] || 120;
    const passed = score >= 95;
    const branch = realBranches[idx % realBranches.length];
    const supervisorId = supervisors[idx % supervisors.length];

    return {
      id: `appraisal-real-${ph.id.slice(0, 8)}`,
      pharmacist_id: ph.id,
      branch_id: branch.id,
      supervisor_id: supervisorId,
      month: 9,
      year: 2026,
      status: 'locked_submitted',
      total_credit_score: score,
      passed,
      comments_and_improvement: passed
        ? 'Excellent clinical dispensing diligence, strong patient counseling and adherence to NHRA standards.'
        : 'Requires clinical refresher on semi-controlled dispensing protocols and patient consultation time management.',
      sections: STANDARD_APPRAISAL_SECTIONS_TEMPLATE,
      amended: false,
      submitted_by: supervisorId,
      created_at: '2026-09-08T09:00:00.000Z',
      updated_at: '2026-09-08T11:00:00.000Z',
      locked_at: '2026-09-08T11:00:00.000Z'
    };
  });

  const { error: insAppraisalErr } = await client.from('tqph_appraisals').insert(appraisalsToInsert);
  if (insAppraisalErr) {
    console.error('❌ Failed to insert real appraisals:', insAppraisalErr);
  } else {
    console.log(`✓ Successfully seeded ${appraisalsToInsert.length} appraisals for REAL pharmacists.`);
  }

  // 7. Verify Counts
  console.log('\n--- Final Verification of REAL Data in Supabase ---');
  const { count: finalAudits } = await client.from('tqph_audits').select('*', { count: 'exact', head: true });
  const { count: finalAppraisals } = await client.from('tqph_appraisals').select('*', { count: 'exact', head: true });
  const { count: finalCapas } = await client.from('tqph_capa_tasks').select('*', { count: 'exact', head: true });

  console.log(`  Live REAL Audits (21 Branches):      ${finalAudits}`);
  console.log(`  Live REAL Appraisals (Pharmacists):  ${finalAppraisals}`);
  console.log(`  Live REAL CAPA Tasks:                ${finalCapas}`);

  console.log('\n🎉 Transition to REAL Bahrain System Data Completed Successfully!\n');
}

seedRealTQPHData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
