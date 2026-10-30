<?php
defined('ABSPATH') || exit;

/** Administrator-only branch credentials, scoped by the routing branch ID. */
final class TSR_Accounts {
    public static function has_linked_account($branch_id) {
        return (bool) get_users(array('meta_key' => Tabarak_Seller_Routing::BRANCH_META,
            'meta_value' => (int) $branch_id, 'fields' => 'ID', 'number' => 1));
    }

    private static function username($code) {
        return strtoupper(trim((string) $code));
    }

    public static function inspect($branches) {
        $rows = array();
        $seen = array();
        foreach ($branches as $branch) {
            $code = self::username($branch['code'] ?? '');
            $id = (int) ($branch['id'] ?? 0);
            $state = 'ready';
            $user = false;
            if (!$id || $code === 'D001' || !preg_match('/^[A-Z0-9_-]{2,40}$/D', $code) ||
                sanitize_user($code, true) !== $code || isset($seen[strtolower($code)])) {
                $state = 'invalid_or_duplicate_code';
            } else {
                $seen[strtolower($code)] = true;
                $user = get_user_by('login', $code);
                $linked = get_users(array('meta_key' => Tabarak_Seller_Routing::BRANCH_META,
                    'meta_value' => $id, 'fields' => 'all'));
                if (count($linked) > 1 || ($linked && (!$user || (int) $linked[0]->ID !== (int) $user->ID))) {
                    $state = 'branch_already_has_another_login';
                } elseif ($user) {
                    $assigned = (int) get_user_meta($user->ID, Tabarak_Seller_Routing::BRANCH_META, true);
                    if (!in_array('tabarak_seller', (array) $user->roles, true) || ($assigned && $assigned !== $id)) {
                        $state = 'username_in_use';
                    } else {
                        $state = $assigned === $id ? 'linked' : 'link_existing';
                    }
                }
            }
            $rows[] = array('branch' => $branch, 'username' => $code, 'state' => $state, 'user' => $user);
        }
        return $rows;
    }

