import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalances, getTransactions } from './settle.ts';
import type { Member, Expense } from '@/lib/types';

const mk = (nickname: string): Member =>
  ({ id: nickname, real_name: nickname, nickname, pin: '0000', created_at: '' });

const exp = (e: Partial<Expense>): Expense => ({
  id: Math.random().toString(36).slice(2),
  trip_id: 't',
  item_name: 'x',
  amount: 0,
  payer: 'A',
  participants: ['A'],
  split_type: 'equal',
  is_transfer: false,
  created_at: '',
  ...e,
});

test('均分：A 代墊 300，三人均分 → B、C 各欠 A 100', () => {
  const members = [mk('A'), mk('B'), mk('C')];
  const expenses = [exp({ payer: 'A', amount: 300, participants: ['A', 'B', 'C'], split_type: 'equal' })];
  const b = computeBalances(members, expenses);
  assert.equal(Math.round(b['A']), 200);
  assert.equal(Math.round(b['B']), -100);
  assert.equal(Math.round(b['C']), -100);

  const tx = getTransactions(b);
  assert.equal(tx.length, 2);
  const total = tx.reduce((s, t) => s + t.amt, 0);
  assert.equal(Math.round(total), 200);
  assert.ok(tx.every((t) => t.to === 'A'));
});

test('自訂分攤：A 代墊 300，B 應付 200、C 應付 100', () => {
  const members = [mk('A'), mk('B'), mk('C')];
  const expenses = [exp({ payer: 'A', amount: 300, participants: ['B', 'C'], split_type: 'custom', split_details: { B: 200, C: 100 } })];
  const b = computeBalances(members, expenses);
  assert.equal(Math.round(b['A']), 300);
  assert.equal(Math.round(b['B']), -200);
  assert.equal(Math.round(b['C']), -100);
});

test('已結清：互相抵銷後無需任何交易', () => {
  const members = [mk('A'), mk('B')];
  const expenses = [
    exp({ payer: 'A', amount: 100, participants: ['A', 'B'], split_type: 'equal' }),
    exp({ payer: 'B', amount: 100, participants: ['A', 'B'], split_type: 'equal' }),
  ];
  const b = computeBalances(members, expenses);
  assert.equal(Math.round(b['A']), 0);
  assert.equal(Math.round(b['B']), 0);
  assert.equal(getTransactions(b).length, 0);
});

test('清帳(is_transfer)後餘額歸零', () => {
  const members = [mk('A'), mk('B')];
  const expenses = [
    exp({ payer: 'A', amount: 200, participants: ['A', 'B'], split_type: 'equal' }), // B 欠 A 100
    exp({ payer: 'B', amount: 100, participants: ['A'], split_type: 'equal', is_transfer: true }), // B 還 A 100
  ];
  const b = computeBalances(members, expenses);
  assert.equal(Math.round(b['A']), 0);
  assert.equal(Math.round(b['B']), 0);
  assert.equal(getTransactions(b).length, 0);
});
