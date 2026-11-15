import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { getPresetRange, periodLabel, todayKey, yesterdayKey, type PeriodPreset } from '../../app/delivery/utils';
import { supabaseClient } from '../../lib/supabaseClient';
import {
  buildDeliveryOrderCleanExportParity,
  buildDeliveryCleanExportWorkbook,
  listDeliveryOrderCleanExportRows
} from '../deliveryCleanExportService';
import { deliveryService } from '../deliveryService';

let rows = Array.from({ length: 12866 }, (_, index) => ({
  id: String(index),
  order_date: '',
  external_source: null as string | null,
  order_kind: 'actual_delivery',
  delivery_status: index === 12865 ? 'cancelled' : 'recorded',
  payment_type: 'TALABAT',
  value_bhd: '1.250',
  cancelled_reason: index === 12865 ? 'Recorded only void: duplication' : null
}));
const auditIds = new Set(['1000', '3500', '9000', '12864']);
const originalFrom = supabaseClient.from;
supabaseClient.from = ((table: string) => {
  const ordering: string[] = [];
  let dateFrom = '';
  let dateTo = '';
  const query = {
    select: () => query,
    is: () => query,
    gte: (column: string, value: string) => {
      assert.equal(column, 'order_date');
      dateFrom = value;
      return query;
    },
    lte: (column: string, value: string) => {
      assert.equal(column, 'order_date');
      dateTo = value;
      return query;
    },
    order: (column: string) => {
      ordering.push(column);
      return query;
    },
    range: async (from: number, to: number) => {
      assert.ok(table === 'delivery_orders' || table === 'delivery_orders_clean');
      assert.deepEqual(ordering, ['order_date', 'created_at', 'id']);
      return { data: rows.filter(row => (!dateFrom || row.order_date >= dateFrom) && (!dateTo || row.order_date <= dateTo)).slice(from, to + 1) };
    },
    in: async (column: string, ids: string[]) => {
      assert.equal(table, 'delivery_recording_voids');
      assert.equal(column, 'order_id');
      assert.ok(ids.length <= 500);
      return { data: ids.filter(id => auditIds.has(id)).map(order_id => ({ order_id })) };
    }
  };
  return query;
}) as unknown as typeof supabaseClient.from;

