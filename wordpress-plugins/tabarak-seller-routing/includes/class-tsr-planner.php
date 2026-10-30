<?php
defined('ABSPATH') || exit;

/** Pure routing decisions; distance never makes a branch ineligible. */
final class TSR_Planner {
    public static function payment_kind($order) {
        $method = (string) $order->get_payment_method();
        if (in_array($method, array('tabarak_tap', 'propharm_tap'), true)) return 'card';
        if ($method === 'cod') return 'cod';
        if (in_array($method, array('tabarak_twallet', 'propharm_twallet'), true)) return 'wallet';
        return 'unsupported';
    }

    public static function minutes_since_midnight($value) {
        if (!is_string($value) || !preg_match('/^(\d{2}):(\d{2})$/', $value, $parts)) return null;
        $hour = (int) $parts[1]; $minute = (int) $parts[2];
        return ($hour < 24 && $minute < 60) || ($hour === 24 && $minute === 0) ? $hour * 60 + $minute : null;
    }

    public static function is_open($branch, $at = null) {
        if (empty($branch['enabled'])) return false;
        if (!empty($branch['always_open'])) return true;
        $at = $at ?: new DateTimeImmutable('now', new DateTimeZone('Asia/Bahrain'));
        $hours = json_decode((string) ($branch['hours_json'] ?? ''), true);
        if (!is_array($hours)) return false;
        $day = (int) $at->format('w');
        $time = (int) $at->format('G') * 60 + (int) $at->format('i');
        foreach (array($day, ($day + 6) % 7) as $index => $check_day) {
            $slots = $hours[(string) $check_day] ?? array();
            if (!is_array($slots)) continue;
            foreach ($slots as $slot) {
                if (!is_array($slot) || count($slot) !== 2) continue;
                $start = self::minutes_since_midnight($slot[0]);
                $end = self::minutes_since_midnight($slot[1]);
                if ($start === null || $end === null || $start === $end) continue;
                if ($index === 0 && $start < $end && $time >= $start && $time < $end) return true;
                if ($index === 0 && $start > $end && $time >= $start) return true;
                if ($index === 1 && $start > $end && $time < $end) return true;
            }
        }
        return false;
    }

    public static function distance_km($a_lat, $a_lng, $b_lat, $b_lng) {
        if (!is_numeric($a_lat) || !is_numeric($a_lng) || !is_numeric($b_lat) || !is_numeric($b_lng)) return PHP_FLOAT_MAX;
        $lat1 = deg2rad((float) $a_lat); $lat2 = deg2rad((float) $b_lat);
        $dlat = $lat2 - $lat1; $dlng = deg2rad((float) $b_lng - (float) $a_lng);
        $h = sin($dlat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dlng / 2) ** 2;
        return 12742 * asin(min(1, sqrt($h)));
    }

    public static function rank($branches, $payment, $block, $lat, $lng, $at = null) {
        $out = array();
        foreach ($branches as $branch) {
            if (empty($branch['enabled']) || empty($branch[$payment . '_enabled'])) continue;
            $branch['is_open'] = self::is_open($branch, $at);
            $branch['same_block'] = $block !== '' && trim((string) $branch['block_number']) === $block;
            $branch['distance_km'] = self::distance_km($lat, $lng, $branch['lat'], $branch['lng']);
            $out[] = $branch;
        }
        usort($out, static function($a, $b) {
            return (int) $b['is_open'] <=> (int) $a['is_open']
                ?: (int) $b['same_block'] <=> (int) $a['same_block']
                ?: $a['distance_km'] <=> $b['distance_km']
                ?: (int) $a['id'] <=> (int) $b['id'];
        });
        return $out;
    }

    /** Choose the next offer wave without changing any order or branch state. */
    public static function offer_wave($eligible, $current_wave, $previous_ids, $count) {
        if ($current_wave === 0) {
            $same = array_values(array_filter($eligible, static function($branch) { return !empty($branch['same_block']); }));
            if ($same) return array('wave' => 1, 'offers' => $same);
        } elseif ($current_wave !== 1) {
            return array('wave' => $current_wave, 'offers' => array());
        }
        $previous_ids = array_map('intval', $previous_ids);
        $remaining = array_values(array_filter($eligible, static function($branch) use ($previous_ids) {
            return !in_array((int) $branch['id'], $previous_ids, true);
        }));
        $offers = array_slice($remaining, 0, max(1, (int) $count));
        $selected = array_map(static function($branch) { return (int) $branch['id']; }, $offers);
        foreach ($remaining as $branch) {
            if (!empty($branch['accept_anywhere']) && !in_array((int) $branch['id'], $selected, true)) $offers[] = $branch;
        }
        return array('wave' => 2, 'offers' => $offers);
    }

    public static function remaining_offer_seconds($started_at_utc, $duration, $open_count, $now = null) {
        if ($open_count < 1) return 0;
        $started = strtotime($started_at_utc . ' UTC');
        if ($started === false) return 0;
        return max(0, (int) $duration - max(0, (int) ($now ?? time()) - $started));
    }

    /** An open database row stops being actionable when its server-side window ends. */
    public static function offer_is_active($dispatch, $rules, $now = null) {
        if (!is_array($dispatch) || ($dispatch['state'] ?? '') !== 'offered') return false;
        $wave = (int) ($dispatch['wave'] ?? 0);
        if ($wave !== 1 && $wave !== 2) return false;
        $duration = $wave === 1 ? $rules['same_block_seconds'] : $rules['offer_timeout_seconds'];
        return self::remaining_offer_seconds((string) ($dispatch['updated_at'] ?? ''), $duration, 1, $now) > 0;
    }
}
