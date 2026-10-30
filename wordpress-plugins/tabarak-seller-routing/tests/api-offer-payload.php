<?php
define('ABSPATH', __DIR__ . '/');
define('ARRAY_A', 'ARRAY_A');
require_once dirname(__DIR__) . '/includes/class-tsr-planner.php';
require_once dirname(__DIR__) . '/includes/class-tsr-api.php';

final class Tabarak_Seller_Routing {
    public static function table($suffix) { return 'test_' . $suffix; }
    public static function block_for_order($order) { return '101'; }
    public static function location_for_order($order) { return array(26.2, 50.5); }
    public static function branch($id) { return $id === 17 ? array('id' => 17, 'name' => 'Jerdab Pharmacy') : null; }
    public static function fulfillment_state($order) { return array('status' => 'awaiting_branch', 'label' => 'Waiting for branch confirmation'); }
    public function sync_workflow_status($order, $dispatch) {}
}

final class OfferTestDb {
    public $event_queries = 0;
    public $claimed = false;
    public function prepare($query, ...$args) { return $query; }
    public function get_var($query) { return null; }
    public function get_row($query, $mode) { return array('state' => $this->claimed ? 'claimed' : 'offered', 'wave' => 1, 'branch_id' => $this->claimed ? 17 : null); }
    public function get_results($query, $mode) {
        $this->event_queries++;
        return array(array('event_key' => 'internal', 'detail' => 'Private event detail'));
    }
}

final class OfferTestItem {
    public function get_id() { return 9; }
    public function get_product_id() { return 10; }
    public function get_variation_id() { return 0; }
    public function get_name() { return 'Medicine name'; }
    public function get_quantity() { return 2; }
    public function get_total() { return '5.000'; }
    public function get_subtotal() { return '5.000'; }
    public function get_total_tax() { return '0.500'; }
    public function get_taxes() { return array('total' => array(1 => '0.500')); }
    public function get_meta($key, $single = false) {
        return array('_tabarak_mobile_promotion_id' => 12, '_tabarak_mobile_regular_line_subtotal_fils' => 6000)[$key] ?? '';
    }
    public function get_product() { return new OfferTestProduct(); }
}

final class OfferTestProduct {
    public function is_type($type) { return false; }
    public function get_sku() { return 'MED-123'; }
    public function get_image_id() { return 7; }
}

final class OfferTestCoupon {
    public function get_code() { return 'SAVE1'; }
    public function get_discount() { return '1.000'; }
}

final class OfferTestFee {
    public function get_name() { return 'Loyalty points'; }
    public function get_total() { return '-0.500'; }
}

function wp_get_attachment_image_url($id, $size) { return $size === 'full' ? 'https://example.test/medicine-full.jpg' : 'https://example.test/medicine.jpg'; }
function get_the_title($id) { return $id === 12 ? 'Buy one, get one' : ''; }
function absint($value) { return abs((int) $value); }
final class WC_Tax { public static function get_rate_percent($id) { return $id === 1 ? '10%' : ''; } }

final class OfferTestOrder {
    public function get_id() { return 123; }
    public function get_order_number() { return '123'; }
    public function get_status() { return 'processing'; }
    public function get_total() { return '5.500'; }
    public function get_subtotal() { return '5.000'; }
    public function get_discount_total() { return '1.000'; }
    public function get_shipping_total() { return '0.000'; }
    public function get_total_tax() { return '0.500'; }
    public function get_currency() { return 'BHD'; }
    public function get_payment_method() { return 'cod'; }
    public function get_created_via() { return 'tabarak-mobile'; }
    public function get_customer_id() { return 71; }
    public function get_date_created() { return null; }
    public function get_meta($key) {
        return array('_tabarak_seller_pharmacist' => 'Test Pharmacist', '_tabarak_delivery_driver_name' => 'Test Driver',
            '_tabarak_delivery_driver_phone' => '+97333123456',
            '_tabarak_mobile_redeemed_points' => 100, '_tabarak_mobile_points_discount_fils' => 500,
            '_tabarak_delivery_driver_id' => 7)[$key] ?? 0;
    }
    public function get_items($type = 'line_item') {
        if ($type === 'fee') return array(new OfferTestFee());
        if ($type === 'coupon') return array(new OfferTestCoupon());
        return array(new OfferTestItem());
    }
    public function get_formatted_billing_full_name() { return 'Private customer'; }
    public function get_billing_phone() { return 'Private phone'; }
    public function get_address($type) { return array('address_1' => 'Private address'); }
    public function get_customer_note() { return 'Private note'; }
}

$wpdb = new OfferTestDb();
$api = new TSR_API(null);
$serialize = new ReflectionMethod(TSR_API::class, 'order_data');
$masked = $serialize->invoke($api, new OfferTestOrder(), false);
if ($masked['item_count'] !== 1 || $masked['items'][0]['name'] !== 'Medicine name'
    || $masked['fulfillment_status'] !== 'awaiting_branch'
    || $masked['fulfillment_label'] !== 'Waiting for branch confirmation'
    || $masked['items'][0]['id'] !== 9 || $masked['items'][0]['unit_price_fils'] !== 2500
    || $masked['items'][0]['sku'] !== 'MED-123'
    || $masked['items'][0]['image_url'] !== 'https://example.test/medicine.jpg'
    || $masked['items'][0]['full_image_url'] !== 'https://example.test/medicine-full.jpg'
    || $masked['items'][0]['line_vat_fils'] !== 500
    || $masked['items'][0]['vat_rate'] !== '10%'
    || $masked['items'][0]['line_grand_total_fils'] !== 5500
    || $masked['items'][0]['offer']['title'] !== 'Buy one, get one'
    || $masked['items'][0]['offer']['savings_fils'] !== 1000
    || $masked['summary']['vat_fils'] !== 500
    || $masked['summary']['coupon_lines'][0]['code'] !== 'SAVE1'
    || $masked['summary']['coupon_lines'][0]['discount_fils'] !== 1000
    || $masked['summary']['redeemed_points'] !== 100
    || $masked['summary']['points_discount_fils'] !== 500
    || $masked['summary']['fee_lines'][0]['amount_fils'] !== -500
    || $masked['events'] !== array() || $wpdb->event_queries !== 0) {
    throw new RuntimeException('Unclaimed offer must expose catalog details without private order data.');
}
foreach (array('customer', 'shipping', 'location', 'note', 'pharmacist', 'driver', 'accepted_branch') as $key) {
    if (array_key_exists($key, $masked)) throw new RuntimeException('Unclaimed offer exposed ' . $key);
}
$full = $serialize->invoke($api, new OfferTestOrder(), true);
if ($full['items'][0]['name'] !== 'Medicine name' || $full['customer']['name'] !== 'Private customer' || $wpdb->event_queries !== 1) {
    throw new RuntimeException('Claimed order lost full details.');
}
$wpdb->claimed = true;
$claimed = $serialize->invoke($api, new OfferTestOrder(), true);
if ($claimed['accepted_branch']['name'] !== 'Jerdab Pharmacy' || $claimed['pharmacist'] !== 'Test Pharmacist'
    || $claimed['driver']['name'] !== 'Test Driver' || $claimed['driver']['phone'] !== '+97333123456') {
    throw new RuntimeException('Claimed order must identify the accepting branch, pharmacist and assigned driver.');
}
echo "Offer payload checks passed.\n";
