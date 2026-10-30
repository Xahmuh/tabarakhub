<?php
define('ABSPATH', __DIR__ . '/');

class ManualItem {
    public $tax_class;
    public $subtotal;
    public $total;
    public $meta = array();
    public function set_tax_class($value) { $this->tax_class = $value; }
    public function set_subtotal($value) { $this->subtotal = $value; }
    public function set_total($value) { $this->total = $value; }
    public function update_meta_data($key, $value) { $this->meta[$key] = $value; }
}

require_once dirname(__DIR__) . '/includes/class-tsr-api.php';
$method = new ReflectionMethod(TSR_API::class, 'set_manual_final_price');
$api = new TSR_API(null);
foreach (array(1, 2) as $quantity) {
    $item = new ManualItem();
    $line_fils = $method->invoke($api, $item, 100000, $quantity);
    if ($line_fils !== 100000 * $quantity || $item->tax_class !== '0'
        || $item->total !== number_format(100 * $quantity, 3, '.', '')
        || $item->subtotal !== $item->total
        || $item->meta['_tabarak_seller_entered_gross_unit_fils'] !== 100000) {
        throw new RuntimeException('Manual price must be final with no WooCommerce VAT for every quantity.');
    }
}
echo "Manual final price checks passed.\n";
