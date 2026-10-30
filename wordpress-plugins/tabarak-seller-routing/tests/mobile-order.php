<?php
define('ABSPATH', __DIR__ . '/');
function register_activation_hook($file, $callback) {}
function add_action($hook, $callback, $priority = 10, $accepted_args = 1) {}
require_once dirname(__DIR__) . '/tabarak-seller-routing.php';

class RoutingTestOrder {
    public function __construct(private $source, private $method = 'cod', private $wallet = 0,
        private $date_paid = null, private $paid = false) {}
    public function get_created_via() { return $this->source; }
    public function get_payment_method() { return $this->method; }
    public function get_total() { return '5.000'; }
    public function get_meta($key) { return $key === '_tabarak_twallet_paid_fils' ? $this->wallet : ''; }
    public function get_date_paid() { return $this->date_paid; }
    public function is_paid() { return $this->paid; }
}
class Tabarak_Mobile_Tap { public static function paid($order) { return $order->is_paid(); } }
class Propharm_Mobile_Tap { public static function paid($order) { return $order->is_paid(); } }

function check_mobile($condition, $message) { if (!$condition) throw new RuntimeException($message); }
foreach (array('tabarak-mobile', 'propharm-mobile') as $source) {
    check_mobile(Tabarak_Seller_Routing::is_mobile_order(new RoutingTestOrder($source)), 'Mobile order source rejected: ' . $source);
}
check_mobile(!Tabarak_Seller_Routing::is_mobile_order(new RoutingTestOrder('checkout')), 'Website order was accepted');
foreach (array('tabarak_tap' => 'card', 'propharm_tap' => 'card', 'tabarak_twallet' => 'wallet',
    'propharm_twallet' => 'wallet', 'cod' => 'cod') as $method => $kind) {
    check_mobile(TSR_Planner::payment_kind(new RoutingTestOrder('tabarak-mobile', $method)) === $kind,
        'Payment routing mismatch: ' . $method);
}
check_mobile(Tabarak_Seller_Routing::card_paid(new RoutingTestOrder('tabarak-mobile', 'tabarak_tap', 0, null, true)),
    'Confirmed Tabarak Tap payment must route');
check_mobile(!Tabarak_Seller_Routing::card_paid(new RoutingTestOrder('tabarak-mobile', 'tabarak_tap')),
    'Unconfirmed Tabarak Tap payment must wait');
check_mobile(Tabarak_Seller_Routing::wallet_paid(new RoutingTestOrder('tabarak-mobile', 'tabarak_twallet', 5000, true)),
    'Fully paid Tabarak wallet order routes even while WooCommerce keeps it on hold for prescription review');
check_mobile(!Tabarak_Seller_Routing::wallet_paid(new RoutingTestOrder('tabarak-mobile', 'tabarak_twallet', 4000, true)),
    'Partially paid wallet order must not route as fully paid');
echo "Mobile order routing checks passed.\n";
