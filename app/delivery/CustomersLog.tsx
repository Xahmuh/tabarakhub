import { useEffect, useState } from 'react';
import { ChevronDown, Download, MapPin, Search } from 'lucide-react';
import type { Branch } from '../../types';
import { branchService } from '../../services/branchService';
import { deliveryCustomerService, type CustomerAddress, type CustomerDeliveryOrder, type DeliveryCustomer } from '../../services/deliveryCustomerService';
import { customerAddressHeading } from './components/CustomerAddressPicker';
import { formatBhd } from './utils';

function CustomerPagination({ page, hasNext, busy, onChange, label }: {
  page: number; hasNext: boolean; busy: boolean; onChange: (page: number) => void; label: string;
}) {
  if (page === 0 && !hasNext) return null;
  return <nav aria-label={label} className="mt-3 flex flex-wrap items-center justify-end gap-3 text-xs">
    <button type="button" className="btn-neutral disabled:opacity-40" disabled={busy || page === 0}
      onClick={() => onChange(page - 1)}>Previous</button>
    <span aria-live="polite" className="font-semibold text-slate-600">Page {page + 1}</span>
    <button type="button" className="btn-neutral disabled:opacity-40" disabled={busy || !hasNext}
      onClick={() => onChange(page + 1)}>Next</button>
  </nav>;
}

