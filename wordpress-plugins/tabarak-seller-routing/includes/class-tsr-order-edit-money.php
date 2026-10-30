<?php
defined('ABSPATH') || exit;

/** Integer-fils settlement for changes to an already accepted order. */
final class TSR_Order_Edit_Money {
    public static function settlement($old_total_fils, $new_total_fils, $paid_fils) {
        $old = (int) $old_total_fils;
        $new = (int) $new_total_fils;
        $paid = (int) $paid_fils;
        if ($old < 0 || $new < 0 || $paid < 0 || $paid > $old) {
            throw new InvalidArgumentException('Invalid order settlement amounts.');
        }
        // $paid is the money still held for this order after earlier wallet credits.
        // A reduction in an unpaid order only lowers the amount to collect.
        $wallet_credit = max(0, $paid - $new);
        $paid_after_credit = $paid - $wallet_credit;
        return array(
            'old_total_fils' => $old,
            'new_total_fils' => $new,
            'paid_fils' => $paid,
            'wallet_credit_fils' => $wallet_credit,
            'paid_after_credit_fils' => $paid_after_credit,
            'amount_due_fils' => max(0, $new - $paid_after_credit),
        );
    }
}
