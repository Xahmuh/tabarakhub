import assert from 'node:assert/strict';
import { SupabaseTQPHService } from '../services/supabaseTqphService';

function clientResult(
  response: { data: any[] | null; error: Error | null },
  role = 'manager',
  assignments: string[] = []
) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from(table: string) {
      let scope: { field: string; ids: string[] } | null = null;
      const query = {
        select() { return this; },
        eq() { return this; },
        or() { return this; },
        neq() { return this; },
        in(field: string, ids: string[]) { scope = { field, ids }; return this; },
        order() { return this; },
        single() {
          return Promise.resolve({ data: { role, branch_id: assignments[0] || null, is_active: true }, error: null });
        },
        upsert() { return Promise.resolve(response); },
        insert() { return Promise.resolve(response); },
        then(resolve: (value: typeof response) => unknown) {
          const result = table === 'supervisor_branches'
            ? { data: assignments.map(branch_id => ({ branch_id })), error: null }
            : scope && response.data
              ? { ...response, data: response.data.filter(row => scope!.ids.includes(row[scope!.field])) }
              : response;
          return Promise.resolve(result).then(resolve);
        }
      };
      return query;
    }
  } as any;
}

const emptyService = new SupabaseTQPHService(clientResult({ data: [], error: null }));
assert.deepEqual(await emptyService.getBranches(), [], 'an empty database result stays empty');
assert.deepEqual(await emptyService.getAudits(), [], 'audit demo rows must never appear');
assert.deepEqual(await emptyService.getPharmacists(), [], 'synthetic pharmacists must never appear');

const deniedService = new SupabaseTQPHService(clientResult({ data: null, error: new Error('permission denied') }));
await assert.rejects(deniedService.getBranches(), /permission denied/);
await assert.rejects(deniedService.getAudits(), /permission denied/);
await assert.rejects(deniedService.saveAudit({} as any), /permission denied/);
const pharmacistService = new SupabaseTQPHService(clientResult({
  data: [{ id: 'ph-1', name: 'Example', code: 'P1', branch_id: 'branch-1' }], error: null
}));
assert.equal((await pharmacistService.getPharmacists())[0].cpr, '', 'never invent a CPR');
const scopedService = new SupabaseTQPHService(clientResult({
  data: [
    { id: 'branch-1', name: 'Assigned' },
    { id: 'branch-2', name: 'Other' }
  ], error: null
}, 'supervisor', ['branch-1']));
assert.deepEqual((await scopedService.getBranches()).map(branch => branch.id), ['branch-1'],
  'supervisor branch switcher only includes assigned branches');
const unassignedService = new SupabaseTQPHService(clientResult({ data: [], error: null }, 'supervisor'));
assert.deepEqual(await unassignedService.getBranches(), [], 'unassigned supervisor sees no branch choices');

const rpcCalls: Array<{ name: string; payload: any }> = [];
const atomicService = new SupabaseTQPHService({
  rpc: async (name: string, payload: any) => {
    rpcCalls.push({ name, payload });
    return { error: null };
  }
} as any);
const audit = { id: 'audit-1' } as any;
const appraisal = { id: 'appraisal-1' } as any;
const capas = [{ id: 'capa-1' }] as any;
await atomicService.submitEvaluation(audit, appraisal, capas);
assert.equal(rpcCalls.length, 1, 'evaluation uses one RPC request');
assert.equal(rpcCalls[0].name, 'submit_tqph_evaluation');
assert.deepEqual(rpcCalls[0].payload, { p_audit: audit, p_appraisal: appraisal, p_capas: capas });
const rejectedRpcService = new SupabaseTQPHService({
  rpc: async () => ({ error: new Error('transaction rejected') })
} as any);
await assert.rejects(rejectedRpcService.submitEvaluation(audit, appraisal, capas), /transaction rejected/);
console.log('TQPH empty-result, branch-scope and atomic-RPC tests passed');
