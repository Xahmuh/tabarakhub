import { supabaseClient } from '../lib/supabase';
import { generateUUID } from '../utils/uuid';

export const hrService = {
  create: async (request: any) => {
    try {
      const payload = {
        ref_num: request.refNum,
        employee_name: request.employeeName,
        cpr: request.cpr,
        type: request.type || (request.leaveType ? 'Vacation Request' : 'Document'),
        doc_types: request.docTypes,
        doc_reason: request.docReason,
        req_date: request.reqDate,
        delivery_method: request.deliveryMethod,
        status: 'Pending',
        email: request.email,
        passport: request.passport,
        passport_name: request.passportName,
        license: request.license,
        sponsor: request.sponsor,
        join_date: request.joinDate,
        salary: request.salary,
        other_doc_type: request.otherDocType,
        leave_type: request.leaveType,
        holiday_from: request.holidayFrom,
        holiday_to: request.holidayTo,
        days_count: request.daysCount,
        flight_out: request.flightOut,
        flight_return: request.flightReturn,
        job_title: request.jobTitle,
        department: request.department,
        location: request.location,
        mobile: request.mobile,
        notes: request.notes,
        last_vacation_date: request.lastVacationDate
      };
      const { data, error } = await supabaseClient.from('hr_requests').insert([payload]).select().single();
      if (error) throw error;
      return data;
    } catch (e) {
      const offline = JSON.parse(localStorage.getItem('tabarak_hr_requests') || '[]');
      const newRequest = { ...request, id: generateUUID(), timestamp: new Date().toISOString(), status: 'Pending' };
      offline.push(newRequest);
      localStorage.setItem('tabarak_hr_requests', JSON.stringify(offline));
      return newRequest;
    }
  },
  list: async () => {
    try {
      const { data, error } = await supabaseClient.from('hr_requests').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        id: r.id,
        refNum: r.ref_num,
        employeeName: r.employee_name,
        cpr: r.cpr,
        type: r.type,
        docTypes: r.doc_types || [],
        docReason: r.doc_reason,
        reqDate: r.req_date,
        deliveryMethod: r.delivery_method,
        status: r.status,
        timestamp: r.timestamp,
        email: r.email,
        passport: r.passport,
        passportName: r.passport_name,
        license: r.license,
        sponsor: r.sponsor,
        joinDate: r.join_date,
        salary: r.salary,
        otherDocType: r.other_doc_type,
        leaveType: r.leave_type,
        holidayFrom: r.holiday_from,
        holidayTo: r.holiday_to,
        daysCount: r.days_count,
        flightOut: r.flight_out,
        flightReturn: r.flight_return,
        jobTitle: r.job_title,
        department: r.department,
        location: r.location,
        mobile: r.mobile,
        notes: r.notes,
        lastVacationDate: r.last_vacation_date
      }));
    } catch (e) {
      const offline = JSON.parse(localStorage.getItem('tabarak_hr_requests') || '[]');
      return offline.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  },
  updateStatus: async (id: string, status: string) => {
    try {
      const { error } = await supabaseClient.from('hr_requests').update({ status }).or(`id.eq.${id},ref_num.eq.${id}`);
      if (error) throw error;
    } catch (e) {
      const offline = JSON.parse(localStorage.getItem('tabarak_hr_requests') || '[]');
      const idx = offline.findIndex((r: any) => r.id === id || r.refNum === id);
      if (idx >= 0) {
        offline[idx].status = status;
        localStorage.setItem('tabarak_hr_requests', JSON.stringify(offline));
      }
    }
  }
};
