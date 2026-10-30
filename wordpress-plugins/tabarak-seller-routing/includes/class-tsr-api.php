<?php
defined('ABSPATH') || exit;

/** Separate staff authentication and scoped REST API; customer tokens are never accepted. */
final class TSR_API {
    private $routing;
    private $delivery_status_cache = array();
    public function __construct($routing) { $this->routing = $routing; }

    public function register_routes() {
        $routes = array(
            array('/login', 'POST', 'login'),
            array('/logout', 'POST', 'logout'),
            array('/me', 'GET', 'me'),
            array('/orders', 'GET', 'orders'),
            array('/active-orders', 'GET', 'active_orders'),
            array('/order-history', 'GET', 'order_history'),
            array('/earnings', 'GET', 'earnings'),
            array('/orders/(?P<id>\d+)', 'GET', 'order'),
            array('/orders/(?P<id>\d+)/claim', 'POST', 'claim'),
            array('/orders/(?P<id>\d+)/pharmacist', 'POST', 'assign_pharmacist'),
            array('/orders/(?P<id>\d+)/reject', 'POST', 'reject'),
            array('/orders/(?P<id>\d+)/start', 'POST', 'start_preparing'),
            array('/orders/(?P<id>\d+)/ready', 'POST', 'mark_ready'),
            array('/orders/(?P<id>\d+)/handoff', 'POST', 'handoff'),
            array('/orders/(?P<id>\d+)/driver', 'POST', 'assign_driver'),
            array('/orders/(?P<id>\d+)/edit', 'POST', 'edit_order'),
            array('/products', 'GET', 'products'),
            array('/drivers', 'GET', 'drivers'),
            array('/pharmacists', 'GET', 'pharmacists'),
            array('/notifications', 'GET', 'notifications'),
            array('/notifications/read-all', 'POST', 'read_all_notifications'),
            array('/notifications/(?P<id>\d+)/read', 'POST', 'read_notification'),
            array('/push-token', 'POST', 'register_push_token'),
            array('/dashboard', 'GET', 'dashboard'),
        );
        foreach ($routes as $route) {
            register_rest_route(Tabarak_Seller_Routing::NS, $route[0], array('methods' => $route[1],
                'permission_callback' => array($this, 'https_only'), 'callback' => array($this, $route[2])));
        }
    }

    public function https_only() { return is_ssl() ? true : new WP_Error('tsr_https_required', 'HTTPS required.', array('status' => 403)); }
    private function error($code, $message, $status = 400) { return new WP_Error('tsr_' . $code, $message, array('status' => $status)); }

    private function driver_bridge_ready() {
        return defined('TSR_DRIVER_BRIDGE_URL') && defined('TSR_DRIVER_BRIDGE_SECRET')
            && is_string(TSR_DRIVER_BRIDGE_URL) && is_string(TSR_DRIVER_BRIDGE_SECRET)
            && strlen(TSR_DRIVER_BRIDGE_SECRET) >= 32
            && wp_parse_url(TSR_DRIVER_BRIDGE_URL, PHP_URL_SCHEME) === 'https'
            && (bool) wp_http_validate_url(TSR_DRIVER_BRIDGE_URL);
    }

    private function driver_bridge($payload) {
        if (!$this->driver_bridge_ready()) return $this->error('driver_bridge_unavailable', 'Driver app connection is not configured.', 503);
        $response = wp_safe_remote_post(TSR_DRIVER_BRIDGE_URL, array(
            'timeout' => 15,
            'headers' => array('Content-Type' => 'application/json', 'Accept' => 'application/json',
                'X-Seller-Bridge-Secret' => TSR_DRIVER_BRIDGE_SECRET),
            'body' => wp_json_encode($payload),
        ));
        if (is_wp_error($response)) return $this->error('driver_bridge_unavailable', 'Driver app connection is unavailable. Try again.', 503);
        $status = wp_remote_retrieve_response_code($response);
        $result = json_decode(wp_remote_retrieve_body($response), true);
        if ($status < 200 || $status >= 300 || !is_array($result)) {
            $message = is_array($result) && is_string($result['error'] ?? null) ? $result['error'] : 'Driver app connection failed. Try again.';
            return $this->error('driver_bridge_failed', $message, $status === 409 ? 409 : 503);
        }
        return $result;
    }

    private function pharmacist_roster($branch) {
        if ($branch && $this->driver_bridge_ready()) {
            $result = $this->driver_bridge(array('action' => 'pharmacists', 'branch_code' => (string) $branch['code']));
            if (!is_wp_error($result) && is_array($result['items'] ?? null)) {
                $names = array(); $codes = array();
                foreach ($result['items'] as $person) {
                    if (!is_array($person)) continue;
                    $name = sanitize_text_field((string) ($person['name'] ?? ''));
                    $code = strtoupper(sanitize_text_field((string) ($person['code'] ?? '')));
                    if ($name === '') continue;
                    $names[] = $name;
                    if ($code !== '') $codes[$code] = $name;
                }
                return array('names' => array_values(array_unique($names)), 'codes' => $codes, 'source' => 'hub');
            }
        }
        return array(
            'names' => $branch ? (json_decode($branch['pharmacists_json'], true) ?: array()) : array(),
            'codes' => $branch ? (json_decode((string) ($branch['pharmacist_codes_json'] ?? ''), true) ?: array()) : array(),
            'source' => 'wordpress',
        );
    }

    private function delivery_statuses($ids) {
        $ids = array_values(array_unique(array_filter(array_map('absint', $ids))));
        if (!$ids || !$this->driver_bridge_ready()) return array();
        $missing = array_values(array_filter($ids, function($id) { return !array_key_exists($id, $this->delivery_status_cache); }));
        if ($missing) {
            $result = $this->driver_bridge(array('action' => 'statuses', 'order_ids' => array_map('strval', $missing)));
            if (is_wp_error($result) || !is_array($result['orders'] ?? null)) return array();
            foreach ($missing as $id) $this->delivery_status_cache[$id] = null;
            foreach ($result['orders'] as $row) {
                $id = absint($row['external_order_id'] ?? 0);
                if ($id && array_key_exists($id, $this->delivery_status_cache)) $this->delivery_status_cache[$id] = $row;
            }
        }
        $statuses = array();
        foreach ($ids as $id) if (is_array($this->delivery_status_cache[$id] ?? null)) $statuses[$id] = $this->delivery_status_cache[$id];
        return $statuses;
    }

    private function reconcile_driver_cancellation($order, $status) {
        $operational_return = is_array($status) && ($status['delivery_status'] ?? '') === 'recorded'
            && !empty($status['assignment_returned_at']);
        if (!is_array($status) || (!$operational_return && ($status['delivery_status'] ?? '') !== 'cancelled')
            || !$order->get_meta('_tabarak_seller_driver_app_id')) return;
        $cancelled_at = sanitize_text_field((string) ($operational_return
            ? $status['assignment_returned_at'] : ($status['cancelled_at'] ?? '')));
        if ($cancelled_at === '') return;
        if ((string) $order->get_meta('_tabarak_seller_driver_cancel_notice_at') === $cancelled_at) return;
        global $wpdb;
        $id = (int) $order->get_id();
        $handed = $wpdb->get_var($wpdb->prepare('SELECT order_id FROM ' . Tabarak_Seller_Routing::table('handoffs') . ' WHERE order_id=%d', $id));
        $returnable = $operational_return && empty($status['picked_up_at']) && !$handed && !$order->get_meta('_tabarak_seller_handed_at');
        $previous_driver = (string) $order->get_meta($order->get_created_via() === 'tabarak-mobile'
            ? '_tabarak_delivery_driver_name' : '_propharm_delivery_driver_name');
        $order->update_meta_data('_tabarak_seller_driver_cancel_notice_at', $cancelled_at);
        if ($returnable) {
            $prefix = $order->get_created_via() === 'tabarak-mobile' ? '_tabarak_delivery_driver_' : '_propharm_delivery_driver_';
            $order->delete_meta_data('_tabarak_seller_driver_app_id');
            $order->delete_meta_data('_tabarak_seller_delivery_order_id');
            foreach (array('id', 'name', 'phone') as $key) $order->delete_meta_data($prefix . $key);
            $order->update_meta_data('_tabarak_seller_driver_returned_at', $cancelled_at);
        }
        $order->save();
        $branch_id = (int) $order->get_meta('_tabarak_seller_branch_id');
        Tabarak_Seller_Routing::event($id, $returnable ? 'driver_pickup_cancelled' : 'driver_delivery_cancelled', 0,
            $branch_id, $previous_driver);
        if ($branch_id) Tabarak_Seller_Routing::notify_branch($branch_id, $id,
            'driver_cancel:' . md5($cancelled_at),
            'Order #' . $order->get_order_number() . ($returnable ? ' needs another driver' : ' driver cancellation needs dispatch review'));
    }

    private function reconcile_driver_delivery($order, $status) {
        if (!is_array($status) || !in_array($status['delivery_status'] ?? '', array('picked_up', 'delivered'), true)
            || !$order->get_meta('_tabarak_seller_driver_app_id')) return;
        $current_status = method_exists($order, 'get_status') ? (string) $order->get_status() : '';
        if (in_array($current_status, array('completed', 'cancelled', 'failed', 'refunded'), true)) return;
        $picked_at = strtotime((string) ($status['picked_up_at'] ?? '')) ?: strtotime((string) ($status['delivered_at'] ?? ''));
        $id = (int) $order->get_id();
        $branch_id = (int) $order->get_meta('_tabarak_seller_branch_id');
        if ($picked_at && !$order->get_meta('_tabarak_seller_handed_at')) {
            global $wpdb;
            $handed_at = gmdate('Y-m-d H:i:s', $picked_at);
            $inserted = method_exists($wpdb, 'query') ? $wpdb->query($wpdb->prepare(
                'INSERT IGNORE INTO ' . Tabarak_Seller_Routing::table('handoffs') .
                ' (order_id,branch_id,order_number,amount_fils,currency,block_number,pharmacist,handed_at,financial_state) VALUES (%d,%d,%s,%d,%s,%s,%s,%s,%s)',
                $id, $branch_id, (string) $order->get_order_number(), (int) round((float) $order->get_total() * 1000),
                (string) $order->get_currency(), Tabarak_Seller_Routing::block_for_order($order),
                (string) $order->get_meta('_tabarak_seller_pharmacist'), $handed_at, 'active'
            )) : false;
            if ($inserted !== false) {
                $order->update_meta_data('_tabarak_seller_handed_at', gmdate('c', $picked_at));
                $order->save();
                if ($inserted === 1 && method_exists('Tabarak_Seller_Routing', 'event')) {
                    Tabarak_Seller_Routing::event($id, 'picked_up', 0, $branch_id, 'Driver confirmed pickup');
                }
            }
        }
        if (($status['delivery_status'] ?? '') === 'delivered') {
            $delivered_at = strtotime((string) ($status['delivered_at'] ?? '')) ?: time();
            if (!$order->get_meta('_tabarak_seller_delivered_at')) {
                $order->update_meta_data('_tabarak_seller_delivered_at', gmdate('c', $delivered_at));
                $order->save();
            }
            if (method_exists($order, 'update_status') && $order->get_status() !== 'completed') {
                $order->update_status('completed', 'Delivery confirmed by Driver app.');
                if (method_exists('Tabarak_Seller_Routing', 'event')) {
                    Tabarak_Seller_Routing::event($id, 'delivered', 0, $branch_id, 'Driver confirmed delivery');
                }
            }
            return;
        }
        if (method_exists($order, 'update_status') && $order->get_status() !== 'handed-to-driver') {
            $order->update_status('handed-to-driver');
        }
    }

