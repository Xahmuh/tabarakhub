<?php
define('ABSPATH', __DIR__ . '/');
require_once dirname(__DIR__) . '/includes/class-tsr-order-edit-money.php';

function check_settlement($old, $new, $paid, $credit, $due) {
    $actual = TSR_Order_Edit_Money::settlement($old, $new, $paid);
    if ($actual['wallet_credit_fils'] !== $credit || $actual['amount_due_fils'] !== $due) {
        throw new RuntimeException("Wrong settlement for {$old}/{$new}/{$paid}");
    }
}

check_settlement(10000, 7000, 10000, 3000, 0); // Fully prepaid, partially dispatched.
check_settlement(10000, 7000, 4000, 0, 3000);  // Partially prepaid, reduce amount due.
check_settlement(10000, 7000, 0, 0, 7000);     // COD, never create free wallet credit.
check_settlement(10000, 12000, 10000, 0, 2000); // Added item, collect the difference.
check_settlement(10000, 12000, 0, 0, 12000);   // COD increase.
check_settlement(10000, 4000, 6000, 2000, 0); // Partial payment becomes overpaid.
check_settlement(7000, 9000, 7000, 0, 2000); // Earlier wallet credit cannot be used again after another increase.
check_settlement(7000, 5000, 7000, 2000, 0); // A later reduction credits only the new difference.
try {
    TSR_Order_Edit_Money::settlement(10000, 7000, 12000);
    throw new RuntimeException('Overpaid starting state was accepted.');
} catch (InvalidArgumentException $expected) {
    // Current paid amount must be reconciled before another edit.
}
echo "Order edit settlement checks passed.\n";