    public static function render($branches) {
        if (!current_user_can('manage_options')) return;
        $rows = self::inspect($branches);
        $blocked = !$rows;
        echo '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
        echo '<div><h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:#0f172a;">Branch Accounts & Credentials</h2>';
        echo '<p style="margin:0;color:#64748b;font-size:13px;">Branch username is the official branch code (e.g., T001, H001). You can set custom passwords manually, generate secure passwords on the fly, or download updated credentials as CSV.</p></div>';
        echo '</div>';

        echo '<table class="widefat striped" style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">';
        echo '<thead><tr style="background:#f8fafc;">';
        echo '<th style="padding:12px;font-weight:700;">Branch</th>';
        echo '<th style="padding:12px;font-weight:700;">Username</th>';
        echo '<th style="padding:12px;font-weight:700;">Status</th>';
        echo '<th style="padding:12px;font-weight:700;">Password Management (Manual / Auto-Generate)</th>';
        echo '</tr></thead><tbody>';

        foreach ($rows as $row) {
            if (!in_array($row['state'], array('ready', 'linked', 'link_existing'), true)) $blocked = true;
            $labels = array(
                'ready' => '<span class="tsr-badge tsr-badge-neutral">Ready to create</span>',
                'linked' => '<span class="tsr-badge tsr-badge-success">Linked</span>',
                'link_existing' => '<span class="tsr-badge tsr-badge-warning">Existing seller ready to link</span>',
                'invalid_or_duplicate_code' => '<span class="tsr-badge tsr-badge-danger">Invalid/Duplicate code</span>',
                'branch_already_has_another_login' => '<span class="tsr-badge tsr-badge-danger">Another login linked</span>',
                'username_in_use' => '<span class="tsr-badge tsr-badge-danger">Username in use</span>',
            );
            $branch_id = (int) $row['branch']['id'];
            $input_id = 'tsr_pass_' . $branch_id;

            echo '<tr>';
            echo '<td style="padding:10px 12px;font-weight:600;color:#0f172a;">' . esc_html($row['branch']['name']) . '</td>';
            echo '<td style="padding:10px 12px;"><code style="font-size:13px;font-weight:700;color:#ba2523;background:#fff1f2;padding:3px 8px;border-radius:4px;">' . esc_html($row['username']) . '</code></td>';
            echo '<td style="padding:10px 12px;">' . ($labels[$row['state']] ?? esc_html($row['state'])) . '</td>';
            echo '<td style="padding:10px 12px;">';

            if ($row['state'] === 'linked' || $row['state'] === 'ready') {
                $is_ready = ($row['state'] === 'ready');
                $action_name = $is_ready ? 'tsr_create_single_account' : 'tsr_reset_account';
                $nonce_action = $is_ready ? 'tsr_create_single_' . $branch_id : 'tsr_reset_account_' . $branch_id;
                $btn_text = $is_ready ? 'Create Account' : 'Save Password';

                echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0;">';
                wp_nonce_field($nonce_action);
                echo '<input type="hidden" name="action" value="' . esc_attr($action_name) . '">';
                echo '<input type="hidden" name="branch_id" value="' . $branch_id . '">';
                echo '<div style="position:relative;display:inline-flex;align-items:center;">';
                echo '<input type="text" name="new_password" id="' . esc_attr($input_id) . '" placeholder="Type custom password..." style="width:190px;height:30px;font-family:monospace;font-size:12px;border:1px solid #cbd5e1;border-radius:5px;padding:0 24px 0 8px;" autocomplete="new-password">';
                echo '<button type="button" onclick="tsrClearInput(\'' . esc_attr($input_id) . '\')" title="Clear" style="position:absolute;right:6px;border:none;background:transparent;color:#94a3b8;cursor:pointer;font-size:14px;padding:0;line-height:1;">&times;</button>';
                echo '</div>';
                echo '<button type="button" class="button button-secondary" onclick="tsrGeneratePassword(\'' . esc_attr($input_id) . '\')" title="Auto-generate secure password" style="height:30px;line-height:28px;padding:0 9px;font-size:12px;display:inline-flex;align-items:center;gap:4px;"><span class="dashicons dashicons-randomize" style="font-size:14px;width:14px;height:14px;margin-top:1px;"></span> Auto</button>';
                echo '<button class="button button-primary" type="submit" style="height:30px;line-height:28px;padding:0 12px;font-size:12px;font-weight:600;">' . esc_html($btn_text) . '</button>';
                echo '<label style="font-size:11px;color:#64748b;display:inline-flex;align-items:center;gap:3px;cursor:pointer;margin-left:4px;"><input type="checkbox" name="download_csv" value="1"> CSV</label>';
                echo '</form>';
            } else {
                echo '<span style="color:#94a3b8;font-size:12px;">No password actions available</span>';
            }

            echo '</td></tr>';
        }
        echo '</tbody></table>';

        ?>
        <script>
        function tsrGeneratePassword(inputId) {
            var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
            var pass = '';
            var cryptoObj = window.crypto || window.msCrypto;
            if (cryptoObj && cryptoObj.getRandomValues) {
                var values = new Uint32Array(16);
                cryptoObj.getRandomValues(values);
                for (var i = 0; i < 16; i++) {
                    pass += chars[values[i] % chars.length];
                }
            } else {
                for (var i = 0; i < 16; i++) {
                    pass += chars.charAt(Math.floor(Math.random() * chars.length));
                }
            }
            var el = document.getElementById(inputId);
            if (el) {
                el.value = pass;
                el.type = 'text';
                el.focus();
                el.select();
            }
        }
        function tsrClearInput(inputId) {
            var el = document.getElementById(inputId);
            if (el) {
                el.value = '';
                el.focus();
            }
        }
        </script>
        <?php

        if ($blocked) {
            echo '<p class="notice notice-warning" style="margin-top:16px;">Resolve the account conflicts above before provisioning. No existing password will be changed.</p>';
            return;
        }

        echo '<div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">';
        echo '<h4 style="margin:0 0 6px;color:#0f172a;font-size:14px;font-weight:700;">Bulk Provisioning</h4>';
        echo '<p style="margin:0 0 12px;color:#64748b;font-size:12.5px;">Create missing branch accounts all at once with auto-generated secure passwords and download the CSV master sheet.</p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('tsr_provision_accounts');
        echo '<input type="hidden" name="action" value="tsr_provision_accounts">';
        submit_button('Create Missing Accounts & Download Passwords CSV', 'secondary', 'submit', false);
        echo '</form>';
        echo '</div>';
    }

    public static function provision() {
        if (!current_user_can('manage_options')) wp_die('Administrator access required.', '', array('response' => 403));
        check_admin_referer('tsr_provision_accounts');
        $rows = self::inspect(Tabarak_Seller_Routing::branch_rows());
        if (!$rows) wp_die('No routing branches exist.', '', array('response' => 422));
        foreach ($rows as $row) {
            if (!in_array($row['state'], array('ready', 'linked', 'link_existing'), true)) {
                wp_die('Resolve branch account conflicts before provisioning. No accounts were created.', '', array('response' => 409));
            }
        }

        self::download_csv(self::create_accounts($rows));
    }

    public static function create_accounts($rows) {
        $results = array();
        foreach ($rows as $row) {
            $branch = $row['branch'];
            $code = $row['username'];
            $password = '';
            $status = $row['state'];
            if ($status === 'ready') {
                // 28 random alphanumeric characters avoid Excel formula interpretation.
                $password = wp_generate_password(28, false, false);
                $user_id = wp_insert_user(array('user_login' => $code, 'user_pass' => $password,
                    'user_email' => '', 'display_name' => $branch['name'], 'role' => 'tabarak_seller',
                    'meta_input' => array(Tabarak_Seller_Routing::BRANCH_META => (int) $branch['id'])));
                if (is_wp_error($user_id)) {
                    $password = '';
                    $status = 'creation_failed';
                } else {
                    $status = (int) get_user_meta($user_id, Tabarak_Seller_Routing::BRANCH_META, true) === (int) $branch['id']
                        ? 'created' : 'created_link_needs_review';
                }
            } elseif ($status === 'link_existing') {
                update_user_meta($row['user']->ID, Tabarak_Seller_Routing::BRANCH_META, (int) $branch['id']);
                $status = 'linked_existing_password_unchanged';
            } else {
                $status = 'already_linked_password_unchanged';
            }
            $results[] = array($code, $branch['name'], $code, $password, $status);
        }
        return $results;
    }

