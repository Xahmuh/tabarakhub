<?php
defined('ABSPATH') || exit;

/** Internal pharmacist directory. Codes are never sent through customer order APIs. */
final class TSR_Pharmacists {
    const OPTION = 'tabarak_seller_pharmacist_directory';

    public static function directory() {
        $rows = get_option(self::OPTION, array());
        return is_array($rows) ? $rows : array();
    }

    public static function render() {
        if (!current_user_can('manage_woocommerce')) return;
        $rows = self::directory();
        echo '<hr><h2>Hub pharmacist directory</h2>';
        echo '<p>' . count($rows) . ' active pharmacist names and internal codes imported. Assignments to branches are managed separately; importing this directory does not enable automatic dispatch.</p>';
        if (isset($_GET['pharmacists_imported'])) echo '<div class="notice notice-success"><p>Pharmacist directory imported: ' . absint($_GET['pharmacists_imported']) . ' records.</p></div>';
        echo '<form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('tsr_import_pharmacists');
        echo '<input type="hidden" name="action" value="tsr_import_pharmacists">';
        echo '<p><label>CSV from Tabarak Hub: code,name (active pharmacists only) <input type="file" name="pharmacists_csv" accept=".csv,text/csv" required></label> ';
        submit_button('Import pharmacist directory', 'secondary', 'submit', false);
        echo '</p></form>';
        if (isset($_GET['assignments_imported'])) echo '<div class="notice notice-success"><p>Hub pharmacist assignments imported for ' . absint($_GET['assignments_imported']) . ' branches.</p></div>';
        echo '<form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('tsr_import_pharmacist_assignments');
        echo '<input type="hidden" name="action" value="tsr_import_pharmacist_assignments">';
        echo '<p><label>Hub branch links CSV: branch_code,pharmacist_code <input type="file" name="assignments_csv" accept=".csv,text/csv" required></label> ';
        submit_button('Import branch pharmacist links', 'secondary', 'submit', false);
        echo '</p><p class="description">Replaces the pharmacist roster for every enabled routing branch. The CSV must include all enabled branches and every code must exist in the imported directory.</p></form>';
        if (!$rows) return;
        echo '<details><summary>View internal pharmacist directory</summary><table class="widefat striped"><thead><tr><th>Code</th><th>Name</th></tr></thead><tbody>';
        foreach ($rows as $code => $name) echo '<tr><td>' . esc_html($code) . '</td><td>' . esc_html($name) . '</td></tr>';
        echo '</tbody></table></details>';
    }

    public static function parse_csv($path) {
        $handle = fopen($path, 'rb');
        if (!$handle) return new WP_Error('read_failed', 'Could not read pharmacist CSV.');
        $header = fgetcsv($handle);
        if (!is_array($header)) { fclose($handle); return new WP_Error('empty_csv', 'Pharmacist CSV is empty.'); }
        $header = array_map(static function($value) { return strtolower(trim((string) $value, " \t\r\n\xEF\xBB\xBF")); }, $header);
        $code_col = array_search('code', $header, true); $name_col = array_search('name', $header, true);
        if ($code_col === false || $name_col === false) { fclose($handle); return new WP_Error('bad_header', 'CSV needs code and name columns.'); }
        $rows = array(); $line = 1;
        while (($cells = fgetcsv($handle)) !== false) {
            $line++;
            if (count($cells) === 1 && trim((string) $cells[0]) === '') continue;
            $code = strtoupper(trim((string) ($cells[$code_col] ?? '')));
            $name = trim((string) ($cells[$name_col] ?? ''));
            if (!preg_match('/^[A-Z0-9_-]{1,32}$/', $code) || $name === '' || strlen($name) > 150 || isset($rows[$code])) {
                fclose($handle); return new WP_Error('invalid_row', 'Invalid or duplicate pharmacist at CSV line ' . $line . '.');
            }
            $rows[$code] = sanitize_text_field($name);
            if (count($rows) > 500) { fclose($handle); return new WP_Error('too_many_rows', 'CSV exceeds 500 pharmacists.'); }
        }
        fclose($handle);
        if (!$rows) return new WP_Error('empty_csv', 'Pharmacist CSV has no records.');
        ksort($rows, SORT_NATURAL);
        return $rows;
    }

