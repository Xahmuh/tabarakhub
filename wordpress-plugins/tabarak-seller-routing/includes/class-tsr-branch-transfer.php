<?php
defined('ABSPATH') || exit;

/** Bulk CSV transfer and an idempotent copy from the site's existing branch directory. */
final class TSR_Branch_Transfer {
    const MAX_CSV_BYTES = 2097152;
    const MAX_ROWS = 1000;

    public static function headers() {
        return array('code', 'name', 'block_number', 'lat', 'lng', 'enabled', 'always_open',
            'card_enabled', 'cod_enabled', 'wallet_enabled', 'accept_anywhere', 'hours_json',
            'pharmacists_json', 'phone', 'whatsapp', 'address', 'locality', 'source_post_id');
    }

    public static function render() {
        if (!current_user_can('manage_woocommerce')) return;
        $report = get_transient('tsr_transfer_' . get_current_user_id());
        if (!is_array($report) && isset($_GET['tsr_created'], $_GET['tsr_updated'], $_GET['tsr_unchanged'], $_GET['tsr_skipped'])) {
            $report = self::report();
            foreach (array('created', 'updated', 'unchanged', 'skipped') as $key) {
                $report[$key] = min(self::MAX_ROWS, absint($_GET['tsr_' . $key]));
            }
        }
        if (is_array($report)) {
            echo '<div class="notice ' . (empty($report['errors']) ? 'notice-success' : 'notice-warning') . '"><p>';
            echo esc_html(sprintf('Branches: %d created, %d updated, %d unchanged, %d skipped.',
                $report['created'], $report['updated'], $report['unchanged'], $report['skipped']));
            echo '</p>';
            if ($report['errors']) echo '<p>' . esc_html(implode(' | ', array_slice($report['errors'], 0, 12))) . '</p>';
            echo '</div>';
        }
        echo '<hr><h2>Bulk import and export</h2>';
        echo '<p>CSV files use UTF-8 and open in Excel. Export the current routing branches, edit the file, then import it. Rows match by stable branch code; missing rows are never deleted. Existing seller account links remain attached to their branch.</p>';
        echo '<p><a class="button" href="' . esc_url(wp_nonce_url(admin_url('admin-post.php?action=tsr_export_branches'), 'tsr_export_branches')) . '">Export routing branches CSV</a> ';
        echo '<a class="button" href="' . esc_url(wp_nonce_url(admin_url('admin-post.php?action=tsr_export_branches&template=1'), 'tsr_export_branches')) . '">Download blank CSV template</a></p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" enctype="multipart/form-data">';
        wp_nonce_field('tsr_import_branches');
        echo '<input type="hidden" name="action" value="tsr_import_branches">';
        echo '<p><label for="tsr_csv_file">Import routing CSV</label> <input type="file" id="tsr_csv_file" name="tsr_csv_file" accept=".csv,text/csv" required> ';
        echo '<button class="button button-primary">Import CSV</button></p></form>';
        if (post_type_exists('tbh_branch')) {
            $counts = wp_count_posts('tbh_branch');
            $count = $counts ? (int) $counts->publish : 0;
            echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
            wp_nonce_field('tsr_copy_directory');
            echo '<input type="hidden" name="action" value="tsr_copy_directory">';
            echo '<p><button class="button button-primary">Copy published Our Branches into routing (' . $count . ')</button></p></form>';
            echo '<p class="description">The copy refreshes names, locations, contact details, opening hours and active state. It keeps existing payment flags, pharmacist lists and seller account links. Unrecognized opening hours make a new branch inactive for review.</p>';
        }
    }

    private static function report() {
        return array('created' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => 0, 'errors' => array());
    }

    private static function finish($report) {
        set_transient('tsr_transfer_' . get_current_user_id(), $report, MINUTE_IN_SECONDS * 5);
        wp_safe_redirect(add_query_arg(array(
            'tsr_created' => (int) $report['created'],
            'tsr_updated' => (int) $report['updated'],
            'tsr_unchanged' => (int) $report['unchanged'],
            'tsr_skipped' => (int) $report['skipped'],
        ), admin_url('admin.php?page=tabarak-seller-routing')));
        exit;
    }

