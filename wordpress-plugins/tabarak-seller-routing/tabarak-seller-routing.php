<?php
/**
 * Plugin Name: Tabarak Seller Routing
 * Description: WordPress-owned branch offers and first-accept dispatch for Tabarak Online orders.
 * Version: 0.2.33
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 */
defined('ABSPATH') || exit;
require_once __DIR__ . '/includes/class-tsr-planner.php';
require_once __DIR__ . '/includes/class-tsr-api.php';
require_once __DIR__ . '/includes/class-tsr-order-edit-money.php';
require_once __DIR__ . '/includes/class-tsr-branch-transfer.php';
require_once __DIR__ . '/includes/class-tsr-accounts.php';
require_once __DIR__ . '/includes/class-tsr-pharmacists.php';

final class Tabarak_Seller_Routing {
    const NS = 'tabarak-seller/v1';
    const VERSION = '0.2.33';
    const BRANCH_META = '_tabarak_seller_branch_id';
    private static $instance;

    public static function instance() { return self::$instance ?: (self::$instance = new self()); }
    public static function table($suffix) { global $wpdb; return $wpdb->prefix . 'tabarak_seller_' . $suffix; }

    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        add_role('tabarak_seller', 'Tabarak seller', array('read' => true));
        $charset = $wpdb->get_charset_collate();
        $schemas = array(
            'branches' => "id bigint unsigned NOT NULL AUTO_INCREMENT, code varchar(40) NOT NULL, name varchar(150) NOT NULL, block_number varchar(8) NOT NULL DEFAULT '', lat decimal(10,7) NULL, lng decimal(10,7) NULL, enabled tinyint(1) NOT NULL DEFAULT 1, always_open tinyint(1) NOT NULL DEFAULT 1, card_enabled tinyint(1) NOT NULL DEFAULT 0, cod_enabled tinyint(1) NOT NULL DEFAULT 1, wallet_enabled tinyint(1) NOT NULL DEFAULT 1, accept_anywhere tinyint(1) NOT NULL DEFAULT 0, hours_json longtext NOT NULL, pharmacists_json longtext NOT NULL, pharmacist_codes_json longtext NOT NULL, phone varchar(40) NOT NULL DEFAULT '', whatsapp varchar(40) NOT NULL DEFAULT '', address varchar(255) NOT NULL DEFAULT '', locality varchar(150) NOT NULL DEFAULT '', source_post_id bigint unsigned NULL, updated_at datetime NOT NULL, PRIMARY KEY  (id), UNIQUE KEY code (code), UNIQUE KEY source_post_id (source_post_id), KEY block_number (block_number)",
            'dispatch' => 'order_id bigint unsigned NOT NULL, state varchar(30) NOT NULL, wave tinyint unsigned NOT NULL DEFAULT 0, branch_id bigint unsigned NULL, claimed_by bigint unsigned NULL, claimed_at datetime NULL, updated_at datetime NOT NULL, PRIMARY KEY  (order_id), KEY state (state), KEY branch_id (branch_id)',
            'offers' => 'order_id bigint unsigned NOT NULL, branch_id bigint unsigned NOT NULL, state varchar(16) NOT NULL, created_at datetime NOT NULL, PRIMARY KEY  (order_id,branch_id), KEY branch_state (branch_id,state)',
            'events' => "id bigint unsigned NOT NULL AUTO_INCREMENT, order_id bigint unsigned NOT NULL, event_key varchar(60) NOT NULL, actor_id bigint unsigned NOT NULL DEFAULT 0, branch_id bigint unsigned NOT NULL DEFAULT 0, detail varchar(255) NOT NULL DEFAULT '', created_at datetime NOT NULL, PRIMARY KEY  (id), KEY order_events (order_id,id), KEY event_time (event_key,created_at)",
            'sessions' => 'token_hash char(64) NOT NULL, user_id bigint unsigned NOT NULL, password_fingerprint char(64) NOT NULL, expires_at bigint unsigned NOT NULL, PRIMARY KEY  (token_hash), KEY user_id (user_id), KEY expires_at (expires_at)',
            'notifications' => 'id bigint unsigned NOT NULL AUTO_INCREMENT, user_id bigint unsigned NOT NULL, event_key varchar(120) NOT NULL, order_id bigint unsigned NOT NULL, title varchar(160) NOT NULL, body varchar(255) NOT NULL, read_at datetime NULL, created_at datetime NOT NULL, PRIMARY KEY  (id), UNIQUE KEY user_event (user_id,event_key), KEY inbox (user_id,id)',
            'handoffs' => "order_id bigint unsigned NOT NULL, branch_id bigint unsigned NOT NULL, order_number varchar(80) NOT NULL, amount_fils bigint NOT NULL, currency varchar(8) NOT NULL DEFAULT 'BHD', block_number varchar(8) NOT NULL DEFAULT '', pharmacist varchar(150) NOT NULL DEFAULT '', handed_at datetime NOT NULL, financial_state varchar(20) NOT NULL DEFAULT 'active', PRIMARY KEY  (order_id), KEY branch_time (branch_id,handed_at), KEY financial_time (financial_state,handed_at)",
        );
        foreach ($schemas as $suffix => $columns) dbDelta('CREATE TABLE ' . self::table($suffix) . " (\n" . str_replace(', ', ",\n", $columns) . "\n) ENGINE=InnoDB {$charset};");
        delete_transient('tbh_active_branches_cache');
        delete_transient('tbh_all_branches_cache');
        update_option('tabarak_seller_routing_schema', self::VERSION, false);
    }

    public static function boot() {
        if (!class_exists('WooCommerce')) return;
        $app = self::instance();
        add_action('init', array($app, 'register_workflow_statuses'), 9);
        add_filter('wc_order_statuses', array($app, 'add_workflow_order_statuses'));
        add_filter('woocommerce_order_is_paid', array($app, 'paid_state_for_workflow'), 10, 2);
        add_filter('woocommerce_rest_prepare_shop_order_object', array($app, 'add_rest_fulfillment_state'), 10, 3);
        add_action('init', array($app, 'maybe_upgrade'));
        add_action('admin_menu', array($app, 'admin_menu'));
        add_action('admin_post_tsr_save_branch', array($app, 'save_branch'));
        add_action('admin_post_tsr_save_rules', array($app, 'save_rules'));
        add_action('admin_post_tsr_assign_account', array($app, 'assign_account'));
        add_action('admin_post_tsr_provision_accounts', array('TSR_Accounts', 'provision'));
        add_action('admin_post_tsr_reset_account', array('TSR_Accounts', 'reset_password'));
        add_action('admin_post_tsr_create_single_account', array('TSR_Accounts', 'create_single_account'));
        add_filter('allow_password_reset', array('TSR_Accounts', 'allow_password_reset'), 10, 2);
        add_action('admin_post_tsr_manual_assign', array($app, 'manual_assign'));
        add_action('admin_post_tsr_retry_dispatch', array($app, 'retry_dispatch'));
        add_action('admin_post_tsr_export_branches', array('TSR_Branch_Transfer', 'export_csv'));
        add_action('admin_post_tsr_import_branches', array('TSR_Branch_Transfer', 'import_csv'));
        add_action('admin_post_tsr_import_pharmacists', array('TSR_Pharmacists', 'import_csv'));
        add_action('admin_post_tsr_import_pharmacist_assignments', array('TSR_Pharmacists', 'import_assignments'));
        add_action('admin_post_tsr_copy_directory', array('TSR_Branch_Transfer', 'copy_directory'));
        add_action('woocommerce_new_order', array($app, 'queue_order'), 20, 1);
        add_action('woocommerce_order_status_changed', array($app, 'status_changed'), 20, 4);
        add_action('tsr_dispatch_order', array($app, 'dispatch_order'), 10, 1);
        add_action('tsr_repeat_offer_alert', array($app, 'repeat_offer_alert'), 10, 3);
        add_filter('cron_schedules', array($app, 'driver_cancel_poll_schedule'));
        add_action('init', array($app, 'schedule_driver_cancel_poll'), 20);
        add_action('tsr_poll_driver_cancellations', array(new TSR_API($app), 'poll_driver_cancellations'));
        add_action('tsr_poll_driver_cancellations', array(new TSR_API($app), 'drain_delivery_outbox'));
        add_action('rest_api_init', array(new TSR_API($app), 'register_routes'));
        add_filter('rest_pre_dispatch', array($app, 'prevent_api_cache'), 0, 3);
    }

    public function maybe_upgrade() { if (get_option('tabarak_seller_routing_schema') !== self::VERSION) self::activate(); }
    public function driver_cancel_poll_schedule($schedules) {
        $schedules['tsr_driver_cancel_minute'] = array('interval' => 60, 'display' => 'Seller driver cancellation check');
        return $schedules;
    }
    public function schedule_driver_cancel_poll() {
        if (!wp_next_scheduled('tsr_poll_driver_cancellations'))
            wp_schedule_event(time() + 60, 'tsr_driver_cancel_minute', 'tsr_poll_driver_cancellations');
    }
    public function register_workflow_statuses() {
        foreach (array(
            'wc-seller-accepted' => 'Accepted by branch',
            'wc-seller-preparing' => 'Preparing',
            'wc-seller-ready' => 'Ready for pickup',
            'wc-handed-to-driver' => 'Handed to driver',
        ) as $status => $label) {
            register_post_status($status, array(
                'label' => $label,
                'public' => false,
                'exclude_from_search' => true,
                'show_in_admin_all_list' => true,
                'show_in_admin_status_list' => true,
                'label_count' => _n_noop($label . ' <span class="count">(%s)</span>', $label . ' <span class="count">(%s)</span>', 'tabarak-seller-routing'),
            ));
        }
    }
    public function add_workflow_order_statuses($statuses) {
        $statuses['wc-seller-accepted'] = 'Accepted by branch';
        $statuses['wc-seller-preparing'] = 'Preparing';
        $statuses['wc-seller-ready'] = 'Ready for pickup';
        $statuses['wc-handed-to-driver'] = 'Handed to driver';
        return $statuses;
    }
    public function paid_state_for_workflow($paid, $order) {
        if (!($order instanceof WC_Order) || !self::is_mobile_order($order)) return $paid;
        if (!in_array($order->get_status(), array('seller-accepted', 'seller-preparing', 'seller-ready', 'handed-to-driver'), true)) return $paid;
        return (bool) $order->get_date_paid();
    }
    /** Add a payment-independent lifecycle field to WooCommerce REST order responses. */
    public function add_rest_fulfillment_state($response, $order, $request) {
        if (!($response instanceof WP_REST_Response) || !($order instanceof WC_Order)) return $response;
        $state = self::fulfillment_state($order);
        $data = $response->get_data();
        $data['fulfillment_status'] = $state['status'];
        $data['fulfillment_label'] = $state['label'];
        $response->set_data($data);
        return $response;
    }
    public static function fulfillment_state($order) {
        $fulfillment = array(
            'seller-accepted' => array('under_review_and_preparation', 'Under review and preparation'),
            'seller-preparing' => array('under_review_and_preparation', 'Under review and preparation'),
            'seller-ready' => array('under_review_and_preparation', 'Under review and preparation'),
            'handed-to-driver' => array('scheduled_for_delivery', 'Scheduled for delivery'),
            'completed' => array('delivered', 'Delivered'),
            'cancelled' => array('cancelled', 'Cancelled'),
            'failed' => array('cancelled', 'Cancelled'),
            'refunded' => array('cancelled', 'Cancelled'),
        );
        $state = $fulfillment[$order->get_status()] ?? array('awaiting_branch', 'Waiting for branch confirmation');
        return array('status' => $state[0], 'label' => $state[1]);
    }
    public function sync_workflow_status($order, $dispatch) {
        if (!self::is_mobile_order($order) || !$dispatch || $dispatch['state'] !== 'claimed'
            || in_array($order->get_status(), array('completed', 'cancelled', 'failed', 'refunded'), true)) return;
        global $wpdb;
        $handed_at = $order->get_meta('_tabarak_seller_handed_at')
            ?: $wpdb->get_var($wpdb->prepare('SELECT handed_at FROM ' . self::table('handoffs') . ' WHERE order_id=%d', $order->get_id()));
        if ($handed_at) $status = 'handed-to-driver';
        elseif ($order->get_meta('_tabarak_seller_ready_at')) $status = 'seller-ready';
        elseif ($order->get_meta('_tabarak_seller_preparing_at')) $status = 'seller-preparing';
        elseif ($order->get_meta('_tabarak_seller_handed_at')) $status = 'handed-to-driver';
        else $status = 'seller-accepted';
        if ($order->get_status() !== $status) $order->update_status($status);
    }
    public function prevent_api_cache($result, $server, $request) {
        if (strpos($request->get_route(), '/' . self::NS . '/') !== 0) return $result;
        do_action('litespeed_control_set_nocache', 'Private Tabarak Seller API');
        nocache_headers();
        header('Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0', true);
        return $result;
    }
    public static function rules() {
        $raw = get_option('tabarak_seller_routing_rules', array());
        $raw = is_array($raw) ? $raw : array();
        return array('enabled' => !empty($raw['enabled']),
            'same_block_seconds' => min(600, max(15, (int) ($raw['same_block_seconds'] ?? 60))),
            'nearby_count' => min(20, max(1, (int) ($raw['nearby_count'] ?? 3))),
            'offer_timeout_seconds' => min(900, max(60, (int) ($raw['offer_timeout_seconds'] ?? 180))));
    }
    public static function readiness_issues() {
        $branches = self::branch_rows();
        if (!$branches) return array('No routing branches are configured.');
        $issues = array();
        $enabled_count = 0;
        foreach ($branches as $branch) {
            if (empty($branch['enabled'])) continue;
            $enabled_count++;
            $name = (string) $branch['name'];
            if (!TSR_Accounts::has_linked_account((int) $branch['id'])) $issues[] = $name . ': no linked seller account';
            $pharmacists = json_decode((string) ($branch['pharmacists_json'] ?? ''), true);
            if (!is_array($pharmacists) || !array_filter($pharmacists, static function($name) { return is_string($name) && trim($name) !== ''; })) $issues[] = $name . ': no pharmacist roster';
            if (empty($branch['block_number']) || !is_numeric($branch['lat']) || !is_numeric($branch['lng'])) $issues[] = $name . ': missing block or coordinates';
        }
        if ($enabled_count === 0) $issues[] = 'No routing branch is enabled.';
        return $issues;
    }
    public static function event($order_id, $key, $actor_id = 0, $branch_id = 0, $detail = '') {
        global $wpdb;
        $wpdb->insert(self::table('events'), array('order_id' => (int) $order_id, 'event_key' => sanitize_key($key), 'actor_id' => (int) $actor_id, 'branch_id' => (int) $branch_id, 'detail' => sanitize_text_field($detail), 'created_at' => current_time('mysql', true)));
    }
    public static function branch_rows() { global $wpdb; return $wpdb->get_results("SELECT * FROM " . self::table('branches') . " WHERE LOWER(code)<>'d001' ORDER BY name ASC", ARRAY_A) ?: array(); }
    public static function branch($id) { global $wpdb; $branch = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('branches') . ' WHERE id=%d', (int) $id), ARRAY_A); return $branch && strtolower($branch['code']) === 'd001' ? null : $branch; }
    public static function is_mobile_order($order) { return $order && in_array($order->get_created_via(), array('tabarak-mobile', 'propharm-mobile'), true); }
    public static function card_paid($order) {
        if ($order->get_payment_method() === 'tabarak_tap') return class_exists('Tabarak_Mobile_Tap') && Tabarak_Mobile_Tap::paid($order);
        return class_exists('Propharm_Mobile_Tap') && Propharm_Mobile_Tap::paid($order);
    }
    public static function wallet_paid($order) {
        if ($order->get_payment_method() === 'tabarak_twallet') {
            $total = (int) round((float) $order->get_total() * 1000);
            return $total >= 0 && (int) $order->get_meta('_tabarak_twallet_paid_fils') >= $total && $order->get_date_paid();
        }
        return $order->is_paid();
    }
    public static function block_for_order($order) {
        return preg_match('/(?:^|[;\n\r])\s*Block\s*:\s*(\d{2,4})\b/i', (string) $order->get_shipping_address_2(), $match) ? $match[1] : '';
    }
    public static function location_for_order($order) {
        $lat = $order->get_meta('delivery_lat', true); $lng = $order->get_meta('delivery_lng', true);
        if (!is_numeric($lat) || !is_numeric($lng)) return null;
        $lat = (float) $lat; $lng = (float) $lng;
        return $lat >= 25.5 && $lat <= 26.7 && $lng >= 50.2 && $lng <= 51.0 ? array($lat, $lng) : null;
    }
    public static function delivery_details($order) {
        $shipping = $order->get_address('shipping');
        $shipping = is_array($shipping) ? $shipping : array();
        $choices = array("Don't ring bell", 'Leave at door', 'Call on arrival', 'Leave at reception');
        $address_parts = array(); $instruction_parts = array();
        foreach (explode(';', (string) ($shipping['address_2'] ?? '')) as $part) {
            $part = trim($part);
            if ($part === '') continue;
            $matched = false;
            foreach ($choices as $choice) {
                if (strcasecmp($part, $choice) === 0) { $instruction_parts[] = $choice; $matched = true; break; }
            }
            if (!$matched) $address_parts[] = $part;
        }
        $shipping['address_2'] = implode('; ', $address_parts);
        $saved = method_exists($order, 'get_meta') ? trim((string) $order->get_meta('Delivery instructions')) : '';
        if ($saved !== '') $instruction_parts[] = $saved;
        return array('shipping' => $shipping, 'instructions' => implode("\n", array_values(array_unique($instruction_parts))));
    }
    public static function sync_driver_status($order) {
        if (!self::is_mobile_order($order) || !defined('TSR_DRIVER_BRIDGE_URL') || !defined('TSR_DRIVER_BRIDGE_SECRET')
            || !is_string(TSR_DRIVER_BRIDGE_SECRET) || strlen(TSR_DRIVER_BRIDGE_SECRET) < 32
            || !is_string(TSR_DRIVER_BRIDGE_URL) || wp_parse_url(TSR_DRIVER_BRIDGE_URL, PHP_URL_SCHEME) !== 'https'
            || !wp_http_validate_url(TSR_DRIVER_BRIDGE_URL)
            || !$order->get_meta('_tabarak_seller_delivery_order_id')
            || in_array($order->get_status(), array('completed', 'cancelled', 'failed', 'refunded'), true)) return;
        $order_id = (int) $order->get_id();
        $cache_key = 'tsr_driver_status_' . $order_id;
        if (get_transient($cache_key)) return;
        set_transient($cache_key, 1, 5);
        $response = wp_safe_remote_post(TSR_DRIVER_BRIDGE_URL, array(
            'timeout' => 3,
            'headers' => array('Content-Type' => 'application/json', 'X-Seller-Bridge-Secret' => TSR_DRIVER_BRIDGE_SECRET),
            'body' => wp_json_encode(array('action' => 'status', 'order_id' => (string) $order_id)),
        ));
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) return;
        $result = json_decode(wp_remote_retrieve_body($response), true);
        $delivery = is_array($result) ? ($result['order'] ?? null) : null;
        if (!is_array($delivery) || (string) ($delivery['id'] ?? '') !== (string) $order->get_meta('_tabarak_seller_delivery_order_id')
            || !in_array($delivery['delivery_status'] ?? '', array('picked_up', 'delivered'), true)) return;
        $picked_at = strtotime((string) ($delivery['picked_up_at'] ?? '')) ?: strtotime((string) ($delivery['delivered_at'] ?? ''));
        $branch_id = (int) $order->get_meta('_tabarak_seller_branch_id');
        if ($picked_at && !$order->get_meta('_tabarak_seller_handed_at')) {
            global $wpdb;
            $handed_at = gmdate('Y-m-d H:i:s', $picked_at);
            $inserted = $wpdb->query($wpdb->prepare('INSERT IGNORE INTO ' . self::table('handoffs') .
                ' (order_id,branch_id,order_number,amount_fils,currency,block_number,pharmacist,handed_at,financial_state) VALUES (%d,%d,%s,%d,%s,%s,%s,%s,%s)',
                $order_id, $branch_id, (string) $order->get_order_number(), (int) round((float) $order->get_total() * 1000),
                (string) $order->get_currency(), self::block_for_order($order),
                (string) $order->get_meta('_tabarak_seller_pharmacist'), $handed_at, 'active'));
            if ($inserted !== false) {
                $order->update_meta_data('_tabarak_seller_handed_at', gmdate('c', $picked_at));
                $order->save();
                if ($inserted === 1) self::event($order_id, 'picked_up', 0, $branch_id, 'Driver confirmed pickup');
            }
        }
        if (($delivery['delivery_status'] ?? '') === 'delivered') {
            $delivered_at = strtotime((string) ($delivery['delivered_at'] ?? '')) ?: time();
            if (!$order->get_meta('_tabarak_seller_delivered_at')) {
                $order->update_meta_data('_tabarak_seller_delivered_at', gmdate('c', $delivered_at));
                $order->save();
            }
            if ($order->get_status() !== 'completed') {
                $order->update_status('completed', 'Delivery confirmed by Driver app.');
                self::event($order_id, 'delivered', 0, $branch_id, 'Driver confirmed delivery');
            }
            return;
        }
        if ($order->get_status() !== 'handed-to-driver') $order->update_status('handed-to-driver');
    }
    public function queue_order($order_id) { if (self::rules()['enabled']) $this->schedule($order_id, 10); }
    public function status_changed($order_id, $old, $new, $order) {
        if (!self::is_mobile_order($order)) return;
        if (in_array($new, array('seller-accepted', 'seller-preparing', 'seller-ready', 'handed-to-driver'), true)) return;
        if (in_array($new, array('cancelled', 'failed', 'refunded'), true)) {
            global $wpdb;
            $wpdb->update(self::table('handoffs'), array('financial_state' => $new), array('order_id' => (int) $order_id));
        }
        $enabled = self::rules()['enabled'];
        if (in_array($new, array('cancelled', 'failed', 'refunded', 'completed'), true)) {
            global $wpdb;
            // Keep a claimed branch assignment for the seller's order history.
            $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='closed',updated_at=%s WHERE order_id=%d AND state<>'claimed'", current_time('mysql', true), (int) $order_id));
            $wpdb->update(self::table('offers'), array('state' => 'closed'), array('order_id' => (int) $order_id, 'state' => 'open'));
            wp_clear_scheduled_hook('tsr_dispatch_order', array((int) $order_id));
            if ($enabled) self::notify_admins((int) $order_id, 'status:' . sanitize_key($new), 'Order #' . $order_id . ' is now ' . wc_get_order_status_name($new));
            return;
        }
        if (!$enabled) return;
        self::notify_admins((int) $order_id, 'status:' . sanitize_key($new), 'Order #' . $order_id . ' is now ' . wc_get_order_status_name($new));
        global $wpdb;
        $state = $wpdb->get_var($wpdb->prepare('SELECT state FROM ' . self::table('dispatch') . ' WHERE order_id=%d', (int) $order_id));
        if (!$state || in_array($state, array('pending', 'needs_location', 'waiting_for_open'), true)) $this->schedule($order_id, 10);
    }
    public function schedule($order_id, $seconds) {
        $args = array((int) $order_id);
        $target = time() + max(1, (int) $seconds);
        $existing = wp_next_scheduled('tsr_dispatch_order', $args);
        if ($existing && $existing <= $target) return;
        if ($existing) wp_unschedule_event($existing, 'tsr_dispatch_order', $args);
        wp_schedule_single_event($target, 'tsr_dispatch_order', $args);
    }
    public function dispatch_order($order_id) {
        global $wpdb;
        $rules = self::rules();
        if (!$rules['enabled']) return;
        $order = wc_get_order((int) $order_id);
        if (!self::is_mobile_order($order) || in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)) return;
        $payment = TSR_Planner::payment_kind($order);
        if ($payment === 'unsupported') { self::notify_admins($order_id, 'payment', 'Unsupported payment method'); return; }
        if ($payment === 'card' && !self::card_paid($order)) return;
        if ($payment === 'wallet' && !self::wallet_paid($order)) return;
        $now = current_time('mysql', true);
        $wpdb->query($wpdb->prepare('INSERT IGNORE INTO ' . self::table('dispatch') . ' (order_id,state,wave,updated_at) VALUES (%d,%s,0,%s)', $order_id, 'pending', $now));
        $dispatch = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('dispatch') . ' WHERE order_id=%d', $order_id), ARRAY_A);
        if (!$dispatch || in_array($dispatch['state'], array('claimed', 'closed', 'needs_admin'), true)) return;
        $wave = (int) $dispatch['wave'];
        if ($dispatch['state'] === 'offered' && in_array($wave, array(1, 2), true)) {
            $open = (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . self::table('offers') . " WHERE order_id=%d AND state='open'", $order_id));
            $duration = $wave === 1 ? $rules['same_block_seconds'] : $rules['offer_timeout_seconds'];
            $remaining = TSR_Planner::remaining_offer_seconds((string) $dispatch['updated_at'], $duration, $open);
            if ($remaining > 0) {
                $this->schedule($order_id, $remaining);
                return;
            }
            if ($wave === 2) {
                $closed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='needs_admin',updated_at=%s WHERE order_id=%d AND state='offered' AND wave=2 AND branch_id IS NULL", $now, $order_id));
                if ($closed === 1) {
                    $wpdb->update(self::table('offers'), array('state' => 'expired'), array('order_id' => $order_id, 'state' => 'open'));
                    self::notify_admins($order_id, 'no_acceptance', 'Order needs manual branch assignment');
                }
                return;
            }
            $wpdb->update(self::table('offers'), array('state' => 'expired'), array('order_id' => $order_id, 'state' => 'open'));
        }
        $location = self::location_for_order($order);
        if (!$location) {
            $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='needs_location',updated_at=%s WHERE order_id=%d AND branch_id IS NULL AND state IN ('pending','waiting_for_open','offered')", $now, $order_id));
            if ($changed === 1) self::notify_admins($order_id, 'location', 'Order needs a delivery location');
            return;
        }
        $ranked = TSR_Planner::rank(self::branch_rows(), $payment, self::block_for_order($order), $location[0], $location[1]);
        if (!$ranked) {
            $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='needs_admin',updated_at=%s WHERE order_id=%d AND branch_id IS NULL AND state IN ('pending','needs_location','waiting_for_open','offered')", $now, $order_id));
            if ($changed === 1) {
                $wpdb->update(self::table('offers'), array('state' => 'expired'), array('order_id' => $order_id, 'state' => 'open'));
                self::notify_admins($order_id, 'no_payment_branch', 'No branch is configured for this payment method');
            }
            return;
        }
        $eligible = array_values(array_filter($ranked, static function($branch) { return $branch['is_open']; }));
        if (!$eligible) {
            $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='waiting_for_open',updated_at=%s WHERE order_id=%d AND branch_id IS NULL AND state IN ('pending','needs_location','waiting_for_open','offered')", $now, $order_id));
            if ($changed === 1) {
                self::notify_admins($order_id, 'closed', 'No eligible branch is open');
                $this->schedule($order_id, 15 * MINUTE_IN_SECONDS);
            }
            return;
        }
        if ($wave === 1) $wpdb->update(self::table('offers'), array('state' => 'expired'), array('order_id' => $order_id, 'state' => 'open'));
        $previous = $wave === 1 ? $wpdb->get_col($wpdb->prepare('SELECT branch_id FROM ' . self::table('offers') . ' WHERE order_id=%d', $order_id)) : array();
        $choice = TSR_Planner::offer_wave($eligible, $wave, $previous, $rules['nearby_count']);
        $offers = $choice['offers']; $next_wave = $choice['wave'];
        if (!$offers) {
            $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='needs_admin',updated_at=%s WHERE order_id=%d AND wave=%d AND branch_id IS NULL AND state IN ('pending','needs_location','waiting_for_open','offered')", $now, $order_id, $wave));
            if ($changed === 1) self::notify_admins($order_id, 'no_acceptance', 'Order needs manual branch assignment');
            return;
        }
        $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='offered',wave=%d,updated_at=%s WHERE order_id=%d AND wave=%d AND branch_id IS NULL AND state IN ('pending','needs_location','waiting_for_open','offered')", $next_wave, $now, $order_id, $wave));
        if ($changed !== 1) return;
        $retry_number = (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . self::table('events') . " WHERE order_id=%d AND event_key='retry_dispatch'", $order_id));
        $offer_event = 'offer:' . $next_wave . ($retry_number ? ':retry' . $retry_number : '');
        foreach ($offers as $branch) {
            $created = $wpdb->query($wpdb->prepare('INSERT INTO ' . self::table('offers') . ' (order_id,branch_id,state,created_at) VALUES (%d,%d,%s,%s) ON DUPLICATE KEY UPDATE state=IF(state=%s,%s,state)', $order_id, $branch['id'], 'open', $now, 'expired', 'open'));
            if ($created) {
                self::notify_branch((int) $branch['id'], $order_id, $offer_event, 'New order available');
                $this->schedule_offer_alert((int) $order_id, (int) $branch['id'], $now);
            }
        }
        self::notify_admins($order_id, 'new', 'New order #' . $order->get_order_number());
        $this->schedule($order_id, $next_wave === 1 ? $rules['same_block_seconds'] : $rules['offer_timeout_seconds']);
    }

    private static function notify($user_id, $order_id, $event_key, $title) {
        global $wpdb;
        $created = $wpdb->insert(self::table('notifications'), array('user_id' => $user_id, 'event_key' => $event_key, 'order_id' => $order_id, 'title' => $title, 'body' => 'Open Tabarak Seller for the latest order status.', 'created_at' => current_time('mysql', true)));
        if (!$created) return;
        self::push_user((int) $user_id, (int) $order_id, $title);
    }
    private static function push_user($user_id, $order_id, $title) {
        $tokens = get_user_meta($user_id, '_tabarak_seller_push_tokens', true);
        if (!is_array($tokens)) return;
        $messages = array();
        foreach (array_slice(array_unique($tokens), 0, 3) as $token) if (is_string($token) && preg_match('/^ExpoPushToken\[[A-Za-z0-9_-]{8,128}\]$/', $token)) $messages[] = array('to' => $token, 'title' => $title, 'body' => 'Open Tabarak Seller for details.', 'data' => array('orderId' => $order_id), 'sound' => 'order_alarm.wav', 'channelId' => 'orders-alarm-v2', 'priority' => 'high');
        if ($messages) wp_remote_post('https://exp.host/--/api/v2/push/send', array('headers' => array('Content-Type' => 'application/json'), 'body' => wp_json_encode($messages), 'timeout' => 5, 'blocking' => false));
    }
    private function schedule_offer_alert($order_id, $branch_id, $generation) {
        $args = array((int) $order_id, (int) $branch_id, (string) $generation);
        if (!wp_next_scheduled('tsr_repeat_offer_alert', $args)) {
            wp_schedule_single_event(time() + 30, 'tsr_repeat_offer_alert', $args);
        }
    }
    public function repeat_offer_alert($order_id, $branch_id, $generation) {
        global $wpdb;
        if (!self::rules()['enabled']) return;
        $dispatch = $wpdb->get_row($wpdb->prepare('SELECT state,wave,branch_id,updated_at FROM ' . self::table('dispatch') . ' WHERE order_id=%d', (int) $order_id), ARRAY_A);
        if (!$dispatch || $dispatch['state'] !== 'offered' || $dispatch['branch_id'] !== null
            || (string) $dispatch['updated_at'] !== (string) $generation
            || !TSR_Planner::offer_is_active($dispatch, self::rules())) return;
        $offer = $wpdb->get_row($wpdb->prepare('SELECT state FROM ' . self::table('offers') . ' WHERE order_id=%d AND branch_id=%d', (int) $order_id, (int) $branch_id), ARRAY_A);
        if (!$offer || $offer['state'] !== 'open') return;
        $users = get_users(array('role' => 'tabarak_seller', 'meta_key' => self::BRANCH_META, 'meta_value' => (int) $branch_id, 'fields' => 'ID'));
        foreach ($users as $user_id) self::push_user((int) $user_id, (int) $order_id, 'New order available');
        $this->schedule_offer_alert((int) $order_id, (int) $branch_id, (string) $generation);
    }
    public static function notify_branch($branch_id, $order_id, $event, $title) {
        foreach (get_users(array('role' => 'tabarak_seller', 'meta_key' => self::BRANCH_META, 'meta_value' => $branch_id, 'fields' => 'ID')) as $user_id) self::notify((int) $user_id, $order_id, $event . ':' . $order_id . ':' . $branch_id, $title);
    }
    public static function notify_admins($order_id, $event, $title) {
        foreach (get_users(array('role__in' => array('administrator', 'shop_manager'), 'fields' => 'ID')) as $user_id) self::notify((int) $user_id, $order_id, $event . ':' . $order_id, $title);
    }
    public function admin_menu() { add_submenu_page('woocommerce', 'Tabarak Seller Routing', 'Seller Routing', 'manage_woocommerce', 'tabarak-seller-routing', array($this, 'admin_page')); }

    public function admin_page() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden');
        $rules = self::rules();
        $branches = self::branch_rows();
        $selected = null;
        if (isset($_GET['branch'])) {
            foreach ($branches as $branch) {
                if ((int) $branch['id'] === absint($_GET['branch'])) {
                    $selected = $branch;
                    break;
                }
            }
        }

        global $wpdb;
        $exceptions = $wpdb->get_results('SELECT order_id,state,updated_at FROM ' . self::table('dispatch') . " WHERE state IN ('needs_location','waiting_for_open','needs_admin','pending') ORDER BY updated_at DESC LIMIT 30", ARRAY_A);
        $attention_count = count($exceptions);

        $active_tab = 'dispatch';
        if (isset($_GET['tab'])) {
            $active_tab = sanitize_key($_GET['tab']);
        } elseif ($selected) {
            $active_tab = 'branch-editor';
        } elseif (isset($_GET['tsr_created']) || isset($_GET['tsr_updated']) || isset($_GET['tsr_unchanged']) || isset($_GET['tsr_skipped'])) {
            $active_tab = 'tools';
        } elseif (isset($_GET['pharmacists_imported']) || isset($_GET['assignments_imported'])) {
            $active_tab = 'accounts';
        }

        $open_count = 0;
        $card_count = 0;
        $enabled_count = 0;
        foreach ($branches as $b) {
            if (!empty($b['enabled'])) {
                $enabled_count++;
                if (TSR_Planner::is_open($b)) $open_count++;
                if (!empty($b['card_enabled'])) $card_count++;
            }
        }
        ?>
        <div class="wrap tsr-admin-wrap">
            <style>
                .tsr-admin-wrap { max-width: 1280px; margin-top: 15px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; }
                .tsr-header { background: #fff; border: 1px solid #c3c4c7; border-radius: 8px; padding: 18px 24px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
                .tsr-header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; }
                .tsr-header p { margin: 0; color: #64748b; font-size: 13px; }
                .tsr-nav-tabs { margin-bottom: 20px; border-bottom: 2px solid #cbd5e1; }
                .tsr-nav-tabs .nav-tab { font-size: 13.5px; font-weight: 600; padding: 9px 18px; line-height: 1.4; border-radius: 6px 6px 0 0; }
                .tsr-nav-tabs .nav-tab .dashicons { font-size: 17px; width: 17px; height: 17px; margin-right: 5px; vertical-align: text-bottom; }
                .tsr-card { background: #fff; border: 1px solid #c3c4c7; border-radius: 8px; padding: 22px; margin-bottom: 22px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
                .tsr-card-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
                .tsr-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 15px; margin-bottom: 22px; }
                .tsr-stat-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
                .tsr-stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 6px; }
                .tsr-stat-value { font-size: 22px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
                .tsr-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
                .tsr-badge-success { background: #dcfce7; color: #166534; }
                .tsr-badge-danger { background: #fee2e2; color: #991b1b; }
                .tsr-badge-warning { background: #fef3c7; color: #92400e; }
                .tsr-badge-info { background: #e0f2fe; color: #0369a1; }
                .tsr-badge-neutral { background: #f1f5f9; color: #475569; }
                .tsr-tab-count { background: #ef4444; color: #fff; border-radius: 9999px; padding: 1px 7px; font-size: 11px; font-weight: 700; margin-left: 6px; }
                .tsr-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                @media (max-width: 900px) { .tsr-form-grid { grid-template-columns: 1fr; } }
                .tsr-form-group { margin-bottom: 16px; }
                .tsr-form-group label { display: block; font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 5px; }
                .tsr-form-group input[type="text"], .tsr-form-group input[type="number"], .tsr-form-group select, .tsr-form-group textarea { width: 100%; max-width: 100%; border-radius: 5px; border-color: #cbd5e1; }
                .tsr-checkbox-pill { display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; margin: 0 8px 8px 0; font-size: 13px; cursor: pointer; }
                .tsr-hours-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
                .tsr-hours-day { width: 90px; font-weight: 700; font-size: 12.5px; color: #1e293b; }
                .tsr-hours-slot { display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 5px; }
                .tsr-hours-slot input { width: 58px !important; text-align: center; padding: 2px 4px !important; font-size: 12px; }
            </style>

            <div class="tsr-header">
                <div>
                    <h1><span class="dashicons dashicons-location-alt"></span> Tabarak Seller Routing</h1>
                    <p>WordPress owns dispatch. Distance only ranks; it never disqualifies an address. Card eligibility must be enabled only for Tabarak branches.</p>
                </div>
                <div>
                    <span class="tsr-badge <?php echo $rules['enabled'] ? 'tsr-badge-success' : 'tsr-badge-neutral'; ?>" style="font-size:12px;padding:6px 14px;">
                        ● <?php echo $rules['enabled'] ? 'Automatic Dispatch Active' : 'Automatic Dispatch Paused'; ?>
                    </span>
                </div>
            </div>

            <?php
            if (isset($_GET['saved'])) {
                echo '<div class="notice notice-success is-dismissible"><p>Settings saved successfully.</p></div>';
            }
            if (isset($_GET['retry_order'], $_GET['retry_state'])) {
                $retry_order = absint($_GET['retry_order']);
                $retry_state = sanitize_key(wp_unslash($_GET['retry_state']));
                echo '<div class="notice notice-' . ($retry_state === 'offered' ? 'success' : 'warning') . ' is-dismissible"><p>Order #' . $retry_order . ' routing state: <strong>' . esc_html($retry_state) . '</strong>.</p></div>';
            }
            $issues = self::readiness_issues();
            if ($issues) {
                echo '<div class="notice notice-warning"><p><strong>Automatic dispatch setup alert:</strong> ' . count($issues) . ' branch issues detected. ' . esc_html(implode('; ', array_slice($issues, 0, 3))) . (count($issues) > 3 ? '; …' : '') . '</p></div>';
            }
            if (!array_filter($branches, static function($branch) { return !empty($branch['enabled']) && !empty($branch['card_enabled']); })) {
                echo '<div class="notice notice-info"><p>No branch currently accepts confirmed Tap card orders. Prepaid card orders require admin assignment until an approved Tabarak branch enables Card.</p></div>';
            }
            $tsr_notice = get_transient('tsr_password_notice_' . get_current_user_id());
            if ($tsr_notice) {
                delete_transient('tsr_password_notice_' . get_current_user_id());
                $verb = ($tsr_notice['action'] === 'created') ? 'created' : 'updated';
                echo '<div class="notice notice-success is-dismissible" style="border-left-color:#10b981;border-radius:6px;padding:12px 16px;margin-bottom:18px;">';
                echo '<p style="font-size:13.5px;margin:0;"><strong>Account ' . esc_html(ucfirst($verb)) . ':</strong> Password for <strong>' . esc_html($tsr_notice['branch_name']) . '</strong> (<code>' . esc_html($tsr_notice['code']) . '</code>) was set to: <code style="font-size:14px;background:#fef2f2;color:#ba2523;padding:3px 8px;border-radius:4px;font-weight:700;">' . esc_html($tsr_notice['password']) . '</code></p>';
                echo '</div>';
            }
            ?>

            <nav class="nav-tab-wrapper tsr-nav-tabs">
                <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=dispatch')); ?>" class="nav-tab <?php echo $active_tab === 'dispatch' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-rss"></span> Dispatch & Orders
                    <?php if ($attention_count > 0): ?>
                        <span class="tsr-tab-count"><?php echo (int) $attention_count; ?></span>
                    <?php endif; ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=branches')); ?>" class="nav-tab <?php echo $active_tab === 'branches' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-store"></span> Branches Directory (<?php echo count($branches); ?>)
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=branch-editor' . ($selected ? '&branch=' . (int) $selected['id'] : ''))); ?>" class="nav-tab <?php echo $active_tab === 'branch-editor' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-edit"></span> <?php echo $selected ? 'Edit Branch: ' . esc_html($selected['name']) : '+ Add Branch'; ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=accounts')); ?>" class="nav-tab <?php echo $active_tab === 'accounts' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-admin-users"></span> Staff & Accounts
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=tools')); ?>" class="nav-tab <?php echo $active_tab === 'tools' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-database-export"></span> Import & Export Tools
                </a>
            </nav>

            <?php if ($active_tab === 'dispatch'): ?>
                <div class="tsr-stats-grid">
                    <div class="tsr-stat-box">
                        <div class="tsr-stat-label">Dispatch Engine</div>
                        <div class="tsr-stat-value">
                            <?php if ($rules['enabled']): ?>
                                <span class="tsr-badge tsr-badge-success">● Active</span>
                            <?php else: ?>
                                <span class="tsr-badge tsr-badge-neutral">○ Disabled</span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="tsr-stat-box">
                        <div class="tsr-stat-label">Needs Attention</div>
                        <div class="tsr-stat-value" style="<?php echo $attention_count > 0 ? 'color:#ef4444;' : 'color:#10b981;'; ?>">
                            <?php echo (int) $attention_count; ?>
                            <span style="font-size:13px;font-weight:600;color:#64748b;">orders</span>
                        </div>
                    </div>
                    <div class="tsr-stat-box">
                        <div class="tsr-stat-label">Open Branches Now</div>
                        <div class="tsr-stat-value">
                            <?php echo (int) $open_count; ?> <span style="font-size:13px;font-weight:600;color:#64748b;">/ <?php echo (int) $enabled_count; ?> enabled</span>
                        </div>
                    </div>
                    <div class="tsr-stat-box">
                        <div class="tsr-stat-label">Prepaid Card Branches</div>
                        <div class="tsr-stat-value">
                            <?php echo (int) $card_count; ?> <span style="font-size:13px;font-weight:600;color:#64748b;">branches</span>
                        </div>
                    </div>
                </div>

                <div class="tsr-card" style="<?php echo $exceptions ? 'border-left: 4px solid #ef4444;' : ''; ?>">
                    <div class="tsr-card-title">
                        <span>
                            <span class="dashicons <?php echo $exceptions ? 'dashicons-warning' : 'dashicons-yes-alt'; ?>" style="<?php echo $exceptions ? 'color:#ef4444;' : 'color:#10b981;'; ?>"></span> 
                            Manual Branch Assignment <?php if ($exceptions): ?>(<?php echo count($exceptions); ?> Needing Attention)<?php endif; ?>
                        </span>
                    </div>

                    <?php if ($exceptions): ?>
                        <p class="description">These orders could not be automatically accepted or require manual branch assignment. Search by branch code (e.g., <strong>H001</strong>, <strong>T003</strong>) or name to assign directly.</p>
                        <table class="widefat striped" style="margin-top:10px;">
                            <thead>
                                <tr>
                                    <th style="width:100px;">Order ID</th>
                                    <th>Hold Reason</th>
                                    <th>Last Updated (UTC)</th>
                                    <th style="width:400px;">Assign to Branch (Search Code / Name)</th>
                                </tr>
                            </thead>
                            <tbody>
                            <?php foreach ($exceptions as $row): ?>
                                <tr>
                                    <td><strong><a href="<?php echo esc_url(admin_url('admin.php?page=wc-orders&action=edit&id=' . (int) $row['order_id'])); ?>">#<?php echo (int) $row['order_id']; ?></a></strong></td>
                                    <td><span class="tsr-badge tsr-badge-warning"><?php echo esc_html($row['state']); ?></span></td>
                                    <td><code><?php echo esc_html($row['updated_at']); ?></code></td>
                                    <td>
                                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="tsr-assign-form" style="display:flex;gap:8px;align-items:center;">
                                            <?php wp_nonce_field('tsr_manual_assign_' . $row['order_id']); ?>
                                            <input type="hidden" name="action" value="tsr_manual_assign">
                                            <input type="hidden" name="order_id" value="<?php echo (int) $row['order_id']; ?>">
                                            <input type="hidden" name="branch_id" id="tsr_assign_branch_<?php echo (int) $row['order_id']; ?>" required>

                                            <div class="tsr-searchable-branch-select" style="position:relative;width:280px;">
                                                <input type="text" 
                                                       class="tsr-branch-search-input" 
                                                       id="tsr_branch_input_<?php echo (int) $row['order_id']; ?>"
                                                       placeholder="Type Code (e.g. H001) or Name..." 
                                                       autocomplete="off"
                                                       style="width:100%;height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:0 26px 0 10px;font-size:12px;background:#fff;"
                                                       onfocus="tsrOpenBranchDropdown('<?php echo (int) $row['order_id']; ?>')"
                                                       oninput="tsrFilterBranches('<?php echo (int) $row['order_id']; ?>')">
                                                <span onclick="tsrClearBranchSelect('<?php echo (int) $row['order_id']; ?>')" class="tsr-clear-branch" style="position:absolute;right:8px;top:7px;cursor:pointer;color:#94a3b8;font-size:14px;display:none;">&times;</span>
                                                
                                                <div class="tsr-branch-dropdown" id="tsr_branch_dropdown_<?php echo (int) $row['order_id']; ?>" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.12);z-index:9999;margin-top:3px;">
                                                    <?php foreach ($branches as $branch): ?>
                                                        <?php if (!empty($branch['enabled'])): ?>
                                                            <div class="tsr-branch-option" 
                                                                 data-id="<?php echo (int) $branch['id']; ?>"
                                                                 data-code="<?php echo esc_attr(strtoupper($branch['code'])); ?>"
                                                                 data-name="<?php echo esc_attr(strtolower($branch['name'])); ?>"
                                                                 data-block="<?php echo esc_attr($branch['block_number']); ?>"
                                                                 onclick="tsrSelectBranch('<?php echo (int) $row['order_id']; ?>', <?php echo (int) $branch['id']; ?>, '<?php echo esc_js('[' . strtoupper($branch['code']) . '] ' . $branch['name']); ?>')"
                                                                 style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;font-size:12px;">
                                                                <div>
                                                                    <span style="font-weight:700;color:#ba2523;background:#fff1f2;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11.5px;margin-right:4px;">
                                                                        <?php echo esc_html(strtoupper($branch['code'])); ?>
                                                                    </span>
                                                                    <strong style="color:#0f172a;"><?php echo esc_html($branch['name']); ?></strong>
                                                                </div>
                                                                <span style="font-size:11px;color:#64748b;background:#f8fafc;padding:2px 5px;border-radius:3px;">
                                                                    Block <?php echo esc_html($branch['block_number']); ?>
                                                                </span>
                                                            </div>
                                                        <?php endif; ?>
                                                    <?php endforeach; ?>
                                                </div>
                                            </div>

                                            <button class="button button-primary button-small" style="height:32px;line-height:30px;padding:0 12px;font-weight:600;">Assign</button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div style="padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
                            <div>
                                <strong style="color:#0f172a;display:block;margin-bottom:3px;font-size:13.5px;">All active mobile orders are assigned</strong>
                                <span style="color:#64748b;font-size:12.5px;">No orders currently require emergency attention. You can also assign any order manually below by searching branch code or name:</span>
                            </div>
                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="tsr-assign-form" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                                <?php wp_nonce_field('tsr_manual_assign_direct'); ?>
                                <input type="hidden" name="action" value="tsr_manual_assign">
                                <input type="number" name="order_id" placeholder="Order ID (e.g. 16645)" required style="width:160px;height:32px;font-size:12px;">
                                <input type="hidden" name="branch_id" id="tsr_assign_branch_direct" required>
                                
                                <div class="tsr-searchable-branch-select" style="position:relative;width:280px;">
                                    <input type="text" 
                                           class="tsr-branch-search-input" 
                                           id="tsr_branch_input_direct"
                                           placeholder="Type Code (e.g. H001) or Name..." 
                                           autocomplete="off"
                                           style="width:100%;height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:0 26px 0 10px;font-size:12px;background:#fff;"
                                           onfocus="tsrOpenBranchDropdown('direct')"
                                           oninput="tsrFilterBranches('direct')">
                                    <span onclick="tsrClearBranchSelect('direct')" class="tsr-clear-branch" style="position:absolute;right:8px;top:7px;cursor:pointer;color:#94a3b8;font-size:14px;display:none;">&times;</span>
                                    
                                    <div class="tsr-branch-dropdown" id="tsr_branch_dropdown_direct" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.12);z-index:9999;margin-top:3px;">
                                        <?php foreach ($branches as $branch): ?>
                                            <?php if (!empty($branch['enabled'])): ?>
                                                <div class="tsr-branch-option" 
                                                     data-id="<?php echo (int) $branch['id']; ?>"
                                                     data-code="<?php echo esc_attr(strtoupper($branch['code'])); ?>"
                                                     data-name="<?php echo esc_attr(strtolower($branch['name'])); ?>"
                                                     data-block="<?php echo esc_attr($branch['block_number']); ?>"
                                                     onclick="tsrSelectBranch('direct', <?php echo (int) $branch['id']; ?>, '<?php echo esc_js('[' . strtoupper($branch['code']) . '] ' . $branch['name']); ?>')"
                                                     style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;font-size:12px;">
                                                    <div>
                                                        <span style="font-weight:700;color:#ba2523;background:#fff1f2;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11.5px;margin-right:4px;">
                                                            <?php echo esc_html(strtoupper($branch['code'])); ?>
                                                        </span>
                                                        <strong style="color:#0f172a;"><?php echo esc_html($branch['name']); ?></strong>
                                                    </div>
                                                    <span style="font-size:11px;color:#64748b;background:#f8fafc;padding:2px 5px;border-radius:3px;">
                                                        Block <?php echo esc_html($branch['block_number']); ?>
                                                    </span>
                                                </div>
                                            <?php endif; ?>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                                <button class="button button-primary" style="height:32px;line-height:30px;padding:0 14px;font-weight:600;">Assign Directly</button>
                            </form>
                        </div>
                    <?php endif; ?>

                    <script>
                    function tsrOpenBranchDropdown(orderId) {
                        document.querySelectorAll('.tsr-branch-dropdown').forEach(function(d) {
                            if (d.id !== 'tsr_branch_dropdown_' + orderId) d.style.display = 'none';
                        });
                        var dd = document.getElementById('tsr_branch_dropdown_' + orderId);
                        if (dd) dd.style.display = 'block';
                    }
                    function tsrFilterBranches(orderId) {
                        var input = document.getElementById('tsr_branch_input_' + orderId);
                        var filter = input.value.trim().toLowerCase();
                        var dd = document.getElementById('tsr_branch_dropdown_' + orderId);
                        var clearBtn = input.nextElementSibling;
                        if (clearBtn) clearBtn.style.display = filter ? 'block' : 'none';
                        if (!dd) return;
                        dd.style.display = 'block';
                        document.getElementById('tsr_assign_branch_' + orderId).value = '';

                        var options = dd.querySelectorAll('.tsr-branch-option');
                        var matchedCount = 0;
                        options.forEach(function(opt) {
                            var code = opt.getAttribute('data-code').toLowerCase();
                            var name = opt.getAttribute('data-name');
                            var block = opt.getAttribute('data-block');
                            if (code.indexOf(filter) !== -1 || name.indexOf(filter) !== -1 || block.indexOf(filter) !== -1) {
                                opt.style.display = 'flex';
                                matchedCount++;
                            } else {
                                opt.style.display = 'none';
                            }
                        });
                        var noResults = dd.querySelector('.tsr-no-branches');
                        if (matchedCount === 0) {
                            if (!noResults) {
                                noResults = document.createElement('div');
                                noResults.className = 'tsr-no-branches';
                                noResults.style.padding = '10px';
                                noResults.style.color = '#94a3b8';
                                noResults.style.fontSize = '12px';
                                noResults.style.textAlign = 'center';
                                noResults.innerText = 'No matching branches';
                                dd.appendChild(noResults);
                            }
                            noResults.style.display = 'block';
                        } else if (noResults) {
                            noResults.style.display = 'none';
                        }
                    }
                    function tsrSelectBranch(orderId, branchId, label) {
                        var input = document.getElementById('tsr_branch_input_' + orderId);
                        var hidden = document.getElementById('tsr_assign_branch_' + orderId);
                        var dd = document.getElementById('tsr_branch_dropdown_' + orderId);
                        if (input) input.value = label;
                        if (hidden) hidden.value = branchId;
                        if (dd) dd.style.display = 'none';
                        var clearBtn = input ? input.nextElementSibling : null;
                        if (clearBtn) clearBtn.style.display = 'block';
                    }
                    function tsrClearBranchSelect(orderId) {
                        var input = document.getElementById('tsr_branch_input_' + orderId);
                        var hidden = document.getElementById('tsr_assign_branch_' + orderId);
                        var dd = document.getElementById('tsr_branch_dropdown_' + orderId);
                        if (input) { input.value = ''; input.focus(); }
                        if (hidden) hidden.value = '';
                        var clearBtn = input ? input.nextElementSibling : null;
                        if (clearBtn) clearBtn.style.display = 'none';
                        if (dd) {
                            dd.querySelectorAll('.tsr-branch-option').forEach(function(opt) { opt.style.display = 'flex'; });
                            dd.style.display = 'block';
                        }
                    }
                    document.addEventListener('click', function(e) {
                        if (!e.target.closest('.tsr-searchable-branch-select')) {
                            document.querySelectorAll('.tsr-branch-dropdown').forEach(function(d) { d.style.display = 'none'; });
                        }
                    });
                    document.addEventListener('submit', function(e) {
                        var form = e.target.closest('.tsr-assign-form');
                        if (!form) return;
                        var hidden = form.querySelector('input[name="branch_id"]');
                        var input = form.querySelector('.tsr-branch-search-input');
                        if (!hidden || !input) return;
                        if (!hidden.value && input.value.trim()) {
                            var query = input.value.trim().toLowerCase();
                            var options = form.querySelectorAll('.tsr-branch-option');
                            var exactMatch = null;
                            var firstVisible = null;
                            options.forEach(function(opt) {
                                if (opt.style.display !== 'none' && !firstVisible) firstVisible = opt;
                                if (opt.getAttribute('data-code').toLowerCase() === query) exactMatch = opt;
                            });
                            var chosen = exactMatch || firstVisible;
                            if (chosen) {
                                hidden.value = chosen.getAttribute('data-id');
                                input.value = chosen.innerText.trim();
                            } else {
                                e.preventDefault();
                                alert('Please select a valid branch from the list.');
                                input.focus();
                            }
                        } else if (!hidden.value) {
                            e.preventDefault();
                            alert('Please choose a branch to assign.');
                            input.focus();
                        }
                    });
                    </script>
                </div>

                <div class="tsr-form-grid">
                    <div class="tsr-card">
                        <div class="tsr-card-title">
                            <span><span class="dashicons dashicons-admin-settings"></span> Global Dispatch Rules</span>
                        </div>
                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                            <?php wp_nonce_field('tsr_rules'); ?>
                            <input type="hidden" name="action" value="tsr_save_rules">
                            
                            <div class="tsr-form-group" style="margin-bottom:20px;">
                                <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
                                    <input type="checkbox" name="enabled" value="1" <?php checked($rules['enabled'], true); ?>>
                                    <strong>Enable automatic order dispatch</strong>
                                </label>
                                <p class="description" style="margin-left:24px;">Automatically route new orders to eligible nearby branches.</p>
                            </div>

                            <div class="tsr-form-group">
                                <label>Same-Block Exclusive Window (Seconds)</label>
                                <input type="number" name="same_block_seconds" min="15" max="600" value="<?php echo (int) $rules['same_block_seconds']; ?>" style="max-width:140px;">
                                <p class="description">Time reserved exclusively for branches located within the customer's exact block before widening the search.</p>
                            </div>

                            <div class="tsr-form-group">
                                <label>Nearest Branches Per Wave</label>
                                <input type="number" name="nearby_count" min="1" max="20" value="<?php echo (int) $rules['nearby_count']; ?>" style="max-width:140px;">
                                <p class="description">Number of candidate branches contacted simultaneously during wave 2.</p>
                            </div>

                            <div class="tsr-form-group">
                                <label>Nearby Offer Response Window (Seconds)</label>
                                <input type="number" name="offer_timeout_seconds" min="60" max="900" value="<?php echo (int) $rules['offer_timeout_seconds']; ?>" style="max-width:140px;">
                                <p class="description">Time given to nearby branches to accept an offer before escalating to admin attention.</p>
                            </div>

                            <?php submit_button('Save Dispatch Rules', 'primary', 'submit', false); ?>
                        </form>
                    </div>

                    <div class="tsr-card">
                        <div class="tsr-card-title">
                            <span><span class="dashicons dashicons-controls-repeat"></span> Retry / Test Order Routing</span>
                        </div>
                        <p class="description">Run dispatch routing for an unassigned mobile order that timed out or was stalled. This triggers fresh offers based on current routing rules.</p>
                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top:18px;">
                            <?php wp_nonce_field('tsr_retry_dispatch'); ?>
                            <input type="hidden" name="action" value="tsr_retry_dispatch">
                            <div class="tsr-form-group">
                                <label>WooCommerce Order ID</label>
                                <input type="number" name="order_id" min="1" placeholder="e.g. 10425" required style="max-width:220px;">
                            </div>
                            <?php submit_button('Run Routing Now', 'secondary', 'submit', false); ?>
                        </form>
                    </div>
                </div>

            <?php elseif ($active_tab === 'branches'): ?>
                <div class="tsr-card">
                    <div class="tsr-card-title">
                        <span><span class="dashicons dashicons-store"></span> Branches Network Directory</span>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=branch-editor')); ?>" class="button button-primary">
                            + Add New Branch
                        </a>
                    </div>
                    <p class="description" style="margin-bottom:15px;">
                        <strong>Card</strong>: Branch may receive orders prepaid via Tap card. <strong>Open Now</strong>: Indicates whether the branch is currently within its configured Bahrain operating hours.
                    </p>
                    <table class="widefat striped" style="border-radius:6px;overflow:hidden;">
                        <thead>
                            <tr>
                                <th>Branch Name</th>
                                <th>Code</th>
                                <th>Block</th>
                                <th>Status</th>
                                <th>Payment Permissions</th>
                                <th>Coverage</th>
                                <th>Open Now</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                        <?php foreach ($branches as $branch): ?>
                            <?php
                            $edit_url = admin_url('admin.php?page=tabarak-seller-routing&tab=branch-editor&branch=' . (int) $branch['id']);
                            $is_open = TSR_Planner::is_open($branch);
                            ?>
                            <tr>
                                <td>
                                    <strong><a href="<?php echo esc_url($edit_url); ?>"><?php echo esc_html($branch['name']); ?></a></strong>
                                    <?php if (!empty($branch['phone'])): ?>
                                        <div style="font-size:11px;color:#64748b;"><?php echo esc_html($branch['phone']); ?></div>
                                    <?php endif; ?>
                                </td>
                                <td><code><?php echo esc_html($branch['code']); ?></code></td>
                                <td><span class="tsr-badge tsr-badge-info"><?php echo esc_html($branch['block_number'] ?: '—'); ?></span></td>
                                <td>
                                    <?php if ($branch['enabled']): ?>
                                        <span class="tsr-badge tsr-badge-success">Enabled</span>
                                    <?php else: ?>
                                        <span class="tsr-badge tsr-badge-neutral">Disabled</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                        <?php if (!empty($branch['card_enabled'])): ?>
                                            <span class="tsr-badge tsr-badge-info" title="Prepaid Card orders supported">💳 Card</span>
                                        <?php endif; ?>
                                        <?php if (!empty($branch['cod_enabled'])): ?>
                                            <span class="tsr-badge tsr-badge-success" title="Cash On Delivery supported">💵 COD</span>
                                        <?php endif; ?>
                                        <?php if (!empty($branch['wallet_enabled'])): ?>
                                            <span class="tsr-badge tsr-badge-neutral" title="Wallet orders supported">👛 Wallet</span>
                                        <?php endif; ?>
                                    </div>
                                </td>
                                <td>
                                    <?php if (!empty($branch['accept_anywhere'])): ?>
                                        <span class="tsr-badge tsr-badge-info">Anywhere</span>
                                    <?php else: ?>
                                        <span class="tsr-badge tsr-badge-neutral">Standard</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if ($is_open): ?>
                                        <span class="tsr-badge tsr-badge-success">🟢 Open</span>
                                    <?php else: ?>
                                        <span class="tsr-badge tsr-badge-neutral">⚪ Closed</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <a class="button button-small" href="<?php echo esc_url($edit_url); ?>">Edit Details</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

            <?php elseif ($active_tab === 'branch-editor'): ?>
                <div class="tsr-card">
                    <div class="tsr-card-title">
                        <span><span class="dashicons dashicons-edit"></span> <?php echo $selected ? 'Edit Branch: ' . esc_html($selected['name']) : 'Add New Branch'; ?></span>
                        <?php if ($selected): ?>
                            <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=branch-editor')); ?>" class="button button-secondary">
                                Cancel / Add New Branch
                            </a>
                        <?php endif; ?>
                    </div>

                    <?php if ($selected && !empty($selected['source_post_id'])): ?>
                        <div class="notice notice-info" style="margin: 0 0 20px;">
                            <p>This branch is linked with <strong>Our Branches</strong> directory. Copying Our Branches refreshes name, block, coordinates, contacts, hours, and active state. Card, COD, Wallet, and pharmacist assignments are preserved. <a href="<?php echo esc_url(admin_url('post.php?post=' . (int) $selected['source_post_id'] . '&action=edit')); ?>" target="_blank">Edit source post &rarr;</a></p>
                        </div>
                    <?php endif; ?>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <?php wp_nonce_field('tsr_branch'); ?>
                        <input type="hidden" name="action" value="tsr_save_branch">
                        <input type="hidden" name="branch_id" value="<?php echo (int) ($selected['id'] ?? 0); ?>">

                        <div class="tsr-form-grid">
                            <!-- Left Column: Core Details & Permissions -->
                            <div>
                                <h3 style="margin-top:0;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Basic Information</h3>
                                <?php
                                $locked_code = $selected && TSR_Accounts::has_linked_account($selected['id']);
                                ?>
                                <div class="tsr-form-group">
                                    <label>Branch Code (Username)</label>
                                    <input type="text" name="code" value="<?php echo esc_attr((string) ($selected['code'] ?? '')); ?>" required <?php echo $locked_code ? 'readonly style="background:#f1f5f9;"' : ''; ?>>
                                    <?php if ($locked_code): ?><p class="description">Code is locked because a seller account is linked.</p><?php endif; ?>
                                </div>
                                <div class="tsr-form-group">
                                    <label>Branch Name</label>
                                    <input type="text" name="name" value="<?php echo esc_attr((string) ($selected['name'] ?? '')); ?>" required>
                                </div>
                                <div class="tsr-form-group">
                                    <label>Origin Block (Bahrain Block Number)</label>
                                    <input type="text" name="block_number" value="<?php echo esc_attr((string) ($selected['block_number'] ?? '')); ?>" <?php echo (!$selected || !empty($selected['enabled'])) ? 'required' : ''; ?>>
                                </div>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                                    <div class="tsr-form-group">
                                        <label>Latitude</label>
                                        <input type="text" name="lat" value="<?php echo esc_attr((string) ($selected['lat'] ?? '')); ?>" required placeholder="26.xxxx">
                                    </div>
                                    <div class="tsr-form-group">
                                        <label>Longitude</label>
                                        <input type="text" name="lng" value="<?php echo esc_attr((string) ($selected['lng'] ?? '')); ?>" required placeholder="50.xxxx">
                                    </div>
                                </div>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                                    <div class="tsr-form-group">
                                        <label>Direct Phone</label>
                                        <input type="text" name="phone" value="<?php echo esc_attr((string) ($selected['phone'] ?? '')); ?>">
                                    </div>
                                    <div class="tsr-form-group">
                                        <label>WhatsApp</label>
                                        <input type="text" name="whatsapp" value="<?php echo esc_attr((string) ($selected['whatsapp'] ?? '')); ?>">
                                    </div>
                                </div>
                                <div class="tsr-form-group">
                                    <label>Area / Locality</label>
                                    <input type="text" name="locality" value="<?php echo esc_attr((string) ($selected['locality'] ?? '')); ?>">
                                </div>
                                <div class="tsr-form-group">
                                    <label>Detailed Address</label>
                                    <input type="text" name="address" value="<?php echo esc_attr((string) ($selected['address'] ?? '')); ?>">
                                </div>

                                <h3 style="margin-top:20px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Routing & Payment Permissions</h3>
                                <div style="margin-top:10px;">
                                    <?php
                                    $checkbox_fields = array(
                                        'enabled' => 'Branch Active in Routing',
                                        'always_open' => 'Operates 24 Hours',
                                        'card_enabled' => 'Accept Prepaid Card (Tap)',
                                        'cod_enabled' => 'Accept Cash on Delivery (COD)',
                                        'wallet_enabled' => 'Accept T-Wallet Payments',
                                        'accept_anywhere' => 'Receive Offers from Any Block'
                                    );
                                    foreach ($checkbox_fields as $key => $label) {
                                        $default = in_array($key, array('enabled', 'always_open', 'cod_enabled', 'wallet_enabled'), true);
                                        $is_checked = $selected ? !empty($selected[$key]) : $default;
                                        echo '<label class="tsr-checkbox-pill">';
                                        echo '<input type="checkbox" name="' . esc_attr($key) . '" value="1" ' . checked($is_checked, true, false) . '> ';
                                        echo esc_html($label);
                                        echo '</label>';
                                    }
                                    ?>
                                </div>
                                <p class="description" style="margin-top:8px;"><strong>Note:</strong> Enable "Accept Prepaid Card" only for confirmed branches authorized to fulfil orders prepaid by card.</p>
                            </div>

                            <!-- Right Column: Operating Hours & Staff -->
                            <div>
                                <h3 style="margin-top:0;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Weekly Operating Hours (Bahrain Time)</h3>
                                <p class="description" style="margin-bottom:12px;">Up to 3 time periods per day in 24-hour format (HH:MM to HH:MM). Use 24:00 for midnight.</p>
                                <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;">
                                <?php
                                $hours = $selected ? json_decode($selected['hours_json'], true) : array();
                                foreach (array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') as $day => $label): ?>
                                    <div class="tsr-hours-row">
                                        <div class="tsr-hours-day"><?php echo esc_html($label); ?></div>
                                        <?php foreach (range(0, 2) as $index):
                                            $slot = $hours[(string) $day][$index] ?? array('', '');
                                        ?>
                                            <div class="tsr-hours-slot">
                                                <input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" name="open[<?php echo $day; ?>][<?php echo $index; ?>]" value="<?php echo esc_attr($slot[0] ?? ''); ?>">
                                                <span style="color:#94a3b8;font-size:11px;">–</span>
                                                <input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" name="close[<?php echo $day; ?>][<?php echo $index; ?>]" value="<?php echo esc_attr($slot[1] ?? ''); ?>">
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                <?php endforeach; ?>
                                </div>

                                <h3 style="margin-top:22px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Assigned Pharmacists Roster</h3>
                                <p class="description">Enter pharmacist names (one per line). Hub employee IDs are linked automatically via the staff directory.</p>
                                <div class="tsr-form-group">
                                    <textarea name="pharmacists" rows="6" style="width:100%;font-family:monospace;"><?php echo esc_textarea(implode("\n", (array) json_decode($selected['pharmacists_json'] ?? '[]', true))); ?></textarea>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:25px;padding-top:15px;border-top:1px solid #f1f5f9;">
                            <?php submit_button($selected ? 'Save Branch Changes' : 'Create Branch', 'primary', 'submit', false); ?>
                            <?php if ($selected): ?>
                                <a href="<?php echo esc_url(admin_url('admin.php?page=tabarak-seller-routing&tab=branches')); ?>" class="button button-secondary" style="margin-left:10px;">Back to Directory</a>
                            <?php endif; ?>
                        </div>
                    </form>
                </div>

            <?php elseif ($active_tab === 'accounts'): ?>
                <div class="tsr-card">
                    <?php TSR_Accounts::render($branches); ?>
                </div>

                <?php if (current_user_can('manage_options')): ?>
                    <div class="tsr-card">
                        <div class="tsr-card-title">
                            <span><span class="dashicons dashicons-admin-links"></span> Link Existing Seller User to Branch</span>
                        </div>
                        <p class="description">For linking an existing user with the 'tabarak_seller' role to an official branch code.</p>
                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;">
                            <?php wp_nonce_field('tsr_account'); ?>
                            <input type="hidden" name="action" value="tsr_assign_account">
                            <select name="user_id" required style="min-width:220px;">
                                <option value="">Select Seller User Account</option>
                                <?php foreach (get_users(array('role' => 'tabarak_seller')) as $user): ?>
                                    <option value="<?php echo (int) $user->ID; ?>"><?php echo esc_html($user->user_login); ?> (ID: <?php echo (int) $user->ID; ?>)</option>
                                <?php endforeach; ?>
                            </select>
                            <select name="branch_id" required style="min-width:220px;">
                                <option value="">Select Branch</option>
                                <?php foreach ($branches as $branch): ?>
                                    <option value="<?php echo (int) $branch['id']; ?>"><?php echo esc_html($branch['name']); ?> (<?php echo esc_html($branch['code']); ?>)</option>
                                <?php endforeach; ?>
                            </select>
                            <?php submit_button('Link Account to Branch', 'secondary', 'submit', false); ?>
                        </form>
                    </div>
                <?php endif; ?>

                <div class="tsr-card">
                    <?php TSR_Pharmacists::render(); ?>
                </div>

            <?php elseif ($active_tab === 'tools'): ?>
                <div class="tsr-card">
                    <?php TSR_Branch_Transfer::render(); ?>
                </div>
            <?php endif; ?>

        </div>
        <?php
    }

    public function save_rules() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_rules');
        if (isset($_POST['enabled'])) {
            $issues = self::readiness_issues();
            if ($issues) wp_die('Automatic dispatch needs linked seller accounts, pharmacist rosters, and valid locations for every enabled branch. Fix ' . count($issues) . ' branch setup issues first.', '', array('response' => 422));
        }
        update_option('tabarak_seller_routing_rules', array('enabled' => isset($_POST['enabled']),
            'same_block_seconds' => min(600, max(15, absint($_POST['same_block_seconds'] ?? 60))),
            'nearby_count' => min(20, max(1, absint($_POST['nearby_count'] ?? 3))),
            'offer_timeout_seconds' => min(900, max(60, absint($_POST['offer_timeout_seconds'] ?? 180)))), false);
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=dispatch&saved=1')); exit;
    }
    public function retry_dispatch() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_retry_dispatch');
        if (!self::rules()['enabled']) wp_die('Enable automatic dispatch before retrying an order.', '', array('response' => 409));
        $order_id = absint($_POST['order_id'] ?? 0);
        $order = wc_get_order($order_id);
        if (!self::is_mobile_order($order)) wp_die('Choose an existing mobile order.', '', array('response' => 422));
        if (in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)) wp_die('This order is closed.', '', array('response' => 409));
        global $wpdb;
        $state = $wpdb->get_var($wpdb->prepare('SELECT state FROM ' . self::table('dispatch') . ' WHERE order_id=%d', $order_id));
        if ($state === 'needs_admin') {
            $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='pending',wave=0,updated_at=%s WHERE order_id=%d AND state='needs_admin' AND branch_id IS NULL", current_time('mysql', true), $order_id));
            if ($changed !== 1) wp_die('This order is no longer available for retry.', '', array('response' => 409));
            wp_clear_scheduled_hook('tsr_dispatch_order', array($order_id));
            self::event($order_id, 'retry_dispatch', get_current_user_id());
        } elseif ($state && !in_array($state, array('pending', 'needs_location', 'waiting_for_open'), true)) wp_die('This order already has a routing outcome.', '', array('response' => 409));
        $this->dispatch_order($order_id);
        $state = $wpdb->get_var($wpdb->prepare('SELECT state FROM ' . self::table('dispatch') . ' WHERE order_id=%d', $order_id));
        if (!$state) wp_die('Routing could not start. Check that the payment method is supported and any required payment is confirmed.', '', array('response' => 409));
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=dispatch&retry_order=' . $order_id . '&retry_state=' . rawurlencode($state))); exit;
    }
    public function save_branch() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_branch');
        global $wpdb;
        $id = absint($_POST['branch_id'] ?? 0);
        $code = sanitize_key(wp_unslash($_POST['code'] ?? '')); $name = sanitize_text_field(wp_unslash($_POST['name'] ?? ''));
        if ($code === 'd001') wp_die('District branch is retired.', '', array('response' => 409));
        $original = $id ? self::branch($id) : null;
        if ($original && $original['code'] !== $code && TSR_Accounts::has_linked_account($id)) wp_die('Branch code cannot change while an account is linked.', '', array('response' => 409));
        $block = preg_replace('/\D/', '', (string) wp_unslash($_POST['block_number'] ?? ''));
        $lat = filter_var(wp_unslash($_POST['lat'] ?? ''), FILTER_VALIDATE_FLOAT); $lng = filter_var(wp_unslash($_POST['lng'] ?? ''), FILTER_VALIDATE_FLOAT);
        $enabled = isset($_POST['enabled']);
        if (!$code || !$name || ($block === '' ? $enabled : !preg_match('/^\d{2,4}$/', $block)) || $lat === false || $lng === false || $lat < 25.5 || $lat > 26.7 || $lng < 50.2 || $lng > 51.0) wp_die('Enter a valid Bahrain branch, block, and coordinates. Enabled branches require a block.', '', array('response' => 422));
        $hours = array();
        foreach (range(0, 6) as $day) {
            foreach (range(0, 2) as $slot) {
                $start = sanitize_text_field(wp_unslash($_POST['open'][$day][$slot] ?? ''));
                $end = sanitize_text_field(wp_unslash($_POST['close'][$day][$slot] ?? ''));
                if ($start !== '' || $end !== '') {
                    if (TSR_Planner::minutes_since_midnight($start) === null || $start === '24:00' ||
                        TSR_Planner::minutes_since_midnight($end) === null || $start === $end) wp_die('Invalid branch hours.', '', array('response' => 422));
                    $hours[(string) $day][] = array($start, $end);
                }
            }
        }
        $names = array_values(array_unique(array_filter(array_map('sanitize_text_field', preg_split('/\r\n|\r|\n/', (string) wp_unslash($_POST['pharmacists'] ?? ''))))));
        $known_codes = $original ? (json_decode((string) ($original['pharmacist_codes_json'] ?? ''), true) ?: array()) : array();
        $known_codes = array_filter($known_codes, static function($pharmacist_name) use ($names) { return in_array($pharmacist_name, $names, true); });
        $data = array('code' => $code, 'name' => $name, 'block_number' => $block, 'lat' => $lat, 'lng' => $lng, 'hours_json' => wp_json_encode($hours), 'pharmacists_json' => wp_json_encode(array_slice($names, 0, 100)), 'pharmacist_codes_json' => wp_json_encode($known_codes), 'updated_at' => current_time('mysql', true));
        foreach (array('phone' => 40, 'whatsapp' => 40, 'address' => 255, 'locality' => 150) as $key => $max) {
            $data[$key] = sanitize_text_field(wp_unslash($_POST[$key] ?? ''));
            if (strlen($data[$key]) > $max) wp_die('Branch contact field is too long.', '', array('response' => 422));
        }
        foreach (array('enabled', 'always_open', 'card_enabled', 'cod_enabled', 'wallet_enabled', 'accept_anywhere') as $key) $data[$key] = isset($_POST[$key]) ? 1 : 0;
        $result = $id ? $wpdb->update(self::table('branches'), $data, array('id' => $id)) : $wpdb->insert(self::table('branches'), $data);
        if ($result === false) wp_die('Could not save branch. Branch code must be unique.', '', array('response' => 409));
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=branch-editor&saved=1&branch=' . ($id ?: $wpdb->insert_id))); exit;
    }
    public function assign_account() {
        if (!current_user_can('manage_options')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_account');
        $user = get_userdata(absint($_POST['user_id'] ?? 0)); $branch = self::branch(absint($_POST['branch_id'] ?? 0));
        if (!$user || !in_array('tabarak_seller', (array) $user->roles, true) || !$branch) wp_die('Choose a seller account and branch.', '', array('response' => 422));
        if (strcasecmp($user->user_login, $branch['code']) !== 0) wp_die('The seller username must match this branch code.', '', array('response' => 409));
        $linked = (int) get_user_meta($user->ID, self::BRANCH_META, true);
        if ($linked && $linked !== (int) $branch['id']) wp_die('This seller account already belongs to another branch.', '', array('response' => 409));
        foreach (get_users(array('meta_key' => self::BRANCH_META, 'meta_value' => (int) $branch['id'], 'fields' => 'ID')) as $other_id) {
            if ((int) $other_id !== (int) $user->ID) wp_die('Another account is already linked to this branch.', '', array('response' => 409));
        }
        update_user_meta($user->ID, self::BRANCH_META, (int) $branch['id']);
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=accounts&saved=1')); exit;
    }
    public function manual_assign() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        $order_id = absint($_POST['order_id'] ?? 0);
        if (isset($_POST['_wpnonce']) && wp_verify_nonce($_POST['_wpnonce'], 'tsr_manual_assign_direct')) {
            // direct assignment nonce valid
        } else {
            check_admin_referer('tsr_manual_assign_' . $order_id);
        }
        $order = wc_get_order($order_id); $branch = self::branch(absint($_POST['branch_id'] ?? 0));
        if (!self::is_mobile_order($order) || !$branch || !$branch['enabled']) wp_die('Invalid order or branch.', '', array('response' => 422));
        if (in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)) wp_die('This order is closed.', '', array('response' => 409));
        $payment = TSR_Planner::payment_kind($order);
        if (empty($branch[$payment . '_enabled'])) wp_die('This branch cannot receive this payment method.', '', array('response' => 422));
        if ($payment === 'card' && !self::card_paid($order)) wp_die('Card payment is not confirmed.', '', array('response' => 409));
        if ($payment === 'wallet' && !self::wallet_paid($order)) wp_die('Wallet payment is not confirmed.', '', array('response' => 409));
        global $wpdb; $now = current_time('mysql', true);
        $wpdb->query('START TRANSACTION');
        $wpdb->query($wpdb->prepare('INSERT IGNORE INTO ' . self::table('dispatch') . ' (order_id,state,wave,updated_at) VALUES (%d,%s,0,%s)', $order_id, 'pending', $now));
        $changed = $wpdb->query($wpdb->prepare('UPDATE ' . self::table('dispatch') . " SET state='claimed',branch_id=%d,claimed_by=%d,claimed_at=%s,updated_at=%s WHERE order_id=%d AND state IN ('needs_location','waiting_for_open','needs_admin','pending')", (int) $branch['id'], get_current_user_id(), $now, $now, $order_id));
        if ($changed !== 1) { $wpdb->query('ROLLBACK'); wp_die('Order was already assigned or changed.', '', array('response' => 409)); }
        $wpdb->query($wpdb->prepare('UPDATE ' . self::table('offers') . " SET state='closed' WHERE order_id=%d AND state='open'", $order_id));
        $wpdb->query('COMMIT');
        $order->update_meta_data('_tabarak_seller_branch_id', (int) $branch['id']); $order->save();
        self::event($order_id, 'assigned_by_admin', get_current_user_id(), (int) $branch['id']);
        self::notify_branch((int) $branch['id'], $order_id, 'manual_assignment', 'Order #' . $order->get_order_number() . ' assigned to your branch');
        self::notify_admins($order_id, 'manual_assignment', 'Order #' . $order->get_order_number() . ' assigned to ' . $branch['name']);
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=dispatch&saved=1')); exit;
    }
}

register_activation_hook(__FILE__, array('Tabarak_Seller_Routing', 'activate'));
add_action('plugins_loaded', array('Tabarak_Seller_Routing', 'boot'), 20);
