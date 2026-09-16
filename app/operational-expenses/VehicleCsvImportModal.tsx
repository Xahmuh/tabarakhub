import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Download, FileSpreadsheet, Upload, Users, X } from 'lucide-react';
import { downloadVehicleCsvTemplate, parseVehicleCsv, ParsedVehicleCsvRow } from './utils/vehicleCsvUtils';
import { expenseService } from '../../services/expenseService';
import { workforceService, Employee } from '../../services/workforceService';
import { Vehicle } from '../../types';

interface VehicleCsvImportModalProps {
  onClose: () => void;
  onImportComplete: (newVehicles: Vehicle[]) => void;
  employees?: Employee[];
}

export const VehicleCsvImportModal: React.FC<VehicleCsvImportModalProps> = ({
  onClose,
  onImportComplete,
  employees = []
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedVehicleCsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setGeneralError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseVehicleCsv(text);
        setParsedRows(rows);
      } catch (err: any) {
        setGeneralError('Failed to parse CSV file. Please check file formatting.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const [updateExisting, setUpdateExisting] = useState(true);
  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setGeneralError(null);
    setProgress({ current: 0, total: validRows.length });

    const createdVehicles: Vehicle[] = [];
    let failureCount = 0;
    const errors: string[] = [];

    // Fetch current existing vehicles for duplicate resolution
    let existingVehicles: Vehicle[] = [];
    try {
      existingVehicles = await expenseService.vehicles.list(true);
    } catch (e) {
      console.warn('Could not fetch existing vehicles list prior to import:', e);
    }

    // Fetch fresh employee list for linking
    let currentEmployees = [...employees];
    if (currentEmployees.length === 0) {
      try {
        currentEmployees = await workforceService.getAllEmployees();
      } catch (e) {
        console.warn('Could not fetch employees for vehicle import linking:', e);
      }
    }

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const plateNorm = (row.plateNumber || '').trim().toUpperCase();
        let codeNorm = (row.vehicleCode || '').trim().toUpperCase();

        // If no code provided, generate unique vehicle code to avoid collisions
        if (!codeNorm) {
          let maxNum = existingVehicles.length;
          existingVehicles.forEach(v => {
            const m = /^V-(\d+)$/i.exec(v.vehicleCode || '');
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxNum) maxNum = n;
            }
          });
          codeNorm = `V-${String(maxNum + 1).padStart(3, '0')}`;
        }

        const matchedExisting = updateExisting
          ? existingVehicles.find(v => {
              const vPlate = (v.plateNumber || '').trim().toUpperCase();
              const vCode = (v.vehicleCode || '').trim().toUpperCase();
              return (plateNorm && vPlate === plateNorm) || (codeNorm && vCode === codeNorm);
            })
          : null;

        let targetVehicle: Vehicle;

        if (matchedExisting) {
          targetVehicle = await expenseService.vehicles.update(matchedExisting.id, {
            plateNumber: row.plateNumber || matchedExisting.plateNumber,
            vehicleCode: codeNorm || matchedExisting.vehicleCode,
            vehicleType: row.vehicleType,
            ownershipType: row.ownershipType,
            crNumber: row.crNumber || matchedExisting.crNumber,
            registrationExpiryDate: row.registrationExpiryDate || matchedExisting.registrationExpiryDate,
            initialOdometer: row.initialOdometer
          });
        } else {
          targetVehicle = await expenseService.vehicles.create({
            plateNumber: row.plateNumber,
            vehicleCode: codeNorm,
            vehicleType: row.vehicleType,
            ownershipType: row.ownershipType,
            crNumber: row.crNumber,
            registrationExpiryDate: row.registrationExpiryDate,
            initialOdometer: row.initialOdometer
          });
        }
        createdVehicles.push(targetVehicle);

        // Update in-memory existingVehicles list for subsequent row matching in same batch
        const exIdx = existingVehicles.findIndex(v => v.id === targetVehicle.id);
        if (exIdx !== -1) {
          existingVehicles[exIdx] = targetVehicle;
        } else {
          existingVehicles.push(targetVehicle);
        }

        // Process staff assignment if staff codes are present in the row
        if (row.assignedStaffCodes && row.assignedStaffCodes.length > 0) {
          const vehicleTag = (targetVehicle.plateNumber || targetVehicle.vehicleCode || '').trim().toUpperCase();
          if (vehicleTag) {
            for (const staffCode of row.assignedStaffCodes) {
              const empMatch = currentEmployees.find(e =>
                (e.code && e.code.toUpperCase() === staffCode) ||
                (e.driver_id && e.driver_id.toUpperCase() === staffCode) ||
                (e.id && e.id.toUpperCase() === staffCode)
              );

              if (empMatch) {
                const currentVehs = empMatch.assigned_vehicles || [];
                if (!currentVehs.some(v => v.trim().toUpperCase() === vehicleTag)) {
                  const updatedVehs = [...currentVehs, vehicleTag];
                  empMatch.assigned_vehicles = updatedVehs;
                  try {
                    await workforceService.saveEmployee(empMatch, empMatch.assignments || []);
                  } catch (empErr) {
                    console.warn(`Failed to link vehicle ${vehicleTag} to employee ${staffCode}:`, empErr);
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`Failed to import row ${row.rowNumber}:`, err);
        failureCount++;
        errors.push(`Row #${row.rowNumber} (Plate: ${row.plateNumber || 'N/A'}, Code: ${row.vehicleCode || 'Auto'}): ${err.message || 'Error saving'}`);
      }
      setProgress({ current: i + 1, total: validRows.length });
    }

    setImporting(false);
    if (createdVehicles.length > 0) {
      onImportComplete(createdVehicles);
    }
    if (failureCount > 0) {
      setGeneralError(`Completed with ${failureCount} failure(s):\n` + errors.join('\n'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand/10 text-brand">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Import Fleet Vehicles via CSV</h3>
              <p className="text-xs font-medium text-slate-500">Upload CSV with Plate Number, Vehicle Code, Type, Ownership, etc.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {generalError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200">
            <div>
              <h4 className="text-sm font-black text-slate-900 mb-1">Download CSV Template</h4>
              <p className="text-xs text-slate-500">Get the standard CSV layout pre-configured with exact required columns.</p>
            </div>
            <button
              onClick={downloadVehicleCsvTemplate}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors shrink-0"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Download Template (.csv)
            </button>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-2">
              Select CSV File to Upload
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={importing}
              className="w-full text-xs font-medium text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand file:text-white hover:file:bg-brand-dark file:cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <input
              type="checkbox"
              id="updateExistingVehicles"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              disabled={importing}
              className="rounded text-brand focus:ring-brand h-4 w-4"
            />
            <label htmlFor="updateExistingVehicles" className="text-xs font-bold text-slate-700 cursor-pointer">
              Update existing vehicles if Plate Number or Vehicle Code already exists in system
            </label>
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-500">
                  Preview Import Data ({validRows.length} Valid, {invalidRows.length} Errors)
                </h4>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">#</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Plate Number</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Code</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Type</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Ownership</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">CR No.</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Reg. Expiry</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Initial Odo</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Assigned Staff</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map(row => (
                      <tr key={row.rowNumber} className={row.isValid ? 'hover:bg-slate-50/60' : 'bg-red-50/30'}>
                        <td className="px-3 py-2 font-mono text-slate-400">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{row.plateNumber || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{row.vehicleCode || 'Auto'}</td>
                        <td className="px-3 py-2 text-slate-700">{row.vehicleType}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-black ${
                            row.ownershipType === 'External' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {row.ownershipType === 'External' ? 'Flexi / External' : 'Internal'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{row.crNumber || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.registrationExpiryDate || '—'}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{row.initialOdometer} km</td>
                        <td className="px-3 py-2">
                          {row.assignedStaffCodes && row.assignedStaffCodes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.assignedStaffCodes.map((c, ci) => (
                                <span key={ci} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono font-bold text-[10px]">
                                  <Users className="h-2.5 w-2.5" /> {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              <CheckCircle className="h-3 w-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded" title={row.error}>
                              <AlertCircle className="h-3 w-3" /> {row.error || 'Invalid'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-2 p-4 rounded-xl bg-brand/5 border border-brand/20">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Importing vehicles...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={e => setUpdateExisting(e.target.checked)}
              disabled={importing}
              className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span>Update existing vehicles if plate number or code matches</span>
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 bg-brand text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importing...' : `Import ${validRows.length} Vehicles`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
