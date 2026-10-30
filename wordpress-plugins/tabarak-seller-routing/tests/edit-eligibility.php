<?php
define('ABSPATH', __DIR__ . '/');
require_once dirname(__DIR__) . '/includes/class-tsr-api.php';

final class Tabarak_Mobile_Rewards {
    public static function credit_wallet_order_adjustment() { return true; }
}
final class Tabarak_Mobile_Notifications {}
final class Tabarak_Seller_Routing {
    public static function card_paid($order) { return false; }
    public static function wallet_paid($order) { return false; }
}
final class TaxedEditOrder {
    public $discount = 0.0;
    public function get_created_via() { return 'tabarak-mobile'; }
    public function get_currency() { return 'BHD'; }
    public function get_customer_id() { return 2; }
    public function get_payment_method() { return 'cod'; }
    public function get_status() { return 'seller-ready'; }
    public function get_total_refunded() { return 0.0; }
    public function get_total_tax() { return 2.990; }
    public function get_coupon_codes() { return array(); }
    public function get_discount_total() { return $this->discount; }
    public function get_meta($key) { return $key === '_tabarak_seller_preparing_at' ? '2026-10-18 14:00:00' : ''; }
}

$method = new ReflectionMethod(TSR_API::class, 'edit_issue');
$api = new TSR_API(null);
$order = new TaxedEditOrder();
if ($method->invoke($api, $order) !== '') throw new RuntimeException('A VAT order was blocked from editing.');
$order->discount = 1.0;
if ($method->invoke($api, $order) !== 'This order has promotions. Edit it in WooCommerce so its pricing rules are preserved.') {
    throw new RuntimeException('A promotional order was allowed without preserving its pricing rules.');
}
echo "Taxed order edit eligibility checks passed.\n";
