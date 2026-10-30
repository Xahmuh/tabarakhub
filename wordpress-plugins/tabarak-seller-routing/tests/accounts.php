<?php
define('ABSPATH', __DIR__);
final class Tabarak_Seller_Routing { const BRANCH_META = '_tabarak_seller_branch_id'; }
$users = array();
$links = array();
function sanitize_user($name, $strict = false) { return preg_replace('/[^A-Za-z0-9_-]/', '', $name); }
function get_user_by($field, $login) {
    global $users;
    foreach ($users as $user) if (strcasecmp($user->user_login, $login) === 0) return $user;
    return false;
}
function get_users($args) {
    global $users, $links;
    $found = array();
    foreach ($users as $user) if (($links[$user->ID] ?? 0) === (int) $args['meta_value']) $found[] = $user;
    return $found;
}
function get_user_meta($id, $key, $single) { global $links; return $links[$id] ?? 0; }
function get_userdata($id) { global $users; return $users[$id] ?? false; }
function wp_generate_password($length, $special, $extra) { return str_repeat('Ab7', 10); }
function wp_insert_user($data) {
    global $users, $links, $inserted;
    $inserted[] = $data;
    $id = count($users) + 100;
    $users[$id] = (object) array('ID' => $id, 'user_login' => $data['user_login'], 'roles' => array($data['role']));
    $links[$id] = $data['meta_input'][Tabarak_Seller_Routing::BRANCH_META];
    return $id;
}
function is_wp_error($value) { return false; }
function update_user_meta($id, $key, $value) { global $links; $links[$id] = $value; return true; }
function check($ok, $message) { if (!$ok) throw new RuntimeException($message); }
function branch($id, $code) { return array('id' => $id, 'code' => $code, 'name' => $code); }
require dirname(__DIR__) . '/includes/class-tsr-accounts.php';

$branches = array(branch(1, 't001'), branch(2, 'h003'));
$rows = TSR_Accounts::inspect($branches);
check(array_column($rows, 'username') === array('T001', 'H003'), 'Official codes must be usernames');
check(array_column($rows, 'state') === array('ready', 'ready'), 'Fresh accounts should be ready');
check(TSR_Accounts::inspect(array(branch(9, 'd001')))[0]['state'] === 'invalid_or_duplicate_code', 'Retired District code must not be provisioned');

$users[11] = (object) array('ID' => 11, 'user_login' => 'T001', 'roles' => array('tabarak_seller'));
$links[11] = 1;
check(TSR_Accounts::inspect($branches)[0]['state'] === 'linked', 'Matching linked seller should be preserved');
check(TSR_Accounts::allow_password_reset(true, 11) === false, 'Seller self-service reset must be blocked');
check(TSR_Accounts::allow_password_reset(true, 999) === true, 'Other users must keep normal reset behavior');

$links[11] = 2;
check(TSR_Accounts::inspect($branches)[0]['state'] === 'username_in_use', 'Wrong branch link must block creation');
$links[11] = 0;
$users[11]->roles = array('customer');
check(TSR_Accounts::inspect($branches)[0]['state'] === 'username_in_use', 'Customer login must not be converted');
$users[11]->roles = array('tabarak_seller');
check(TSR_Accounts::inspect($branches)[0]['state'] === 'link_existing', 'Unlinked seller can be linked');

$users[12] = (object) array('ID' => 12, 'user_login' => 'OTHER', 'roles' => array('tabarak_seller'));
$links[12] = 1;
check(TSR_Accounts::inspect($branches)[0]['state'] === 'branch_already_has_another_login', 'Existing branch login must not be replaced');
check(TSR_Accounts::inspect(array(branch(1, 't001'), branch(3, 'T001')))[1]['state'] === 'invalid_or_duplicate_code', 'Duplicate codes must block bulk creation');

$users = array(); $links = array(); $inserted = array();
$initial = TSR_Accounts::inspect($branches);
$created = TSR_Accounts::create_accounts($initial);
check(count($created) === 2 && $created[0][2] === 'T001' && $created[1][2] === 'H003', 'Both branch codes must be created');
check(strlen($created[0][3]) >= 28 && $created[0][4] === 'created', 'Initial password must be returned once');
check($inserted[0]['user_email'] === '' && $inserted[0]['role'] === 'tabarak_seller', 'No email and no elevated role');
check($links[100] === 1 && $links[101] === 2, 'Each user must be scoped to its own branch');
$again = TSR_Accounts::create_accounts(TSR_Accounts::inspect($branches));
check(count($inserted) === 2 && $again[0][3] === '' && $again[1][3] === '', 'Repeating must not recreate or rotate accounts');
echo "Account preflight checks passed.\n";