function CustomerDetails({ phone, branchId }: { phone: string; branchId: string | null }) {
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [addressError, setAddressError] = useState(false);
  const [orders, setOrders] = useState<CustomerDeliveryOrder[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(true);
  const [orderError, setOrderError] = useState(false);

  useEffect(() => {
    let active = true;
    deliveryCustomerService.addresses(branchId, phone)
      .then(data => { if (active) setAddresses(data); })
      .catch(() => { if (active) setAddressError(true); });
    return () => { active = false; };
  }, [branchId, phone]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setOrderError(false);
    deliveryCustomerService.orders(branchId, phone, page).then(result => {
      if (!active) return;
      setOrders(result.rows);
      setHasNext(result.hasNext);
    }).catch(() => { if (active) setOrderError(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [branchId, phone, page]);

  return <div className="space-y-6 border-t border-slate-200 p-4 sm:p-5">
    <section>
      <h4 className="mb-3 text-sm font-black text-slate-900">Saved addresses</h4>
      {addressError ? <p role="alert" className="text-sm text-red-700">Could not load saved addresses.</p>
        : addresses === null ? <p role="status" className="text-sm text-slate-500">Loading addresses…</p>
        : addresses.length === 0 ? <p className="text-sm text-slate-500">No saved addresses.</p>
        : <ul className="grid gap-2 md:grid-cols-2">
          {addresses.map((address, index) => <li key={index} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-start gap-2 text-sm font-bold text-slate-800">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> {customerAddressHeading(address)}
            </p>
            {address.customer_address && <p className="mt-1 break-words text-sm text-slate-600">{address.customer_address}</p>}
            {address.location_url && /^https:\/\/[^\s]+$/i.test(address.location_url) && (
              <a className="mt-2 inline-block text-xs font-bold text-brand underline" href={address.location_url} target="_blank" rel="noreferrer">Open GPS location</a>
            )}
          </li>)}
        </ul>}
    </section>
    <section>
      <h4 className="mb-3 text-sm font-black text-slate-900">Order history</h4>
      {busy ? <p role="status" className="text-sm text-slate-500">Loading orders…</p>
        : orderError ? <p role="alert" className="text-sm text-red-700">Could not load order history.</p>
        : orders.length === 0 ? <p className="text-sm text-slate-500">No orders on this page.</p>
        : <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[630px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-700"><tr>
              {['Order', 'Date', 'Value', 'Status', 'Driver', 'Pharmacist', 'Branch'].map(label =>
                <th scope="col" key={label} className="px-3 py-2.5">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => <tr key={order.id}>
                <td className="px-3 py-2.5 font-bold">{order.order_number || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{order.order_date}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatBhd(Number(order.value_bhd))}</td>
                <td className="px-3 py-2.5 capitalize">{order.delivery_status.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2.5">{order.driver_name
                  ? <>{order.driver_name}<span className="block text-xs text-slate-500">{order.delivered_at ? 'Delivered' : 'Assigned'}</span></>
                  : order.recorded_driver_name ? <>{order.recorded_driver_name}<span className="block text-xs text-slate-500">Recorded only</span></> : '—'}</td>
                <td className="px-3 py-2.5">{order.pharmacist_name || '—'}</td>
                <td className="px-3 py-2.5">{order.branch_name || '—'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      <CustomerPagination page={page} hasNext={!orderError && hasNext} busy={busy} onChange={setPage} label="Customer order pages" />
    </section>
  </div>;
}

export function CustomersLog({ lockedBranchId, canChooseBranch }: { lockedBranchId: string | null; canChooseBranch: boolean }) {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const branchId = lockedBranchId || selectedBranch;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [customers, setCustomers] = useState<DeliveryCustomer[]>([]);
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    if (!canChooseBranch) return;
    let active = true;
    branchService.list().then(data => { if (active) setBranches(data.filter(branch => branch.role === 'branch')); })
      .catch(() => { if (active) setBranches([]); });
    return () => { active = false; };
  }, [canChooseBranch]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setExpandedPhone(null);
    setError('');
    deliveryCustomerService.list(branchId, search, page).then(result => {
      if (!active) return;
      setCustomers(result.rows);
      setHasNext(result.hasNext);
    }).catch(failure => {
      if (!active) return;
      setError(failure?.code === '22023' ? 'Enter the full phone number, such as 33123456 or +97333123456.' : 'Could not load customers.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [branchId, page, search]);

  const exportCustomerPhones = async () => {
    setExporting(true);
    setExportError('');
    try {
      const allCustomers = await deliveryCustomerService.listAll(branchId, search);
      if (allCustomers.length === 0) {
        setExportError('No customer phone numbers match the current filters.');
        return;
      }

      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
      ]);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tabarak Hub';
      workbook.subject = 'Customers Log phone numbers';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Customer Phones');
      worksheet.columns = [{ header: 'Phone Number', key: 'phone', width: 24 }];
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      worksheet.autoFilter = `A1:A${allCustomers.length + 1}`;
      worksheet.getColumn(1).numFmt = '@';
      worksheet.getColumn(1).alignment = { vertical: 'middle' };
      const header = worksheet.getRow(1);
      header.height = 26;
      header.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      worksheet.addRows(allCustomers.map(customer => [customer.phone]));
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 22;
          row.getCell(1).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
          if (rowNumber % 2 === 0) {
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        }
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const branchName = canChooseBranch
        ? branches.find(branch => branch.id === branchId)?.name || 'All_Branches'
        : 'Branch';
      const fileBranch = branchName.trim().replace(/[^a-zA-Z0-9_-]+/g, '_');
      const fileDate = new Date().toISOString().slice(0, 10);
      saveAs(new Blob([buffer]), `Customers_Log_${fileBranch}_${fileDate}.xlsx`);
    } catch {
      setExportError('Could not export customer phone numbers.');
    } finally {
      setExporting(false);
    }
  };

  return <section className="operational-panel space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="text-xl font-black text-slate-950">Customers Log</h3>
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" className="btn-neutral" disabled={busy || exporting || !!error || customers.length === 0}
          onClick={exportCustomerPhones} title="Export all matching customer phone numbers to Excel">
          <Download className="h-4 w-4" aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
          event.preventDefault(); setPage(0); setSearch(searchText.trim());
        }}>
          {canChooseBranch && <label className="space-y-1 text-xs font-bold text-slate-700">
            <span className="block">Branch</span>
            <select className="h-10 rounded-lg border border-slate-200 bg-white px-3" value={selectedBranch || ''}
              onChange={event => { setPage(0); setSelectedBranch(event.target.value || null); }}>
              <option value="">All branches</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>}
          <label className="space-y-1 text-xs font-bold text-slate-700">
            <span className="block">Customer phone</span>
            <input type="tel" value={searchText} onChange={event => setSearchText(event.target.value)}
              placeholder="Local or international number" className="h-10 rounded-lg border border-slate-200 px-3" />
          </label>
          <button type="submit" className="btn-primary"><Search className="h-4 w-4" aria-hidden="true" /> Search</button>
          {search && <button type="button" className="btn-neutral" onClick={() => { setSearchText(''); setSearch(''); setPage(0); }}>Clear</button>}
        </form>
      </div>
    </div>
    {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
    {busy ? <p role="status" className="py-3 text-sm text-slate-500">Loading customers…</p>
      : error ? <p role="alert" className="py-3 text-sm text-red-700">{error}</p>
      : customers.length === 0 ? <p className="py-3 text-sm text-slate-500">No matching customers.</p>
      : <div className="space-y-2">{customers.map(customer => {
        const expanded = expandedPhone === customer.phone;
        return <article key={customer.phone} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button type="button" aria-expanded={expanded} aria-controls={`customer-log-${customer.phone.slice(1)}`}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50"
            onClick={() => setExpandedPhone(expanded ? null : customer.phone)}>
            <span>
              <span className="block text-sm font-black tabular-nums text-slate-950">{customer.phone}</span>
              <span className="block text-xs text-slate-600">{customer.address_count} addresses · {customer.order_count} orders · Last order {customer.last_order_date}</span>
            </span>
            <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <div id={`customer-log-${customer.phone.slice(1)}`} hidden={!expanded}>
            {expanded && <CustomerDetails phone={customer.phone} branchId={branchId} />}
          </div>
        </article>;
      })}</div>}
    <CustomerPagination page={page} hasNext={!error && hasNext} busy={busy} onChange={setPage} label="Customer pages" />
  </section>;
}
