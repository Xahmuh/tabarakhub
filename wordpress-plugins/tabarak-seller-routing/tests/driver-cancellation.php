<?php
define('ABSPATH', __DIR__ . '/');
require_once dirname(__DIR__) . '/includes/class-tsr-api.php';

final class Tabarak_Seller_Routing {
    public static $events = array();
    public static $notifications = array();
    public static function table($suffix) { return 'test_' . $suffix; }
    public static function is_mobile_order($order) { return $order && $order->get_created_via() === 'tabarak-mobile'; }
    public static function block_for_order($order) { return '321'; }
    public static function event(...$args) { self::$events[] = $args; }
    public static function notify_branch(...$args) { self::$notifications[] = $args; }
}

function sanitize_text_field($value) { return trim((string) $value); }

final class DriverCancelDb {
    public $handoff = false;
    public $inserted = 0;
    public function prepare($query, ...$args) { return $query; }
    public function get_var($query) { return $this->handoff ? 16649 : null; }
    public function query($query) { $this->inserted++; return 1; }
}

final class DriverCancelOrder {
    public $meta = array(
        '_tabarak_seller_driver_app_id' => 'first-driver',
        '_tabarak_seller_delivery_order_id' => 'delivery-16649',
        '_tabarak_seller_branch_id' => 17,
        '_tabarak_delivery_driver_name' => 'First driver',
        '_tabarak_delivery_driver_phone' => '33123456',
    );
    public $saves = 0;
    public $status = 'seller-ready';
    public function get_id() { return 16649; }
    public function get_order_number() { return '16649'; }
    public function get_created_via() { return 'tabarak-mobile'; }
    public function get_total() { return '4.500'; }
    public function get_currency() { return 'BHD'; }
    public function get_shipping_address_2() { return 'Block: 321'; }
    public function get_status() { return $this->status; }
    public function update_status($status, $note = '') { $this->status = $status; }
    public function get_meta($key) { return $this->meta[$key] ?? ''; }
    public function update_meta_data($key, $value) { $this->meta[$key] = $value; }
    public function delete_meta_data($key) { unset($this->meta[$key]); }
    public function save() { $this->saves++; }
}

function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }

$wpdb = new DriverCancelDb();
$api = new TSR_API(null);
$reconcile = new ReflectionMethod(TSR_API::class, 'reconcile_driver_cancellation');
$order = new DriverCancelOrder();
$cancel = array('delivery_status' => 'recorded', 'assignment_returned_at' => '2026-10-18T15:00:00Z', 'picked_up_at' => null);
$reconcile->invoke($api, $order, $cancel);
check(!$order->get_meta('_tabarak_seller_driver_app_id'), 'Driver must be cleared before pickup.');
check($order->get_meta('_tabarak_seller_driver_returned_at') === $cancel['assignment_returned_at'], 'Return timestamp missing.');
check($order->saves === 1 && count(Tabarak_Seller_Routing::$notifications) === 1, 'Cancellation should notify once.');
$reconcile->invoke($api, $order, $cancel);
check($order->saves === 1 && count(Tabarak_Seller_Routing::$notifications) === 1, 'Cancellation must be idempotent.');

$order = new DriverCancelOrder();
$cancel = array('delivery_status' => 'cancelled', 'cancelled_at' => '2026-10-18T15:00:00Z', 'picked_up_at' => null);
$reconcile->invoke($api, $order, $cancel);
check($order->get_meta('_tabarak_seller_driver_app_id') === 'first-driver', 'Historic cancellation must remain terminal.');
$order = new DriverCancelOrder();
$cancel['picked_up_at'] = '2026-10-18T14:59:00Z';
$reconcile->invoke($api, $order, $cancel);
check($order->get_meta('_tabarak_seller_driver_app_id') === 'first-driver', 'Picked-up order must not be returned for reassignment.');
check(count(Tabarak_Seller_Routing::$notifications) === 3, 'Historical and post-pickup cancellations should alert the branch.');

$reconcile_delivery = new ReflectionMethod(TSR_API::class, 'reconcile_driver_delivery');
$order = new DriverCancelOrder();
$reconcile_delivery->invoke($api, $order, array(
    'id' => 'delivery-16649',
    'delivery_status' => 'picked_up',
    'picked_up_at' => '2026-10-18T16:00:00Z',
));
check($order->get_status() === 'handed-to-driver', 'Picked-up status must transition order to handed-to-driver.');
check((string) $order->get_meta('_tabarak_seller_handed_at') !== '', 'Picked-up status must record _tabarak_seller_handed_at.');

$reconcile_delivery->invoke($api, $order, array(
    'id' => 'delivery-16649',
    'delivery_status' => 'delivered',
    'picked_up_at' => '2026-10-18T16:00:00Z',
    'delivered_at' => '2026-10-18T16:25:00Z',
));
check($order->get_status() === 'completed', 'Delivered status must transition order to completed.');
check((string) $order->get_meta('_tabarak_seller_delivered_at') !== '', 'Delivered status must record _tabarak_seller_delivered_at.');
echo "Driver cancellation and delivery reconciliation checks passed.\n";