try {
  const operational = await deliveryService.orders.list();
  const clean = await listDeliveryOrderCleanExportRows();
  assert.equal(clean.length, 12861);
  assert.deepEqual(operational.map(row => row.id), clean.map(row => row.id));
  assert.ok(clean.every(row => !auditIds.has(row.id) && row.id !== '12865'));
  const parity = buildDeliveryOrderCleanExportParity(operational, clean);
  assert.ok(parity.matches, parity.differences.join('; '));
  assert.equal(parity.paymentTotals.clean.TALABAT, 16076.25);

  const fixture = { order_kind: 'actual_delivery', delivery_status: 'recorded', cancelled_reason: null, external_source: null };
  rows = [
    { ...fixture, id: 'today-tab', order_date: todayKey(), payment_type: 'CASH', value_bhd: '0.101' },
    { ...fixture, id: 'today-external', order_date: todayKey(), external_source: 'talabat', payment_type: 'CARD', value_bhd: '1.202' },
    { ...fixture, id: 'today-transfer', order_date: todayKey(), order_kind: 'internal_transfer', payment_type: 'CASH', value_bhd: '100.000' },
    { ...fixture, id: 'yesterday-tab', order_date: yesterdayKey(), payment_type: 'CARD', value_bhd: '2.003' },
    { ...fixture, id: 'before-range', order_date: '2000-01-01', payment_type: 'TALABAT', value_bhd: '999.000' }
  ];

  const cases: { preset: PeriodPreset; expected: [string[], number][] }[] = [
    { preset: 'today', expected: [[['today-tab', 'today-external'], 1.303], [['today-tab'], 0.101], [['today-external'], 1.202]] },
    { preset: 'yesterday', expected: [[['yesterday-tab'], 2.003], [['yesterday-tab'], 2.003], [[], 0]] },
    { preset: 'custom', expected: [[['today-tab', 'today-external', 'yesterday-tab'], 3.306], [['today-tab', 'yesterday-tab'], 2.104], [['today-external'], 1.202]] }
  ];
  const sheetNames = ['Total Delivery Orders', 'Tabarak Delivery', 'Talabat Delivery'];
  for (const { preset, expected } of cases) {
    const range = getPresetRange(preset, yesterdayKey(), todayKey());
    const filters = { dateFrom: range.from, dateTo: range.to };
    const dashboardRows = await deliveryService.orders.list(filters);
    const exportRows = await listDeliveryOrderCleanExportRows(filters);
    const exportParity = buildDeliveryOrderCleanExportParity(dashboardRows, exportRows);
    assert.ok(exportParity.matches, exportParity.differences.join('; '));
    const title = periodLabel(preset, range.from, range.to);
    const branches = Array.from({ length: 22 }, (_, i) => [`Branch ${i + 1}`, 1, 0.101]);
    const workbook = await buildDeliveryCleanExportWorkbook(exportRows, title, exportParity, [
      { tab: 'Branches', name: 'Orders per branch', headers: ['Branch', 'Orders', 'Value (BHD)'], rows: branches },
      { tab: 'Pharmacists', name: 'Pharmacist performance', headers: ['Pharmacist', 'Orders'], rows: [['Pharmacist A', 2]] },
      { tab: 'Drivers', name: 'Driver performance', headers: ['Driver', 'Orders'], rows: [['Driver A', 3]] },
      { tab: 'Drivers', name: 'Driver workload by weekday', headers: ['Driver', 'Sun'], rows: [['Driver A', 3]] },
      { tab: 'Geography', name: 'Direct payments by governorate', headers: ['Governorate', 'Orders'], rows: [['Capital', 1]] },
      { tab: 'Operations', name: 'Internal transfer routes', headers: ['From branch', 'To branch', 'Orders'], rows: [] }
    ]);
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    assert.deepEqual(reloaded.worksheets.map(sheet => sheet.name), ['Dashboard', 'Branches', 'Pharmacists', 'Drivers', 'Geography', 'Operations', 'Order Details', 'QA']);
    assert.equal(reloaded.views[0].activeTab, 0);
    const dashboard = reloaded.worksheets[0];
    assert.equal(dashboard.getCell('A1').value, 'Delivery Analytics');
    assert.equal(dashboard.getCell('A2').value, title);
    assert.equal(dashboard.getCell('A5').value, exportRows.length);
    assert.equal(dashboard.getCell('G5').value, 22);
    assert.equal(dashboard.getCell('A15').hyperlink, "#'Branches'!A1");
    assert.equal(reloaded.getWorksheet('Branches')!.getCell('A3').hyperlink, "#'Dashboard'!A1");
    const qa = reloaded.getWorksheet('QA')!;
    expected.forEach(([ids, value], index) => {
      const row = dashboard.getRow(9 + index);
      assert.equal(row.getCell(1).value, sheetNames[index]);
      assert.equal(row.getCell(5).value, ids.length);
      assert.equal(row.getCell(7).value, value);
      assert.equal(qa.getCell(`D${11 + index}`).value, 'YES');
    });
    assert.equal(reloaded.getWorksheet('Branches')!.getCell('A28').value, 'Branch 22');
    assert.equal(reloaded.getWorksheet('Pharmacists')!.getCell('A7').value, 'Pharmacist A');
    assert.equal(reloaded.getWorksheet('Drivers')!.getCell('A9').value, 'Driver workload by weekday');
    const details = reloaded.getWorksheet('Order Details')!;
    const detailRows = Array.from({ length: exportRows.length }, (_, index) => details.getRow(index + 6));
    assert.deepEqual(detailRows.map(row => row.getCell(1).value), exportRows.map(row => row.id));
    assert.deepEqual(detailRows.filter(row => row.getCell(3).value === 'Talabat Delivery').map(row => row.getCell(1).value), expected[2][0]);
    assert.equal(detailRows.some(row => row.getCell(3).value === 'Internal Transfer'), preset !== 'yesterday');
  }

  const changedSource = await listDeliveryOrderCleanExportRows({ dateFrom: todayKey(), dateTo: todayKey() });
  const todayOrders = await deliveryService.orders.list({ dateFrom: todayKey(), dateTo: todayKey() });
  changedSource.find(row => row.id === 'today-external')!.externalSource = null;
  const sourceParity = buildDeliveryOrderCleanExportParity(todayOrders, changedSource);
  assert.ok(sourceParity.paymentTotals.matches);
  assert.deepEqual(sourceParity.deliveryGroups.map(group => group.matches), [true, false, false]);
  console.log('Delivery clean export parity test passed.');
} finally {
  supabaseClient.from = originalFrom;
}