    public static function import_csv() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_import_pharmacists');
        $file = $_FILES['pharmacists_csv'] ?? null;
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($file['size'] ?? 0) > 1024 * 1024) wp_die('Upload a CSV smaller than 1 MB.', '', array('response' => 422));
        if (!is_uploaded_file($file['tmp_name'])) wp_die('Invalid uploaded file.', '', array('response' => 422));
        $rows = self::parse_csv($file['tmp_name']);
        if (is_wp_error($rows)) wp_die(esc_html($rows->get_error_message()), '', array('response' => 422));
        update_option(self::OPTION, $rows, false);
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&pharmacists_imported=' . count($rows)));
        exit;
    }

    public static function parse_assignments($path, $directory, $branches) {
        $handle = fopen($path, 'rb');
        if (!$handle) return new WP_Error('read_failed', 'Could not read branch link CSV.');
        $header = fgetcsv($handle);
        if (!is_array($header)) { fclose($handle); return new WP_Error('empty_csv', 'Branch link CSV is empty.'); }
        $header = array_map(static function($value) { return strtolower(trim((string) $value, " \t\r\n\xEF\xBB\xBF")); }, $header);
        $branch_col = array_search('branch_code', $header, true);
        $code_col = array_search('pharmacist_code', $header, true);
        if ($branch_col === false || $code_col === false) { fclose($handle); return new WP_Error('bad_header', 'CSV needs branch_code and pharmacist_code columns.'); }
        $allowed = array();
        foreach ($branches as $branch) if (!empty($branch['enabled'])) $allowed[strtoupper((string) $branch['code'])] = $branch;
        if (!$allowed) { fclose($handle); return new WP_Error('no_branches', 'No enabled routing branches.'); }
        $rows = array_fill_keys(array_keys($allowed), array()); $line = 1;
        while (($cells = fgetcsv($handle)) !== false) {
            $line++;
            if (count($cells) === 1 && trim((string) $cells[0]) === '') continue;
            $branch = strtoupper(trim((string) ($cells[$branch_col] ?? '')));
            $code = strtoupper(trim((string) ($cells[$code_col] ?? '')));
            if (!isset($allowed[$branch]) || !isset($directory[$code]) || isset($rows[$branch][$code])) {
                fclose($handle); return new WP_Error('invalid_link', 'Unknown or duplicate branch/pharmacist link at CSV line ' . $line . '.');
            }
            $rows[$branch][$code] = $directory[$code];
            if ($line > 10000) { fclose($handle); return new WP_Error('too_many_links', 'Branch link CSV exceeds 10,000 rows.'); }
        }
        fclose($handle);
        foreach ($rows as $branch => $pharmacists) if (!$pharmacists) return new WP_Error('missing_branch', 'No pharmacist links for branch ' . $branch . '.');
        return $rows;
    }

    public static function import_assignments() {
        if (!current_user_can('manage_woocommerce')) wp_die('Forbidden', '', array('response' => 403));
        check_admin_referer('tsr_import_pharmacist_assignments');
        $file = $_FILES['assignments_csv'] ?? null;
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($file['size'] ?? 0) > 1024 * 1024) wp_die('Upload a CSV smaller than 1 MB.', '', array('response' => 422));
        if (!is_uploaded_file($file['tmp_name'])) wp_die('Invalid uploaded file.', '', array('response' => 422));
        $directory = self::directory();
        if (!$directory) wp_die('Import the pharmacist directory first.', '', array('response' => 422));
        $branches = Tabarak_Seller_Routing::branch_rows();
        $rosters = self::parse_assignments($file['tmp_name'], $directory, $branches);
        if (is_wp_error($rosters)) wp_die(esc_html($rosters->get_error_message()), '', array('response' => 422));
        global $wpdb;
        $wpdb->query('START TRANSACTION');
        foreach ($branches as $branch) {
            $code = strtoupper((string) $branch['code']);
            if (!isset($rosters[$code])) continue;
            $codes = $rosters[$code];
            $names = array_values(array_unique(array_values($codes)));
            $saved = $wpdb->update(Tabarak_Seller_Routing::table('branches'), array(
                'pharmacists_json' => wp_json_encode($names),
                'pharmacist_codes_json' => wp_json_encode($codes),
                'updated_at' => current_time('mysql', true)), array('id' => (int) $branch['id']));
            if ($saved === false) {
                $wpdb->query('ROLLBACK');
                wp_die('Could not save pharmacist links for branch ' . esc_html($code) . '.', '', array('response' => 500));
            }
        }
        $wpdb->query('COMMIT');
        wp_safe_redirect(admin_url('admin.php?page=tabarak-seller-routing&assignments_imported=' . count($rosters)));
        exit;
    }
}
