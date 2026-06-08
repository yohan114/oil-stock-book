import { Router } from 'express';
import { db } from '../db.js';
import { recomputeLedger, currentBalance } from '../ledger.js';
import { h, TXN_SELECT, decorate, classifyText, round3 } from '../util.js';

const router = Router();

router.get('/', h((req, res) => {
  const { productId, kind, consumerType, assetId, projectId, from, to, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const offset = Number(req.query.offset) || 0;
  const where = ['t.voided = 0'];
  const args = {};
  if (productId)   { where.push('t.product_id = @productId'); args.productId = productId; }
  if (kind)        { where.push('t.kind = @kind'); args.kind = kind; }
  if (consumerType){ where.push('t.consumer_type = @consumerType'); args.consumerType = consumerType; }
  if (assetId)     { where.push('t.asset_id = @assetId'); args.assetId = assetId; }
  if (projectId)   { where.push('t.project_id = @projectId'); args.projectId = projectId; }
  if (from)        { where.push('t.txn_date >= @from'); args.from = from; }
  if (to)          { where.push('t.txn_date <= @to'); args.to = to; }
  if (q)           { where.push('(t.description LIKE @q OR t.mr_no LIKE @q OR t.mtn_no LIKE @q)'); args.q = `%${q}%`; }
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n FROM transactions t WHERE ${w}`).get(args).n;
  const rows = db.prepare(
    `${TXN_SELECT} WHERE ${w} ORDER BY t.id DESC LIMIT @limit OFFSET @offset`
  ).all({ ...args, limit, offset });
  res.json({ total, rows: rows.map(decorate) });
}));

const getOne = (id) => decorate(db.prepare(`${TXN_SELECT} WHERE t.id=?`).get(id));

router.post('/', h((req, res) => {
  const b = req.body;
  if (!b.product_id || !b.txn_date || !b.kind) {
    return res.status(400).json({ error: 'product_id, txn_date and kind are required' });
  }
  const qty = round3(Number(b.qty) || 0);
  let { consumer_type = null, asset_id = null, project_id = null } = b;

  if (b.kind === 'issue' && !asset_id && !project_id && consumer_type == null && b.description) {
    const c = classifyText(b.description);
    consumer_type = c.consumer_type; asset_id = c.asset_id; project_id = c.project_id;
  }
  if (asset_id) consumer_type = 'asset';
  else if (project_id) consumer_type = 'project';

  const info = db.prepare(`
    INSERT INTO transactions
      (product_id, txn_date, kind, qty_received, qty_issued, balance_after,
       consumer_type, asset_id, project_id, description, mr_no, mtn_no, remark, source)
    VALUES (@product_id,@txn_date,@kind,@qty_received,@qty_issued,0,
            @consumer_type,@asset_id,@project_id,@description,@mr_no,@mtn_no,@remark,'manual')`).run({
    product_id: b.product_id, txn_date: b.txn_date, kind: b.kind,
    qty_received: b.kind === 'receipt' || b.kind === 'opening' ? qty : 0,
    qty_issued: b.kind === 'issue' ? qty : 0,
    consumer_type: b.kind === 'issue' ? consumer_type : null,
    asset_id, project_id,
    description: b.description || null, mr_no: b.mr_no || null, mtn_no: b.mtn_no || null,
    remark: b.remark || null,
  });
  recomputeLedger(b.product_id);
  res.status(201).json({ transaction: getOne(info.lastInsertRowid), balance: round3(currentBalance(b.product_id)) });
}));

router.patch('/:id', h((req, res) => {
  const cur = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Transaction not found' });
  const b = req.body;
  const next = {
    txn_date: b.txn_date ?? cur.txn_date,
    qty_received: b.qty_received != null ? round3(b.qty_received) : cur.qty_received,
    qty_issued: b.qty_issued != null ? round3(b.qty_issued) : cur.qty_issued,
    asset_id: 'asset_id' in b ? b.asset_id : cur.asset_id,
    project_id: 'project_id' in b ? b.project_id : cur.project_id,
    consumer_type: 'consumer_type' in b ? b.consumer_type : cur.consumer_type,
    description: 'description' in b ? b.description : cur.description,
    mr_no: 'mr_no' in b ? b.mr_no : cur.mr_no,
    mtn_no: 'mtn_no' in b ? b.mtn_no : cur.mtn_no,
    remark: 'remark' in b ? b.remark : cur.remark,
  };
  if (next.asset_id) next.consumer_type = 'asset';
  else if (next.project_id) next.consumer_type = 'project';
  db.prepare(`UPDATE transactions SET txn_date=@txn_date, qty_received=@qty_received, qty_issued=@qty_issued,
      asset_id=@asset_id, project_id=@project_id, consumer_type=@consumer_type, description=@description,
      mr_no=@mr_no, mtn_no=@mtn_no, remark=@remark, updated_at=datetime('now') WHERE id=@id`)
    .run({ ...next, id: cur.id });
  recomputeLedger(cur.product_id);
  res.json({ transaction: getOne(cur.id), balance: round3(currentBalance(cur.product_id)) });
}));

router.post('/:id/void', h((req, res) => {
  const cur = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Transaction not found' });
  db.prepare(`UPDATE transactions SET voided=1, updated_at=datetime('now') WHERE id=?`).run(cur.id);
  recomputeLedger(cur.product_id);
  res.json({ ok: true, balance: round3(currentBalance(cur.product_id)) });
}));

export default router;
