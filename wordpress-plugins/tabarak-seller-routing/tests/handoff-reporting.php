<?php
define('ABSPATH', __DIR__ . '/');
define('ARRAY_A', 'ARRAY_A');
define('TSR_DRIVER_BRIDGE_URL', 'https://bridge.example.test');
define('TSR_DRIVER_BRIDGE_SECRET', str_repeat('s', 32));
require_once dirname(__DIR__) . '/includes/class-tsr-api.php';

final class WP_Error {}
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_salt($scheme) { return 'test-salt'; }
function get_userdata($id) { return (object) array('ID' => $id, 'user_pass' => 'saved-password-hash', 'roles' => array('tabarak_seller')); }
function user_can($user, $capability) { return false; }
function get_user_meta($id, $key, $single) { return 17; }
function absint($value) { return abs((int) $value); }
function sanitize_key($value) { return strtolower(preg_replace('/[^a-z0-9_-]/i', '', $value)); }
function wp_parse_url($url, $component = -1) { return parse_url($url, $component); }
function wp_http_validate_url($url) { return (bool) parse_url($url, PHP_URL_HOST); }
function wp_json_encode($value) { return json_encode($value); }
function wp_safe_remote_post($url, $args) {
    $payload = json_decode($args['body'], true);
    $orders = array_map(static function($id) { return array('external_order_id' => (string) $id,
        'delivery_status' => 'delivered', 'picked_up_at' => '2026-10-14T08:10:00Z', 'delivered_at' => '2026-10-14T08:30:00Z'); }, $payload['order_ids'] ?? array());
    return array('status' => 200, 'body' => json_encode(array('orders' => $orders)));
}
function wp_remote_retrieve_response_code($response) { return $response['status']; }
function wp_remote_retrieve_body($response) { return $response['body']; }

final class Tabarak_Seller_Routing {
    const BRANCH_META = '_tabarak_seller_branch_id';
    public static function table($suffix) { return 'test_' . $suffix; }
    public static function branch($id) { return $id === 17 ? array('id' => 17) : null; }
}

final class ReportingRequest {
    private $params;
    public function __construct($params = array()) { $this->params = $params; }
    public function get_header($name) { return 'Bearer ' . str_repeat('a', 64); }
    public function get_param($key) { return $this->params[$key] ?? null; }
}

final class ReportingDb {
    public $history_query = '';
    public $earnings_query = '';
    public function prepare($query, ...$args) {
        $values = array_map(static function($value) { return is_string($value) ? "'" . $value . "'" : $value; }, $args);
        return vsprintf($query, $values);
    }
    public function get_row($query, $mode) {
        return array('user_id' => 7, 'password_fingerprint' => hash_hmac('sha256', 'saved-password-hash', wp_salt('auth')));
    }
    public function get_results($query, $mode) {
        if (str_contains($query, 'SELECT * FROM test_handoffs')) {
            $this->history_query = $query;
            return array_map(static function($id) { return array('order_id' => $id, 'branch_id' => 17,
                'order_number' => (string) $id, 'amount_fils' => 1250, 'currency' => 'BHD',
                'block_number' => '555', 'pharmacist' => 'Test', 'handed_at' => '2026-10-14 08:00:00',
                'financial_state' => 'active'); }, range(1, 21));
        }
        $this->earnings_query = $query;
        return array(array('bucket' => 0, 'total' => 1200, 'order_count' => 2), array('bucket' => 6, 'total' => 3500, 'order_count' => 1));
    }
}

$wpdb = new ReportingDb();
$api = new TSR_API(null);
$history = $api->order_history(new ReportingRequest(array('limit' => 20, 'offset' => 0)));
if (count($history['items']) !== 20 || !$history['has_more']
    || $history['items'][0]['value_bhd'] !== 1.25
    || $history['items'][0]['delivery_status'] !== 'delivered'
    || $history['items'][0]['delivered_at'] !== '2026-10-14T08:30:00Z'
    || !str_contains($wpdb->history_query, 'WHERE branch_id=17')) {
    throw new RuntimeException('Branch history must be scoped, paginated and read persisted handovers.');
}
$earnings = $api->earnings(new ReportingRequest(array('period' => 'week')));
if ($earnings['total_fils'] !== 4700 || count($earnings['buckets']) !== 7
    || $earnings['order_count'] !== 3 || $earnings['buckets'][0]['order_count'] !== 2
    || $earnings['buckets'][6]['order_count'] !== 1
    || $earnings['buckets'][0]['total_fils'] !== 1200 || $earnings['buckets'][6]['total_fils'] !== 3500
    || !str_contains($wpdb->earnings_query, 'branch_id=17 AND financial_state=\'active\'')) {
    throw new RuntimeException('Branch earnings must aggregate active handover snapshots only.');
}
echo "Handover reporting checks passed.\n";
