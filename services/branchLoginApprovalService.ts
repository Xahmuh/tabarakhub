import { supabaseClient } from '../lib/supabaseClient';
import { BranchLoginApproval, BranchLoginApprovalDeviceInfo } from '../types';

const APPROVAL_SELECT = `
  id,
  user_id,
  branch_id,
  device_fingerprint_hash,
  device_label,
  browser_name,
  os_name,
  user_agent_hash,
  last_ip,
  status,
  requested_at,
  expires_at,
  approved_by,
  approved_at,
  rejected_by,
  rejected_at,
  rejection_reason,
  created_at,
  updated_at
`;

const PENDING_POLL_MS = 3000;

const isMissingOpenRequestRpc = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42883' || code === 'PGRST202' || message.includes('branch_login_approval_open_request');
};

const fallbackHash = (value: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
};

const sha256 = async (value: string) => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return fallbackHash(value);
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const detectBrowser = (ua: string) => {
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'Safari';
  return 'Browser';
};

const detectOs = (ua: string, platform: string) => {
  const source = `${ua} ${platform}`.toLowerCase();
  if (source.includes('windows')) return 'Windows';
  if (source.includes('mac')) return 'macOS';
  if (source.includes('iphone') || source.includes('ipad') || source.includes('ios')) return 'iOS';
  if (source.includes('android')) return 'Android';
  if (source.includes('linux')) return 'Linux';
  return 'Unknown OS';
};

export const collectBranchLoginDeviceInfo = async (): Promise<BranchLoginApprovalDeviceInfo> => {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const screenInfo = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown-screen';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown-timezone';
  const language = nav?.language || 'unknown-language';
  const platform = nav?.platform || 'unknown-platform';
  const userAgent = nav?.userAgent || 'unknown-user-agent';
  const browserName = detectBrowser(userAgent);
  const osName = detectOs(userAgent, platform);
  const fingerprintSource = [userAgent, platform, screenInfo, timezone, language].join('|');

  return {
    deviceFingerprintHash: await sha256(fingerprintSource),
    deviceLabel: `${browserName} on ${osName} (${screenInfo}, ${timezone})`,
    browserName,
    osName,
    userAgentHash: await sha256(userAgent)
  };
};