    private static function csv_cell($value) {
        $value = (string) $value;
        // Excel must not execute branch names or notes as formulas.
        return preg_match('/^[\s\x00-\x1f]*[=+@-]/u', $value) ? "'" . $value : $value;
    }

    public static function export_csv() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_export_branches');
        $template = !empty($_GET['template']);
        nocache_headers();
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="tabarak-routing-' . ($template ? 'template' : 'branches') . '.csv"');
        echo "\xEF\xBB\xBF";
        $out = fopen('php://output', 'w');
        fputcsv($out, self::headers());
        if (!$template) {
            foreach (Tabarak_Seller_Routing::branch_rows() as $branch) {
                $row = array();
                foreach (self::headers() as $header_name) $row[] = self::csv_cell($branch[$header_name] ?? '');
                fputcsv($out, $row);
            }
        }
        fclose($out);
        exit;
    }

    private static function bool_value($value) {
        $value = strtolower(trim((string) $value));
        if (in_array($value, array('1', 'yes', 'true', 'on'), true)) return 1;
        if (in_array($value, array('0', 'no', 'false', 'off'), true)) return 0;
        return null;
    }

    private static function clean_cell($value) {
        $value = trim((string) $value);
        // Undo the formula guard on a CSV previously exported by this plugin.
        if (preg_match('/^\'[\s\x00-\x1f]*[=+@-]/u', $value)) $value = substr($value, 1);
        return $value;
    }

    private static function parse_json($value, $list) {
        $data = json_decode((string) $value, true);
        if (!is_array($data)) return null;
        if ($list) {
            if (array_values($data) !== $data) return null;
            foreach ($data as $entry) if (!is_string($entry)) return null;
            $data = array_slice(array_values(array_unique(array_filter(array_map('sanitize_text_field', $data), 'strlen'))), 0, 100);
        } else {
            foreach ($data as $day => $slots) {
                if (!preg_match('/^[0-6]$/', (string) $day) || !is_array($slots)) return null;
                foreach ($slots as $slot) {
                    if (!is_array($slot) || array_keys($slot) !== array(0, 1) ||
                        TSR_Planner::minutes_since_midnight($slot[0]) === null ||
                        TSR_Planner::minutes_since_midnight($slot[1]) === null ||
                        $slot[0] === $slot[1] || $slot[0] === '24:00') return null;
                }
            }
        }
        $encoded = wp_json_encode($data);
        return $encoded === false ? null : $encoded;
    }

    public static function validate_row($row, &$error) {
        $error = '';
        $data = array();
        $code = strtolower(self::clean_cell($row['code'] ?? ''));
        if ($code === '' || strlen($code) > 40 || !preg_match('/^[a-z0-9_-]+$/', $code)) $error = 'Invalid code';
        if ($code === 'd001') $error = 'District branch is retired';
        $data['code'] = $code;
        $data['name'] = sanitize_text_field(self::clean_cell($row['name'] ?? ''));
        if ($data['name'] === '' || strlen($data['name']) > 150) $error = 'Invalid name';
        $data['block_number'] = self::clean_cell($row['block_number'] ?? '');
        if ($data['block_number'] !== '' && !preg_match('/^\d{2,4}$/', $data['block_number'])) $error = 'Invalid block';
        foreach (array('lat' => array(25.5, 26.7), 'lng' => array(50.2, 51.0)) as $key => $range) {
            $raw = self::clean_cell($row[$key] ?? '');
            if (!is_numeric($raw) || (float) $raw < $range[0] || (float) $raw > $range[1]) $error = 'Invalid coordinates';
            $data[$key] = is_numeric($raw) ? (float) $raw : 0;
        }
        foreach (array('enabled', 'always_open', 'card_enabled', 'cod_enabled', 'wallet_enabled', 'accept_anywhere') as $key) {
            $data[$key] = self::bool_value($row[$key] ?? '');
            if ($data[$key] === null) $error = 'Invalid ' . $key . ' flag';
        }
        if ($data['block_number'] === '' && $data['enabled']) $error = 'Block is required for an enabled branch';
        $data['hours_json'] = self::parse_json(self::clean_cell($row['hours_json'] ?? ''), false);
        $data['pharmacists_json'] = self::parse_json(self::clean_cell($row['pharmacists_json'] ?? ''), true);
        if ($data['hours_json'] === null || $data['pharmacists_json'] === null) $error = 'Invalid JSON';
        if (!$data['always_open'] && $data['enabled'] && !json_decode((string) $data['hours_json'], true)) $error = 'Open hours are required for an enabled branch';
        foreach (array('phone' => 40, 'whatsapp' => 40, 'address' => 255, 'locality' => 150) as $key => $max) {
            $data[$key] = sanitize_text_field(self::clean_cell($row[$key] ?? ''));
            if (strlen($data[$key]) > $max) $error = 'Value too long: ' . $key;
        }
        $source = self::clean_cell($row['source_post_id'] ?? '');
        if ($source !== '' && (!ctype_digit($source) || (int) $source < 1)) $error = 'Invalid source post ID';
        $data['source_post_id'] = $source === '' ? null : (int) $source;
        $data['updated_at'] = current_time('mysql', true);
        return $error === '' ? $data : null;
    }

    public static function upsert($data, $preserve_settings = false) {
        global $wpdb;
        $table = Tabarak_Seller_Routing::table('branches');
        $existing = null;
        if (!empty($data['source_post_id'])) {
            $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE source_post_id=%d", $data['source_post_id']), ARRAY_A);
        }
        if (!$existing) $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE code=%s", $data['code']), ARRAY_A);
        if ($existing && $existing['code'] !== $data['code']) {
            if (TSR_Accounts::has_linked_account($existing['id'])) return 'branch code has a linked account';
            $other = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$table} WHERE code=%s", $data['code']));
            if ($other && (int) $other !== (int) $existing['id']) return 'duplicate code';
        }
        if ($existing && $preserve_settings) {
            foreach (array('card_enabled', 'cod_enabled', 'wallet_enabled', 'accept_anywhere', 'pharmacists_json') as $key) $data[$key] = $existing[$key];
        }
        $codes = $existing ? (json_decode((string) ($existing['pharmacist_codes_json'] ?? ''), true) ?: array()) : array();
        $names = json_decode((string) $data['pharmacists_json'], true) ?: array();
        $data['pharmacist_codes_json'] = wp_json_encode(array_filter($codes, static function($name) use ($names) { return in_array($name, $names, true); }));
        if ($existing && !$data['source_post_id']) $data['source_post_id'] = $existing['source_post_id'];
        if ($existing) {
            $same = true;
            foreach ($data as $key => $value) {
                if ($key !== 'updated_at' && (string) ($existing[$key] ?? '') !== (string) ($value ?? '')) { $same = false; break; }
            }
            if ($same) return 'unchanged';
            return $wpdb->update($table, $data, array('id' => (int) $existing['id'])) === false ? 'database error' : 'updated';
        }
        return $wpdb->insert($table, $data) ? 'created' : 'database error';
    }

    private static function add_result(&$report, $result, $label) {
        if (isset($report[$result])) $report[$result]++;
        else { $report['skipped']++; $report['errors'][] = $label . ': ' . $result; }
    }

    public static function import_csv() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_import_branches');
        $file = $_FILES['tsr_csv_file'] ?? null;
        if (!$file || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK ||
            !is_uploaded_file($file['tmp_name'] ?? '') ||
            (int) ($file['size'] ?? 0) < 1 || (int) $file['size'] > self::MAX_CSV_BYTES ||
            strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION)) !== 'csv') {
            wp_die('Upload a CSV file up to 2 MB.', '', array('response' => 422));
        }
        $handle = fopen($file['tmp_name'], 'r');
        if (!$handle) wp_die('Could not read CSV.', '', array('response' => 422));
        $first = fgets($handle, 65536);
        if ($first === false) wp_die('CSV is empty.', '', array('response' => 422));
        $delimiter = substr_count($first, ';') > substr_count($first, ',') ? ';' : ',';
        rewind($handle);
        $headers = fgetcsv($handle, 65536, $delimiter);
        if (!$headers) wp_die('CSV header is missing.', '', array('response' => 422));
        $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);
        $headers = array_map('trim', $headers);
        if (count($headers) !== count(array_unique($headers)) || array_diff(self::headers(), $headers)) {
            wp_die('CSV columns must match the exported template.', '', array('response' => 422));
        }
        $report = self::report();
        $seen = array();
        $line = 1;
        while (($values = fgetcsv($handle, 65536, $delimiter)) !== false) {
            $line++;
            if ($line > self::MAX_ROWS + 1) { $report['errors'][] = 'Stopped after 1,000 rows'; break; }
            if (count($values) === 1 && trim($values[0]) === '') continue;
            if (count($values) !== count($headers)) { self::add_result($report, 'invalid column count', 'Row ' . $line); continue; }
            $row = array_combine($headers, $values);
            $error = '';
            $data = self::validate_row($row, $error);
            if (!$data) { self::add_result($report, $error, 'Row ' . $line); continue; }
            if (isset($seen[$data['code']])) { self::add_result($report, 'duplicate code in file', 'Row ' . $line); continue; }
            $seen[$data['code']] = true;
            self::add_result($report, self::upsert($data), 'Row ' . $line);
        }
        fclose($handle);
        self::finish($report);
    }

    public static function directory_hours($text) {
        $text = trim((string) $text);
        if (preg_match('/(?:24\s*hours|24\s*\/\s*7|open\s*24)/i', $text)) return array(1, '{}');
        preg_match_all('/\b([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-4]):([0-5]\d)\b/u', $text, $matches, PREG_SET_ORDER);
        $slots = array();
        foreach ($matches as $match) {
            $start = $match[1] . ':' . $match[2];
            $end = $match[3] . ':' . $match[4];
            if ($end === '24:00' || TSR_Planner::minutes_since_midnight($end) !== null) $slots[] = array($start, $end);
        }
        if (!$slots) return array(0, '{}');
        $hours = array();
        foreach (range(0, 6) as $day) $hours[(string) $day] = $slots;
        return array(0, wp_json_encode($hours));
    }

    public static function directory_row($post, &$warning) {
        $warning = '';
        $id = (int) $post->ID;
        $code = get_post_meta($id, '_tbh_branch_code', true);
        list($always_open, $hours_json) = self::directory_hours(get_post_meta($id, '_tbh_branch_hours', true));
        $active = get_post_meta($id, '_tbh_branch_is_active', true) !== '0';
        $block = trim((string) get_post_meta($id, '_tbh_branch_block', true));
        if ($active && $block === '') {
            $warning = 'Block number is missing; imported inactive';
            $active = false;
        }
        if ($active && !$always_open && $hours_json === '{}') {
            $warning = 'Opening hours need review; imported inactive';
            $active = false;
        }
        return array('code' => $code, 'name' => $post->post_title,
            'block_number' => $block,
            'lat' => get_post_meta($id, '_tbh_branch_lat', true),
            'lng' => get_post_meta($id, '_tbh_branch_lng', true),
            'enabled' => $active ? '1' : '0', 'always_open' => (string) $always_open,
            'card_enabled' => '0', 'cod_enabled' => '1', 'wallet_enabled' => '1', 'accept_anywhere' => '0',
            'hours_json' => $hours_json, 'pharmacists_json' => '[]',
            'phone' => get_post_meta($id, '_tbh_branch_phone', true),
            'whatsapp' => get_post_meta($id, '_tbh_branch_whatsapp', true),
            'address' => get_post_meta($id, '_tbh_branch_address', true),
            'locality' => get_post_meta($id, '_tbh_branch_locality', true),
            'source_post_id' => (string) $id);
    }

    public static function copy_directory() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_copy_directory');
        if (!post_type_exists('tbh_branch')) wp_die('Our Branches is unavailable.', '', array('response' => 422));
        $report = self::report();
        $posts = get_posts(array('post_type' => 'tbh_branch', 'post_status' => 'publish',
            'numberposts' => self::MAX_ROWS, 'orderby' => 'ID', 'order' => 'ASC'));
        $seen = array();
        foreach ($posts as $post) {
            $warning = '';
            $row = self::directory_row($post, $warning);
            $error = '';
            $data = self::validate_row($row, $error);
            if (!$data) { self::add_result($report, $error, 'Branch #' . $post->ID); continue; }
            if (isset($seen[$data['code']])) { self::add_result($report, 'duplicate code in Our Branches', 'Branch #' . $post->ID); continue; }
            $seen[$data['code']] = true;
            self::add_result($report, self::upsert($data, true), 'Branch #' . $post->ID);
            if ($warning) $report['errors'][] = $post->post_title . ': ' . $warning;
        }
        self::finish($report);
    }
}
