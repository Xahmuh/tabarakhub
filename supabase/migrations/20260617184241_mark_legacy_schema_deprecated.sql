-- Project-wide cleanup audit: comments-only deprecation markers.
-- No drops, deletes, rewrites, grants, policy changes, or data changes.
-- Do not apply remotely without explicit operator approval.

comment on column public.delivery_orders.order_value is
'Deprecated legacy duplicate. Use public.delivery_orders.value_bhd for new reporting and clean views. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.payment_method is
'Deprecated legacy duplicate. Use public.delivery_orders.payment_type for new reporting and clean views. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.order_type is
'Deprecated legacy duplicate. Use public.delivery_orders.order_kind for new reporting and clean views. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.business_date is
'Deprecated legacy duplicate. Use public.delivery_orders.order_date for new reporting and clean views. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.driver_name is
'Deprecated legacy driver-name snapshot for clean reporting. Prefer joining public.delivery_drivers.name when driver_id is available. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.transfer_time is
'Deprecated legacy timing field for clean reporting. Prefer lifecycle timestamps and transfer branch fields. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.is_posted is
'Deprecated legacy posting flag for clean reporting. Prefer lifecycle/status fields. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.created_by_branch_id is
'Deprecated legacy branch actor trace field. Prefer current actor/profile traceability fields. Keep until explicit drop-readiness approval.';

comment on column public.delivery_orders.updated_by_branch_id is
'Deprecated legacy branch actor trace field. Prefer current actor/profile traceability fields. Keep until explicit drop-readiness approval.';

comment on column public.feedback_responses.ops_1 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.ops_2 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.ops_3 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.pur_1 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.pur_2 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.pur_3 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.hr_1 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.hr_2 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.hr_3 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.it_1 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.it_2 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';

comment on column public.feedback_responses.it_3 is
'Deprecated legacy fixed-score compatibility column. Prefer ratings/overall_score based reporting. Keep until feedback QA and drop-readiness approval.';
