'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default function TripExpensePage() {
  const { id: tripId } = useParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [tripInfo, setTripInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  
  // 視覺效果：滾動高度
  const [scrollY, setScrollY] = useState(0);

  // 表單狀態
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !amount || selectedFriends.length === 0) return alert('請填寫完整資訊');

    await supabase.from('trip_expenses').insert([{
      item_name: item,
      amount: parseFloat(amount),
      payer,
      participants: selectedFriends,
      trip_id: tripId
    }]);

    setItem(''); setAmount(''); setFormOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆支出嗎？')) return;
    await supabase.from('trip_expenses').delete().eq('id', id);
    fetchData();
  };

  // 🧮 運算邏輯：計算 Balance 與結清路徑
  const balances: any = {};
  members.forEach(m => balances[m.nickname] = 0);
  expenses.forEach(exp => {
    const amt = parseFloat(exp.amount);
    const perPerson = amt / exp.participants.length;
    if (balances[exp.payer] !== undefined) balances[exp.payer] += amt;
    exp.participants.forEach((p: string) => {
      if (balances[p] !== undefined) balances[p] -= perPerson;
    });
  });

  const getTransactions = () => {
    let debtors = Object.entries(balances).filter(([_, v]: any) => v < -1).map(([n, v]: any) => ({ n, v: Math.abs(v) }));
    let creditors = Object.entries(balances).filter(([_, v]: any) => v > 1).map(([n, v]: any) => ({ n, v }));
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

  // 視覺參數
  const headerHeight = 280;
  const scale = scrollY < 0 ? 1 + Math.abs(scrollY) / 300 : 1;
  const opacity = 1 - Math.min(scrollY / headerHeight, 1);

  return (
    <div className="bg-gray-100 min-h-screen text-black relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="expense" />

      {/* 沉浸式封面背景 (同行程表) */}
      <div className="fixed top-0 left-0 w-full z-0 h-[280px] overflow-hidden">
        <img 
          src={tripInfo?.cover_url || "https://images.unsplash.com/photo-1554224155-6726b3ff858f"} 
          className="w-full h-full object-cover"
          style={{ transform: `scale(${scale})`, opacity: opacity }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-transparent to-black/50" />
        <div className="absolute bottom-12 left-6 text-white" style={{ opacity }}>
          <h1 className="text-3xl font-black drop-shadow-lg">{tripInfo?.name}</h1>
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-[0.2em] mt-1">Settlement Archive / 帳目檔案</p>
        </div>
      </div>

      {/* 頂部導航 (隨滾動變色) */}
      <div className={`p-4 flex items-center sticky top-0 z-50 transition-all ${scrollY > 100 ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <button onClick={() => setSidebarOpen(true)} className={`p-2 rounded-xl ${scrollY > 100 ? 'text-black' : 'text-white bg-black/20 backdrop-blur-sm'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className={`ml-4 font-bold transition-opacity ${scrollY > 100 ? 'opacity-100 text-green-600' : 'opacity-0'}`}>
          {tripInfo?.name} - 支出結算
        </h1>
      </div>

      {/* 內容區塊 */}
      <div className="relative z-10" style={{ marginTop: `${headerHeight - 40}px` }}>
        <div className="bg-gray-100 rounded-t-[40px] p-6 min-h-screen shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
          
          {/* 結清建議卡片 (檔案庫風格) */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm mb-8 border border-green-100">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-[10px] font-bold text-green-600 uppercase tracking-widest px-2 py-1 bg-green-50 rounded-lg">最佳結清路徑</h2>
                <span className="text-[9px] text-gray-300 font-mono">ALGORITHM V3.1</span>
             </div>
             
             {transactions.length > 0 ? (
               <div className="space-y-4">
                 {transactions.map((t, i) => (
                   <div key={i} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Debtor</span>
                        <span className="font-bold text-red-500">{t.from}</span>
                      </div>
                      <div className="flex flex-col items-center px-4">
                         <span className="text-[18px] text-gray-200">→</span>
                         <span className="font-mono font-bold text-green-700 text-lg">${t.amt.toFixed(0)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-gray-400 font-bold uppercase text-right">Creditor</span>
                        <span className="font-bold text-blue-600">{t.to}</span>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-center text-gray-400 py-6 italic text-sm">目前帳目已平清 ✨</p>
             )}
          </div>

          {/* 支出歷史清單 */}
          <div className="space-y-4 pb-24">
             <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">支出明細 (RECENT ACTIVITY)</h3>
             {loading ? <div className="text-center py-10 text-gray-400">載入中...</div> : 
               expenses.map(exp => (
                 <div key={exp.id} className="bg-white p-5 rounded-3xl shadow-sm flex justify-between items-center border border-transparent hover:border-green-200 transition-all">
                    <div>
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter mb-2 inline-block">
                        {exp.payer} 墊付
                      </span>
                      <h4 className="font-bold text-gray-800 text-lg leading-none mb-1">{exp.item_name}</h4>
                      <p className="text-[10px] text-gray-400 font-medium">參與：{exp.participants.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-xl text-blue-600">${parseFloat(exp.amount).toFixed(0)}</span>
                      <button onClick={() => handleDelete(exp.id)} className="text-gray-200 hover:text-red-400 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                 </div>
               ))
             }
          </div>
        </div>
      </div>

      {/* FAB 按鈕 */}
      <button 
        onClick={() => setFormOpen(true)} 
        className="fixed bottom-8 right-8 w-14 h-14 bg-green-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl z-40 hover:scale-110 active:scale-95 transition-transform"
      >
        $
      </button>

      {/* 新增支出彈窗 (同樣風格) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleAddExpense} className="bg-white w-full max-w-sm p-8 rounded-[40px] shadow-2xl text-black">
            <h2 className="text-xl font-bold mb-8 text-green-600 tracking-tight">新增支出紀錄</h2>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">項目內容</label>
                <input placeholder="例如：晚餐、油錢" value={item} onChange={e => setItem(e.target.value)} className="w-full border-none p-4 rounded-2xl bg-gray-50 mt-1 outline-none focus:ring-2 focus:ring-green-500 transition-all" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">金額 (TWD)</label>
                <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-none p-4 rounded-2xl bg-gray-50 mt-1 outline-none font-mono text-lg" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">代墊成員</label>
                <select value={payer} onChange={e => setPayer(e.target.value)} className="w-full border-none p-4 rounded-2xl bg-gray-50 mt-1 outline-none appearance-none font-bold">
                  {members.map(m => <option key={m.id} value={m.nickname}>{m.nickname}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">分攤對象</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {members.map(m => (
                    <button
                      key={m.id} type="button"
                      onClick={() => selectedFriends.includes(m.nickname) 
                        ? setSelectedFriends(selectedFriends.filter(f => f !== m.nickname))
                        : setSelectedFriends([...selectedFriends, m.nickname])}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedFriends.includes(m.nickname) ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {m.nickname}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-10">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">取消</button>
              <button type="submit" className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-100">儲存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}