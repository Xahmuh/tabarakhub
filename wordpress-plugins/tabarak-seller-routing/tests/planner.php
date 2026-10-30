<?php
define('ABSPATH', __DIR__ . '/');
require_once dirname(__DIR__) . '/includes/class-tsr-planner.php';

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

$at = new DateTimeImmutable('2026-10-07 12:00:00', new DateTimeZone('Asia/Bahrain'));
$base = array('enabled' => 1, 'always_open' => 1, 'card_enabled' => 1,
    'cod_enabled' => 1, 'wallet_enabled' => 1, 'hours_json' => '{}');
$branches = array(
    array_merge($base, array('id' => 1, 'name' => 'Excluded card branch', 'block_number' => '101', 'lat' => 26.20, 'lng' => 50.55, 'card_enabled' => 0)),
    array_merge($base, array('id' => 2, 'name' => 'Nearby Tabarak', 'block_number' => '102', 'lat' => 26.21, 'lng' => 50.56)),
    array_merge($base, array('id' => 3, 'name' => 'Far Tabarak', 'block_number' => '999', 'lat' => 25.60, 'lng' => 50.95)),
);
$card = TSR_Planner::rank($branches, 'card', '101', 26.20, 50.55, $at);
check(count($card) === 2 && (int) $card[0]['id'] === 2, 'Card must skip a nearby ineligible branch');
$cod = TSR_Planner::rank($branches, 'cod', '101', 26.20, 50.55, $at);
check((int) $cod[0]['id'] === 1 && $cod[0]['same_block'], 'Same block takes first priority');
$rules = array('same_block_seconds' => 60, 'offer_timeout_seconds' => 180);
$started = '2026-10-07 12:00:00';
$start = strtotime($started . ' UTC');
check(TSR_Planner::offer_is_active(array('state' => 'offered', 'wave' => 1, 'updated_at' => $started), $rules, $start + 59), 'Same-block offer is active before deadline');
check(!TSR_Planner::offer_is_active(array('state' => 'offered', 'wave' => 1, 'updated_at' => $started), $rules, $start + 60), 'Same-block offer expires exactly at deadline');
check(TSR_Planner::offer_is_active(array('state' => 'offered', 'wave' => 2, 'updated_at' => $started), $rules, $start + 179), 'Nearby offer uses its own deadline');
check(!TSR_Planner::offer_is_active(array('state' => 'claimed', 'wave' => 2, 'updated_at' => $started), $rules, $start + 1), 'Claimed order has no active offer');
$far = TSR_Planner::rank(array($branches[2]), 'cod', '777', 26.20, 50.55, $at);
check(count($far) === 1 && $far[0]['distance_km'] > 50, 'Distance must not disqualify the far fallback');
$night = array_merge($base, array('id' => 4, 'block_number' => '100', 'lat' => 26.2, 'lng' => 50.5,
    'always_open' => 0, 'hours_json' => '{"2":[["21:00","03:00"]]}'));
check(TSR_Planner::is_open($night, new DateTimeImmutable('2026-10-06 22:00:00', new DateTimeZone('Asia/Bahrain'))), 'Overnight shift opens on starting day');
check(TSR_Planner::is_open($night, new DateTimeImmutable('2026-10-07 02:00:00', new DateTimeZone('Asia/Bahrain'))), 'Overnight shift remains open after midnight');
check(!TSR_Planner::is_open($night, $at), 'Overnight shift closes at its end');
$wave_branches = array(
    array('id' => 1, 'same_block' => true, 'accept_anywhere' => 0),
    array('id' => 2, 'same_block' => false, 'accept_anywhere' => 0),
    array('id' => 3, 'same_block' => false, 'accept_anywhere' => 1),
);
$first = TSR_Planner::offer_wave($wave_branches, 0, array(), 1);
check($first['wave'] === 1 && array_column($first['offers'], 'id') === array(1), 'Same-block branch receives the exclusive first wave');
$fallback = TSR_Planner::offer_wave($wave_branches, 1, array(1), 1);
check($fallback['wave'] === 2 && array_column($fallback['offers'], 'id') === array(2, 3), 'Fallback excludes the first wave and includes anywhere branches');
$direct = TSR_Planner::offer_wave(array_slice($wave_branches, 1), 0, array(), 1);
check($direct['wave'] === 2 && array_column($direct['offers'], 'id') === array(2, 3), 'No same-block branch starts the nearby wave');
check(!TSR_Planner::offer_wave($wave_branches, 2, array(), 1)['offers'], 'A completed nearby wave must not reopen offers');
check(TSR_Planner::remaining_offer_seconds('2026-10-14 09:00:00', 180, 1, strtotime('2026-10-14 09:01:00 UTC')) === 120,
    'An open offer keeps its remaining response window');
check(TSR_Planner::remaining_offer_seconds('2026-10-14 09:00:00', 180, 1, strtotime('2026-10-14 09:04:00 UTC')) === 0,
    'An expired offer moves to the next state');
check(TSR_Planner::remaining_offer_seconds('2026-10-14 09:00:00', 180, 0, strtotime('2026-10-14 09:01:00 UTC')) === 0,
    'All rejections advance the order without waiting for the timer');
echo "Planner checks passed.\n";