const mapApproval = (row: any): BranchLoginApproval => ({
  id: row.id,
  userId: row.user_id,
  userEmail: row.user_email ?? null,
  branchId: row.branch_id,
  branchCode: row.branch_code ?? null,
  branchName: row.branch_name ?? null,
  deviceFingerprintHash: row.device_fingerprint_hash ?? null,
  deviceLabel: row.device_label ?? null,
  browserName: row.browser_name ?? null,
  osName: row.os_name ?? null,
  userAgentHash: row.user_agent_hash ?? null,
  lastIp: row.last_ip ?? null,
  status: row.status,
  requestedAt: row.requested_at,
  expiresAt: row.expires_at,
  approvedBy: row.approved_by ?? null,
  approvedAt: row.approved_at ?? null,
  rejectedBy: row.rejected_by ?? null,
  rejectedAt: row.rejected_at ?? null,
  rejectionReason: row.rejection_reason ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const branchLoginApprovalService = {
  createBranchLoginApprovalRequest: async (input: {
    branchId: string;
    deviceInfo?: BranchLoginApprovalDeviceInfo;
  }): Promise<BranchLoginApproval> => {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      throw new Error('No authenticated Supabase session exists for login approval.');
    }

    const deviceInfo = input.deviceInfo || await collectBranchLoginDeviceInfo();
    await branchLoginApprovalService.expireOldBranchLoginApprovals();

    const { data: openedRequest, error: openRequestError } = await supabaseClient.rpc('branch_login_approval_open_request' as any, {
      p_target_branch_id: input.branchId,
      p_device_fingerprint_hash: deviceInfo.deviceFingerprintHash,
      p_device_label: deviceInfo.deviceLabel,
      p_browser_name: deviceInfo.browserName,
      p_os_name: deviceInfo.osName,
      p_user_agent_hash: deviceInfo.userAgentHash
    });

    if (!openRequestError && openedRequest) return mapApproval(openedRequest);
    if (openRequestError && !isMissingOpenRequestRpc(openRequestError)) throw openRequestError;

    const payload = {
      user_id: sessionData.session.user.id,
      branch_id: input.branchId,
      device_fingerprint_hash: deviceInfo.deviceFingerprintHash,
      device_label: deviceInfo.deviceLabel,
      browser_name: deviceInfo.browserName,
      os_name: deviceInfo.osName,
      user_agent_hash: deviceInfo.userAgentHash,
      status: 'pending'
    };

    const { data, error } = await supabaseClient
      .from('branch_login_approvals')
      .insert(payload)
      .select(APPROVAL_SELECT)
      .single();

    if (!error && data) return mapApproval(data);

    const { data: existing, error: existingError } = await supabaseClient
      .from('branch_login_approvals')
      .select(APPROVAL_SELECT)
      .eq('user_id', sessionData.session.user.id)
      .eq('branch_id', input.branchId)
      .eq('device_fingerprint_hash', deviceInfo.deviceFingerprintHash)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingError && existing) return mapApproval(existing);
    throw error || existingError || new Error('Could not create branch login approval request.');
  },

  getBranchLoginApprovalStatus: async (requestId: string): Promise<BranchLoginApproval> => {
    const { data, error } = await supabaseClient
      .from('branch_login_approvals')
      .select(APPROVAL_SELECT)
      .eq('id', requestId)
      .maybeSingle();

    if (error || !data) {
      throw error || new Error('Login approval request was not found.');
    }

    const approval = mapApproval(data);
    if (approval.status === 'pending' && new Date(approval.expiresAt).getTime() <= Date.now()) {
      await branchLoginApprovalService.expireOldBranchLoginApprovals();
      return { ...approval, status: 'expired' };
    }
    return approval;
  },

  subscribeToBranchLoginApproval: (
    requestId: string,
    onChange: (approval: BranchLoginApproval) => void,
    onError?: (error: unknown) => void
  ) => {
    let disposed = false;

    const poll = async () => {
      try {
        const approval = await branchLoginApprovalService.getBranchLoginApprovalStatus(requestId);
        if (!disposed) onChange(approval);
      } catch (error) {
        if (!disposed) onError?.(error);
      }
    };

    const interval = window.setInterval(poll, PENDING_POLL_MS);
    void poll();

    const channel = supabaseClient
      .channel(`branch-login-approval-${requestId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branch_login_approvals', filter: `id=eq.${requestId}` },
        payload => {
          if (!disposed && payload.new) onChange(mapApproval(payload.new));
        }
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' && !disposed) {
          void poll();
        }
      });

    return () => {
      disposed = true;
      window.clearInterval(interval);
      void supabaseClient.removeChannel(channel);
    };
  },

  listPendingBranchLoginApprovals: async (): Promise<BranchLoginApproval[]> => {
    await branchLoginApprovalService.expireOldBranchLoginApprovals();
    const { data, error } = await supabaseClient.rpc('branch_login_approval_list_pending' as any);
    if (error) throw error;
    return (data || []).map(mapApproval);
  },

  approveBranchLoginApproval: async (requestId: string): Promise<BranchLoginApproval> => {
    const { data, error } = await supabaseClient.rpc('branch_login_approval_approve' as any, {
      target_request_id: requestId
    });
    if (error) throw error;
    return mapApproval(data);
  },

  rejectBranchLoginApproval: async (requestId: string, reason?: string): Promise<BranchLoginApproval> => {
    const { data, error } = await supabaseClient.rpc('branch_login_approval_reject' as any, {
      target_request_id: requestId,
      reason: reason || null
    });
    if (error) throw error;
    return mapApproval(data);
  },

  cancelBranchLoginApproval: async (requestId: string): Promise<BranchLoginApproval> => {
    const { data, error } = await supabaseClient.rpc('branch_login_approval_cancel' as any, {
      target_request_id: requestId
    });
    if (error) throw error;
    return mapApproval(data);
  },

  expireOldBranchLoginApprovals: async (): Promise<number> => {
    const { data, error } = await supabaseClient.rpc('branch_login_approval_expire_old' as any);
    if (error) throw error;
    return Number(data || 0);
  }
};
