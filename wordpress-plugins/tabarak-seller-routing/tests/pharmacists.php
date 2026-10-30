<?php
define('ABSPATH', __DIR__ . '/');
function sanitize_text_field($value) { return trim($value); }
class WP_Error {
    public function __construct(public $code, public $message) {}
}
require_once dirname(__DIR__) . '/includes/class-tsr-pharmacists.php';

$path = tempnam(sys_get_temp_dir(), 'tsr-ph-');
try {
    file_put_contents($path, "\xEF\xBB\xBFcode,name\nE001,Dr. Example One\nE002,Dr. Example Two\n");
    $rows = TSR_Pharmacists::parse_csv($path);
    if ($rows instanceof WP_Error || $rows !== array('E001' => 'Dr. Example One', 'E002' => 'Dr. Example Two')) throw new RuntimeException('Valid directory CSV was not parsed.');
    file_put_contents($path, "code,name\nE001,Dr. Example One\nE001,Dr. Duplicate\n");
    if (!(TSR_Pharmacists::parse_csv($path) instanceof WP_Error)) throw new RuntimeException('Duplicate pharmacist code was accepted.');
    $branches = array(array('code' => 'T001', 'enabled' => 1), array('code' => 'H001', 'enabled' => 1));
    $directory = array('E001' => 'Dr. Example One', 'E002' => 'Dr. Example Two');
    file_put_contents($path, "branch_code,pharmacist_code\nT001,E001\nH001,E002\n");
    $links = TSR_Pharmacists::parse_assignments($path, $directory, $branches);
    if ($links instanceof WP_Error || $links['T001']['E001'] !== 'Dr. Example One' || $links['H001']['E002'] !== 'Dr. Example Two') throw new RuntimeException('Valid branch links were not parsed.');
    file_put_contents($path, "branch_code,pharmacist_code\nT001,E001\n");
    if (!(TSR_Pharmacists::parse_assignments($path, $directory, $branches) instanceof WP_Error)) throw new RuntimeException('Missing branch roster was accepted.');
    file_put_contents($path, "branch_code,pharmacist_code\nT001,E001\nH001,E999\n");
    if (!(TSR_Pharmacists::parse_assignments($path, $directory, $branches) instanceof WP_Error)) throw new RuntimeException('Unknown pharmacist code was accepted.');
    echo "Pharmacist directory checks passed.\n";
} finally {
    unlink($path);
}
