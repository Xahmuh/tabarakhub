import React, { useEffect, useState } from 'react';
import { Branch } from '../../types';
import { branchService } from '../../services/branchService';
import { supabaseClient } from '../../lib/supabaseClient';

type RecordKind = 'delivery' | 'benefit';
type FoundRecord = {
  id: string;
  label: string;
  branchId: string;
  status: string;
  source?: string;
  linkedOrderId?: string | null;
  archived?: boolean;
  amount?: string;
};

export const AdminRecordCorrections: React.FC = () => {
  const [kind, setKind] = useState<RecordKind>('delivery');
  const [search, setSearch] = useState('');
  const [record, setRecord] = useState<FoundRecord | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recent, setRecent] = useState<Array<{ id: string; action: string; reason: string; created_at: string; actor_id: string }>>([]);

  const loadRecent = async () => {
    const { data, error } = await supabaseClient.from('admin_record_corrections')
      .select('id,action,reason,created_at,actor_id')
      .order('created_at', { ascending: false }).limit(20);
    if (!error) setRecent(data || []);
  };

  useEffect(() => {
    branchService.list().then(setBranches).catch(error => setMessage(String(error)));
    void loadRecent();
  }, []);

  const findRecord = async () => {
    const term = search.trim().toUpperCase();
    if (!term) return;
    setBusy(true);
    setRecord(null);
    setMessage('');
    try {
      let found = false;
      if (kind === 'delivery') {
        const { data, error } = await supabaseClient.from('delivery_orders')
          .select('id,order_number,branch_id,delivery_status,deleted_at')
          .eq('order_number', term).maybeSingle();
        if (error) throw error;
        if (data) {
          found = true;
          setRecord({ id: data.id, label: data.order_number, branchId: data.branch_id,
            status: data.deleted_at ? 'deleted' : data.delivery_status });
        }
      } else {
        const { data, error } = await supabaseClient.from('benefit_pay_transfers')
          .select('id,serial_number,branch_id,source,delivery_order_id,value_bhd')
          .eq('serial_number', term).maybeSingle();
        if (error) throw error;
        if (data) {
          found = true;
          setRecord({ id: data.id, label: data.serial_number, branchId: data.branch_id,
            status: 'active', source: data.source, linkedOrderId: data.delivery_order_id,
            amount: String(data.value_bhd) });
        } else {
          const { data: archived, error: archiveError } = await supabaseClient
            .from('benefit_pay_deleted_transfers')
            .select('transfer_id,snapshot,deleted_at')
            .eq('snapshot->>serial_number', term).is('restored_at', null).maybeSingle();
          if (archiveError) throw archiveError;
          if (archived) {
            found = true;
            const snapshot = archived.snapshot as any;
            setRecord({ id: archived.transfer_id, label: snapshot.serial_number,
              branchId: snapshot.branch_id, status: 'deleted', source: snapshot.source,
              amount: String(snapshot.value_bhd), archived: true });
          }
        }
      }
      setTargetBranchId('');
      setReason('');
      if (!found) setMessage('No matching record found.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const correct = async (action: 'move' | 'restore') => {
    if (!record || reason.trim().length < 5) return;
    if (action === 'move' && (!targetBranchId || targetBranchId === record.branchId)) return;
    const target = branches.find(branch => branch.id === targetBranchId);
    const description = action === 'move'
      ? `Move ${record.label} to ${target?.code || 'selected branch'}?`
      : `Restore ${record.label}?`;
    if (!window.confirm(`${description}\nReason: ${reason.trim()}`)) return;
    setBusy(true);
    setMessage('');
    try {
      let rpc = '';
      let args: Record<string, string> = { p_reason: reason.trim() };
      if (kind === 'delivery') {
        rpc = action === 'move' ? 'app_admin_move_delivery_order' : 'app_admin_restore_delivery_order';
        args = { ...args, p_order_id: record.id };
      } else {
        rpc = action === 'move' ? 'app_admin_move_manual_benefit_pay' : 'app_admin_restore_manual_benefit_pay';
        args = { ...args, p_transfer_id: record.id };
      }
      if (action === 'move') args.p_target_branch_id = targetBranchId;
      const { data, error } = await supabaseClient.rpc(rpc as any, args as any);
      if (error) throw error;
      const result = data as any;
      setMessage(`Saved. ${result?.order_number || result?.serial_number || record.label}${result?.benefit_pay_serial ? ` / ${result.benefit_pay_serial}` : ''}`);
      setRecord(null);
      setSearch('');
      setReason('');
      await loadRecent();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const branchLabel = (id: string) => {
    const branch = branches.find(item => item.id === id);
    return branch ? `${branch.code} - ${branch.name}` : id;
  };
  const canMove = record && !record.archived && (kind === 'delivery' || record.source === 'manual');
  const canRestore = record && (kind === 'delivery'
    ? record.status === 'cancelled'
    : record.archived && record.source === 'manual');

  return (
    <section className="operational-panel space-y-5 p-5">
      <div>
        <h3 className="text-xl font-bold text-slate-950">Admin record corrections</h3>
        <p className="text-sm text-slate-500">Move a record to its correct branch or restore a mistakenly voided record. Each correction is logged.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setKind('delivery'); setRecord(null); setMessage(''); }}
          className={kind === 'delivery' ? 'btn-primary' : 'btn-secondary'}>Delivery order</button>
        <button type="button" onClick={() => { setKind('benefit'); setRecord(null); setMessage(''); }}
          className={kind === 'benefit' ? 'btn-primary' : 'btn-secondary'}>Benefit Pay</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="min-w-[240px] flex-1 rounded-md border border-slate-200 px-3 py-2"
          placeholder={kind === 'delivery' ? 'Exact order number' : 'Exact BP serial number'}
          value={search} onChange={event => setSearch(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void findRecord(); }} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={findRecord}>Find</button>
      </div>
      {record && <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm text-slate-700">
          <strong>{record.label}</strong> · {branchLabel(record.branchId)} · {record.status}
          {record.amount && ` · ${record.amount} BHD`}
          {record.linkedOrderId && <p className="mt-1 text-xs text-slate-500">Linked delivery: {record.linkedOrderId}. Move the delivery order to move both records.</p>}
        </div>
        {canMove && <select className="w-full rounded-md border border-slate-200 bg-white px-3 py-2"
          value={targetBranchId} onChange={event => setTargetBranchId(event.target.value)}>
          <option value="">Select correct branch</option>
          {branches.filter(branch => branch.id !== record.branchId).map(branch =>
            <option key={branch.id} value={branch.id}>{branch.code} - {branch.name}</option>)}
        </select>}
        <textarea className="w-full rounded-md border border-slate-200 px-3 py-2"
          placeholder="Reason for correction (required)" value={reason}
          onChange={event => setReason(event.target.value)} rows={2} />
        <div className="flex flex-wrap gap-2">
          {canMove && <button type="button" className="btn-primary" disabled={busy || !targetBranchId || reason.trim().length < 5}
            onClick={() => void correct('move')}>Move to branch</button>}
          {canRestore && <button type="button" className="btn-secondary" disabled={busy || reason.trim().length < 5}
            onClick={() => void correct('restore')}>Restore record</button>}
        </div>
      </div>}
      {message && <p role="status" className="text-sm font-semibold text-slate-700">{message}</p>}
      {!record && !busy && !message && search.trim() && <p className="text-xs text-slate-500">Search by the complete number.</p>}
      {recent.length > 0 && <div className="border-t border-slate-200 pt-4">
        <h4 className="mb-2 text-sm font-bold text-slate-900">Recent corrections</h4>
        <div className="space-y-2">
          {recent.map(item => <p key={item.id} className="text-xs text-slate-600">
            {new Date(item.created_at).toLocaleString()} · {item.action.replaceAll('_', ' ')} · {item.reason}
          </p>)}
        </div>
      </div>}
    </section>
  );
};
