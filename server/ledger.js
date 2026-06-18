import { db } from './db.js';
import { round3 } from '../scripts/lib.js';

// Ordered by insertion id (= physical stock-book order), so the running balance
// reproduces the official ledger row-for-row even when dates are out of sequence.
const selectRows = db.prepare(
  `SELECT id, qty_received, qty_issued FROM transactions
   WHERE product_id = ? AND voided = 0
   ORDER BY txn_date ASC, id ASC`
);
const updateBalance = db.prepare('UPDATE transactions SET balance_after = ? WHERE id = ?');

/** Recompute and persist running balance for one product's ledger. */
export const recomputeLedger = db.transaction((productId) => {
  let running = 0;
  for (const r of selectRows.all(productId)) {
    running = round3(running + r.qty_received - r.qty_issued);
    updateBalance.run(running, r.id);
  }
  return running;
});

/** Current balance = balance_after of the latest non-voided row. */
export function currentBalance(productId) {
  const row = db
    .prepare(
      `SELECT balance_after FROM transactions
       WHERE product_id = ? AND voided = 0
       ORDER BY txn_date DESC, id DESC LIMIT 1`
    )
    .get(productId);
  return row ? row.balance_after : 0;
}