    public function poll_driver_cancellations() {
        if (!$this->driver_bridge_ready()) return;
        global $wpdb;
        $ids = $wpdb->get_col('SELECT order_id FROM ' . Tabarak_Seller_Routing::table('dispatch')
            . " WHERE state='claimed' ORDER BY updated_at DESC LIMIT 100") ?: array();
        foreach (array_chunk($ids, 100) as $batch) {
            $statuses = $this->delivery_statuses($batch);
            foreach ($statuses as $id => $status) {
                $state = $status['delivery_status'] ?? '';
                if (!in_array($state, array('assigned', 'recorded', 'cancelled', 'picked_up', 'delivered'), true)) continue;
                $order = wc_get_order($id);
                if (!Tabarak_Seller_Routing::is_mobile_order($order)) continue;
                if ($state === 'assigned') {
                    if ($order->get_meta('_tabarak_seller_driver_sync_pending')) $this->sync_assigned_driver_order($order);
                } elseif ($state === 'cancelled' || ($state === 'recorded' && !empty($status['assignment_returned_at']))) {
                    $this->reconcile_driver_cancellation($order, $status);
                } else {
                    $this->reconcile_driver_delivery($order, $status);
                }
            }
        }
    }

    /** Consume a bounded batch; the database lease keeps failures retryable. */
    public function drain_delivery_outbox() {
        if (!defined('TSR_DELIVERY_OUTBOX_CONSUMER_V1') || TSR_DELIVERY_OUTBOX_CONSUMER_V1 !== true) return;
        $result = $this->driver_bridge(array('action' => 'drain_outbox'));
        update_option('tsr_delivery_outbox_last_run_at', gmdate('c'), false);
        if (is_wp_error($result)) {
            update_option('tsr_delivery_outbox_last_error', $result->get_error_message(), false);
            return;
        }
        update_option('tsr_delivery_outbox_last_error', '', false);
        update_option('tsr_delivery_outbox_last_result', array(
            'claimed' => (int) ($result['claimed'] ?? 0),
            'sent' => (int) ($result['sent'] ?? 0),
            'ticketed' => (int) ($result['ticketed'] ?? 0),
            'retried' => (int) ($result['retried'] ?? 0),
            'superseded' => (int) ($result['superseded'] ?? 0),
        ), false);
    }

