import React, { useEffect, useState } from 'react';
import { DutySchedulerLeaveRecord, DutySchedulerLeaveStatus } from '../../types';
import { dutySchedulerService } from '../../services/dutySchedulerService';
import { workforceService } from '../../services/workforceService';
import { 
  Plus, 
  Loader2, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Clock, 
  AlertCircle, 
  Filter, 
  X,
  FileText
} from 'lucide-react';

export const InterimLeaveView: React.FC = () => {
  const [leaves, setLeaves] = useState<DutySchedulerLeaveRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<DutySchedulerLeaveStatus>('APPROVED');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedLeaves, fetchedEmployees] = await Promise.all([
        dutySchedulerService.getAllLeaveRecords(),
        workforceService.getAllEmployees()
      ]);
      setLeaves(fetchedLeaves);
      setEmployees(fetchedEmployees.filter(e => e.category === 'Pharmacist'));
    } catch (err) {
      console.error('Failed to load leave records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getEmployeeName = (empId: string) => {
    return employees.find(e => e.id === empId)?.full_name || 'Unknown Pharmacist';
  };

  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setEmployeeId(employees[0]?.id || '');
    setLeaveType('ANNUAL');
    setStartDate(today);
    setEndDate(today);
    setStatus('APPROVED');
    setNotes('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!employeeId) {
      setErrorMessage('Please select a pharmacist.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Please specify both start and end dates.');
      return;
    }
    if (startDate > endDate) {
      setErrorMessage('Start date cannot be after end date.');
      return;
    }

    setIsSaving(true);
    try {
      await dutySchedulerService.createLeaveRecord({
        employeeId,
        leaveType,
        startDate,
        endDate,
        status,
        notes
      });
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating leave record:', err);
      setErrorMessage(err.message || 'Failed to record leave.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: DutySchedulerLeaveStatus) => {
    try {
      await dutySchedulerService.updateLeaveStatus(id, newStatus);
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleDeleteLeave = async (id: string) => {
    if (!confirm('Are you sure you want to remove this leave record?')) return;
    try {
      await dutySchedulerService.deleteLeaveRecord(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting leave record:', err);
      alert('Failed to delete leave record');
    }
  };

  const filteredLeaves = statusFilter === 'ALL'
    ? leaves
    : leaves.filter(l => l.status === statusFilter);

  const approvedCount = leaves.filter(l => l.status === 'APPROVED').length;
  const pendingCount = leaves.filter(l => l.status === 'PENDING').length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Interim Leave Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage approved leave records strictly enforced by the scheduling engine.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-dark transition-all shadow-sm font-medium hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          <span>Record Leave</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{leaves.length}</div>
            <div className="text-xs text-slate-500">Total Leave Records</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{approvedCount}</div>
            <div className="text-xs text-slate-500">Approved (Hard Constraints)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{pendingCount}</div>
            <div className="text-xs text-slate-500">Pending Review</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <Filter className="h-4 w-4 text-slate-400 ml-1" />
        <span className="text-xs font-semibold text-slate-600">Filter Status:</span>
        <div className="flex gap-1.5 overflow-x-auto">
          {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-brand text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No leave records found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Pharmacist</th>
                  <th className="px-5 py-3">Leave Type</th>
                  <th className="px-5 py-3">Start Date</th>
                  <th className="px-5 py-3">End Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeaves.map(leave => (
                  <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {getEmployeeName(leave.employeeId)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {leave.leaveType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{leave.startDate}</td>
                    <td className="px-5 py-3.5 text-slate-600">{leave.endDate}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        leave.status === 'APPROVED' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : leave.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                      {leave.notes || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      {leave.status === 'PENDING' && (
                        <button
                          onClick={() => handleStatusChange(leave.id, 'APPROVED')}
                          title="Approve Leave"
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {leave.status === 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(leave.id, 'REJECTED')}
                          title="Reject / Revoke"
                          className="p-1 rounded text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteLeave(leave.id)}
                        title="Delete Record"
                        className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">Record Pharmacist Leave</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Pharmacist <span className="text-red-500">*</span>
                </label>
                <select
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                >
                  <option value="">Select Pharmacist</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_number || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Leave Type
                  </label>
                  <select
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="ANNUAL">Annual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="EMERGENCY">Emergency Leave</option>
                    <option value="UNPAID">Unpaid Leave</option>
                    <option value="OFFICIAL">Official Duty / Exam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as DutySchedulerLeaveStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="APPROVED">APPROVED (Hard Constraint)</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Notes / Reason
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes or reason for leave..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
