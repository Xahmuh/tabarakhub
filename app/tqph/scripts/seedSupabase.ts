import { supabaseClient } from '../../../lib/supabaseClient';
import {
  MOCK_AUDITS,
  MOCK_CAPA_TASKS
} from '../data/mockAudits';
import {
  MOCK_APPRAISALS
} from '../data/mockAppraisals';

async function seedTQPHLiveDatabase() {
  console.log('======================================================');
  console.log('  TQPH Live Supabase Database Seeder                 ');
  console.log('======================================================');

  if (!supabaseClient) {
    console.error('❌ Supabase client is not configured.');
    process.exit(1);
  }

  // 1. Seed Audits
  console.log(`\n1. Seeding ${MOCK_AUDITS.length} Audits...`);
  const auditsPayload = MOCK_AUDITS.map(a => ({
    id: a.id,
    branch_id: a.branch_id,
    supervisor_id: a.supervisor_id,
    date: a.date,
    status: a.status,
    compliance_score: a.compliance_score,
    violations_list: a.violations_list || [],
    sections: a.sections,
    amended: a.amended ?? false,
    submitted_by: a.submitted_by,
    locked_at: a.locked_at ?? null
  }));

  const { error: auditErr } = await (supabaseClient as any)
    .from('tqph_audits')
    .upsert(auditsPayload, { onConflict: 'id' });

  if (auditErr) {
    console.error('❌ Failed to upsert audits:', auditErr);
  } else {
    console.log(`✓ Successfully upserted ${MOCK_AUDITS.length} audits.`);
  }

  // 2. Seed Appraisals
  console.log(`\n2. Seeding ${MOCK_APPRAISALS.length} Appraisals...`);
  const appraisalsPayload = MOCK_APPRAISALS.map(ap => ({
    id: ap.id,
    pharmacist_id: ap.pharmacist_id,
    branch_id: ap.branch_id,
    supervisor_id: ap.supervisor_id,
    month: ap.month,
    year: ap.year,
    status: ap.status,
    total_credit_score: ap.total_credit_score,
    passed: ap.passed,
    comments_and_improvement: ap.comments_and_improvement ?? null,
    sections: ap.sections,
    amended: ap.amended ?? false,
    submitted_by: ap.submitted_by,
    locked_at: ap.locked_at ?? null
  }));

  const { error: appraisalErr } = await (supabaseClient as any)
    .from('tqph_appraisals')
    .upsert(appraisalsPayload, { onConflict: 'id' });

  if (appraisalErr) {
    console.error('❌ Failed to upsert appraisals:', appraisalErr);
  } else {
    console.log(`✓ Successfully upserted ${MOCK_APPRAISALS.length} appraisals.`);
  }

  // 3. Seed CAPA Tasks
  console.log(`\n3. Seeding ${MOCK_CAPA_TASKS.length} CAPA Tasks...`);
  const capaPayload = MOCK_CAPA_TASKS.map(c => ({
    id: c.id,
    audit_id: c.audit_id,
    element_code: c.element_code,
    violation: c.violation,
    required_action: c.required_action,
    severity: c.severity,
    due_date: c.due_date,
    status: c.status,
    assigned_to: c.assigned_to,
    resolved_by: c.resolved_by ?? null,
    resolved_at: c.resolved_at ?? null,
    resolution_proof_url: c.resolution_proof_url ?? null
  }));

  const { error: capaErr } = await (supabaseClient as any)
    .from('tqph_capa_tasks')
    .upsert(capaPayload, { onConflict: 'id' });

  if (capaErr) {
    console.error('❌ Failed to upsert CAPA tasks:', capaErr);
  } else {
    console.log(`✓ Successfully upserted ${MOCK_CAPA_TASKS.length} CAPA tasks.`);
  }

  // 4. Verify Live Counts from Supabase
  console.log('\n--- Verifying Live Remote Table Row Counts ---');
  const { count: auditCount } = await (supabaseClient as any)
    .from('tqph_audits')
    .select('*', { count: 'exact', head: true });

  const { count: appraisalCount } = await (supabaseClient as any)
    .from('tqph_appraisals')
    .select('*', { count: 'exact', head: true });

  const { count: capaCount } = await (supabaseClient as any)
    .from('tqph_capa_tasks')
    .select('*', { count: 'exact', head: true });

  console.log(`  Live tqph_audits rows:      ${auditCount}`);
  console.log(`  Live tqph_appraisals rows: ${appraisalCount}`);
  console.log(`  Live tqph_capa_tasks rows:  ${capaCount}`);

  console.log('\n🎉 Live Supabase Database Seeding Completed Successfully!\n');
}

seedTQPHLiveDatabase().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