    private function actor($request) {
        global $wpdb;
        $header = (string) $request->get_header('authorization');
        if (!preg_match('/^Bearer ([a-f0-9]{64})$/', $header, $match)) return $this->error('unauthorized', 'Sign in again.', 401);
        $hash = hash_hmac('sha256', $match[1], wp_salt('auth'));
        $session = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . Tabarak_Seller_Routing::table('sessions') . ' WHERE token_hash=%s AND expires_at>%d', $hash, time()), ARRAY_A);
        if (!$session) return $this->error('unauthorized', 'Sign in again.', 401);
        $user = get_userdata((int) $session['user_id']);
        $valid = $user && hash_equals((string) $session['password_fingerprint'], hash_hmac('sha256', $user->user_pass, wp_salt('auth')));
        if (!$valid || (!$this->is_admin($user) && !in_array('tabarak_seller', (array) $user->roles, true))) {
            $wpdb->delete(Tabarak_Seller_Routing::table('sessions'), array('token_hash' => $hash));
            return $this->error('unauthorized', 'Sign in again.', 401);
        }
        $branch_id = $this->is_admin($user) ? 0 : (int) get_user_meta($user->ID, Tabarak_Seller_Routing::BRANCH_META, true);
        if (!$this->is_admin($user) && !Tabarak_Seller_Routing::branch($branch_id)) return $this->error('branch_required', 'This account is not linked to a branch.', 403);
        return array('user' => $user, 'admin' => $this->is_admin($user), 'branch_id' => $branch_id, 'token_hash' => $hash);
    }

    private function is_admin($user) { return $user && (user_can($user, 'manage_woocommerce') || user_can($user, 'manage_options')); }
    private function auth($request) { $actor = $this->actor($request); return is_wp_error($actor) ? $actor : $actor; }
    private function require_order($request, $actor, $claimed_only = false) {
        $id = absint($request['id']); $order = wc_get_order($id);
        if (!Tabarak_Seller_Routing::is_mobile_order($order)) return $this->error('not_found', 'Order not found.', 404);
        if ($claimed_only && in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)) {
            return $this->error('order_closed', 'This order is closed.', 409);
        }
        global $wpdb;
        $dispatch = $wpdb->get_row($wpdb->prepare('SELECT state,branch_id,wave,updated_at FROM ' . Tabarak_Seller_Routing::table('dispatch') . ' WHERE order_id=%d', $id), ARRAY_A);
        if ($actor['admin']) {
            if ($claimed_only && (!$dispatch || $dispatch['state'] !== 'claimed')) return $this->error('not_claimed', 'Assign a branch before this action.', 409);
            return $order;
        }
        if ($dispatch && $dispatch['state'] === 'claimed' && (int) $dispatch['branch_id'] === $actor['branch_id']) return $order;
        if (!$claimed_only && $dispatch && $dispatch['state'] === 'offered') {
            $offer = $wpdb->get_var($wpdb->prepare('SELECT state FROM ' . Tabarak_Seller_Routing::table('offers') . ' WHERE order_id=%d AND branch_id=%d', $id, $actor['branch_id']));
            if ($offer === 'open') {
                if (TSR_Planner::offer_is_active($dispatch, Tabarak_Seller_Routing::rules())) return $order;
                return $this->error('offer_expired', 'This offer has expired.', 409);
            }
        }
        return $this->error('not_found', 'Order not found.', 404);
    }

    public function login($request) {
        global $wpdb;
        $body = $request->get_json_params();
        if (!is_array($body) || !is_string($body['login'] ?? null) || !is_string($body['password'] ?? null)) return $this->error('invalid_login', 'Enter your login and password.', 422);
        $login = trim($body['login']); $password = $body['password'];
        if ($login === '' || strlen($login) > 150 || strlen($password) > 256) return $this->error('invalid_login', 'Invalid login.', 422);
        $rate_key = 'tsr_login_' . hash('sha256', strtolower($login) . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
        $attempts = (int) get_transient($rate_key);
        if ($attempts >= 8) return $this->error('rate_limited', 'Try again in 15 minutes.', 429);
        $user = wp_authenticate($login, $password);
        if (is_wp_error($user) || (!$this->is_admin($user) && !in_array('tabarak_seller', (array) $user->roles, true))) {
            set_transient($rate_key, $attempts + 1, 15 * MINUTE_IN_SECONDS);
            return $this->error('invalid_login', 'Invalid login.', 401);
        }
        $branch_id = $this->is_admin($user) ? 0 : (int) get_user_meta($user->ID, Tabarak_Seller_Routing::BRANCH_META, true);
        if (!$this->is_admin($user) && !Tabarak_Seller_Routing::branch($branch_id)) return $this->error('branch_required', 'Ask the administrator to link this login to a branch.', 403);
        delete_transient($rate_key);
        $token = bin2hex(random_bytes(32));
        $saved = $wpdb->insert(Tabarak_Seller_Routing::table('sessions'), array(
            'token_hash' => hash_hmac('sha256', $token, wp_salt('auth')), 'user_id' => $user->ID,
            'password_fingerprint' => hash_hmac('sha256', $user->user_pass, wp_salt('auth')),
            'expires_at' => time() + 12 * HOUR_IN_SECONDS));
        if (!$saved) return $this->error('unavailable', 'Could not start session.', 503);
        return array('token' => $token, 'expires_at' => time() + 12 * HOUR_IN_SECONDS,
            'user' => array('id' => $user->ID, 'name' => $user->display_name,
                'role' => $this->is_admin($user) ? 'admin' : 'branch', 'branch_id' => $branch_id));
    }

    public function logout($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        global $wpdb; $wpdb->delete(Tabarak_Seller_Routing::table('sessions'), array('token_hash' => $actor['token_hash']));
        return array('ok' => true);
    }

    public function me($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $branch = $actor['branch_id'] ? Tabarak_Seller_Routing::branch($actor['branch_id']) : null;
        $codes = $branch ? (json_decode((string) ($branch['pharmacist_codes_json'] ?? ''), true) ?: array()) : array();
        $records = array();
        foreach ($codes as $code => $name) $records[] = array('code' => (string) $code, 'name' => (string) $name);
        return array('id' => $actor['user']->ID, 'name' => $actor['user']->display_name,
            'role' => $actor['admin'] ? 'admin' : 'branch', 'branch' => $branch ? array('id' => (int) $branch['id'], 'name' => $branch['name'],
                'pharmacists' => json_decode($branch['pharmacists_json'], true) ?: array(), 'pharmacist_records' => $records) : null);
    }

    public function pharmacists($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        if ($actor['admin'] || !$actor['branch_id']) return $this->error('branch_login_required', 'Use a branch account.', 403);
        $branch = Tabarak_Seller_Routing::branch($actor['branch_id']);
        if (!$branch) return $this->error('branch_required', 'Assigned branch could not be verified.', 403);
        $roster = $this->pharmacist_roster($branch);
        $records = array();
        foreach ($roster['codes'] as $code => $name) $records[] = array('code' => (string) $code, 'name' => (string) $name);
        foreach ($roster['names'] as $name) {
            if (!in_array($name, array_column($records, 'name'), true)) $records[] = array('code' => '', 'name' => (string) $name);
        }
        return array('items' => $records, 'source' => $roster['source']);
    }

    private function payment($order) {
        $kind = TSR_Planner::payment_kind($order);
        $wallet_key = $order->get_created_via() === 'tabarak-mobile' ? '_tabarak_twallet_paid_fils' : '_propharm_twallet_paid_fils';
        $wallet = max(0, (int) $order->get_meta($wallet_key));
        $total = (int) round((float) $order->get_total() * 1000);
        $card_paid = $kind === 'card' && Tabarak_Seller_Routing::card_paid($order);
        $wallet_paid = $kind === 'wallet' && Tabarak_Seller_Routing::wallet_paid($order);
        $original_paid = $order->get_meta('_tabarak_seller_original_paid_fils', true);
        $paid = $original_paid !== '' ? max(0, (int) $original_paid) : ($card_paid || $wallet_paid ? $total : $wallet);
        $credited = max(0, (int) $order->get_meta('_tabarak_seller_wallet_credit_total_fils'));
        $due = max(0, $total - max(0, $paid - $credited));
        return array('method' => $kind, 'status' => $due === 0 ? 'paid' : ($paid > $credited ? 'partial' : 'unpaid'),
            'wallet_paid_fils' => $wallet, 'wallet_credit_fils' => $credited, 'amount_due_fils' => $due);
    }

    private function edit_issue($order) {
        if ($order->get_created_via() !== 'tabarak-mobile' || $order->get_currency() !== 'BHD' || !$order->get_customer_id()
            || !class_exists('Tabarak_Mobile_Rewards') || !method_exists('Tabarak_Mobile_Rewards', 'credit_wallet_order_adjustment')
            || !class_exists('Tabarak_Mobile_Notifications')) return 'Wallet editing is unavailable for this order.';
        if (!in_array($order->get_payment_method(), array('cod', 'tabarak_twallet', 'tabarak_tap'), true)
            || ($order->get_payment_method() === 'tabarak_tap' && !Tabarak_Seller_Routing::card_paid($order))
            || ($order->get_payment_method() === 'tabarak_twallet' && !Tabarak_Seller_Routing::wallet_paid($order))) {
            return 'Wait for the payment to finish before editing this order.';
        }
        if (!in_array($order->get_status(), array('pending', 'on-hold', 'processing', 'seller-accepted', 'seller-preparing', 'seller-ready', 'handed-to-driver'), true)
            || !$order->get_meta('_tabarak_seller_preparing_at')
            || (float) $order->get_total_refunded() > 0) return 'Delivered or closed orders cannot be edited.';
        if ($order->get_coupon_codes() || (float) $order->get_discount_total() !== 0.0
            || (int) $order->get_meta('_tabarak_mobile_points_discount_fils') > 0
            || (float) $order->get_meta('_tabarak_mobile_product_discount') > 0
            || (float) $order->get_meta('_tabarak_mobile_cart_rule_discount') > 0
            || $order->get_meta('_tabarak_mobile_discount_rules')) {
            return 'This order has promotions. Edit it in WooCommerce so its pricing rules are preserved.';
        }
        return '';
    }

    private function delivery_schedule($order) {
        $mode = '';
        $date = '';
        $time = '';
        $metadata = method_exists($order, 'get_meta_data') ? $order->get_meta_data() : array();
        foreach ($metadata as $meta) {
            $data = is_object($meta) && method_exists($meta, 'get_data') ? $meta->get_data() : array();
            $key = strtolower(str_replace('-', '_', (string) ($data['key'] ?? '')));
            $value = $data['value'] ?? '';
            if (!is_scalar($value)) continue;
            $value = sanitize_text_field((string) $value);
            if ($value === '') continue;
            if (preg_match('/(delivery|fulfillment).*(type|mode|method|speed)|(type|mode|method|speed).*(delivery|fulfillment)/', $key)) {
                $normalized = strtolower($value);
                if (preg_match('/scheduled|schedule|later|slot/', $normalized)) $mode = 'scheduled';
                elseif (preg_match('/express|asap|instant|now|immediate/', $normalized)) $mode = 'express';
            }
            if (preg_match('/(delivery|fulfillment|scheduled).*(date)|(date).*(delivery|fulfillment|scheduled)/', $key)) $date = $value;
            if (preg_match('/(delivery|fulfillment|scheduled).*(time|slot)|(time|slot).*(delivery|fulfillment|scheduled)/', $key)) $time = $value;
        }
        if ($mode === '' && ($date !== '' || $time !== '')) $mode = 'scheduled';
        if ($mode === '') $mode = 'express';
        return array('mode' => $mode, 'date' => $date, 'time' => $time);
    }

    private function order_data($order, $full = false) {
        global $wpdb;
        $id = $order->get_id();
        $driver_delivery = null;
        if ($full && $order->get_meta('_tabarak_seller_driver_app_id')) {
            $driver_delivery = $this->delivery_statuses(array($id))[$id] ?? null;
            $this->reconcile_driver_cancellation($order, $driver_delivery);
            $this->reconcile_driver_delivery($order, $driver_delivery);
        }
        $dispatch = $wpdb->get_row($wpdb->prepare('SELECT state,wave,branch_id,claimed_at FROM ' . Tabarak_Seller_Routing::table('dispatch') . ' WHERE order_id=%d', $id), ARRAY_A);
        if ($this->routing) $this->routing->sync_workflow_status($order, $dispatch);
        $fulfillment = Tabarak_Seller_Routing::fulfillment_state($order);
        $delivery_schedule = $this->delivery_schedule($order);
        $items = $order->get_items();
        $fees_fils = 0;
        $fee_lines = array();
        foreach ($order->get_items('fee') as $fee) {
            $amount = (int) round((float) $fee->get_total() * 1000);
            $fees_fils += $amount;
            $fee_lines[] = array('name' => (string) $fee->get_name(), 'amount_fils' => $amount);
        }
        $coupon_lines = array();
        foreach ($order->get_items('coupon') as $coupon) {
            $discount = max(0, (int) round((float) $coupon->get_discount() * 1000));
            if ($discount > 0) $coupon_lines[] = array('code' => (string) $coupon->get_code(), 'discount_fils' => $discount);
        }
        $events = $full ? ($wpdb->get_results($wpdb->prepare('SELECT event_key,actor_id,branch_id,detail,created_at FROM ' . Tabarak_Seller_Routing::table('events') . ' WHERE order_id=%d ORDER BY id ASC', $id), ARRAY_A) ?: array()) : array();
        $out = array('id' => $id, 'number' => $order->get_order_number(), 'status' => $order->get_status(),
            'fulfillment_status' => $fulfillment['status'], 'fulfillment_label' => $fulfillment['label'],
            'delivery_schedule' => $delivery_schedule,
            'total' => $order->get_total(), 'currency' => $order->get_currency(), 'payment' => $this->payment($order),
            'edit_revision' => max(0, (int) $order->get_meta('_tabarak_seller_edit_revision')),
            'created_at' => $order->get_date_created() ? $order->get_date_created()->date('c') : null,
            'block' => Tabarak_Seller_Routing::block_for_order($order),
            'dispatch' => $dispatch ?: array('state' => 'not_dispatched'),
            'rider_tip_fils' => max(0, (int) $order->get_meta($order->get_created_via() === 'tabarak-mobile' ? '_tabarak_mobile_rider_tip_minor' : '_propharm_mobile_rider_tip_minor')),
            'summary' => array(
                'subtotal_fils' => (int) round((float) $order->get_subtotal() * 1000),
                'discount_fils' => (int) round((float) $order->get_discount_total() * 1000),
                'shipping_fils' => (int) round((float) $order->get_shipping_total() * 1000),
                'fees_fils' => $fees_fils,
                'fee_lines' => $fee_lines,
                'coupon_lines' => $coupon_lines,
                'redeemed_points' => max(0, (int) $order->get_meta('_tabarak_mobile_redeemed_points')),
                'points_discount_fils' => max(0, (int) $order->get_meta('_tabarak_mobile_points_discount_fils')),
                'vat_fils' => (int) round((float) $order->get_total_tax() * 1000),
            ),
            'item_count' => count($items),
            'items' => array_values(array_map(static function($item) {
                $product = $item->get_product();
                $parent = $product && $product->is_type('variation') ? wc_get_product($product->get_parent_id()) : null;
                $sku = $product ? (string) $product->get_sku() : '';
                if ($sku === '' && $parent) $sku = (string) $parent->get_sku();
                $image_id = $product ? (int) $product->get_image_id() : 0;
                if (!$image_id && $parent) $image_id = (int) $parent->get_image_id();
                $quantity = (int) $item->get_quantity();
                $line_subtotal_fils = (int) round((float) $item->get_subtotal() * 1000);
                $line_total_fils = (int) round((float) $item->get_total() * 1000);
                $line_vat_fils = (int) round((float) $item->get_total_tax() * 1000);
                $vat_rates = array();
                $taxes = $item->get_taxes();
                if (class_exists('WC_Tax') && is_array($taxes['total'] ?? null)) {
                    foreach ($taxes['total'] as $rate_id => $amount) {
                        if (absint($rate_id) > 0 && $amount !== '') $vat_rates[] = (string) WC_Tax::get_rate_percent(absint($rate_id));
                    }
                }
                $offer_id = absint($item->get_meta('_tabarak_mobile_promotion_id', true));
                $offer_title = trim((string) $item->get_meta('_tabarak_mobile_offer_title', true));
                if ($offer_title === '' && $offer_id) $offer_title = trim((string) get_the_title($offer_id));
                if ($offer_title === '' && $offer_id) $offer_title = 'Offer';
                $reference_fils = max(0, (int) $item->get_meta('_tabarak_mobile_regular_line_subtotal_fils', true));
                $offer_savings_fils = $offer_title !== '' && $reference_fils > $line_subtotal_fils
                    ? $reference_fils - $line_subtotal_fils : 0;
                return array('id' => (int) $item->get_id(), 'product_id' => (int) $item->get_product_id(),
                    'variation_id' => (int) $item->get_variation_id(),
                    'name' => $item->get_name(), 'quantity' => $quantity,
                    'line_subtotal_fils' => $line_subtotal_fils,
                    'line_total_fils' => $line_total_fils,
                    'line_discount_fils' => max(0, $line_subtotal_fils - $line_total_fils),
                    'line_vat_fils' => $line_vat_fils,
                    'vat_rate' => implode(', ', array_unique(array_filter($vat_rates))),
                    'line_grand_total_fils' => $line_total_fils + $line_vat_fils,
                    'unit_price_fils' => $quantity > 0 ? (int) round($line_subtotal_fils / $quantity) : 0,
                    'offer' => $offer_title !== '' ? array('title' => $offer_title, 'savings_fils' => $offer_savings_fils) : null,
                    'sku' => $sku, 'image_url' => $image_id ? (string) wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '',
                    'full_image_url' => $image_id ? (string) wp_get_attachment_image_url($image_id, 'full') : '');
            }, $items)),
            'events' => $events);
        if ($full) {
            $handed_at = $wpdb->get_var($wpdb->prepare('SELECT handed_at FROM ' . Tabarak_Seller_Routing::table('handoffs') . ' WHERE order_id=%d', $id));
            $out['handed_at'] = $handed_at ? gmdate('c', strtotime($handed_at . ' UTC')) : null;
            $out['driver_delivery_status'] = $driver_delivery['delivery_status'] ?? null;
            $out['driver_returned_at'] = (string) $order->get_meta('_tabarak_seller_driver_returned_at') ?: null;
            $accepted_branch = $dispatch && $dispatch['state'] === 'claimed' && !empty($dispatch['branch_id'])
                ? Tabarak_Seller_Routing::branch((int) $dispatch['branch_id']) : null;
            $out['accepted_branch'] = $accepted_branch ? array(
                'id' => (int) $accepted_branch['id'],
                'name' => (string) $accepted_branch['name'],
            ) : null;
            $out['customer'] = array('name' => $order->get_formatted_billing_full_name(), 'phone' => $order->get_billing_phone());
            $delivery_details = class_exists('Tabarak_Driver_Status_Sync')
                ? Tabarak_Driver_Status_Sync::delivery_details($order)
                : (method_exists('Tabarak_Seller_Routing', 'delivery_details')
                    ? Tabarak_Seller_Routing::delivery_details($order)
                    : array('shipping' => $order->get_address('shipping'), 'instructions' => ''));
            $out['shipping'] = $delivery_details['shipping'];
            $out['delivery_instructions'] = $delivery_details['instructions'];
            $out['location'] = Tabarak_Seller_Routing::location_for_order($order);
            $out['note'] = $order->get_customer_note();
            $out['pharmacist'] = (string) $order->get_meta('_tabarak_seller_pharmacist');
            $driver_prefix = $order->get_created_via() === 'tabarak-mobile' ? '_tabarak_delivery_driver_' : '_propharm_delivery_driver_';
            $app_driver_id = (string) $order->get_meta('_tabarak_seller_driver_app_id');
            $out['driver'] = array('id' => $app_driver_id !== '' ? $app_driver_id : (int) $order->get_meta($driver_prefix . 'id'),
                'name' => (string) $order->get_meta($driver_prefix . 'name'),
                'phone' => (string) $order->get_meta($driver_prefix . 'phone'));
            $out['edit_unavailable_reason'] = $this->edit_issue($order);
        }
        return $out;
    }

    public function orders($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $limit = min(100, max(1, absint($request->get_param('limit') ?: 50)));
        global $wpdb; $ids = array();
        if ($actor['admin']) {
            $orders = wc_get_orders(array('limit' => $limit, 'orderby' => 'date', 'order' => 'DESC', 'status' => 'any'));
            $orders = array_values(array_filter($orders, static function($order) { return Tabarak_Seller_Routing::is_mobile_order($order); }));
            return array('items' => array_map(function($order) { return $this->order_data($order, true); }, $orders));
        }
        $claimed = $wpdb->get_col($wpdb->prepare('SELECT order_id FROM ' . Tabarak_Seller_Routing::table('dispatch') . " WHERE branch_id=%d AND state='claimed' ORDER BY updated_at DESC LIMIT %d", $actor['branch_id'], $limit));
        $offered_rows = $wpdb->get_results($wpdb->prepare('SELECT o.order_id,d.state,d.wave,d.updated_at FROM ' . Tabarak_Seller_Routing::table('offers') . ' o JOIN ' . Tabarak_Seller_Routing::table('dispatch') . " d ON d.order_id=o.order_id WHERE o.branch_id=%d AND o.state='open' AND d.state='offered' ORDER BY o.created_at DESC LIMIT %d", $actor['branch_id'], $limit), ARRAY_A) ?: array();
        $rules = Tabarak_Seller_Routing::rules();
        $offered = array_column(array_values(array_filter($offered_rows, static function($row) use ($rules) {
            return TSR_Planner::offer_is_active($row, $rules);
        })), 'order_id');
        $ids = array_values(array_unique(array_map('intval', array_merge($offered, $claimed))));
        $items = array();
        foreach (array_slice($ids, 0, $limit) as $id) {
            $order = wc_get_order($id); if (!$order) continue;
            $items[] = $this->order_data($order, in_array((string) $id, array_map('strval', $claimed), true));
        }
        return array('items' => $items);
    }

    private function append_active_orders($ids, $claimed, &$items, $limit) {
        $ids = array_values(array_unique(array_filter(array_map('absint', $ids))));
        if (!$ids) return null;
        global $wpdb;
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        $departed_ids = $wpdb->get_col($wpdb->prepare('SELECT order_id FROM ' . Tabarak_Seller_Routing::table('handoffs') . ' WHERE order_id IN (' . $placeholders . ')', ...$ids));
        $departed = array_fill_keys(array_map('intval', $departed_ids), true);
        $delivery = $this->delivery_statuses($ids);
        foreach ($ids as $id) {
            if (count($items) >= $limit) break;
            $order = wc_get_order($id);
            if (!Tabarak_Seller_Routing::is_mobile_order($order)) continue;
            if (isset($delivery[$id])) {
                $this->reconcile_driver_cancellation($order, $delivery[$id]);
                $this->reconcile_driver_delivery($order, $delivery[$id]);
                if (in_array($delivery[$id]['delivery_status'] ?? '', array('picked_up', 'delivered'), true) && $order->get_meta('_tabarak_seller_handed_at')) {
                    $departed[$id] = true;
                }
            }
            if (isset($departed[$id]) && ($delivery[$id]['delivery_status'] ?? '') === 'delivered') continue;
            if (in_array($order->get_status(), array('completed', 'cancelled', 'failed', 'refunded'), true)) continue;
            $items[] = $this->order_data($order, $claimed);
        }
        return null;
    }

    public function active_orders($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $limit = min(100, max(1, absint($request->get_param('limit') ?: 50)));
        $items = array();
        if ($actor['admin']) {
            for ($page = 1; ; $page++) {
                $orders = wc_get_orders(array('limit' => 100, 'page' => $page, 'orderby' => 'date', 'order' => 'DESC', 'status' => 'any'));
                $ids = array_map(static function($order) { return $order->get_id(); }, $orders);
                $error = $this->append_active_orders($ids, true, $items, $limit);
                if (is_wp_error($error)) return $error;
                if (count($items) >= $limit || count($orders) < 100) break;
            }
            return array('items' => $items);
        }
        global $wpdb;
        $offered_rows = $wpdb->get_results($wpdb->prepare('SELECT o.order_id,d.state,d.wave,d.updated_at FROM ' . Tabarak_Seller_Routing::table('offers') . ' o JOIN ' . Tabarak_Seller_Routing::table('dispatch') . " d ON d.order_id=o.order_id WHERE o.branch_id=%d AND o.state='open' AND d.state='offered' ORDER BY o.created_at DESC LIMIT %d", $actor['branch_id'], $limit), ARRAY_A) ?: array();
        $rules = Tabarak_Seller_Routing::rules();
        $offered = array_column(array_values(array_filter($offered_rows, static function($row) use ($rules) {
            return TSR_Planner::offer_is_active($row, $rules);
        })), 'order_id');
        $error = $this->append_active_orders($offered, false, $items, $limit);
        if (is_wp_error($error)) return $error;
        for ($offset = 0; count($items) < $limit; $offset += 100) {
            $claimed = $wpdb->get_col($wpdb->prepare('SELECT order_id FROM ' . Tabarak_Seller_Routing::table('dispatch') . " WHERE branch_id=%d AND state='claimed' ORDER BY updated_at DESC LIMIT 100 OFFSET %d", $actor['branch_id'], $offset));
            $error = $this->append_active_orders($claimed, true, $items, $limit);
            if (is_wp_error($error)) return $error;
            if (count($claimed) < 100) break;
        }
        return array('items' => $items);
    }

    public function order_history($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        global $wpdb;
        $limit = min(50, max(1, absint($request->get_param('limit') ?: 20)));
        $offset = min(100000, absint($request->get_param('offset') ?: 0));
        $range = sanitize_key((string) $request->get_param('range'));
        if ($range === '') $range = 'all';
        if (!in_array($range, array('all', 'today', 'yesterday', 'last7', 'last30'), true)) return $this->error('invalid_range', 'Choose a valid history date range.', 422);
        $table = Tabarak_Seller_Routing::table('handoffs');
        $where = array(); $params = array();
        if (!$actor['admin']) { $where[] = 'branch_id=%d'; $params[] = $actor['branch_id']; }
        $range_start = null; $range_end = null;
        if ($range !== 'all') {
            $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Bahrain'));
            $today = $now->setTime(0, 0);
            if ($range === 'today') { $start = $today; $end = $today->modify('+1 day'); }
            elseif ($range === 'yesterday') { $start = $today->modify('-1 day'); $end = $today; }
            elseif ($range === 'last7') { $start = $today->modify('-6 days'); $end = $today->modify('+1 day'); }
            else { $start = $today->modify('-29 days'); $end = $today->modify('+1 day'); }
            $where[] = 'handed_at >= %s AND handed_at < %s';
            $range_start = $start->setTimezone(new DateTimeZone('UTC'))->getTimestamp();
            $range_end = $end->setTimezone(new DateTimeZone('UTC'))->getTimestamp();
        }
        $sql = 'SELECT * FROM ' . $table . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY handed_at DESC,order_id DESC LIMIT %d OFFSET %d';
        $items = array(); $candidate_offset = 0; $skip = $offset; $more = false;
        do {
            $page_params = array_merge($params, array(100, $candidate_offset));
            $rows = $wpdb->get_results($wpdb->prepare($sql, ...$page_params), ARRAY_A) ?: array();
            $candidate_offset += count($rows);
            $statuses = $this->delivery_statuses(array_column($rows, 'order_id'));
            foreach ($rows as $row) {
                $status = $statuses[(int) $row['order_id']] ?? array();
                if (($status['delivery_status'] ?? '') !== 'delivered' || empty($status['delivered_at'])) continue;
                $delivered_ts = strtotime((string) $status['delivered_at']);
                if ($range_start !== null && ($delivered_ts === false || $delivered_ts < $range_start || $delivered_ts >= $range_end)) continue;
                if ($skip > 0) { $skip--; continue; }
                if (count($items) >= $limit) { $more = true; break 2; }
                $items[] = array('external_order_id' => (string) $row['order_id'], 'order_number' => (string) $row['order_number'],
                    'value_bhd' => round((int) $row['amount_fils'] / 1000, 3), 'delivery_status' => 'delivered',
                    'picked_up_at' => $status['picked_up_at'] ?? null, 'delivered_at' => $status['delivered_at'],
                    'block_number' => $row['block_number'], 'pharmacist_name' => $row['pharmacist']);
            }
        } while (count($rows) === 100);
        return array('items' => $items, 'has_more' => $more);
    }

    public function earnings($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $period = sanitize_key((string) $request->get_param('period'));
        if (!in_array($period, array('day', 'week', 'month', 'year'), true)) return $this->error('invalid_period', 'Choose day, week, month or year.', 422);
        $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Bahrain'));
        if ($period === 'day') { $start = $now->setTime(0, 0); $end = $start->modify('+1 day'); $labels = array('00', '04', '08', '12', '16', '20'); $bucket = 'FLOOR(HOUR(DATE_ADD(handed_at, INTERVAL 3 HOUR))/4)'; }
        elseif ($period === 'week') { $start = $now->modify('monday this week')->setTime(0, 0); $end = $start->modify('+1 week'); $labels = array('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'); $bucket = 'WEEKDAY(DATE_ADD(handed_at, INTERVAL 3 HOUR))'; }
        elseif ($period === 'month') { $start = $now->modify('first day of this month')->setTime(0, 0); $end = $start->modify('+1 month'); $labels = array('1–7', '8–14', '15–21', '22–28', '29+'); $bucket = 'FLOOR((DAYOFMONTH(DATE_ADD(handed_at, INTERVAL 3 HOUR))-1)/7)'; }
        else { $start = $now->setDate((int) $now->format('Y'), 1, 1)->setTime(0, 0); $end = $start->modify('+1 year'); $labels = array('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'); $bucket = 'MONTH(DATE_ADD(handed_at, INTERVAL 3 HOUR))-1'; }
        global $wpdb;
        $table = Tabarak_Seller_Routing::table('handoffs');
        $start_utc = $start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $end_utc = $end->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $where = $actor['admin'] ? 'financial_state=%s AND handed_at>=%s AND handed_at<%s'
            : 'branch_id=%d AND financial_state=%s AND handed_at>=%s AND handed_at<%s';
        $query = $actor['admin']
            ? $wpdb->prepare('SELECT ' . $bucket . ' AS bucket,SUM(amount_fils) AS total,COUNT(*) AS order_count FROM ' . $table . ' WHERE ' . $where . ' GROUP BY bucket', 'active', $start_utc, $end_utc)
            : $wpdb->prepare('SELECT ' . $bucket . ' AS bucket,SUM(amount_fils) AS total,COUNT(*) AS order_count FROM ' . $table . ' WHERE ' . $where . ' GROUP BY bucket', $actor['branch_id'], 'active', $start_utc, $end_utc);
        $buckets = array_map(static function($label) { return array('label' => $label, 'total_fils' => 0, 'order_count' => 0); }, $labels);
        foreach (($wpdb->get_results($query, ARRAY_A) ?: array()) as $row) {
            $index = (int) $row['bucket'];
            if (isset($buckets[$index])) {
                $buckets[$index]['total_fils'] = (int) $row['total'];
                $buckets[$index]['order_count'] = (int) $row['order_count'];
            }
        }
        return array('period' => $period, 'total_fils' => array_sum(array_column($buckets, 'total_fils')),
            'order_count' => array_sum(array_column($buckets, 'order_count')), 'buckets' => $buckets);
    }

    public function order($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $order = $this->require_order($request, $actor); if (is_wp_error($order)) return $order;
        global $wpdb;
        $branch_id = $wpdb->get_var($wpdb->prepare('SELECT branch_id FROM ' . Tabarak_Seller_Routing::table('dispatch') . ' WHERE order_id=%d AND state=%s', $order->get_id(), 'claimed'));
        return $this->order_data($order, $actor['admin'] || (int) $branch_id === $actor['branch_id']);
    }

    public function claim($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        if ($actor['admin']) return $this->error('branch_login_required', 'Use a branch account to claim.', 403);
        $order = $this->require_order($request, $actor); if (is_wp_error($order)) return $order;
        if (in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)) {
            return $this->error('order_closed', 'This order is closed.', 409);
        }
        $body = $request->get_json_params(); $name = sanitize_text_field((string) ($body['pharmacist'] ?? ''));
        $code = strtoupper(sanitize_text_field((string) ($body['pharmacist_code'] ?? '')));
        $branch = Tabarak_Seller_Routing::branch($actor['branch_id']);
        $roster = $this->pharmacist_roster($branch);
        $names = $roster['names']; $codes = $roster['codes'];
        if ($name !== '' || $code !== '') {
            if ($code !== '') {
                if (!isset($codes[$code]) || ($name !== '' && $name !== $codes[$code])) return $this->error('invalid_pharmacist', 'Choose a pharmacist from this branch.', 422);
                $name = $codes[$code];
            } else {
                $matches = array_keys($codes, $name, true);
                if (count($matches) === 1) $code = $matches[0];
            }
            if (!$name || !in_array($name, $names, true)) return $this->error('invalid_pharmacist', 'Choose a pharmacist from this branch.', 422);
        }
        global $wpdb; $id = $order->get_id(); $branch_id = $actor['branch_id'];
        $table = Tabarak_Seller_Routing::table('dispatch'); $offers = Tabarak_Seller_Routing::table('offers');
        $wpdb->query('START TRANSACTION');
        try {
            $dispatch = $wpdb->get_row($wpdb->prepare('SELECT state,wave,updated_at FROM ' . $table . ' WHERE order_id=%d FOR UPDATE', $id), ARRAY_A);
            if (!TSR_Planner::offer_is_active($dispatch, Tabarak_Seller_Routing::rules())) {
                $wpdb->query('ROLLBACK'); return $this->error('offer_expired', 'This offer has expired.', 409);
            }
            $offer = $wpdb->get_var($wpdb->prepare('SELECT state FROM ' . $offers . ' WHERE order_id=%d AND branch_id=%d FOR UPDATE', $id, $branch_id));
            if ($offer !== 'open') { $wpdb->query('ROLLBACK'); return $this->error('already_taken', 'This offer is no longer available.', 409); }
            $claimed = $wpdb->query($wpdb->prepare('UPDATE ' . $table . " SET state='claimed',branch_id=%d,claimed_by=%d,claimed_at=%s,updated_at=%s WHERE order_id=%d AND state='offered' AND branch_id IS NULL", $branch_id, $actor['user']->ID, current_time('mysql', true), current_time('mysql', true), $id));
            if ($claimed !== 1) { $wpdb->query('ROLLBACK'); return $this->error('already_taken', 'Another branch accepted first.', 409); }
            $wpdb->query($wpdb->prepare('UPDATE ' . $offers . " SET state=IF(branch_id=%d,'claimed','closed') WHERE order_id=%d", $branch_id, $id));
            $wpdb->query('COMMIT');
        } catch (Throwable $e) { $wpdb->query('ROLLBACK'); return $this->error('unavailable', 'Could not claim order.', 503); }
        $order->update_meta_data('_tabarak_seller_branch_id', $branch_id);
        if ($name !== '') {
            $order->update_meta_data('_tabarak_seller_pharmacist', $name);
            if ($code !== '') $order->update_meta_data('_tabarak_seller_pharmacist_code', $code);
        } else {
            $order->delete_meta_data('_tabarak_seller_pharmacist');
            $order->delete_meta_data('_tabarak_seller_pharmacist_code');
        }
        $order->update_meta_data('_tabarak_seller_preparing_at', gmdate('c'));
        $order->save();
        Tabarak_Seller_Routing::event($id, 'claimed', $actor['user']->ID, $branch_id);
        Tabarak_Seller_Routing::event($id, 'preparing', $actor['user']->ID, $branch_id, $name !== '' ? $name : 'Pharmacist assignment pending');
        Tabarak_Seller_Routing::notify_admins($id, 'claimed', 'Order #' . $order->get_order_number() . ' claimed');
        return $this->order_data($order, true);
    }

    public function assign_pharmacist($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $order = $this->require_order($request, $actor, true); if (is_wp_error($order)) return $order;
        if (!$order->get_meta('_tabarak_seller_preparing_at') || $order->get_meta('_tabarak_seller_ready_at')
            || $order->get_meta('_tabarak_seller_handed_at') || in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)) {
            return $this->error('pharmacist_unavailable', 'Assign the pharmacist before the order is marked ready.', 409);
        }
        $branch_id = $actor['admin'] ? (int) $order->get_meta('_tabarak_seller_branch_id') : $actor['branch_id'];
        $branch = Tabarak_Seller_Routing::branch($branch_id);
        $roster = $this->pharmacist_roster($branch);
        $names = $roster['names']; $codes = $roster['codes'];
        $body = $request->get_json_params();
        $name = sanitize_text_field((string) ($body['pharmacist'] ?? ''));
        $code = strtoupper(sanitize_text_field((string) ($body['pharmacist_code'] ?? '')));
        if ($code !== '') {
            if (!isset($codes[$code]) || ($name !== '' && $name !== $codes[$code])) return $this->error('invalid_pharmacist', 'Choose a pharmacist from this branch.', 422);
            $name = $codes[$code];
        } else {
            $matches = array_keys($codes, $name, true);
            if (count($matches) === 1) $code = $matches[0];
        }
        if (!$name || !in_array($name, $names, true)) return $this->error('invalid_pharmacist', 'Choose a pharmacist from this branch.', 422);
        $order->update_meta_data('_tabarak_seller_pharmacist', $name);
        if ($code !== '') $order->update_meta_data('_tabarak_seller_pharmacist_code', $code);
        $order->save();
        Tabarak_Seller_Routing::event($order->get_id(), 'pharmacist_assigned', $actor['user']->ID, $branch_id, $name);
        $this->sync_assigned_driver_order($order);
        return $this->order_data($order, true);
    }

    public function reject($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        if ($actor['admin']) return $this->error('branch_login_required', 'Use a branch account.', 403);
        $order = $this->require_order($request, $actor); if (is_wp_error($order)) return $order;
        global $wpdb;
        $changed = $wpdb->update(Tabarak_Seller_Routing::table('offers'), array('state' => 'rejected'), array('order_id' => $order->get_id(), 'branch_id' => $actor['branch_id'], 'state' => 'open'));
        if (!$changed) return $this->error('not_available', 'Offer is no longer available.', 409);
        Tabarak_Seller_Routing::event($order->get_id(), 'rejected', $actor['user']->ID, $actor['branch_id']);
        $open = (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . Tabarak_Seller_Routing::table('offers') . " WHERE order_id=%d AND state='open'", $order->get_id()));
        if ($open === 0) {
            $wave = (int) $wpdb->get_var($wpdb->prepare('SELECT wave FROM ' . Tabarak_Seller_Routing::table('dispatch') . ' WHERE order_id=%d', $order->get_id()));
            if ($wave === 1) $this->routing->schedule($order->get_id(), 1);
            else {
                $wpdb->update(Tabarak_Seller_Routing::table('dispatch'), array('state' => 'needs_admin', 'updated_at' => current_time('mysql', true)), array('order_id' => $order->get_id()));
                Tabarak_Seller_Routing::notify_admins($order->get_id(), 'no_acceptance', 'Order needs manual branch assignment');
            }
        }
        return array('ok' => true);
    }

    public function start_preparing($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $order = $this->require_order($request, $actor, true); if (is_wp_error($order)) return $order;
        $body = $request->get_json_params(); $name = sanitize_text_field((string) ($body['pharmacist'] ?? ''));
        $code = strtoupper(sanitize_text_field((string) ($body['pharmacist_code'] ?? '')));
        $branch_id = $actor['admin'] ? (int) $order->get_meta('_tabarak_seller_branch_id') : $actor['branch_id'];
        $branch = Tabarak_Seller_Routing::branch($branch_id);
        $names = $branch ? (json_decode($branch['pharmacists_json'], true) ?: array()) : array();
        $codes = $branch ? (json_decode((string) ($branch['pharmacist_codes_json'] ?? ''), true) ?: array()) : array();
        if ($code !== '') {
            if (!isset($codes[$code]) || ($name !== '' && $name !== $codes[$code])) return $this->error('invalid_pharmacist', 'Choose a pharmacist from this branch.', 422);
            $name = $codes[$code];
        } else {
            $matches = array_keys($codes, $name, true);
            if (count($matches) === 1) $code = $matches[0];
        }
        if (!$name || !in_array($name, $names, true)) return $this->error('invalid_pharmacist', 'Choose a pharmacist from this branch.', 422);
        if ($order->get_meta('_tabarak_seller_preparing_at')) return $this->error('already_started', 'Preparation was already started.', 409);
        $order->update_meta_data('_tabarak_seller_pharmacist', $name);
        if ($code !== '') $order->update_meta_data('_tabarak_seller_pharmacist_code', $code);
        $order->update_meta_data('_tabarak_seller_preparing_at', gmdate('c'));
        $order->save();
        Tabarak_Seller_Routing::event($order->get_id(), 'preparing', $actor['user']->ID, $branch_id, $name);
        return $this->order_data($order, true);
    }

    public function mark_ready($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $order = $this->require_order($request, $actor, true); if (is_wp_error($order)) return $order;
        if (!$order->get_meta('_tabarak_seller_preparing_at')) return $this->error('not_started', 'Start preparation first.', 409);
        if (!$order->get_meta('_tabarak_seller_pharmacist')) return $this->error('pharmacist_required', 'Assign the pharmacist before marking this order ready.', 409);
        if (!$order->get_meta('_tabarak_seller_ready_at')) {
            $order->update_meta_data('_tabarak_seller_ready_at', gmdate('c')); $order->save();
            Tabarak_Seller_Routing::event($order->get_id(), 'ready', $actor['user']->ID, (int) $order->get_meta('_tabarak_seller_branch_id'));
        }
        return $this->order_data($order, true);
    }

    public function handoff($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        if ($actor['admin']) return $this->error('branch_login_required', 'Use a branch account to record handover.', 403);
        $order = $this->require_order($request, $actor, true); if (is_wp_error($order)) return $order;
        if (!$order->get_meta('_tabarak_seller_ready_at')) return $this->error('not_ready', 'Mark order ready first.', 409);
        global $wpdb;
        $table = Tabarak_Seller_Routing::table('handoffs');
        $id = (int) $order->get_id();
        $existing = $wpdb->get_var($wpdb->prepare('SELECT order_id FROM ' . $table . ' WHERE order_id=%d', $id));
        if ($existing) return $this->order_data($order, true);
        $amount_fils = (int) round((float) $order->get_total() * 1000);
        if ($amount_fils < 0) return $this->error('invalid_total', 'Order total is invalid.', 409);
        $inserted = $wpdb->query($wpdb->prepare('INSERT IGNORE INTO ' . $table . ' (order_id,branch_id,order_number,amount_fils,currency,block_number,pharmacist,handed_at,financial_state) VALUES (%d,%d,%s,%d,%s,%s,%s,%s,%s)',
            $id, $actor['branch_id'], (string) $order->get_order_number(), $amount_fils,
            (string) $order->get_currency(), Tabarak_Seller_Routing::block_for_order($order),
            (string) $order->get_meta('_tabarak_seller_pharmacist'), current_time('mysql', true), 'active'));
        if ($inserted === false) return $this->error('handoff_failed', 'Could not record handover.', 503);
        if ($inserted === 1) Tabarak_Seller_Routing::event($id, 'handed_over', $actor['user']->ID, $actor['branch_id']);
        return $this->order_data($order, true);
    }

    public function drivers($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        if ($this->driver_bridge_ready()) {
            $branch = $actor['branch_id'] ? Tabarak_Seller_Routing::branch($actor['branch_id']) : null;
            if (!$actor['admin'] && !$branch) return $this->error('branch_required', 'A branch is required to check driver attendance.', 403);
            $payload = array('action' => 'drivers');
            if ($branch && !empty($branch['code'])) $payload['branch_code'] = (string) $branch['code'];
            $result = $this->driver_bridge($payload);
            if (is_wp_error($result)) return $result;
            return array('items' => is_array($result['items'] ?? null) ? $result['items'] : array(), 'source' => 'supabase');
        }
        $order = wc_get_order(absint($request->get_param('order_id')));
        $source = Tabarak_Seller_Routing::is_mobile_order($order) ? $order->get_created_via() : 'tabarak-mobile';
        global $wpdb; $table = $wpdb->prefix . ($source === 'tabarak-mobile' ? 'tabarak_mobile_drivers' : 'propharm_mobile_drivers');
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) !== $table) return array('items' => array(), 'source' => 'wordpress');
        return array('items' => $wpdb->get_results('SELECT id,name,phone FROM ' . $table . ' WHERE active=1 ORDER BY name ASC', ARRAY_A) ?: array(), 'source' => 'wordpress');
    }

    public function products($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $search = trim(sanitize_text_field((string) $request->get_param('search')));
        if (strlen($search) < 2 || strlen($search) > 80) return $this->error('invalid_search', 'Enter at least two characters to find a product.', 422);
        $found = wc_get_products(array('status' => 'publish', 'limit' => 80, 'search' => $search,
            'type' => array('simple', 'variation')));
        global $wpdb;
        $sku_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key='_sku' AND meta_value LIKE %s ORDER BY post_id DESC LIMIT 40",
            '%' . $wpdb->esc_like($search) . '%')) ?: array();
        foreach ($sku_ids as $sku_id) {
            $sku_product = wc_get_product((int) $sku_id);
            if ($sku_product) array_unshift($found, $sku_product);
        }
        $sku_id = wc_get_product_id_by_sku($search);
        if ($sku_id) {
            $sku_product = wc_get_product($sku_id);
            if ($sku_product) array_unshift($found, $sku_product);
        }
        $items = array();
        foreach ($found as $product) {
            if (!$product || $product->get_status() !== 'publish' || !$product->is_purchasable() || !$product->is_in_stock()) continue;
            $id = (int) $product->get_id();
            if (isset($items[$id])) continue;
            $parent = $product->is_type('variation') ? wc_get_product($product->get_parent_id()) : null;
            $image_id = (int) $product->get_image_id();
            if (!$image_id && $parent) $image_id = (int) $parent->get_image_id();
            $items[$id] = array('id' => $id, 'name' => (string) $product->get_name(),
                'sku' => (string) ($product->get_sku() ?: ($parent ? $parent->get_sku() : '')),
                'image_url' => $image_id ? (string) wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '',
                'price_fils' => (int) round((float) $product->get_price() * 1000));
            if (count($items) >= 20) break;
        }
        return array('items' => array_values($items));
    }

    private function edit_stock($item, $product, $new_quantity, $reduce_new = false) {
        if (!$product || !$product->managing_stock()) return;
        $reserved = max(0, (int) $item->get_meta('_reduced_stock', true));
        if (!$reduce_new && !$reserved) return;
        $change = $new_quantity - $reserved;
        if ($change > 0 && !$product->has_enough_stock($change)) throw new DomainException('Not enough stock for ' . $product->get_name());
        if ($change !== 0) {
            $result = wc_update_product_stock($product, abs($change), $change > 0 ? 'decrease' : 'increase');
            if ($result === false || is_wp_error($result)) throw new DomainException('Stock could not be updated.');
        }
        if ($new_quantity > 0) $item->update_meta_data('_reduced_stock', $new_quantity);
        else $item->delete_meta_data('_reduced_stock');
    }

    /** Seller manual prices are final, independent of WooCommerce catalogue tax settings. */
    private function set_manual_final_price($item, $unit_price_fils, $quantity) {
        $line_fils = $unit_price_fils * $quantity;
        $line = number_format($line_fils / 1000, 3, '.', '');
        $item->set_tax_class('0');
        $item->set_subtotal($line);
        $item->set_total($line);
        $item->update_meta_data('_tabarak_seller_entered_gross_unit_fils', $unit_price_fils);
        return $line_fils;
    }

    /** Edit quantities and add catalogue products before driver dispatch. All money is integer fils. */
    public function edit_order($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $body = $request->get_json_params();
        $quantities = is_array($body) ? ($body['quantities'] ?? null) : null;
        $additions = is_array($body) ? ($body['additions'] ?? null) : null;
        $revision = is_array($body) ? ($body['revision'] ?? null) : null;
        $expected_total = is_array($body) ? ($body['expected_total_fils'] ?? null) : null;
        $customer_contact_confirmed = is_array($body) && ($body['customer_contact_confirmed'] ?? false) === true;
        if (!is_array($quantities) || !is_array($additions) || !is_int($revision) || $revision < 0
            || !is_int($expected_total) || $expected_total < 0 || count($quantities) > 100 || count($additions) > 12) {
            return $this->error('invalid_edit', 'Refresh the order and enter valid quantities.', 422);
        }
        $id = absint($request['id']);
        global $wpdb;
        $lock = 'twallet:order:' . $id;
        if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s,5)', $lock)) !== 1) return $this->error('busy', 'Order is being updated. Try again.', 409);
        $transaction = false;
        try {
            $order = $this->require_order($request, $actor, true); if (is_wp_error($order)) return $order;
            $issue = $this->edit_issue($order);
            if ($issue !== '') return $this->error('edit_unavailable', $issue, 409);
            if (max(0, (int) $order->get_meta('_tabarak_seller_edit_revision')) !== $revision) {
                return $this->error('stale_edit', 'Order changed. Refresh it before editing.', 409);
            }
            if ((int) round((float) $order->get_total() * 1000) !== $expected_total) {
                return $this->error('stale_edit', 'Order total changed. Refresh it before editing.', 409);
            }
            $existing = $order->get_items('line_item');
            $requested = array();
            foreach ($quantities as $row) {
                if (!is_array($row) || !is_int($row['id'] ?? null) || !isset($existing[$row['id']])
                    || !is_int($row['quantity'] ?? null) || !is_int($row['before_quantity'] ?? null)
                    || !is_int($row['unit_price_fils'] ?? null) || $row['unit_price_fils'] < 1 || $row['unit_price_fils'] > 10000000
                    || (isset($row['price_includes_tax']) && (!is_bool($row['price_includes_tax'])
                        || ($row['price_includes_tax'] && (int) $existing[$row['id']]->get_product_id() !== 0)))
                    || $row['before_quantity'] !== (int) $existing[$row['id']]->get_quantity()
                    || $row['quantity'] < 0 || $row['quantity'] > 100 || isset($requested[$row['id']])) {
                    return $this->error('invalid_edit', 'Invalid order item or quantity.', 422);
                }
                $requested[$row['id']] = array('quantity' => $row['quantity'], 'unit_price_fils' => $row['unit_price_fils'],
                    // Manual items never inherit the catalogue VAT rate.
                    'price_includes_tax' => (int) $existing[$row['id']]->get_product_id() === 0);
            }
            if (count($requested) !== count($existing)) return $this->error('invalid_edit', 'Send every existing item quantity.', 422);
            $items_changed = false;
            foreach ($existing as $item_id => $item) {
                $old_quantity = (int) $item->get_quantity();
                $old_line_fils = (int) round((float) $item->get_total() * 1000);
                if ($requested[$item_id]['price_includes_tax']) $old_line_fils += (int) round((float) $item->get_total_tax() * 1000);
                $old_unit_price = $old_quantity > 0 ? (int) round($old_line_fils / $old_quantity) : 0;
                if ($requested[$item_id]['quantity'] !== $old_quantity || $requested[$item_id]['unit_price_fils'] !== $old_unit_price
                    || ($requested[$item_id]['price_includes_tax'] && $item->get_tax_class() !== '0')) $items_changed = true;
            }
            if (!$items_changed && !$additions) return $this->error('no_change', 'Change a price, quantity or add a product first.', 422);
            $new_products = array();
            foreach ($additions as $row) {
                if (!is_array($row) || !is_int($row['product_id'] ?? null) || !is_int($row['quantity'] ?? null)
                    || !is_int($row['unit_price_fils'] ?? null) || $row['quantity'] < 1 || $row['quantity'] > 100
                    || $row['unit_price_fils'] < 1 || $row['unit_price_fils'] > 10000000) {
                    return $this->error('invalid_edit', 'Choose a product, quantity and valid price.', 422);
                }
                if ($row['product_id'] === 0) {
                    $name = sanitize_text_field((string) ($row['name'] ?? ''));
                    if ($name === '' || mb_strlen($name) > 120) return $this->error('invalid_item', 'Enter a valid manual item name.', 422);
                    if (isset($row['price_includes_tax']) && !is_bool($row['price_includes_tax'])) return $this->error('invalid_edit', 'Invalid tax price setting.', 422);
                    $new_products[] = array(null, $name, $row['quantity'], $row['unit_price_fils'], true);
                    continue;
                }
                $product = wc_get_product($row['product_id']);
                if (!$product || !in_array($product->get_type(), array('simple', 'variation'), true) || $product->get_status() !== 'publish'
                    || !$product->is_purchasable() || !$product->is_in_stock()
                    || !$product->has_enough_stock($row['quantity'])
                    || ($product->is_sold_individually() && $row['quantity'] > 1)) {
                    return $this->error('invalid_product', 'This product cannot be added to this order.', 422);
                }
                $new_products[] = array($product, '', $row['quantity'], $row['unit_price_fils'], false);
            }
            if (array_sum(array_column($requested, 'quantity')) + array_sum(array_column($additions, 'quantity')) < 1) return $this->error('empty_order', 'Keep at least one item in the order.', 422);
            $old_total = (int) round((float) $order->get_total() * 1000);
            $previous_credit = max(0, (int) $order->get_meta('_tabarak_seller_wallet_credit_total_fils'));
            $saved_paid = $order->get_meta('_tabarak_seller_original_paid_fils', true);
            $original_paid = $saved_paid !== '' ? max(0, (int) $saved_paid) :
                (Tabarak_Seller_Routing::card_paid($order) || Tabarak_Seller_Routing::wallet_paid($order)
                    ? $old_total : max(0, (int) $order->get_meta('_tabarak_twallet_paid_fils')));
            $held_paid = max(0, $original_paid - $previous_credit);
            $stock_reduced = false;
            foreach ($existing as $item) if ((int) $item->get_meta('_reduced_stock', true) > 0) $stock_reduced = true;
            $manual_lines = array();
            wc_transaction_query('start'); $transaction = true;
            foreach ($existing as $item_id => $item) {
                $old_quantity = (int) $item->get_quantity();
                $new_quantity = $requested[$item_id]['quantity'];
                $new_unit_price = $requested[$item_id]['unit_price_fils'];
                $old_line_fils = (int) round((float) $item->get_total() * 1000);
                if ($requested[$item_id]['price_includes_tax']) $old_line_fils += (int) round((float) $item->get_total_tax() * 1000);
                $old_unit_price = $old_quantity > 0 ? (int) round($old_line_fils / $old_quantity) : 0;
                if ($old_quantity === $new_quantity && $old_unit_price === $new_unit_price
                    && (!$requested[$item_id]['price_includes_tax'] || $item->get_tax_class() === '0')) continue;
                if ($old_quantity < 1) throw new DomainException('Invalid saved item quantity.');
                $product = $item->get_product();
                if (!$product && (int) $item->get_product_id() !== 0) throw new DomainException('This product is no longer available.');
                if ($product && $new_quantity > 1 && $product->is_sold_individually()) throw new DomainException('This item quantity cannot be changed.');
                if ($product && $new_quantity > $old_quantity && !$product->has_enough_stock($new_quantity - $old_quantity)) throw new DomainException('Not enough stock for ' . $product->get_name());
                if ($product) $this->edit_stock($item, $product, $new_quantity);
                if ($new_quantity === 0) { $order->remove_item($item_id); continue; }
                $net_line_fils = $requested[$item_id]['price_includes_tax']
                    ? $this->set_manual_final_price($item, $new_unit_price, $new_quantity)
                    : $new_unit_price * $new_quantity;
                $net_unit_fils = (int) round($net_line_fils / $new_quantity);
                $item->update_meta_data('_tabarak_seller_base_quantity', 1);
                $item->update_meta_data('_tabarak_seller_base_total_fils', $net_unit_fils);
                $item->update_meta_data('_tabarak_seller_base_subtotal_fils', $net_unit_fils);
                $item->set_quantity($new_quantity);
                if (!$requested[$item_id]['price_includes_tax']) {
                    $line_total = number_format($net_line_fils / 1000, 3, '.', '');
                    $item->set_total($line_total);
                    $item->set_subtotal($line_total);
                }
                $item->save();
                if ($requested[$item_id]['price_includes_tax']) $manual_lines[] = array($item, $new_unit_price * $new_quantity);
            }
            foreach ($new_products as $entry) {
                list($product, $name, $quantity, $price, $price_includes_tax) = $entry;
                $item = new WC_Order_Item_Product();
                if ($product) $item->set_product($product);
                else $item->set_name($name);
                $item->set_quantity($quantity);
                $net_line_fils = $price_includes_tax
                    ? $this->set_manual_final_price($item, $price, $quantity) : $price * $quantity;
                if (!$price_includes_tax) {
                    $line = number_format($net_line_fils / 1000, 3, '.', '');
                    $item->set_subtotal($line); $item->set_total($line);
                }
                $item->update_meta_data('_tabarak_seller_base_quantity', 1);
                $item->update_meta_data('_tabarak_seller_base_total_fils', (int) round($net_line_fils / $quantity));
                $item->update_meta_data('_tabarak_seller_base_subtotal_fils', (int) round($net_line_fils / $quantity));
                if ($product) $this->edit_stock($item, $product, $quantity, $stock_reduced);
                $order->add_item($item);
                if ($price_includes_tax) $manual_lines[] = array($item, $price * $quantity);
            }
            $order->calculate_totals(true);
            foreach ($manual_lines as $line) {
                $actual_fils = (int) round(((float) $line[0]->get_total() + (float) $line[0]->get_total_tax()) * 1000);
                if ($actual_fils !== $line[1] || (int) round((float) $line[0]->get_total_tax() * 1000) !== 0) {
                    throw new DomainException('Manual item price changed during VAT calculation. Order was not saved.');
                }
            }
            $new_total = (int) round((float) $order->get_total() * 1000);
            if ($new_total < 1 || $new_total > 100000000) throw new DomainException('Order total must be positive for driver assignment.');
            if ($new_total > $old_total && !$customer_contact_confirmed) throw new DomainException('Contact the customer before saving an order increase.');
            $settlement = TSR_Order_Edit_Money::settlement($old_total, $new_total, min($held_paid, $old_total));
            $next_revision = $revision + 1;
            if ($settlement['wallet_credit_fils'] > 0 && !Tabarak_Mobile_Rewards::credit_wallet_order_adjustment(
                (int) $order->get_customer_id(), $id, $next_revision, $settlement['wallet_credit_fils'])) {
                throw new RuntimeException('Wallet credit could not be saved.');
            }
            $order->update_meta_data('_tabarak_seller_original_paid_fils', $original_paid);
            $order->update_meta_data('_tabarak_seller_wallet_credit_total_fils', $previous_credit + $settlement['wallet_credit_fils']);
            $order->update_meta_data('_tabarak_seller_edit_revision', $next_revision);
            $order->save();
            if (method_exists($wpdb, 'update')) {
                $wpdb->update(Tabarak_Seller_Routing::table('handoffs'), array('amount_fils' => $new_total), array('order_id' => $id));
            }
            wc_transaction_query('commit'); $transaction = false;
            if ($order->get_meta('_tabarak_seller_driver_app_id') && !$order->get_meta('_tabarak_seller_handed_at')) {
                $this->sync_assigned_driver_order($order);
            }
            try { $order->add_order_note('Seller revised items. Total: ' . number_format($old_total / 1000, 3, '.', '') . ' → ' . number_format($new_total / 1000, 3, '.', '') . ' BHD. Customer contacted before increase: ' . ($new_total > $old_total ? 'Yes (Seller confirmed)' : 'Not required') . '. Wallet credit: ' . number_format($settlement['wallet_credit_fils'] / 1000, 3, '.', '') . ' BHD. Collect on delivery: ' . number_format($settlement['amount_due_fils'] / 1000, 3, '.', '') . ' BHD.'); } catch (Throwable $ignored) {}
            Tabarak_Seller_Routing::event($id, 'order_edited', $actor['user']->ID, (int) $order->get_meta('_tabarak_seller_branch_id'), 'Revision ' . $next_revision);
            $notice = 'Order #' . $order->get_order_number() . ' was updated by the branch. New total: ' . number_format($new_total / 1000, 3, '.', '') . ' BHD.';
            if ($settlement['wallet_credit_fils'] > 0) $notice .= ' ' . number_format($settlement['wallet_credit_fils'] / 1000, 3, '.', '') . ' BHD returned to T-Wallet.';
            if ($settlement['amount_due_fils'] > 0) $notice .= ' Collect ' . number_format($settlement['amount_due_fils'] / 1000, 3, '.', '') . ' BHD on delivery.';
            try {
                if (!Tabarak_Mobile_Notifications::notify_user((int) $order->get_customer_id(), 'seller:order-edit:' . $id . ':' . $next_revision,
                    'Order updated', $notice, $id)) $order->add_order_note('Customer edit notification could not be saved. Staff follow-up required.');
            } catch (Throwable $ignored) { try { $order->add_order_note('Customer edit notification failed. Staff follow-up required.'); } catch (Throwable $ignored_again) {} }
            return $this->order_data($order, true);
        } catch (Throwable $e) {
            if ($transaction) wc_transaction_query('rollback');
            return $this->error('edit_failed', $e instanceof InvalidArgumentException || $e instanceof DomainException
                ? $e->getMessage() : 'Order update failed. Refresh and try again.', 409);
        } finally {
            $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
    }

    private function build_driver_assign_payload($order, $driver_id, $branch, $location) {
        $delivery_details = class_exists('Tabarak_Driver_Status_Sync')
            ? Tabarak_Driver_Status_Sync::delivery_details($order)
            : (method_exists('Tabarak_Seller_Routing', 'delivery_details')
                ? Tabarak_Seller_Routing::delivery_details($order)
                : array('shipping' => $order->get_address('shipping'), 'instructions' => ''));
        $shipping = $delivery_details['shipping'];
        $billing = $order->get_address('billing');
        $address = implode(', ', array_filter(array(
            ($shipping['address_1'] ?? '') ?: ($billing['address_1'] ?? ''),
            ($shipping['address_2'] ?? '') ?: ($billing['address_2'] ?? ''),
            ($shipping['city'] ?? '') ?: ($billing['city'] ?? ''),
            ($shipping['state'] ?? '') ?: ($billing['state'] ?? ''),
            ($shipping['postcode'] ?? '') ?: ($billing['postcode'] ?? ''),
        ), static function($part) { return trim((string) $part) !== ''; }));
        $payment = $this->payment($order);
        $driver_notes = array();
        if (($delivery_details['instructions'] ?? '') !== '') {
            $driver_notes[] = 'Delivery instructions: ' . str_replace("\n", '; ', $delivery_details['instructions']);
        }
        if (trim((string) $order->get_customer_note()) !== '') {
            $driver_notes[] = ($driver_notes ? 'Customer note: ' : '') . trim((string) $order->get_customer_note());
        }
        return array('action' => 'assign', 'driver_id' => $driver_id, 'order' => array(
            'id' => (string) $order->get_id(), 'number' => (string) $order->get_order_number(),
            'branch_code' => (string) $branch['code'],
            'created_at' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d') : gmdate('Y-m-d'),
            'total' => (string) $order->get_total(), 'payment_method' => $payment['method'],
            'amount_due_fils' => (int) $payment['amount_due_fils'],
            'block' => Tabarak_Seller_Routing::block_for_order($order),
            'pharmacist' => (string) $order->get_meta('_tabarak_seller_pharmacist'),
            'customer' => array('name' => $order->get_formatted_billing_full_name(), 'phone' => $order->get_billing_phone()),
            'address' => $address, 'location' => $location,
            'note' => implode("\n", $driver_notes),
        ));
    }

    private function sync_assigned_driver_order($order) {
        $driver_id = (string) $order->get_meta('_tabarak_seller_driver_app_id');
        if ($driver_id === '' || $order->get_meta('_tabarak_seller_handed_at')) return;
        if (!$this->driver_bridge_ready()) {
            $order->update_meta_data('_tabarak_seller_driver_sync_pending', gmdate('c'));
            $order->save();
            return;
        }
        $branch_id = (int) $order->get_meta('_tabarak_seller_branch_id');
        $branch = Tabarak_Seller_Routing::branch($branch_id);
        $location = Tabarak_Seller_Routing::location_for_order($order);
        if (!$branch || empty($branch['code']) || !$location || trim((string) $order->get_billing_phone()) === '') return;
        $result = $this->driver_bridge($this->build_driver_assign_payload($order, $driver_id, $branch, $location));
        if (is_wp_error($result) || empty($result['delivery_order_id'])) {
            $order->update_meta_data('_tabarak_seller_driver_sync_pending', gmdate('c'));
            $order->save();
            return;
        }
        if ($order->get_meta('_tabarak_seller_driver_sync_pending')) {
            $order->delete_meta_data('_tabarak_seller_driver_sync_pending');
            $order->save();
        }
    }

    public function assign_driver($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $order = $this->require_order($request, $actor, true); if (is_wp_error($order)) return $order;
        global $wpdb;
        $handoff_exists = $wpdb->get_var($wpdb->prepare('SELECT order_id FROM ' . Tabarak_Seller_Routing::table('handoffs') . ' WHERE order_id=%d', $order->get_id()));
        if ($order->get_meta('_tabarak_seller_handed_at') || $handoff_exists) return $this->error('already_handed_over', 'This order has already been handed to the driver.', 409);
        if ($order->get_meta('_tabarak_delivery_driver_id') || $order->get_meta('_propharm_delivery_driver_id'))
            return $this->error('legacy_driver_assigned', 'This WordPress driver assignment cannot be changed in Driver app.', 409);
        if (in_array($order->get_status(), array('cancelled', 'failed', 'refunded', 'completed'), true)
            || Tabarak_Seller_Routing::fulfillment_state($order)['status'] === 'delivered') {
            return $this->error('order_closed', 'A delivered or closed order cannot be assigned to a driver.', 409);
        }
        $body = $request->get_json_params();
        if (!$this->driver_bridge_ready()) {
            // Preserve the existing WordPress-only assignment path for older clients
            // during rollout. The updated Seller app labels and blocks this mode.
            $legacy_id = absint(is_array($body) ? ($body['driver_id'] ?? 0) : 0);
            $tabarak = $order->get_created_via() === 'tabarak-mobile';
            $table = $wpdb->prefix . ($tabarak ? 'tabarak_mobile_drivers' : 'propharm_mobile_drivers');
            $legacy_driver = $wpdb->get_row($wpdb->prepare('SELECT id,name,phone FROM ' . $table . ' WHERE id=%d AND active=1', $legacy_id), ARRAY_A);
            if (!$legacy_driver) return $this->error('invalid_driver', 'Choose an active WordPress driver.', 422);
            $legacy_prefix = $tabarak ? '_tabarak_delivery_driver_' : '_propharm_delivery_driver_';
            $order->update_meta_data($legacy_prefix . 'id', (int) $legacy_driver['id']);
            $order->update_meta_data($legacy_prefix . 'name', $legacy_driver['name']);
            $order->update_meta_data($legacy_prefix . 'phone', $legacy_driver['phone']);
            $order->save();
            Tabarak_Seller_Routing::event($order->get_id(), 'driver_assigned', $actor['user']->ID, (int) $order->get_meta('_tabarak_seller_branch_id'), $legacy_driver['name']);
            return $this->order_data($order, true);
        }
        $driver_id = is_array($body) ? (string) ($body['driver_id'] ?? '') : '';
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $driver_id)) {
            return $this->error('invalid_driver', 'Choose a driver with an active app account.', 422);
        }
        $existing_driver_id = (string) $order->get_meta('_tabarak_seller_driver_app_id');
        if ($existing_driver_id !== '') {
            $state = $this->delivery_statuses(array($order->get_id()));
            $delivery = $state[$order->get_id()] ?? null;
            $this->reconcile_driver_cancellation($order, $delivery);
            $this->reconcile_driver_delivery($order, $delivery);
            $existing_driver_id = (string) $order->get_meta('_tabarak_seller_driver_app_id');
            if ($existing_driver_id !== '' && ($delivery['delivery_status'] ?? '') !== 'assigned')
                return $this->error('driver_not_reassignable', 'The driver has already picked up or cancelled this assignment. Refresh the order.', 409);
        }
        if ($existing_driver_id === $driver_id) return $this->order_data($order, true);
        $branch_id = (int) $order->get_meta('_tabarak_seller_branch_id');
        $branch = Tabarak_Seller_Routing::branch($branch_id);
        if (!$branch || empty($branch['code'])) return $this->error('branch_required', 'Assigned branch could not be verified.', 409);
        $location = Tabarak_Seller_Routing::location_for_order($order);
        if (!$location) return $this->error('location_required', 'Customer GPS is missing. Confirm the delivery location before assigning a driver.', 422);
        if (trim((string) $order->get_billing_phone()) === '') return $this->error('phone_required', 'Customer phone is missing. Confirm it before assigning a driver.', 422);
        $result = $this->driver_bridge($this->build_driver_assign_payload($order, $driver_id, $branch, $location));
        if (is_wp_error($result)) return $result;
        $driver = $result['driver'] ?? null;
        if (!is_array($driver) || (string) ($driver['id'] ?? '') !== $driver_id || empty($result['delivery_order_id'])) {
            return $this->error('driver_bridge_failed', 'Driver app did not confirm assignment. Refresh the order before retrying.', 503);
        }
        $tabarak = $order->get_created_via() === 'tabarak-mobile';
        $prefix = $tabarak ? '_tabarak_delivery_driver_' : '_propharm_delivery_driver_';
        $order->update_meta_data('_tabarak_seller_driver_app_id', $driver_id);
        $order->update_meta_data('_tabarak_seller_delivery_order_id', sanitize_text_field((string) $result['delivery_order_id']));
        $order->update_meta_data($prefix . 'name', sanitize_text_field((string) ($driver['name'] ?? '')));
        $order->update_meta_data($prefix . 'phone', sanitize_text_field((string) ($driver['phone'] ?? '')));
        $order->delete_meta_data('_tabarak_seller_driver_returned_at');
        $order->delete_meta_data('_tabarak_seller_driver_cancel_notice_at');
        $order->delete_meta_data('_tabarak_seller_driver_sync_pending');
        $order->save();
        unset($this->delivery_status_cache[$order->get_id()]);
        Tabarak_Seller_Routing::event($order->get_id(), $existing_driver_id === '' ? 'driver_assigned' : 'driver_reassigned',
            $actor['user']->ID, (int) $order->get_meta('_tabarak_seller_branch_id'), $driver['name']);
        return $this->order_data($order, true);
    }

    public function notifications($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        global $wpdb;
        return array('items' => $wpdb->get_results($wpdb->prepare('SELECT id,event_key,order_id,title,body,created_at,read_at FROM ' . Tabarak_Seller_Routing::table('notifications') . ' WHERE user_id=%d ORDER BY id DESC LIMIT 100', $actor['user']->ID), ARRAY_A) ?: array());
    }

    public function read_notification($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        global $wpdb;
        $wpdb->query($wpdb->prepare('UPDATE ' . Tabarak_Seller_Routing::table('notifications') . ' SET read_at=COALESCE(read_at,%s) WHERE id=%d AND user_id=%d', current_time('mysql', true), absint($request['id']), $actor['user']->ID));
        return array('ok' => true);
    }

    public function read_all_notifications($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        global $wpdb;
        $wpdb->query($wpdb->prepare('UPDATE ' . Tabarak_Seller_Routing::table('notifications') . ' SET read_at=COALESCE(read_at,%s) WHERE user_id=%d AND read_at IS NULL', current_time('mysql', true), $actor['user']->ID));
        return array('ok' => true, 'updated' => (int) $wpdb->rows_affected);
    }

    public function register_push_token($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        $body = $request->get_json_params(); $token = $body['token'] ?? null;
        if (!is_string($token) || !preg_match('/^ExpoPushToken\[[A-Za-z0-9_-]{8,128}\]$/', $token)) return $this->error('invalid_token', 'Invalid push token.', 422);
        $tokens = get_user_meta($actor['user']->ID, '_tabarak_seller_push_tokens', true);
        $tokens = is_array($tokens) ? $tokens : array();
        array_unshift($tokens, $token);
        update_user_meta($actor['user']->ID, '_tabarak_seller_push_tokens', array_slice(array_values(array_unique($tokens)), 0, 3));
        return array('ok' => true);
    }

    public function dashboard($request) {
        $actor = $this->auth($request); if (is_wp_error($actor)) return $actor;
        global $wpdb; $dispatch = Tabarak_Seller_Routing::table('dispatch'); $events = Tabarak_Seller_Routing::table('events');
        if ($actor['admin']) $where = '1=1';
        else $where = $wpdb->prepare('branch_id=%d', $actor['branch_id']);
        $states = $wpdb->get_results('SELECT state,COUNT(*) AS count FROM ' . $dispatch . ' WHERE ' . $where . ' GROUP BY state', ARRAY_A) ?: array();
        $rows = $wpdb->get_results('SELECT e.order_id,e.event_key,e.created_at FROM ' . $events . ' e JOIN ' . $dispatch . " d ON d.order_id=e.order_id WHERE e.event_key IN ('preparing','ready') AND e.created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 DAY) AND " . ($actor['admin'] ? '1=1' : $wpdb->prepare('d.branch_id=%d', $actor['branch_id'])) . ' ORDER BY e.order_id,e.id', ARRAY_A) ?: array();
        $started = array(); $prep = array();
        foreach ($rows as $row) {
            if ($row['event_key'] === 'preparing') $started[$row['order_id']] = strtotime($row['created_at'] . ' UTC');
            if ($row['event_key'] === 'ready' && isset($started[$row['order_id']])) $prep[] = max(0, (strtotime($row['created_at'] . ' UTC') - $started[$row['order_id']]) / 60);
        }
        return array('states' => $states, 'average_preparation_minutes' => $prep ? round(array_sum($prep) / count($prep), 1) : null,
            'preparation_samples' => count($prep));
    }
}