    public static function allow_password_reset($allow, $user_id) {
        $user = get_userdata((int) $user_id);
        return $user && in_array('tabarak_seller', (array) $user->roles, true) ? false : $allow;
    }

    public static function reset_password() {
        if (!current_user_can('manage_options')) wp_die('Administrator access required.', '', array('response' => 403));
        $branch_id = absint($_POST['branch_id'] ?? 0);
        check_admin_referer('tsr_reset_account_' . $branch_id);
        $branch = Tabarak_Seller_Routing::branch($branch_id);
        if (!$branch) wp_die('Branch not found.', '', array('response' => 404));
        $code = self::username($branch['code']);
        $user = get_user_by('login', $code);
        if (!$user || !in_array('tabarak_seller', (array) $user->roles, true) ||
            (int) get_user_meta($user->ID, Tabarak_Seller_Routing::BRANCH_META, true) !== $branch_id) {
            wp_die('Branch account is not linked.', '', array('response' => 409));
        }

        $manual_pass = isset($_POST['new_password']) ? trim((string) $_POST['new_password']) : '';
        if ($manual_pass !== '') {
            if (strlen($manual_pass) < 6) {
                wp_die('Password must be at least 6 characters long.', '', array('response' => 400));
            }
            $password = $manual_pass;
            $action_type = 'manual_password_set';
        } else {
            $password = wp_generate_password(28, false, false);
            $action_type = 'password_reset_auto';
        }

        wp_set_password($password, $user->ID);
        global $wpdb;
        $wpdb->delete(Tabarak_Seller_Routing::table('sessions'), array('user_id' => (int) $user->ID));

        $download_csv = !empty($_POST['download_csv']);
        if ($download_csv) {
            self::download_csv(array(array($code, $branch['name'], $code, $password, $action_type)));
        } else {
            set_transient('tsr_password_notice_' . get_current_user_id(), array(
                'branch_name' => $branch['name'],
                'code'        => $code,
                'password'    => $password,
                'action'      => 'reset',
            ), 60);
            wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=accounts&password_saved=1'));
            exit;
        }
    }

    public static function create_single_account() {
        if (!current_user_can('manage_options')) wp_die('Administrator access required.', '', array('response' => 403));
        $branch_id = absint($_POST['branch_id'] ?? 0);
        check_admin_referer('tsr_create_single_' . $branch_id);
        $branch = Tabarak_Seller_Routing::branch($branch_id);
        if (!$branch) wp_die('Branch not found.', '', array('response' => 404));
        $code = self::username($branch['code']);

        $manual_pass = isset($_POST['new_password']) ? trim((string) $_POST['new_password']) : '';
        if ($manual_pass !== '') {
            if (strlen($manual_pass) < 6) {
                wp_die('Password must be at least 6 characters long.', '', array('response' => 400));
            }
            $password = $manual_pass;
            $action_type = 'single_manual_create';
        } else {
            $password = wp_generate_password(28, false, false);
            $action_type = 'single_auto_create';
        }

        $user_id = wp_insert_user(array(
            'user_login'   => $code,
            'user_pass'    => $password,
            'user_email'   => '',
            'display_name' => $branch['name'],
            'role'         => 'tabarak_seller',
            'meta_input'   => array(Tabarak_Seller_Routing::BRANCH_META => $branch_id)
        ));

        if (is_wp_error($user_id)) {
            wp_die('Failed to create account: ' . esc_html($user_id->get_error_message()), '', array('response' => 400));
        }

        $download_csv = !empty($_POST['download_csv']);
        if ($download_csv) {
            self::download_csv(array(array($code, $branch['name'], $code, $password, $action_type)));
        } else {
            set_transient('tsr_password_notice_' . get_current_user_id(), array(
                'branch_name' => $branch['name'],
                'code'        => $code,
                'password'    => $password,
                'action'      => 'created',
            ), 60);
            wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&tab=accounts&password_saved=1'));
            exit;
        }
    }

    private static function download_csv($rows) {
        nocache_headers();
        header('Cache-Control: private, no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="tabarak-branch-credentials.csv"');
        $out = fopen('php://output', 'w');
        echo "\xEF\xBB\xBF";
        fputcsv($out, array('branch_code', 'branch_name', 'username', 'one_time_password', 'status'));
        foreach ($rows as $row) {
            $row = array_map(static function($value) {
                $value = (string) $value;
                return preg_match('/^[\s\x00-\x1f]*[=+@-]/u', $value) ? "'" . $value : $value;
            }, $row);
            fputcsv($out, $row);
        }
        fclose($out);
        exit;
    }
}
