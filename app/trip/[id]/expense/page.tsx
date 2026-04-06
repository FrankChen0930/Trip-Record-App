'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { ExpenseSkeleton } from '@/components/Skeleton';
import type { Trip, Member, Expense } from '@/lib/types';
import { Menu, DollarSign, Trash2, Edit2, Copy, Receipt } from 'lucide-react';

export default function TripExpensePage() {
  const { id: tripId } = useParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tripInfo, setTripInfo] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // 表單狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [splitDetails, setSplitDetails] = useState<Record<string, string>>({});
  const [selectedLedgerMember, setSelectedLedgerMember] = useState<string>('');

  const fetchData = async () => {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    const { data: exp } = await supabase.from('trip_expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    const { data: mem } = await supabase.from('trip_members').select('*');

    setTripInfo(trip);
    setExpenses(exp || []);
    setMembers(mem || []);

    if (mem && mem.length > 0) {
      if (!payer) setPayer(mem[0].nickname);
      if (selectedFriends.length === 0) setSelectedFriends(mem.map(m => m.nickname));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    const channel = supabase
      .channel(`exp-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [tripId]);

  const handleEditClick = (exp: Expense) => {
    setEditingId(exp.id);
    setItem(exp.item_name);
    setAmount(exp.amount.toString());
    setPayer(exp.payer);
    setSelectedFriends(exp.participants);
    setSplitType(exp.split_type || 'equal');
    
    const parsedDetails: Record<string, string> = {};
    if (exp.split_details) {
      Object.entries(exp.split_details).forEach(([key, val]) => {
        parsedDetails[key] = String(val);
      });
    }
    setSplitDetails(parsedDetails);
    setFormOpen(true);
  };

  const handleCopyClick = (exp: Expense) => {
    setEditingId(null);
    setItem(exp.item_name);
    setAmount(exp.amount.toString());
    setPayer(exp.payer);
    setSelectedFriends(exp.participants);
    setSplitType(exp.split_type || 'equal');
    
    const parsedDetails: Record<string, string> = {};
    if (exp.split_details) {
      Object.entries(exp.split_details).forEach(([key, val]) => {
        parsedDetails[key] = String(val);
      });
    }
    setSplitDetails(parsedDetails);
    setFormOpen(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !amount || selectedFriends.length === 0) { toast('請填寫完整資訊', 'warning'); return; }

    const numAmount = parseFloat(amount);
    
    let finalSplitDetails: Record<string, number> = {};
    if (splitType === 'custom') {
      let customSum = 0;
      for (const friend of selectedFriends) {
        const friendAmt = parseFloat(splitDetails[friend] || '0');
        finalSplitDetails[friend] = friendAmt;
        customSum += friendAmt;
      }
      if (Math.abs(customSum - numAmount) > 1) {
        toast(`自訂加總 (${customSum.toFixed(1)}) 不等於總額 (${numAmount})`, 'warning'); 
        return;
      }
    }

    const payload = {
      item_name: item,
      amount: numAmount,
      payer,
      participants: selectedFriends,
      split_type: splitType,
      split_details: splitType === 'custom' ? finalSplitDetails : null,
      trip_id: tripId
    };

    try {
      if (editingId) {
        await supabase.from('trip_expenses').update(payload).eq('id', editingId);
        toast('支出已更新', 'success');
      } else {
        await supabase.from('trip_expenses').insert([payload]);
        toast('支出已記錄', 'success');
      }
      setItem(''); setAmount(''); setFormOpen(false); setEditingId(null); setSplitDetails({});
      fetchData();
    } catch (error: any) {
      toast('儲存失敗：' + error.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: '確定要刪除這筆支出嗎？', confirmText: '刪除', danger: true });
    if (!ok) return;
    await supabase.from('trip_expenses').delete().eq('id', id);
    toast('支出已刪除', 'info');
    fetchData();
  };

  const handleSettleDebt = async (debtor: string, creditor: string, amount: number) => {
    const ok = await confirm({ message: `確定記錄 ${debtor} 償還 ${creditor} $${amount.toFixed(0)} 嗎？`, confirmText: '確清帳', danger: false });
    if (!ok) return;

    try {
      await supabase.from('trip_expenses').insert([{
        item_name: '✔️ 結清款項',
        amount: amount,
        payer: debtor,
        participants: [creditor],
        split_type: 'equal',
        is_transfer: true,
        trip_id: tripId
      }]);
      toast('清帳紀錄已新增', 'success');
      fetchData();
    } catch (e: any) {
      toast('清帳失敗：' + e.message, 'error');
    }
  };

  // 計算 Balance
  const balances: Record<string, number> = {};
  members.forEach(m => balances[m.nickname] = 0);
  expenses.forEach(exp => {
    const amt = typeof exp.amount === 'number' ? exp.amount : parseFloat(String(exp.amount));
    if (balances[exp.payer] !== undefined) balances[exp.payer] += amt;
    
    if (exp.split_type === 'custom' && exp.split_details) {
      Object.entries(exp.split_details).forEach(([person, personAmt]) => {
         if (balances[person] !== undefined) balances[person] -= (typeof personAmt === 'number' ? personAmt : parseFloat(String(personAmt)));
      });
    } else {
      const perPerson = amt / exp.participants.length;
      exp.participants.forEach((p: string) => {
        if (balances[p] !== undefined) balances[p] -= perPerson;
      });
    }
  });

  const getTransactions = () => {
    const debtors = Object.entries(balances).filter(([_, v]) => v < -1).map(([n, v]) => ({ n, v: Math.abs(v) }));
    const creditors = Object.entries(balances).filter(([_, v]) => v > 1).map(([n, v]) => ({ n, v }));
    const tx = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amt = Math.min(debtors[i].v, creditors[j].v);
      tx.push({ from: debtors[i].n, to: creditors[j].n, amt });
      debtors[i].v -= amt; creditors[j].v -= amt;
      if (debtors[i].v < 1) i++; if (creditors[j].v < 1) j++;
    }
    return tx;
  };

  const transactions = getTransactions();
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.is_transfer ? 0 : (typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount)))), 0);

  // 支出分類 (簡單圓餅圖)
  const categoryMap = useMemo(() => {
    const cat: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.is_transfer) return;
      const key = e.payer;
      cat[key] = (cat[key] || 0) + (typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount)));
    });
    return cat;
  }, [expenses]);

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // 視覺參數
  const headerHeight = 280;
  const opacity = Math.max(0, 1 - scrollY / headerHeight);

  return (
    <div className="bg-gray-50 min-h-screen text-black relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="expense" />

      {/* 沉浸式封面背景 */}
      <div className="fixed top-0 left-0 w-full z-0 h-[280px] overflow-hidden bg-gray-900">
        <img
          src={tripInfo?.cover_url || "https://images.unsplash.com/photo-1554224155-6726b3ff858f"}
          className="w-full h-full object-cover"
          style={{ opacity, transform: `scale(${1 + scrollY * 0.001})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-black/50" />
        <div className="absolute bottom-16 left-6 text-white" style={{ opacity }}>
          <h1 className="text-3xl font-black drop-shadow-lg tracking-tight">{tripInfo?.name}</h1>
          <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mt-1">Settlement Archive / 帳目檔案</p>
        </div>
      </div>

      {/* 頂部導航 */}
      <div className={`p-4 flex items-center sticky top-0 z-50 transition-all duration-300 ${scrollY > 100 ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`}>
        <button onClick={() => setSidebarOpen(true)} className={`p-2.5 rounded-xl transition-all ${scrollY > 100 ? 'text-black hover:bg-gray-100' : 'text-white glass-dark'}`}>
          <Menu className="h-5 w-5" />
        </button>
        <h1 className={`ml-4 font-bold text-sm transition-all ${scrollY > 100 ? 'opacity-100 text-emerald-600' : 'opacity-0'}`}>
          {tripInfo?.name} - 支出結算
        </h1>
      </div>

      {/* 內容區塊 */}
      <div className="relative z-10" style={{ marginTop: `${headerHeight - 40}px` }}>
        <div className="bg-gray-50 rounded-t-[3rem] p-6 min-h-screen">

          {/* 總額統計卡片 */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-[2rem] shadow-lg mb-6 text-white">
            <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">Total Expenses</p>
            <p className="text-4xl font-black font-mono">${totalExpenses.toFixed(0)}</p>
            <p className="text-[10px] text-emerald-200 mt-2">{expenses.length} 筆紀錄 · {members.length} 位成員</p>
          </div>

          {/* 成員墊付比例 (簡單圓形圖示) */}
          {Object.keys(categoryMap).length > 0 && (
            <div className="bg-white p-5 rounded-[2rem] shadow-sm mb-6 border border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">墊付比例</h3>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(categoryMap).map(([name, amount], i) => (
                  <div key={name} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                    <span className="text-xs font-bold">{name}</span>
                    <span className="text-xs text-gray-400 font-mono">${(amount as number).toFixed(0)}</span>
                    <span className="text-[9px] text-gray-300">({((amount as number) / totalExpenses * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
              {/* 進度條 */}
              <div className="flex h-2 rounded-full overflow-hidden mt-4">
                {Object.entries(categoryMap).map(([name, amount], i) => (
                  <div
                    key={name}
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${(amount as number) / totalExpenses * 100}%`,
                      backgroundColor: pieColors[i % pieColors.length]
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 結清建議卡片 */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm mb-6 border border-emerald-100">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-2 py-1 bg-emerald-50 rounded-lg">最佳結清路徑</h2>
              <span className="text-[9px] text-gray-300 font-mono">ALGORITHM V3.1</span>
            </div>

            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((t, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 card-hover">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-gray-400 font-bold uppercase">Debtor</span>
                      <span className="font-bold text-red-500">{t.from}</span>
                    </div>
                    <div className="flex flex-col items-center px-4 flex-1">
                      <span className="text-gray-200 text-xl">→</span>
                      <span className="font-mono font-bold text-emerald-700 text-lg">${t.amt.toFixed(0)}</span>
                    </div>
                    <div className="flex flex-col items-end mr-4">
                      <span className="text-[9px] text-gray-400 font-bold uppercase text-right">Creditor</span>
                      <span className="font-bold text-blue-600">{t.to}</span>
                    </div>
                    <button onClick={() => handleSettleDebt(t.from, t.to, t.amt)} className="px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[10px] rounded-xl transition-colors whitespace-nowrap">清帳</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-8 h-8 text-emerald-300 mx-auto mb-2 opacity-50" />
                <p className="text-gray-400 italic text-sm font-medium">目前帳目已平清</p>
              </div>
            )}
          </div>

          {/* 成員個人紀錄 (Member Ledger) */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm mb-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-1 bg-gray-50 rounded-lg">個人花費紀錄</h2>
              <select value={selectedLedgerMember} onChange={e => setSelectedLedgerMember(e.target.value)} className="bg-gray-50 border-none rounded-xl px-3 py-1 text-sm font-bold text-gray-700 outline-none cursor-pointer hover:bg-gray-100 transition-colors">
                <option value="">選擇成員...</option>
                {members.map(m => (
                  <option key={m.id} value={m.nickname}>{m.nickname}</option>
                ))}
              </select>
            </div>

            {selectedLedgerMember ? (() => {
              const memberTxs = expenses.filter(e => !e.is_transfer && (e.payer === selectedLedgerMember || e.participants.includes(selectedLedgerMember)));
              const totalPaid = memberTxs.filter(e => e.payer === selectedLedgerMember).reduce((acc, e) => acc + Number(e.amount), 0);
              const totalOwed = memberTxs.reduce((acc, e) => {
                if (e.split_type === 'custom' && e.split_details?.[selectedLedgerMember]) {
                  return acc + Number(e.split_details[selectedLedgerMember]);
                } else if (e.participants.includes(selectedLedgerMember)) {
                  return acc + (Number(e.amount) / e.participants.length);
                }
                return acc;
              }, 0);

              return (
                <div className="space-y-4">
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 bg-blue-50 p-3 rounded-xl flex flex-col items-center">
                       <span className="text-[10px] font-bold text-blue-400">總墊付</span>
                       <span className="font-mono font-black text-blue-600 text-lg">${totalPaid.toFixed(0)}</span>
                    </div>
                    <div className="flex-1 bg-red-50 p-3 rounded-xl flex flex-col items-center">
                       <span className="text-[10px] font-bold text-red-400">總分攤 (應付)</span>
                       <span className="font-mono font-black text-red-600 text-lg">${totalOwed.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {memberTxs.map(exp => {
                       let myShare = 0;
                       if (exp.split_type === 'custom' && exp.split_details?.[selectedLedgerMember]) {
                         myShare = Number(exp.split_details[selectedLedgerMember]);
                       } else if (exp.participants.includes(selectedLedgerMember)) {
                         myShare = Number(exp.amount) / exp.participants.length;
                       }
                       const iPaid = exp.payer === selectedLedgerMember;
                       
                       return (
                         <div key={exp.id} className="flex justify-between items-center text-sm p-3 bg-gray-50/50 rounded-xl border border-transparent hover:border-gray-100 transition-colors">
                           <div className="flex flex-col">
                             <span className="font-bold text-gray-800 text-xs">{exp.item_name}</span>
                             <span className="text-[9px] text-gray-400 font-bold">{new Date(exp.created_at).toLocaleDateString()}</span>
                           </div>
                           <div className="flex items-center gap-4 text-right">
                             {myShare > 0 && <div className="flex flex-col items-end"><span className="text-[9px] text-red-300 font-black tracking-widest uppercase mb-0.5">被分攤</span><span className="font-mono text-red-500 font-black leading-none">${myShare.toFixed(0)}</span></div>}
                             {iPaid && <div className="flex flex-col items-end"><span className="text-[9px] text-blue-300 font-black tracking-widest uppercase mb-0.5">代墊</span><span className="font-mono text-blue-600 font-black leading-none">${Number(exp.amount).toFixed(0)}</span></div>}
                           </div>
                         </div>
                       );
                    })}
                    {memberTxs.length === 0 && <p className="text-center text-xs text-gray-400 py-4 font-bold">目前沒有相關花費紀錄</p>}
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-6 text-xs text-gray-400 font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">請選擇上方選單以查看個人帳本明細</div>
            )}
          </div>

          {/* 支出歷史清單 */}
          <div className="space-y-3 pb-24">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">支出明細 (RECENT ACTIVITY)</h3>
            {loading ? <ExpenseSkeleton /> :
              expenses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Receipt className="w-12 h-12 text-gray-400" /></div>
                  <h3 className="text-lg font-bold text-gray-300 mb-2">還沒有支出紀錄</h3>
                  <p className="text-sm text-gray-300">點擊右下角的 {<DollarSign className="inline w-4 h-4" />} 按鈕開始記帳！</p>
                </div>
              ) :
              expenses.map(exp => (
                <div key={exp.id} className={`p-5 rounded-[1.5rem] shadow-sm flex justify-between items-center border border-transparent transition-all card-hover group ${exp.is_transfer ? 'bg-emerald-50/50 hover:border-emerald-200' : 'bg-white hover:border-blue-200'}`}>
                  <div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter mb-2 inline-block ${exp.is_transfer ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'}`}>
                      {exp.payer} {exp.is_transfer ? '還款' : '墊付'}
                    </span>
                    <h4 className="font-bold text-gray-800 text-lg leading-none mb-1">{exp.item_name}</h4>
                    {exp.is_transfer ? (
                       <p className="text-[10px] text-emerald-500 font-medium">還給：{exp.participants.join(', ')}</p>
                    ) : (
                       <p className="text-[10px] text-gray-400 font-medium">參與：{exp.participants.join(', ')}</p>
                    )}
                    {exp.split_type === 'custom' && !exp.is_transfer && <p className="text-[9px] text-orange-500 font-bold mt-0.5">自訂分攤</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xl text-blue-600 mr-2">${typeof exp.amount === 'number' ? exp.amount.toFixed(0) : parseFloat(String(exp.amount)).toFixed(0)}</span>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditClick(exp)} className="p-1.5 bg-gray-50 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-100 transition-all" title="編輯">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCopyClick(exp)} className="p-1.5 bg-gray-50 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-100 transition-all" title="複製">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(exp.id)} className="p-1.5 bg-gray-50 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-100 transition-all" title="刪除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* FAB 按鈕 */}
      <button
        onClick={() => {
          setEditingId(null); setItem(''); setAmount(''); setSplitDetails({});
          setSplitType('equal');
          if (members && members.length > 0) {
            setPayer(members[0].nickname);
            setSelectedFriends(members.map(m => m.nickname));
          }
          setFormOpen(true);
        }}
        className="fab-button bg-emerald-500 text-white hover:shadow-[0_8px_40px_rgba(16,185,129,0.35)] flex items-center justify-center"
      >
        <DollarSign className="w-8 h-8" />
      </button>

      {/* 新增/編輯支出 Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title={editingId ? "編輯支出紀錄" : "新增支出紀錄"}>
        <form onSubmit={handleAddExpense}>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">項目內容</label>
              <input placeholder="例如：晚餐、油錢" value={item} onChange={e => setItem(e.target.value)} className="w-full border-none p-4 rounded-2xl bg-gray-50 mt-1 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">金額 (TWD)</label>
              <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-none p-4 rounded-2xl bg-gray-50 mt-1 outline-none font-mono text-lg focus:ring-2 focus:ring-emerald-500 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">代墊成員</label>
              <select value={payer} onChange={e => setPayer(e.target.value)} className="w-full border-none p-4 rounded-2xl bg-gray-50 mt-1 outline-none appearance-none font-bold">
                {members.map(m => <option key={m.id} value={m.nickname}>{m.nickname}</option>)}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">分攤對象</label>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button type="button" onClick={() => setSplitType('equal')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${splitType === 'equal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>均分</button>
                  <button type="button" onClick={() => setSplitType('custom')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${splitType === 'custom' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>自訂</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button
                    key={m.id} type="button"
                    onClick={() => {
                        if (selectedFriends.includes(m.nickname)) {
                            setSelectedFriends(selectedFriends.filter(f => f !== m.nickname));
                        } else {
                            setSelectedFriends([...selectedFriends, m.nickname]);
                        }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedFriends.includes(m.nickname) ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  >
                    {m.nickname}
                  </button>
                ))}
              </div>

              {/* 自訂分攤輸入區 */}
              {splitType === 'custom' && selectedFriends.length > 0 && (
                <div className="mt-4 bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <h4 className="text-[10px] font-bold text-orange-600 mb-3 uppercase tracking-widest">輸入各自分攤金額</h4>
                  <div className="space-y-2">
                    {selectedFriends.map(friend => (
                      <div key={friend} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-gray-700 w-20">{friend}</span>
                        <input
                          type="number" placeholder="0"
                          value={splitDetails[friend] || ''}
                          onChange={e => setSplitDetails({...splitDetails, [friend]: e.target.value})}
                          className="flex-1 border-none p-2 rounded-xl bg-white outline-none font-mono text-sm focus:ring-2 focus:ring-orange-400 text-right"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-orange-200/50 flex justify-between items-center text-xs font-bold">
                    <span className="text-orange-800">目前總分攤：</span>
                    <span className={`${Math.abs(selectedFriends.reduce((acc, f) => acc + parseFloat(splitDetails[f] || '0'), 0) - (parseFloat(amount) || 0)) < 1 ? 'text-emerald-600' : 'text-red-500'} font-mono text-sm`}>
                      ${selectedFriends.reduce((acc, f) => acc + parseFloat(splitDetails[f] || '0'), 0).toFixed(0)} / ${amount || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-10">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-4 bg-gray-50 rounded-2xl font-bold hover:bg-gray-100 transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:bg-emerald-700">儲存</button>
          </div>
        </form>
      </Modal>

      <BottomTabs />
    </div>
  );
}