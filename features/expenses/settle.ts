import type { Member, Expense } from '@/lib/types';

// 計算每人餘額：正值=別人欠他，負值=他欠別人。純函式，方便單元測試。
export function computeBalances(members: Member[], expenses: Expense[]): Record<string, number> {
  const balances: Record<string, number> = {};
  members.forEach((m) => { balances[m.nickname] = 0; });

  expenses.forEach((exp) => {
    const amt = typeof exp.amount === 'number' ? exp.amount : parseFloat(String(exp.amount));
    if (balances[exp.payer] !== undefined) balances[exp.payer] += amt;

    if (exp.split_type === 'custom' && exp.split_details) {
      Object.entries(exp.split_details).forEach(([person, personAmt]) => {
        if (balances[person] !== undefined) {
          balances[person] -= (typeof personAmt === 'number' ? personAmt : parseFloat(String(personAmt)));
        }
      });
    } else {
      const perPerson = amt / exp.participants.length;
      exp.participants.forEach((p) => {
        if (balances[p] !== undefined) balances[p] -= perPerson;
      });
    }
  });

  return balances;
}

export interface SettleTransaction { from: string; to: string; amt: number; }

// 最佳結清路徑（貪婪：最大債務人對最大債權人），最小化交易次數。
export function getTransactions(balances: Record<string, number>): SettleTransaction[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < -1).map(([n, v]) => ({ n, v: Math.abs(v) }));
  const creditors = Object.entries(balances).filter(([, v]) => v > 1).map(([n, v]) => ({ n, v }));
  const tx: SettleTransaction[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    tx.push({ from: debtors[i].n, to: creditors[j].n, amt });
    debtors[i].v -= amt; creditors[j].v -= amt;
    if (debtors[i].v < 1) i++;
    if (creditors[j].v < 1) j++;
  }
  return tx;
}
