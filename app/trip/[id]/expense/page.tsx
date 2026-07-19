'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { ExpenseSkeleton } from '@/components/Skeleton';
import type { Expense } from '@/lib/types';
import { Menu, DollarSign, Trash2, Edit2, Copy, Receipt } from 'lucide-react';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { useTripMembers } from '@/features/members/hooks/useTripMembers';
import { useExpenses } from '@/features/expenses/hooks/useExpenses';
import { useSaveExpense, useDeleteExpense, useSettleDebt } from '@/features/expenses/hooks/useExpenseMutations';
import { computeBalances, getTransactions } from '@/features/expenses/settle';

export default function TripExpensePage() {
  const params = useParams();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;

  // 伺服器資料改由 feature hooks 提供（useExpenses 內含 Realtime 訂閱）
  const { data: tripInfo } = useTrip(tripId);
  // p9：成員名單限定為旅程所屬身分組（代墊人/分攤對象不再列出全站成員）
  const { data: members } = useTripMembers(tripId);
  const { data: expenses = [], isLoading: loading } = useExpenses(tripId);
  const saveExpense = useSaveExpense(tripId);
  const deleteExpense = useDeleteExpense(tripId);
  const settleDebt = useSettleDebt(tripId);

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

  // 成員載入後初始化表單預設（代墊人、分攤對象、個人帳本預設為自己）；用 functional update 避免覆蓋使用者已改的值
  useEffect(() => {
    if (members.length === 0) return;
    setPayer(prev => prev || members[0].nickname);
    setSelectedFriends(prev => prev.length === 0 ? members.map(m => m.nickname) : prev);
    const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('my_member_id') : null;
    if (myId) {
      const me = members.find(m => m.id === myId);
      if (me) setSelectedLedgerMember(prev => prev || me.nickname);
    }
  }, [members]);

  // 捲動視差
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    
    const finalSplitDetails: Record<string, number> = {};
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
      await saveExpense.mutateAsync({ id: editingId, payload });
      toast(editingId ? '支出已更新' : '支出已記錄', 'success');
      setItem(''); setAmount(''); setFormOpen(false); setEditingId(null); setSplitDetails({});
    } catch (error) {
      toast('儲存失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: '確定要刪除這筆支出嗎？', confirmText: '刪除', danger: true });
    if (!ok) return;
    try {
      await deleteExpense.mutateAsync(id);
      toast('支出已刪除', 'info');
    } catch (error) {
      toast('刪除失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleSettleDebt = async (debtor: string, creditor: string, amount: number) => {
    const ok = await confirm({ message: `確定記錄 ${debtor} 償還 ${creditor} $${amount.toFixed(0)} 嗎？`, confirmText: '確清帳', danger: false });
    if (!ok) return;
    try {
      await settleDebt.mutateAsync({ debtor, creditor, amount });
      toast('清帳紀錄已新增', 'success');
    } catch (error) {
      toast('清帳失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  // 餘額與最佳結清路徑（純函式，已抽到 features/expenses/settle.ts）
  const balances = computeBalances(members, expenses);
  const transactions = getTransactions(balances);
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

  const pieColors = ['#1D9E75', '#5DCAA5', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // 視覺參數
  const headerHeight = 280;
  const opacity = Math.max(0, 1 - scrollY / headerHeight);

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="expense" />

      {/* 沉浸式封面背景 */}
      <div className="fixed top-0 left-0 w-full z-0 h-[280px] overflow-hidden bg-gray-900">
        <img
          src={tripInfo?.cover_url || "https://images.unsplash.com/photo-1554224155-6726b3ff858f"}
          className="w-full h-full object-cover"
          style={{ opacity, transform: `scale(${1 + scrollY * 0.001})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F2FAF7] via-transparent to-black/50" />
        <div className="absolute bottom-16 left-6 text-white" style={{ opacity }}>
          <h1 className="text-3xl font-black drop-shadow-lg tracking-tight">{tripInfo?.name}</h1>
          <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mt-1">Settlement Archive / 帳目檔案</p>
        </div>
      </div>

      {/* 頂部導航 */}
      <div className={`p-4 flex items-center sticky top-0 z-50 transition-all duration-300 ${scrollY > 100 ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`}>
        <button onClick={() => setSidebarOpen(true)} className={`p-2.5 rounded-xl transition-all ${scrollY > 100 ? 'text-[var(--color-ink)] hover:bg-[var(--color-primary-soft)]' : 'text-white glass-dark'}`}>
          <Menu className="h-5 w-5" />
        </button>
        <h1 className={`ml-4 font-bold text-sm transition-all ${scrollY > 100 ? 'opacity-100 text-[var(--color-primary-strong)]' : 'opacity-0'}`}>
          {tripInfo?.name} - 支出結算
        </h1>
      </div>

      {/* 內容區塊 */}
      <div className="relative z-10" style={{ marginTop: `${headerHeight - 40}px` }}>
        <div className="rounded-t-[3rem] p-6 min-h-screen" style={{ background: 'var(--color-bg-page)' }}>

          {/* 總額統計卡片 */}
          <div className="bg-gradient-to-br from-[#1D9E75] to-[#0F6E56] p-6 rounded-xl shadow-lg mb-6 text-white">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Total Expenses</p>
            <p className="text-4xl font-black font-mono">${totalExpenses.toFixed(0)}</p>
            <p className="text-[10px] text-white/70 mt-2">{expenses.length} 筆紀錄 · {members.length} 位成員</p>
          </div>

          {/* 成員墊付比例 (簡單圓形圖示) */}
          {Object.keys(categoryMap).length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm mb-6 border border-[var(--color-border-hairline)]">
              <h3 className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-widest mb-4">墊付比例</h3>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(categoryMap).map(([name, amount], i) => (
                  <div key={name} className="flex items-center gap-2 bg-[var(--color-bg-page)] px-3 py-2 rounded-xl">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                    <span className="text-xs font-bold">{name}</span>
                    <span className="text-xs text-[var(--color-ink-muted)] font-mono">${(amount as number).toFixed(0)}</span>
                    <span className="text-[9px] text-[#C4CFC9]">({((amount as number) / totalExpenses * 100).toFixed(0)}%)</span>
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
          <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-[#9BDCC4]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[10px] font-bold text-[var(--color-primary-strong)] uppercase tracking-widest px-2 py-1 bg-[var(--color-primary-soft)] rounded-lg">最佳結清路徑</h2>
              <span className="text-[9px] text-[#C4CFC9] font-mono">ALGORITHM V3.1</span>
            </div>

            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((t, i) => (
                  <div key={i} className="flex justify-between items-center bg-[var(--color-bg-page)] p-4 rounded-2xl border border-[var(--color-border-hairline)] card-hover">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[var(--color-ink-muted)] font-bold uppercase">Debtor</span>
                      <span className="font-bold text-red-500">{t.from}</span>
                    </div>
                    <div className="flex flex-col items-center px-4 flex-1">
                      <span className="text-[#C4CFC9] text-xl">→</span>
                      <span className="font-mono font-bold text-[var(--color-primary-strong)] text-lg">${t.amt.toFixed(0)}</span>
                    </div>
                    <div className="flex flex-col items-end mr-4">
                      <span className="text-[9px] text-[var(--color-ink-muted)] font-bold uppercase text-right">Creditor</span>
                      <span className="font-bold text-[var(--color-primary-strong)]">{t.to}</span>
                    </div>
                    <button onClick={() => handleSettleDebt(t.from, t.to, t.amt)} className="px-3 py-2 bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] hover:bg-[#B9E7D6] font-bold text-[10px] rounded-xl transition-colors whitespace-nowrap">清帳</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-8 h-8 text-[#9BDCC4] mx-auto mb-2 opacity-70" />
                <p className="text-[var(--color-ink-muted)] italic text-sm font-medium">目前帳目已平清</p>
              </div>
            )}
          </div>

          {/* 成員個人紀錄 (Member Ledger) */}
          <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-[var(--color-border-hairline)]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-widest px-2 py-1 bg-[var(--color-bg-page)] rounded-lg">個人花費紀錄</h2>
              <select value={selectedLedgerMember} onChange={e => setSelectedLedgerMember(e.target.value)} className="bg-[var(--color-bg-page)] border-none rounded-xl px-3 py-1 text-sm font-bold text-[var(--color-ink)] outline-none cursor-pointer hover:bg-[var(--color-primary-soft)] transition-colors">
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
                    <div className="flex-1 bg-[var(--color-primary-soft)] p-3 rounded-xl flex flex-col items-center">
                       <span className="text-[10px] font-bold text-[var(--color-primary)]">總墊付</span>
                       <span className="font-mono font-black text-[var(--color-primary-strong)] text-lg">${totalPaid.toFixed(0)}</span>
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
                         <div key={exp.id} className="flex justify-between items-center text-sm p-3 bg-[var(--color-bg-page)] rounded-xl border border-transparent hover:border-[#D8EBE3] transition-colors">
                           <div className="flex flex-col">
                             <span className="font-bold text-[var(--color-ink)] text-xs">{exp.item_name}</span>
                             <span className="text-[9px] text-[var(--color-ink-muted)] font-bold">{new Date(exp.created_at).toLocaleDateString()}</span>
                           </div>
                           <div className="flex items-center gap-4 text-right">
                             {myShare > 0 && <div className="flex flex-col items-end"><span className="text-[9px] text-red-300 font-black tracking-widest uppercase mb-0.5">被分攤</span><span className="font-mono text-red-500 font-black leading-none">${myShare.toFixed(0)}</span></div>}
                             {iPaid && <div className="flex flex-col items-end"><span className="text-[9px] text-[var(--color-primary)] font-black tracking-widest uppercase mb-0.5">代墊</span><span className="font-mono text-[var(--color-primary-strong)] font-black leading-none">${Number(exp.amount).toFixed(0)}</span></div>}
                           </div>
                         </div>
                       );
                    })}
                    {memberTxs.length === 0 && <p className="text-center text-xs text-[var(--color-ink-muted)] py-4 font-bold">目前沒有相關花費紀錄</p>}
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-6 text-xs text-[var(--color-ink-muted)] font-bold bg-[var(--color-bg-page)] rounded-xl border border-dashed border-[#C4DED3]">請選擇上方選單以查看個人帳本明細</div>
            )}
          </div>

          {/* 支出歷史清單 */}
          <div className="space-y-3 pb-24">
            <h3 className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-widest px-1 mb-2">支出明細 (RECENT ACTIVITY)</h3>
            {loading ? <ExpenseSkeleton /> :
              expenses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Receipt className="w-12 h-12 text-[var(--color-ink-muted)]" /></div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-ink-muted)' }}>還沒有支出紀錄</h3>
                  <p className="text-sm" style={{ color: 'var(--color-ink-muted)', opacity: 0.7 }}>點擊右下角的 {<DollarSign className="inline w-4 h-4" />} 按鈕開始記帳！</p>
                </div>
              ) :
              expenses.map(exp => (
                <div key={exp.id} className={`p-5 rounded-xl shadow-sm flex justify-between items-center border border-transparent transition-all card-hover group ${exp.is_transfer ? 'bg-[var(--color-primary-soft)]/40 hover:border-[#9BDCC4]' : 'bg-white hover:border-[#9BDCC4]'}`}>
                  <div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter mb-2 inline-block ${exp.is_transfer ? 'bg-[#CDEEE2] text-[var(--color-primary-strong)]' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)]'}`}>
                      {exp.payer} {exp.is_transfer ? '還款' : '墊付'}
                    </span>
                    <h4 className="font-bold text-[var(--color-ink)] text-lg leading-none mb-1">{exp.item_name}</h4>
                    {exp.is_transfer ? (
                       <p className="text-[10px] text-[var(--color-primary)] font-medium">還給：{exp.participants.join(', ')}</p>
                    ) : (
                       <p className="text-[10px] text-[var(--color-ink-muted)] font-medium">參與：{exp.participants.join(', ')}</p>
                    )}
                    {exp.split_type === 'custom' && !exp.is_transfer && exp.split_details && (
                      <p className="text-[9px] text-orange-500 font-bold mt-0.5">
                        自訂分攤：{Object.entries(exp.split_details).filter(([, v]) => Number(v) > 0).map(([name, v]) => `${name} $${Number(v).toFixed(0)}`).join('・')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xl text-[var(--color-ink)] mr-2">${typeof exp.amount === 'number' ? exp.amount.toFixed(0) : parseFloat(String(exp.amount)).toFixed(0)}</span>
                    {/* 操作鈕常駐（行動裝置沒有 hover） */}
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEditClick(exp)} className="p-1.5 bg-[var(--color-bg-page)] rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)] transition-all" title="編輯">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCopyClick(exp)} className="p-1.5 bg-[var(--color-bg-page)] rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)] transition-all" title="複製">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(exp.id)} className="p-1.5 bg-[var(--color-bg-page)] rounded-lg text-[var(--color-ink-muted)] hover:text-red-500 hover:bg-red-50 transition-all" title="刪除">
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
        className="fab-button bg-[var(--color-primary)] text-white hover:shadow-[0_8px_40px_rgba(15,110,86,0.45)] flex items-center justify-center"
      >
        <DollarSign className="w-8 h-8" />
      </button>

      {/* 新增/編輯支出 Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title={editingId ? "編輯支出紀錄" : "新增支出紀錄"}>
        <form onSubmit={handleAddExpense}>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1">項目內容</label>
              <input placeholder="例如：晚餐、油錢" value={item} onChange={e => setItem(e.target.value)} className="w-full border-none p-4 rounded-xl bg-[var(--color-bg-page)] mt-1 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1">金額 (TWD)</label>
              <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-none p-4 rounded-xl bg-[var(--color-bg-page)] mt-1 outline-none font-mono text-lg focus:ring-2 focus:ring-[var(--color-primary)] transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1">代墊成員</label>
              <select value={payer} onChange={e => setPayer(e.target.value)} className="w-full border-none p-4 rounded-xl bg-[var(--color-bg-page)] mt-1 outline-none appearance-none font-bold">
                {members.map(m => <option key={m.id} value={m.nickname}>{m.nickname}</option>)}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1">分攤對象</label>
                <div className="flex bg-[#EEF1F0] rounded-lg p-0.5">
                  <button type="button" onClick={() => setSplitType('equal')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${splitType === 'equal' ? 'bg-white shadow-sm text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]'}`}>均分</button>
                  <button type="button" onClick={() => setSplitType('custom')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${splitType === 'custom' ? 'bg-white shadow-sm text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]'}`}>自訂</button>
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
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedFriends.includes(m.nickname) ? 'bg-[var(--color-primary)] text-white shadow-md scale-105' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)] hover:bg-[#E1E7E4]'}`}
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
                        <span className="text-sm font-bold text-[var(--color-ink)] w-20">{friend}</span>
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
                    <span className={`${Math.abs(selectedFriends.reduce((acc, f) => acc + parseFloat(splitDetails[f] || '0'), 0) - (parseFloat(amount) || 0)) < 1 ? 'text-[var(--color-primary-strong)]' : 'text-red-500'} font-mono text-sm`}>
                      ${selectedFriends.reduce((acc, f) => acc + parseFloat(splitDetails[f] || '0'), 0).toFixed(0)} / ${amount || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-10">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-4 bg-[#EEF1F0] text-[var(--color-ink)] rounded-xl font-bold hover:bg-[#E1E7E4] transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all hover:bg-[var(--color-primary-strong)]">儲存</button>
          </div>
        </form>
      </Modal>

      <BottomTabs />
    </div>
  );
}