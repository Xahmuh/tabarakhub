import { supabaseClient } from '../lib/supabaseClient';
import { 
  PharmacistSchedulingProfile, 
  DutySchedule, 
  DutyScheduleAssignment,
  DutySchedulerLeaveRecord,
  DutySchedulerLeaveStatus,
  PharmacistRollingState,
  DutyScheduleConflict,
  BranchShiftType,
  DutyScheduleChange,
  DutySchedulerSettings,
  BranchZone,
  BranchArea
} from '../types';
import { getCalendarDatesInRange } from './schedulingEngine';

export const dutySchedulerService = {
  
  // ==========================================
  // ==========================================
  // Leave Records (Union of Annual Leave Requests + Interim Sick/Other)
  // ==========================================

  async getApprovedLeaveForEmployee(employeeId: string, startDate: string, endDate: string): Promise<DutySchedulerLeaveRecord[]> {
    // 1. Fetch approved annual leave requests
    const annualPromise = supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'APPROVED')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    // 2. Fetch approved sick/other leaves from interim table
    const interimPromise = supabaseClient
      .from('duty_scheduler_leave_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'APPROVED')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    const [annualRes, interimRes] = await Promise.all([annualPromise, interimPromise]);

    if (annualRes.error) {
      console.error('Error fetching approved annual leave:', annualRes.error);
      throw annualRes.error;
    }
    if (interimRes.error) {
      console.error('Error fetching interim leave:', interimRes.error);
      throw interimRes.error;
    }

    const annualRecords: DutySchedulerLeaveRecord[] = (annualRes.data || []).map((row: any) => ({
      id: row.id,
      employeeId: row.employee_id,
      leaveType: 'ANNUAL',
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      notes: row.request_comments,
      createdBy: row.decided_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const interimRecords: DutySchedulerLeaveRecord[] = (interimRes.data || []).map(mapLeaveRecordFromDB);

    const seenIds = new Set<string>();
    const unionRecords: DutySchedulerLeaveRecord[] = [];
    for (const r of [...annualRecords, ...interimRecords]) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        unionRecords.push(r);
      }
    }

    return unionRecords;
  },

  async getAllLeaveRecords(options?: { employeeId?: string, status?: DutySchedulerLeaveStatus }): Promise<DutySchedulerLeaveRecord[]> {
    let annualQuery = supabaseClient.from('annual_leave_requests').select('*').order('start_date', { ascending: false });
    let interimQuery = supabaseClient.from('duty_scheduler_leave_records').select('*').order('start_date', { ascending: false });

    if (options?.employeeId) {
      annualQuery = annualQuery.eq('employee_id', options.employeeId);
      interimQuery = interimQuery.eq('employee_id', options.employeeId);
    }
    if (options?.status) {
      annualQuery = annualQuery.eq('status', options.status);
      interimQuery = interimQuery.eq('status', options.status);
    }

    const [annualRes, interimRes] = await Promise.all([annualQuery, interimQuery]);
    if (annualRes.error) throw annualRes.error;
    if (interimRes.error) throw interimRes.error;

    const annualRecords: DutySchedulerLeaveRecord[] = (annualRes.data || []).map((row: any) => ({
      id: row.id,
      employeeId: row.employee_id,
      leaveType: 'ANNUAL',
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      notes: row.request_comments,
      createdBy: row.decided_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const interimRecords: DutySchedulerLeaveRecord[] = (interimRes.data || []).map(mapLeaveRecordFromDB);

    const seenIds = new Set<string>();
    const unionRecords: DutySchedulerLeaveRecord[] = [];
    for (const r of [...annualRecords, ...interimRecords]) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        unionRecords.push(r);
      }
    }

    return unionRecords;
  },

  async createLeaveRecord(record: Partial<DutySchedulerLeaveRecord>): Promise<DutySchedulerLeaveRecord> {
    if (record.leaveType?.toUpperCase() === 'ANNUAL') {
      const s = new Date(record.startDate! + 'T00:00:00Z').getTime();
      const e = new Date(record.endDate! + 'T00:00:00Z').getTime();
      const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;

      const { data, error } = await supabaseClient
        .from('annual_leave_requests')
        .insert({
          employee_id: record.employeeId,
          start_date: record.startDate,
          end_date: record.endDate,
          requested_days: days,
          status: record.status || 'APPROVED',
          request_comments: record.notes || null,
          requested_at: new Date().toISOString(),
          decided_at: record.status === 'APPROVED' ? new Date().toISOString() : null,
          decision_comments: record.status === 'APPROVED' ? 'Created via Duty Scheduler' : null
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        employeeId: data.employee_id,
        leaveType: 'ANNUAL',
        startDate: data.start_date,
        endDate: data.end_date,
        status: data.status,
        notes: data.request_comments,
        createdBy: data.decided_by_user_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    const { data, error } = await supabaseClient
      .from('duty_scheduler_leave_records')
      .insert(mapLeaveRecordToDB(record))
      .select()
      .single();
      
    if (error) throw error;
    return mapLeaveRecordFromDB(data);
  },

  async createLeaveRecords(records: Partial<DutySchedulerLeaveRecord>[]): Promise<DutySchedulerLeaveRecord[]> {
    if (!records || records.length === 0) return [];
    const results: DutySchedulerLeaveRecord[] = [];
    for (const r of records) {
      const saved = await this.createLeaveRecord(r);
      results.push(saved);
    }
    return results;
  },
  
  async updateLeaveStatus(id: string, status: DutySchedulerLeaveStatus): Promise<void> {
    // Try updating annual_leave_requests first
    const { data: ann } = await supabaseClient
      .from('annual_leave_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (ann && ann.length > 0) return;

    // Otherwise update duty_scheduler_leave_records
    const { error } = await supabaseClient
      .from('duty_scheduler_leave_records')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
      
    if (error) throw error;
  },

  async deleteLeaveRecord(id: string): Promise<void> {
    await supabaseClient.from('annual_leave_requests').delete().eq('id', id);
    await supabaseClient.from('duty_scheduler_leave_records').delete().eq('id', id);
  },

  // ==========================================
  // Pharmacist Scheduling Profiles
  // ==========================================

  async getProfiles(): Promise<PharmacistSchedulingProfile[]> {
    const [profilesRes, zonesRes] = await Promise.all([
      supabaseClient
        .from('pharmacist_scheduling_profiles')
        .select(`
          *,
          allowed_branches:pharmacist_allowed_branches(branch_id),
          allowed_shift_types:pharmacist_allowed_shift_types(shift_type_code)
        `)
        .order('created_at', { ascending: false }),
      supabaseClient.from('branch_zones').select('id, name')
    ]);

    if (profilesRes.error) throw profilesRes.error;
    const zoneNameMap = new Map((zonesRes.data || []).map(z => [z.id, z.name]));

    return (profilesRes.data || []).map(row => ({
      ...mapProfileFromDB(row),
      zoneName: row.zone_id ? zoneNameMap.get(row.zone_id) : undefined,
      secondaryZoneName: row.secondary_zone_id ? zoneNameMap.get(row.secondary_zone_id) : undefined,
      allowedBranchIds: row.allowed_branches?.map((ab: any) => ab.branch_id) || [],
      allowedShiftTypes: row.allowed_shift_types?.map((st: any) => st.shift_type_code) || []
    }));
  },

  async upsertProfile(profile: Partial<PharmacistSchedulingProfile>, allowedBranchIds: string[], allowedShiftTypes: string[]): Promise<PharmacistSchedulingProfile> {
    // 1. Upsert profile
    const { data: profileData, error: profileError } = await supabaseClient
      .from('pharmacist_scheduling_profiles')
      .upsert(mapProfileToDB(profile))
      .select()
      .single();

    if (profileError) throw profileError;

    const profileId = profileData.id;

    // 2. Sync allowed branches
    await supabaseClient.from('pharmacist_allowed_branches').delete().eq('profile_id', profileId);
    if (allowedBranchIds.length > 0) {
      await supabaseClient.from('pharmacist_allowed_branches').insert(
        allowedBranchIds.map(branchId => ({ profile_id: profileId, branch_id: branchId }))
      );
    }

    // 3. Sync allowed shift types
    await supabaseClient.from('pharmacist_allowed_shift_types').delete().eq('profile_id', profileId);
    if (allowedShiftTypes.length > 0) {
      await supabaseClient.from('pharmacist_allowed_shift_types').insert(
        allowedShiftTypes.map(code => ({ profile_id: profileId, shift_type_code: code }))
      );
    }

    return mapProfileFromDB(profileData);
  },

  async deleteProfile(profileId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('pharmacist_scheduling_profiles')
      .delete()
      .eq('id', profileId);
    if (error) throw error;
  },

  // ==========================================
  // Schedules
  // ==========================================

  async getSchedules(): Promise<DutySchedule[]> {
    const { data, error } = await supabaseClient
      .from('duty_schedules')
      .select('*')
      .order('period_start', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapScheduleFromDB);
  },

  async getScheduleDetails(scheduleId: string): Promise<{
    schedule: DutySchedule;
    assignments: DutyScheduleAssignment[];
    conflicts: DutyScheduleConflict[];
  }> {
    const [schedRes, assignRes, confRes] = await Promise.all([
      supabaseClient.from('duty_schedules').select('*').eq('id', scheduleId).single(),
      supabaseClient.from('duty_schedule_assignments').select('*').eq('schedule_id', scheduleId),
      supabaseClient.from('duty_schedule_conflicts').select('*').eq('schedule_id', scheduleId)
    ]);

    if (schedRes.error) throw schedRes.error;
    if (assignRes.error) throw assignRes.error;
    if (confRes.error) throw confRes.error;

    return {
      schedule: mapScheduleFromDB(schedRes.data),
      assignments: (assignRes.data || []).map(mapAssignmentFromDB),
      conflicts: (confRes.data || []).map(mapConflictFromDB)
    };
  },

  async createDraftSchedule(schedule: Partial<DutySchedule>): Promise<DutySchedule> {
    const { data, error } = await supabaseClient
      .from('duty_schedules')
      .insert({
        name: schedule.name || null,
        zone_id: schedule.zoneId || null,
        period_start: schedule.periodStart,
        period_end: schedule.periodEnd,
        status: schedule.status || 'DRAFT',
        version: 1
      })
      .select()
      .single();

    if (error) throw error;
    return mapScheduleFromDB(data);
  },
  
  async updateScheduleStatus(scheduleId: string, status: DutySchedule['status']): Promise<void> {
    const { error } = await supabaseClient
      .from('duty_schedules')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', scheduleId);
    if (error) throw error;
  },

  async saveScheduleAssignments(
    scheduleId: string, 
    assignments: Partial<DutyScheduleAssignment>[], 
    conflicts: Partial<DutyScheduleConflict>[],
    rollingStates?: Partial<PharmacistRollingState>[]
  ): Promise<void> {
    // Delete non-locked assignments first to allow re-generation
    await supabaseClient
      .from('duty_schedule_assignments')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('is_locked', false);

    // Delete existing conflicts
    await supabaseClient
      .from('duty_schedule_conflicts')
      .delete()
      .eq('schedule_id', scheduleId);

    if (assignments.length > 0) {
      const dbAssignments = assignments.map(a => ({
        id: a.id,
        schedule_id: scheduleId,
        employee_id: a.employeeId,
        branch_id: a.branchId,
        date: a.date,
        shift_code: a.shiftCode,
        is_locked: a.isLocked || false,
        is_relief: a.isRelief || false
      }));
      const { error: aErr } = await supabaseClient
        .from('duty_schedule_assignments')
        .upsert(dbAssignments, { onConflict: 'schedule_id,employee_id,date' });
      if (aErr) throw aErr;
    }

    if (conflicts.length > 0) {
      const dbConflicts = conflicts.map(c => ({
        schedule_id: scheduleId,
        employee_id: c.employeeId || null,
        branch_id: c.branchId || null,
        date: c.date,
        conflict_type: c.conflictType,
        severity: c.severity,
        description: c.description
      }));
      const { error: cErr } = await supabaseClient
        .from('duty_schedule_conflicts')
        .insert(dbConflicts);
      if (cErr) throw cErr;
    }

    if (rollingStates && rollingStates.length > 0) {
      const dbRolling = rollingStates.map(rs => mapRollingStateToDB({
        ...rs,
        scheduleId: scheduleId
      }));
      await supabaseClient
        .from('pharmacist_rolling_state')
        .upsert(dbRolling, { onConflict: 'employee_id,schedule_id' });
    }
  },

  async createAssignment(assignment: Partial<DutyScheduleAssignment>): Promise<DutyScheduleAssignment> {
    const row: any = {
      schedule_id: assignment.scheduleId,
      employee_id: assignment.employeeId,
      branch_id: assignment.branchId,
      date: assignment.date,
      shift_code: assignment.shiftCode || 'AM',
      is_locked: assignment.isLocked ?? false,
      is_relief: assignment.isRelief ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabaseClient
      .from('duty_schedule_assignments')
      .upsert(row, { onConflict: 'schedule_id,employee_id,date' })
      .select()
      .single();
    if (error) throw error;
    return mapAssignmentFromDB(data);
  },

  async updateAssignment(id: string, updates: Partial<DutyScheduleAssignment>): Promise<DutyScheduleAssignment> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (updates.shiftCode !== undefined) updateData.shift_code = updates.shiftCode;
    if (updates.branchId !== undefined) updateData.branch_id = updates.branchId;
    if (updates.isLocked !== undefined) updateData.is_locked = updates.isLocked;
    if (updates.isRelief !== undefined) updateData.is_relief = updates.isRelief;

    const { data, error } = await supabaseClient
      .from('duty_schedule_assignments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapAssignmentFromDB(data);
  },

  async updateAssignmentWithAudit(
    id: string, 
    updates: Partial<DutyScheduleAssignment>, 
    actingUserId?: string, 
    reason?: string
  ): Promise<DutyScheduleAssignment> {
    // 1. Fetch current assignment for audit old_value
    const { data: current } = await supabaseClient
      .from('duty_schedule_assignments')
      .select('*')
      .eq('id', id)
      .single();

    const updated = await this.updateAssignment(id, updates);

    // 2. Insert audit change record (Spec §25)
    if (current) {
      await this.logScheduleChange({
        scheduleId: current.schedule_id,
        actingUserId: actingUserId,
        eventType: 'MANUAL_EDIT',
        targetId: id,
        oldValue: {
          shiftCode: current.shift_code,
          branchId: current.branch_id,
          isLocked: current.is_locked,
          isRelief: current.is_relief
        },
        newValue: {
          shiftCode: updated.shiftCode,
          branchId: updated.branchId,
          isLocked: updated.isLocked,
          isRelief: updated.isRelief
        },
        reason: reason || 'Manual schedule adjustment'
      });
    }

    return updated;
  },

  async toggleAssignmentLock(id: string, isLocked: boolean, actingUserId?: string): Promise<void> {
    const { data } = await supabaseClient
      .from('duty_schedule_assignments')
      .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (data) {
      await this.logScheduleChange({
        scheduleId: data.schedule_id,
        actingUserId: actingUserId,
        eventType: isLocked ? 'LOCK_ASSIGNMENT' : 'UNLOCK_ASSIGNMENT',
        targetId: id,
        oldValue: { isLocked: !isLocked },
        newValue: { isLocked },
        reason: isLocked ? 'Assignment locked' : 'Assignment unlocked'
      });
    }
  },

  async batchUpdateLocks(assignmentIds: string[], isLocked: boolean, scheduleId: string, actingUserId?: string): Promise<void> {
    if (!assignmentIds.length) return;
    const { error } = await supabaseClient
      .from('duty_schedule_assignments')
      .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
      .in('id', assignmentIds);
    if (error) throw error;

    await this.logScheduleChange({
      scheduleId,
      actingUserId,
      eventType: isLocked ? 'BATCH_LOCK' : 'BATCH_UNLOCK',
      targetId: `${assignmentIds.length} assignments`,
      newValue: { count: assignmentIds.length, isLocked },
      reason: isLocked ? 'Batch locked assignments' : 'Batch unlocked assignments'
    });
  },

  /**
   * Auto-Fills all unfilled (pending) shift slots in a schedule to guarantee zero gaps.
   */
  async autoFillPendingShifts(
    scheduleId: string, 
    actingUserId?: string
  ): Promise<{ filledCount: number; createdAssignments: DutyScheduleAssignment[] }> {
    // 1. Fetch schedule
    const { data: schedule, error: sErr } = await supabaseClient
      .from('duty_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
    if (sErr || !schedule) throw new Error('Schedule not found');

    // 2. Fetch existing assignments
    const { data: assignmentsData, error: aErr } = await supabaseClient
      .from('duty_schedule_assignments')
      .select('*')
      .eq('schedule_id', scheduleId);
    if (aErr) throw aErr;

    // 3. Fetch active profiles and active branches
    const { data: profilesData } = await supabaseClient
      .from('pharmacist_scheduling_profiles')
      .select('*')
      .eq('is_active', true);
    const profiles = (profilesData || []).map(mapProfileFromDB);

    const { data: branchesData } = await supabaseClient.from('branches').select('*').eq('is_active', true);
    const branches = branchesData || [];

    // Filter branches if schedule is zone-scoped
    let targetBranches = branches;
    if (schedule.zone_id) {
      const { data: zone } = await supabaseClient
        .from('branch_zones')
        .select('*')
        .eq('id', schedule.zone_id)
        .single();
      if (zone?.branch_ids && Array.isArray(zone.branch_ids) && zone.branch_ids.length > 0) {
        targetBranches = branches.filter((b: any) => zone.branch_ids.includes(b.id));
      }
    }

    // 4. Fetch shift types
    const { data: shiftTypesData } = await supabaseClient
      .from('branch_shift_types')
      .select('*')
      .eq('is_active', true);
    const shiftTypes = shiftTypesData || [];

    // 5. Fetch leaves overlapping period (union of Annual Leave Requests + Interim Sick/Other)
    const [annualLeavesRes, interimLeavesRes] = await Promise.all([
      supabaseClient
        .from('annual_leave_requests')
        .select('*')
        .eq('status', 'APPROVED')
        .lte('start_date', schedule.period_end)
        .gte('end_date', schedule.period_start),
      supabaseClient
        .from('duty_scheduler_leave_records')
        .select('*')
        .eq('status', 'APPROVED')
        .lte('start_date', schedule.period_end)
        .gte('end_date', schedule.period_start)
    ]);
    const annualMapped = (annualLeavesRes.data || []).map((r: any) => ({
      id: r.id,
      employee_id: r.employee_id,
      employeeId: r.employee_id,
      leave_type: 'ANNUAL',
      leaveType: 'ANNUAL',
      start_date: r.start_date,
      startDate: r.start_date,
      end_date: r.end_date,
      endDate: r.end_date,
      status: r.status
    }));
    const interimMapped = (interimLeavesRes.data || []).map((r: any) => ({
      ...r,
      employeeId: r.employee_id,
      leaveType: r.leave_type,
      startDate: r.start_date,
      endDate: r.end_date
    }));
    const leaves = [...annualMapped, ...interimMapped];

    // Map existing assignments: [date][branchId][shiftCode] = count
    const assignmentsByDateBranchShift = new Map<string, number>();
    const workingPharmacistsByDate = new Map<string, Set<string>>();
    const totalAssignmentsPerPharmacist = new Map<string, number>();

    for (const a of assignmentsData || []) {
      const key = `${a.date}_${a.branch_id}_${a.shift_code.toUpperCase()}`;
      assignmentsByDateBranchShift.set(key, (assignmentsByDateBranchShift.get(key) || 0) + 1);

      if (!workingPharmacistsByDate.has(a.date)) {
        workingPharmacistsByDate.set(a.date, new Set());
      }
      workingPharmacistsByDate.get(a.date)!.add(a.employee_id);

      totalAssignmentsPerPharmacist.set(
        a.employee_id,
        (totalAssignmentsPerPharmacist.get(a.employee_id) || 0) + 1
      );
    }

    // Generate dates
    const dates = getCalendarDatesInRange(schedule.period_start, schedule.period_end);

    // Find all unfilled slots
    const createdAssignments: DutyScheduleAssignment[] = [];
    const newAssignmentRows: any[] = [];

    for (const dateStr of dates) {
      const workingToday = workingPharmacistsByDate.get(dateStr) || new Set<string>();

      for (const branch of targetBranches) {
        // Determine shifts required for this branch
        const branchShifts = shiftTypes.filter((st: any) => st.branch_id === branch.id);
        const effectiveShifts = branchShifts.length > 0 ? branchShifts : [
          { code: 'AM', staff_required: 1 },
          { code: 'PM', staff_required: 1 }
        ];

        for (const shift of effectiveShifts) {
          const shiftCode = shift.code.toUpperCase();
          const requiredCount = shift.staff_required || 1;
          const key = `${dateStr}_${branch.id}_${shiftCode}`;
          const currentCount = assignmentsByDateBranchShift.get(key) || 0;
          const needed = requiredCount - currentCount;

          for (let slot = 0; slot < needed; slot++) {
            // Find best available candidate among active profiles
            const candidates = profiles.filter(p => {
              if (workingToday.has(p.employeeId)) return false;
              const onLeave = leaves.some((l: any) => {
                const lEmp = String(l.employee_id || l.employeeId).trim().toLowerCase();
                if (lEmp !== p.employeeId.trim().toLowerCase()) return false;
                const status = String(l.status || 'APPROVED').trim().toUpperCase();
                if (status === 'REJECTED' || status === 'CANCELLED') return false;
                return l.start_date <= dateStr && l.end_date >= dateStr;
              });
              return !onLeave;
            });

            if (candidates.length > 0) {
              // Rank: relief first, primary branch second, lowest assignments third
              candidates.sort((a, b) => {
                if (a.roleType === 'RELIEF' && b.roleType !== 'RELIEF') return -1;
                if (b.roleType === 'RELIEF' && a.roleType !== 'RELIEF') return 1;
                if (a.primaryBranchId === branch.id && b.primaryBranchId !== branch.id) return -1;
                if (b.primaryBranchId === branch.id && a.primaryBranchId !== branch.id) return 1;
                const countA = totalAssignmentsPerPharmacist.get(a.employeeId) || 0;
                const countB = totalAssignmentsPerPharmacist.get(b.employeeId) || 0;
                return countA - countB;
              });

              const chosen = candidates[0];
              workingToday.add(chosen.employeeId);
              workingPharmacistsByDate.set(dateStr, workingToday);
              assignmentsByDateBranchShift.set(key, (assignmentsByDateBranchShift.get(key) || 0) + 1);
              totalAssignmentsPerPharmacist.set(
                chosen.employeeId,
                (totalAssignmentsPerPharmacist.get(chosen.employeeId) || 0) + 1
              );

              newAssignmentRows.push({
                schedule_id: scheduleId,
                employee_id: chosen.employeeId,
                branch_id: branch.id,
                date: dateStr,
                shift_code: shiftCode,
                is_locked: false,
                is_relief: chosen.roleType === 'RELIEF',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    if (newAssignmentRows.length > 0) {
      const { data: inserted, error: iErr } = await supabaseClient
        .from('duty_schedule_assignments')
        .upsert(newAssignmentRows, { onConflict: 'schedule_id,employee_id,date' })
        .select();
      if (iErr) throw iErr;
      if (inserted) {
        createdAssignments.push(...inserted.map(mapAssignmentFromDB));
      }

      // Clean up UNSATISFIABLE_COVERAGE conflicts for this schedule that are now covered
      await supabaseClient
        .from('duty_schedule_conflicts')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('conflict_type', 'UNSATISFIABLE_COVERAGE');

      // Log schedule change audit
      await this.logScheduleChange({
        scheduleId,
        actingUserId,
        eventType: 'AUTO_FILL_UNFILLED',
        newValue: { filledCount: newAssignmentRows.length },
        reason: `Auto-filled ${newAssignmentRows.length} unfilled shifts to enforce zero-gap coverage`
      });
    }

    return { filledCount: newAssignmentRows.length, createdAssignments };
  },

  async deleteSchedule(scheduleId: string): Promise<void> {
    const { error } = await supabaseClient.from('duty_schedules').delete().eq('id', scheduleId);
    if (error) throw error;
  },

  // ==========================================
  // Rolling State Continuity (Spec §16.1)
  // ==========================================

  async getLatestRollingState(employeeIds?: string[]): Promise<PharmacistRollingState[]> {
    let query = supabaseClient
      .from('pharmacist_rolling_state')
      .select('*')
      .order('created_at', { ascending: false });

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('employee_id', employeeIds);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query pharmacist_rolling_state:', error.message);
      return [];
    }

    // Keep only the latest record per employee_id
    const seen = new Set<string>();
    const latest: PharmacistRollingState[] = [];
    for (const row of data || []) {
      if (!seen.has(row.employee_id)) {
        seen.add(row.employee_id);
        latest.push(mapRollingStateFromDB(row));
      }
    }
    return latest;
  },

  // ==========================================
  // Scheduling Zones
  // ==========================================

  async getSchedulingZones(): Promise<BranchZone[]> {
    const [{ data: zones, error: zoneError }, { data: members, error: memberError }] = await Promise.all([
      supabaseClient.from('branch_zones').select('*').order('code', { ascending: true }),
      supabaseClient.from('branch_zone_members').select('zone_id, branch_id')
    ]);
    if (zoneError) throw zoneError;
    if (memberError) throw memberError;

    const branchIdsByZone = new Map<string, string[]>();
    (members || []).forEach(member => {
      const list = branchIdsByZone.get(member.zone_id) || [];
      list.push(member.branch_id);
      branchIdsByZone.set(member.zone_id, list);
    });

    return (zones || []).map(zone => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      supervisorUserId: zone.supervisor_user_id,
      notes: zone.notes || undefined,
      isActive: zone.is_active,
      branchIds: branchIdsByZone.get(zone.id) || [],
      createdAt: zone.created_at,
      updatedAt: zone.updated_at
    }));
  },

  async upsertSchedulingZone(zone: Partial<BranchZone>): Promise<BranchZone> {
    const code = zone.code?.trim().toUpperCase();
    if (!code) throw new Error('Zone code is required.');

    const payload: any = {
      code,
      name: zone.name?.trim(),
      notes: zone.notes?.trim() || null,
      is_active: zone.isActive ?? true,
      updated_at: new Date().toISOString()
    };
    if (zone.id) payload.id = zone.id;

    const { data, error } = await supabaseClient
      .from('branch_zones')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      supervisorUserId: data.supervisor_user_id,
      notes: data.notes || undefined,
      isActive: data.is_active,
      branchIds: zone.branchIds || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async deleteSchedulingZone(zoneId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('branch_zones')
      .delete()
      .eq('id', zoneId);
    if (error) throw error;
  },

  async assignBranchToZone(branchId: string, zoneId: string | null): Promise<void> {
    const { error: delError } = await supabaseClient
      .from('branch_zone_members')
      .delete()
      .eq('branch_id', branchId);
    if (delError) throw delError;

    if (zoneId) {
      const { error: insError } = await supabaseClient
        .from('branch_zone_members')
        .insert({ zone_id: zoneId, branch_id: branchId });
      if (insError) throw insError;
    }
  },

  async batchAssignBranchesToZone(zoneId: string, branchIds: string[]): Promise<void> {
    if (branchIds.length > 0) {
      await supabaseClient
        .from('branch_zone_members')
        .delete()
        .in('branch_id', branchIds);
    }
    if (zoneId && branchIds.length > 0) {
      const rows = branchIds.map(bId => ({ zone_id: zoneId, branch_id: bId }));
      const { error } = await supabaseClient
        .from('branch_zone_members')
        .insert(rows);
      if (error) throw error;
    }
  },

  // ==========================================
  // Geographic Areas (Regions)
  // ==========================================

  async getAreas(): Promise<BranchArea[]> {
    const { data, error } = await supabaseClient
      .from('regions')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching regions:', error.message);
      return [];
    }
    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      code: r.code,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async assignBranchToArea(branchId: string, regionId: string | null): Promise<void> {
    const { error } = await supabaseClient
      .from('branches')
      .update({ region_id: regionId })
      .eq('id', branchId);

    if (error) throw error;
  },

  // ==========================================
  // Branch Shift Configuration (Pharmacies Config)
  // ==========================================

  async getBranchShiftTypes(branchIds?: string[]): Promise<BranchShiftType[]> {
    let query = supabaseClient
      .from('branch_shift_types')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (branchIds && branchIds.length > 0) {
      query = query.in('branch_id', branchIds);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query branch_shift_types (fallback will be used):', error.message);
      return [];
    }
    return (data || []).map(mapBranchShiftTypeFromDB);
  },

  async saveBranchShiftTypes(branchId: string, shifts: Partial<BranchShiftType>[]): Promise<void> {
    const { error: delError } = await supabaseClient
      .from('branch_shift_types')
      .delete()
      .eq('branch_id', branchId);
    if (delError) throw delError;

    if (shifts.length > 0) {
      const rows = shifts.map(s => ({
        branch_id: branchId,
        code: s.code || 'AM',
        name: s.name || s.code || 'Shift',
        start_time: s.startTime || '08:00:00',
        end_time: s.endTime || '16:00:00',
        staff_required: s.staffRequired ?? 1,
        is_active: s.isActive ?? true,
        duration_hours: s.durationHours ?? 8.0,
        crosses_midnight: s.crossesMidnight ?? false
      }));

      const { error: insError } = await supabaseClient
        .from('branch_shift_types')
        .insert(rows);
      if (insError) throw insError;
    }
  },

  async setBranchShiftPreset(branchId: string, preset: '3_SHIFTS' | '2_SHIFTS' | '1_LONG_SHIFT'): Promise<void> {
    let shifts: Partial<BranchShiftType>[] = [];
    if (preset === '3_SHIFTS') {
      shifts = [
        { code: 'AM', name: 'Morning Shift', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1, durationHours: 8, crossesMidnight: false },
        { code: 'PM', name: 'Evening Shift', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1, durationHours: 8, crossesMidnight: false },
        { code: 'NIGHT', name: 'Night Shift', startTime: '00:00:00', endTime: '08:00:00', staffRequired: 1, durationHours: 8, crossesMidnight: false }
      ];
    } else if (preset === '2_SHIFTS') {
      shifts = [
        { code: 'AM', name: 'Morning Shift', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1, durationHours: 8, crossesMidnight: false },
        { code: 'PM', name: 'Evening Shift', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1, durationHours: 8, crossesMidnight: false }
      ];
    } else if (preset === '1_LONG_SHIFT') {
      shifts = [
        { code: 'FULL', name: 'Full Duty (Long Shift)', startTime: '09:00:00', endTime: '21:00:00', staffRequired: 1, durationHours: 12, crossesMidnight: false }
      ];
    }
    await dutySchedulerService.saveBranchShiftTypes(branchId, shifts);
  },

  // ==========================================
  // Schedule Versioning (Spec §23)
  // ==========================================

  async createScheduleVersion(scheduleId: string, reason?: string, userId?: string): Promise<DutySchedule> {
    const { data: current, error: getErr } = await supabaseClient
      .from('duty_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (getErr) throw getErr;

    const nextVersion = (current.version || 1) + 1;
    const { data, error } = await supabaseClient
      .from('duty_schedules')
      .update({
        version: nextVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) throw error;

    await this.logScheduleChange({
      scheduleId,
      actingUserId: userId,
      eventType: 'INCREMENT_VERSION',
      oldValue: { version: current.version },
      newValue: { version: nextVersion },
      reason: reason || 'Schedule regenerated / updated'
    });

    return mapScheduleFromDB(data);
  },

  // ==========================================
  // Audit Trail (Spec §25)
  // ==========================================

  async logScheduleChange(change: Partial<DutyScheduleChange>): Promise<void> {
    try {
      await supabaseClient.from('duty_schedule_changes').insert({
        schedule_id: change.scheduleId,
        acting_user_id: change.actingUserId || null,
        event_type: change.eventType,
        target_id: change.targetId || null,
        old_value: change.oldValue || null,
        new_value: change.newValue || null,
        reason: change.reason || null
      });
    } catch (err) {
      console.warn('Failed to insert duty_schedule_changes audit record:', err);
    }
  },

  async getScheduleChanges(scheduleId: string): Promise<DutyScheduleChange[]> {
    const { data, error } = await supabaseClient
      .from('duty_schedule_changes')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not query duty_schedule_changes:', error.message);
      return [];
    }
    return (data || []).map(mapScheduleChangeFromDB);
  },

  // ==========================================
  // Control Center Settings (Spec §26)
  // ==========================================

  async getDutySchedulerSettings(): Promise<DutySchedulerSettings> {
    const { data, error } = await supabaseClient
      .from('duty_scheduler_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }
    return mapSettingsFromDB(data);
  },

  async updateDutySchedulerSettings(settings: Partial<DutySchedulerSettings>, userId?: string): Promise<DutySchedulerSettings> {
    const current = await this.getDutySchedulerSettings();
    const currentWorkRestConfig = settings.defaultWorkRestConfig ?? current.defaultWorkRestConfig ?? {};
    const updatedWorkRestConfig = {
      ...currentWorkRestConfig,
      default_rest_days_per_period: settings.defaultRestDaysPerPeriod ?? current.defaultRestDaysPerPeriod ?? 4,
      global_max_consecutive_days: settings.globalMaxConsecutiveDays ?? current.globalMaxConsecutiveDays ?? 8
    };

    const payload: any = {
      default_minimum_rest_hours: settings.defaultMinimumRestHours ?? current.defaultMinimumRestHours,
      default_maximum_consecutive_working_days: settings.defaultMaximumConsecutiveWorkingDays ?? current.defaultMaximumConsecutiveWorkingDays,
      default_work_rest_mode: settings.defaultWorkRestMode ?? current.defaultWorkRestMode,
      default_work_rest_config: updatedWorkRestConfig,
      shift_weights: settings.shiftWeights ?? current.shiftWeights,
      weekend_days: settings.weekendDays ?? current.weekendDays,
      fairness_weight: settings.fairnessWeight ?? current.fairnessWeight,
      continuity_weight: settings.continuityWeight ?? current.continuityWeight,
      updated_by: userId || null,
      updated_at: new Date().toISOString()
    };

    if (current.id) {
      payload.id = current.id;
    }

    const { data, error } = await supabaseClient
      .from('duty_scheduler_settings')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapSettingsFromDB(data);
  },

  // ==========================================
  // Concurrent Editing Guard
  // ==========================================
  
  async acquireScheduleLock(scheduleId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabaseClient
      .from('duty_schedules')
      .update({ editing_user_id: userId, editing_started_at: new Date().toISOString() })
      .eq('id', scheduleId)
      // Only acquire if no one else has it, or if it's the same user
      .or(`editing_user_id.is.null,editing_user_id.eq.${userId}`)
      .select()
      .single();

    if (error || !data) {
      return false; // Failed to acquire lock (someone else has it)
    }
    return true;
  },

  async releaseScheduleLock(scheduleId: string, userId: string): Promise<void> {
    await supabaseClient
      .from('duty_schedules')
      .update({ editing_user_id: null, editing_started_at: null })
      .eq('id', scheduleId)
      .eq('editing_user_id', userId); // Only release if we own it
  }

};

// --- Mappers ---

function mapLeaveRecordFromDB(row: any): DutySchedulerLeaveRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLeaveRecordToDB(record: Partial<DutySchedulerLeaveRecord>): any {
  return {
    employee_id: record.employeeId,
    leave_type: record.leaveType,
    start_date: record.startDate,
    end_date: record.endDate,
    status: record.status || 'PENDING',
    notes: record.notes
  };
}

function mapProfileFromDB(row: any): PharmacistSchedulingProfile {
  const overrideVal = (row.max_consecutive_working_days_override !== undefined && row.max_consecutive_working_days_override !== null)
    ? row.max_consecutive_working_days_override
    : row.work_rest_config?.maxConsecutiveWorkingDaysOverride;

  return {
    id: row.id,
    employeeId: row.employee_id,
    roleType: row.role_type,
    primaryBranchId: row.primary_branch_id,
    zoneId: row.zone_id || undefined,
    secondaryZoneId: row.secondary_zone_id || undefined,
    secondaryZoneMaxDays: row.secondary_zone_max_days !== undefined && row.secondary_zone_max_days !== null ? Number(row.secondary_zone_max_days) : 0,
    workRestMode: row.work_rest_mode,
    workRestConfig: row.work_rest_config,
    patternStrictness: row.pattern_strictness,
    maximumConsecutiveWorkingDays: row.maximum_consecutive_working_days,
    maxConsecutiveWorkingDaysOverride: overrideVal !== undefined && overrideVal !== null ? Number(overrideVal) : null,
    minimumRestHours: row.minimum_rest_hours !== undefined && row.minimum_rest_hours !== null ? Number(row.minimum_rest_hours) : 11.0,
    weekendPreference: row.weekend_preference,
    isActive: row.is_active,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProfileToDB(profile: Partial<PharmacistSchedulingProfile>): any {
  // Store maxConsecutiveWorkingDaysOverride inside work_rest_config JSONB so it works reliably
  // across all database instances without failing PostgREST schema cache validation
  const updatedWorkRestConfig = {
    ...(profile.workRestConfig || {}),
    ...(profile.maxConsecutiveWorkingDaysOverride !== undefined ? { maxConsecutiveWorkingDaysOverride: profile.maxConsecutiveWorkingDaysOverride } : {})
  };

  return {
    id: profile.id, // For upsert
    employee_id: profile.employeeId,
    role_type: profile.roleType,
    primary_branch_id: profile.primaryBranchId,
    zone_id: profile.zoneId || null,
    secondary_zone_id: profile.secondaryZoneId || null,
    secondary_zone_max_days: profile.secondaryZoneMaxDays ?? 0,
    work_rest_mode: profile.workRestMode,
    work_rest_config: updatedWorkRestConfig,
    pattern_strictness: profile.patternStrictness,
    maximum_consecutive_working_days: profile.maximumConsecutiveWorkingDays,
    minimum_rest_hours: profile.minimumRestHours || 11.0,
    weekend_preference: profile.weekendPreference,
    is_active: profile.isActive,
    effective_from: profile.effectiveFrom,
    effective_to: profile.effectiveTo
  };
}

function mapScheduleFromDB(row: any): DutySchedule {
  return {
    id: row.id,
    name: row.name || undefined,
    zoneId: row.zone_id || undefined,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    version: row.version,
    editingUserId: row.editing_user_id,
    editingStartedAt: row.editing_started_at,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAssignmentFromDB(row: any): DutyScheduleAssignment {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    employeeId: row.employee_id,
    branchId: row.branch_id,
    date: row.date,
    shiftCode: row.shift_code,
    isLocked: row.is_locked,
    isRelief: row.is_relief,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapConflictFromDB(row: any): DutyScheduleConflict {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    employeeId: row.employee_id,
    branchId: row.branch_id,
    date: row.date,
    conflictType: row.conflict_type,
    severity: row.severity,
    description: row.description,
    createdAt: row.created_at
  };
}

const DEFAULT_SETTINGS: DutySchedulerSettings = {
  defaultMinimumRestHours: 11.0,
  defaultMaximumConsecutiveWorkingDays: 6,
  defaultWorkRestMode: 'DAYS_PER_WEEK',
  defaultWorkRestConfig: { target_days_per_week: 6, default_rest_days_per_period: 4 },
  defaultRestDaysPerPeriod: 4,
  globalMaxConsecutiveDays: 8,
  shiftWeights: { AM: 1.0, PM: 1.0, NIGHT: 1.25, FULL: 1.0, weekend_bonus: 0.25 },
  weekendDays: [5], // Friday
  fairnessWeight: 1.0,
  continuityWeight: 1.0,
  updatedAt: new Date().toISOString()
};

function mapRollingStateFromDB(row: any): PharmacistRollingState {
  return {
    id: row.id,
    employeeId: row.employee_id,
    scheduleId: row.schedule_id,
    consecutiveWorkingDays: row.current_consecutive_working_days ?? row.consecutive_working_days ?? 0,
    currentConsecutiveWorkingDays: row.current_consecutive_working_days ?? row.consecutive_working_days ?? 0,
    currentConsecutiveRestDays: row.current_consecutive_rest_days ?? 0,
    currentPatternCycleIndex: row.current_pattern_cycle_index ?? 0,
    lastShiftType: row.last_shift_type,
    lastBranchId: row.last_branch_id,
    lastShiftEndTime: row.last_shift_end_datetime ?? row.last_shift_end_time,
    lastShiftEndDatetime: row.last_shift_end_datetime ?? row.last_shift_end_time,
    daysSinceWeeklyRest: row.days_since_weekly_rest ?? 0,
    workloadScore: Number(row.total_workload_score ?? row.workload_score ?? 0),
    totalWorkloadScore: Number(row.total_workload_score ?? row.workload_score ?? 0),
    recentWorkloadScore: Number(row.recent_workload_score ?? 0),
    weekendAssignmentCount: row.weekend_assignment_count ?? 0,
    isOnActiveStreak: Boolean(row.is_on_active_streak ?? ((row.current_consecutive_working_days ?? row.consecutive_working_days ?? 0) > 0)),
    streakStartDate: row.streak_start_date || null,
    currentStreakTargetLength: row.current_streak_target_length !== undefined && row.current_streak_target_length !== null ? Number(row.current_streak_target_length) : null,
    createdAt: row.created_at
  };
}

function mapRollingStateToDB(state: Partial<PharmacistRollingState>): any {
  return {
    id: state.id,
    employee_id: state.employeeId,
    schedule_id: state.scheduleId,
    consecutive_working_days: state.currentConsecutiveWorkingDays ?? state.consecutiveWorkingDays ?? 0,
    current_consecutive_working_days: state.currentConsecutiveWorkingDays ?? state.consecutiveWorkingDays ?? 0,
    current_consecutive_rest_days: state.currentConsecutiveRestDays ?? 0,
    current_pattern_cycle_index: state.currentPatternCycleIndex ?? 0,
    last_shift_type: state.lastShiftType,
    last_branch_id: state.lastBranchId,
    last_shift_end_time: state.lastShiftEndDatetime ?? state.lastShiftEndTime,
    last_shift_end_datetime: state.lastShiftEndDatetime ?? state.lastShiftEndTime,
    days_since_weekly_rest: state.daysSinceWeeklyRest ?? 0,
    workload_score: state.totalWorkloadScore ?? state.workloadScore ?? 0,
    total_workload_score: state.totalWorkloadScore ?? state.workloadScore ?? 0,
    recent_workload_score: state.recentWorkloadScore ?? 0,
    weekend_assignment_count: state.weekendAssignmentCount ?? 0,
    is_on_active_streak: state.isOnActiveStreak ?? ((state.currentConsecutiveWorkingDays ?? state.consecutiveWorkingDays ?? 0) > 0),
    streak_start_date: state.streakStartDate || null,
    current_streak_target_length: state.currentStreakTargetLength || null
  };
}

function mapBranchShiftTypeFromDB(row: any): BranchShiftType {
  return {
    id: row.id,
    branchId: row.branch_id,
    code: row.shift_type_code || row.code || 'M',
    shiftTypeCode: row.shift_type_code || row.code || 'M',
    name: row.name || row.shift_type_code || 'Shift',
    startTime: row.start_time,
    endTime: row.end_time,
    crossesMidnight: row.crosses_midnight ?? false,
    durationHours: Number(row.duration_hours ?? 8),
    staffRequired: Number(row.staff_required ?? 1),
    isActive: row.is_active ?? true
  };
}

function mapScheduleChangeFromDB(row: any): DutyScheduleChange {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    actingUserId: row.acting_user_id,
    eventType: row.event_type,
    targetId: row.target_id,
    oldValue: row.old_value,
    newValue: row.new_value,
    reason: row.reason,
    createdAt: row.created_at
  };
}

function mapSettingsFromDB(row: any): DutySchedulerSettings {
  const workRestConfig = row.default_work_rest_config || { target_days_per_week: 6 };
  return {
    id: row.id,
    defaultMinimumRestHours: Number(row.default_minimum_rest_hours ?? 11.0),
    defaultMaximumConsecutiveWorkingDays: Number(row.default_maximum_consecutive_working_days ?? 6),
    defaultWorkRestMode: row.default_work_rest_mode || 'DAYS_PER_WEEK',
    defaultWorkRestConfig: workRestConfig,
    defaultRestDaysPerPeriod: Number(row.default_rest_days_per_period ?? workRestConfig.default_rest_days_per_period ?? 4),
    globalMaxConsecutiveDays: Number(row.global_max_consecutive_days ?? workRestConfig.global_max_consecutive_days ?? 8),
    shiftWeights: row.shift_weights || { AM: 1.0, PM: 1.0, NIGHT: 1.25, FULL: 1.0, weekend_bonus: 0.25 },
    weekendDays: Array.isArray(row.weekend_days) ? row.weekend_days : [5],
    fairnessWeight: Number(row.fairness_weight ?? 1.0),
    continuityWeight: Number(row.continuity_weight ?? 1.0),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
}
