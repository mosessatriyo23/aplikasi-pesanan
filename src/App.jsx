import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { 
  User, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Send,
  Database,
  X,
  ShoppingCart,
  Trash2,
  Package,
  Info
} from 'lucide-react';

// Konfigurasi Firebase
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'order-system-v1';

// Konstanta Harga
const PRICES = {
  KAOS_BASE: 75000,
  POLO_BASE: 85000,
  TOPI: 35000,
  MUG: 25000,
  LENGAN_PANJANG: 5000,
  LENGAN_KERUT: 7000
};

// Daftar Ukuran Polo (Hingga 5XL dengan kelipatan 5rb)
const POLO_SIZES = [
  { id: 'S', label: 'S', extra: 0 },
  { id: 'M', label: 'M', extra: 0 },
  { id: 'L', label: 'L', extra: 0 },
  { id: 'XL', label: 'XL', extra: 0 },
  { id: 'XXL', label: 'XXL (+5rb)', extra: 5000 },
  { id: 'XXXL', label: 'XXXL (+10rb)', extra: 10000 },
  { id: 'XXXXL', label: 'XXXXL (+15rb)', extra: 15000 },
  { id: 'XXXXXL', label: 'XXXXXL (+20rb)', extra: 20000 },
];

const KAOS_SIZES = [
  { id: 'S', label: 'S', extra: 0 },
  { id: 'M', label: 'M', extra: 0 },
  { id: 'L', label: 'L', extra: 0 },
  { id: 'XL', label: 'XL', extra: 0 },
  { id: 'XXL', label: 'XXL (+5rb)', extra: 5000 },
  { id: 'XXXL', label: 'XXXL (+10rb)', extra: 10000 },
  { id: 'XXXXL', label: 'XXXXL (+15rb)', extra: 15000 },
  { id: 'XXXXXL', label: 'XXXXXL (+20rb)', extra: 20000 },
];

export default function App() {
  const [view, setView] = useState('user'); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [responses, setResponses] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // Data Pesanan
  const [formData, setFormData] = useState({
    nama: '',
    wilayah: '',
    polo: {}, 
    lenganPanjangPolo: 0,
    lenganKerutPolo: 0,
    kaos: {},
    lenganPanjangKaos: 0,
    lenganKerutKaos: 0,
    topi: 0,
    mug: 0
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInAnonymously(auth);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { setError("Gagal menyambung ke sistem."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || view !== 'admin') return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResponses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => setError("Gagal mengambil data admin."));
    return () => unsubscribe();
  }, [user, view]);

  // Hitung Total Item
  const getTotalQty = (type) => {
    return Object.values(formData[type] || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
  };

  const totalPolo = getTotalQty('polo');
  const totalKaos = getTotalQty('kaos');
  const totalItems = totalPolo + totalKaos + (parseInt(formData.topi) || 0) + (parseInt(formData.mug) || 0);

  const calculateTotalHarga = () => {
    let total = 0;
    // Polo
    Object.keys(formData.polo).forEach(size => {
      const qty = parseInt(formData.polo[size]) || 0;
      const sizePrice = POLO_SIZES.find(s => s.id === size)?.extra || 0;
      total += qty * (PRICES.POLO_BASE + sizePrice);
    });
    total += (formData.lenganPanjangPolo * PRICES.LENGAN_PANJANG);
    total += (formData.lenganKerutPolo * PRICES.LENGAN_KERUT);

    // Kaos
    Object.keys(formData.kaos).forEach(size => {
      const qty = parseInt(formData.kaos[size]) || 0;
      const sizePrice = KAOS_SIZES.find(s => s.id === size)?.extra || 0;
      total += qty * (PRICES.KAOS_BASE + sizePrice);
    });
    total += (formData.lenganPanjangKaos * PRICES.LENGAN_PANJANG);
    total += (formData.lenganKerutKaos * PRICES.LENGAN_KERUT);

    total += (parseInt(formData.topi) || 0) * PRICES.TOPI;
    total += (parseInt(formData.mug) || 0) * PRICES.MUG;
    return total;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (totalItems === 0) {
      setError("Silakan pilih minimal 1 produk.");
      return;
    }
    // Validasi Lengan
    if (formData.lenganPanjangPolo + formData.lenganKerutPolo > totalPolo) {
      setError("Jumlah pilihan lengan Polo melebihi jumlah baju yang dipesan.");
      return;
    }
    if (formData.lenganPanjangKaos + formData.lenganKerutKaos > totalKaos) {
      setError("Jumlah pilihan lengan Kaos melebihi jumlah baju yang dipesan.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const totalHarga = calculateTotalHarga();
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
        ...formData,
        totalItems,
        totalHarga,
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) { 
      setError("Gagal mengirim pesanan. Silakan coba lagi."); 
    } finally { 
      setLoading(false); 
    }
  };

  const deleteOrder = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id));
      setDeleteConfirmId(null);
    } catch (e) { console.error(e); }
  };

  // --- SUB-KOMPONEN UI ---
  const QuantitySelector = ({ label, value, onChange, color = "blue", subtitle = "" }) => (
    <div className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-lg font-bold text-slate-700">{label}</span>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-10 h-10 bg-slate-200 rounded-full text-xl font-bold active:bg-slate-300 transition-colors"
        >-</button>
        <span className="text-xl font-bold w-6 text-center">{value}</span>
        <button 
          onClick={() => onChange(value + 1)}
          className={`w-10 h-10 bg-${color}-100 text-${color}-600 rounded-full text-xl font-bold active:bg-${color}-200 transition-colors`}
        >+</button>
      </div>
    </div>
  );

  const SleeveSection = ({ type, totalQty, longValue, wrinkledValue, onLongChange, onWrinkledChange }) => {
    if (totalQty === 0) return null;
    return (
      <div className="mt-6 p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 border-dashed animate-in fade-in zoom-in duration-300">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Info size={16}/> Atur Jenis Lengan (Total {totalQty} Baju)
        </p>
        <QuantitySelector 
          label="Lengan Panjang" 
          subtitle="+Rp 5.000 per baju"
          value={longValue} 
          onChange={(v) => {
            if (v + wrinkledValue <= totalQty) onLongChange(v);
          }}
          color="indigo"
        />
        <QuantitySelector 
          label="Lengan Kerut" 
          subtitle="+Rp 7.000 per baju"
          value={wrinkledValue} 
          onChange={(v) => {
            if (v + longValue <= totalQty) onWrinkledChange(v);
          }}
          color="indigo"
        />
        <p className="mt-3 text-xs text-slate-400 italic">
          Sisa {totalQty - (longValue + wrinkledValue)} baju akan otomatis menjadi Lengan Pendek (Standar).
        </p>
      </div>
    );
  };

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Database className="text-blue-600"/> Data Pesanan</h1>
            <button onClick={() => setView('user')} className="bg-slate-800 text-white px-5 py-2 rounded-xl font-bold shadow-md hover:bg-slate-700 transition-colors">Tutup Admin</button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden overflow-x-auto border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="p-4 font-bold border-r border-blue-500">Pendaftar</th>
                  <th className="p-4 font-bold border-r border-blue-500 text-center">Polo</th>
                  <th className="p-4 font-bold border-r border-blue-500 text-center">Kaos</th>
                  <th className="p-4 font-bold border-r border-blue-500 text-center">Aksesori</th>
                  <th className="p-4 font-bold text-right">Total Bayar</th>
                  <th className="p-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {responses.length === 0 ? (
                  <tr><td colSpan="6" className="p-10 text-center text-slate-400 italic">Belum ada pesanan masuk.</td></tr>
                ) : responses.map(order => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 border-r border-slate-100">
                      <div className="font-bold text-slate-800">{order.nama}</div>
                      <div className="text-xs text-slate-400 uppercase font-semibold">{order.wilayah}</div>
                    </td>
                    <td className="p-4 border-r border-slate-100 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(order.polo).filter(([_, q]) => q > 0).map(([s, q]) => (
                          <span key={s} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-100">{s}:{q}</span>
                        ))}
                      </div>
                      {(order.lenganPanjangPolo > 0 || order.lenganKerutPolo > 0) && (
                        <div className="text-blue-600 font-bold mt-2 pt-2 border-t border-slate-100 border-dashed">
                          {order.lenganPanjangPolo > 0 && <div>PJG: {order.lenganPanjangPolo}</div>}
                          {order.lenganKerutPolo > 0 && <div>KRT: {order.lenganKerutPolo}</div>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 border-r border-slate-100 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(order.kaos).filter(([_, q]) => q > 0).map(([s, q]) => (
                          <span key={s} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-100">{s}:{q}</span>
                        ))}
                      </div>
                      {(order.lenganPanjangKaos > 0 || order.lenganKerutKaos > 0) && (
                        <div className="text-emerald-600 font-bold mt-2 pt-2 border-t border-slate-100 border-dashed">
                          {order.lenganPanjangKaos > 0 && <div>PJG: {order.lenganPanjangKaos}</div>}
                          {order.lenganKerutKaos > 0 && <div>KRT: {order.lenganKerutKaos}</div>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 border-r border-slate-100 text-xs text-center font-bold text-slate-600">
                      {order.topi > 0 && <div className="bg-orange-50 text-orange-700 px-2 py-1 rounded mb-1">Topi: {order.topi}</div>}
                      {order.mug > 0 && <div className="bg-amber-50 text-amber-700 px-2 py-1 rounded">Mug: {order.mug}</div>}
                    </td>
                    <td className="p-4 font-black text-right text-blue-700 whitespace-nowrap">
                      Rp {order.totalHarga?.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      {deleteConfirmId === order.id ? (
                        <div className="flex flex-col gap-1 items-center">
                          <button onClick={() => deleteOrder(order.id)} className="bg-red-600 text-white text-[10px] px-3 py-1 rounded uppercase font-bold">Hapus</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] text-slate-400 underline">Batal</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(order.id)} className="text-red-400 hover:text-red-600 p-2 transition-colors"><Trash2 size={18}/></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center max-w-md w-full border-b-[12px] border-green-600 animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={60} className="text-green-500" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4">Berhasil!</h1>
          <p className="text-xl text-slate-500 mb-10 leading-relaxed">Pesanan Anda telah kami terima dan akan segera diproses.</p>
          <button 
            onClick={() => {
              setSubmitted(false);
              setFormData({nama:'', wilayah:'', polo:{}, lenganPanjangPolo:0, lenganKerutPolo:0, kaos:{}, lenganPanjangKaos:0, lenganKerutKaos:0, topi:0, mug:0});
            }}
            className="w-full bg-slate-900 text-white py-6 rounded-2xl font-bold text-2xl shadow-xl hover:bg-black active:scale-95 transition-all"
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans pb-48">
      <button onClick={() => setView('admin')} className="fixed top-4 right-4 text-slate-300 hover:text-blue-500 z-10 transition-colors"><Database size={24}/></button>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tight">Formulir Atribut</h1>
          <p className="text-xl text-slate-500 font-medium">Lengkapi data diri dan pilih produk yang Anda inginkan.</p>
        </div>

        <div className="space-y-6">
          
          {/* Section 1: Data Diri */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-lg border-l-8 border-blue-500 transition-all hover:shadow-xl">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3"><User className="text-blue-500" size={28}/> Identitas Anda</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})}
                  className="w-full p-5 text-lg bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:bg-white outline-none transition-all" 
                  placeholder="Misal: Budi Santoso"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Wilayah / Cabang</label>
                <input 
                  type="text" 
                  value={formData.wilayah} 
                  onChange={(e) => setFormData({...formData, wilayah: e.target.value})}
                  className="w-full p-5 text-lg bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:bg-white outline-none transition-all" 
                  placeholder="Misal: Jakarta Barat"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Polo */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-lg border-l-8 border-indigo-500 transition-all hover:shadow-xl">
            <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3"><Package className="text-indigo-500" size={28}/> Pesanan Polo (Rp 85rb)</h2>
            <p className="text-slate-400 mb-6 font-medium">Silakan pilih ukuran baju yang ingin dipesan:</p>
            <div className="bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
              {POLO_SIZES.map(s => (
                <QuantitySelector 
                  key={s.id} 
                  label={s.label} 
                  value={formData.polo[s.id] || 0} 
                  onChange={(val) => {
                    const newPolo = {...formData.polo, [s.id]: val};
                    const newTotal = Object.values(newPolo).reduce((a, b) => a + b, 0);
                    setFormData({
                      ...formData, 
                      polo: newPolo,
                      lenganPanjangPolo: Math.min(formData.lenganPanjangPolo, newTotal),
                      lenganKerutPolo: Math.min(formData.lenganKerutPolo, newTotal - Math.min(formData.lenganPanjangPolo, newTotal))
                    });
                  }}
                  color="indigo"
                />
              ))}
            </div>
            
            <SleeveSection 
              totalQty={totalPolo}
              longValue={formData.lenganPanjangPolo}
              wrinkledValue={formData.lenganKerutPolo}
              onLongChange={(v) => setFormData({...formData, lenganPanjangPolo: v})}
              onWrinkledChange={(v) => setFormData({...formData, lenganKerutPolo: v})}
            />
          </div>

          {/* Section 3: Kaos */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-lg border-l-8 border-emerald-500 transition-all hover:shadow-xl">
            <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3"><Package className="text-emerald-500" size={28}/> Pesanan Kaos (Rp 75rb)</h2>
            <p className="text-slate-400 mb-6 font-medium">Silakan pilih ukuran baju yang ingin dipesan:</p>
            <div className="bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
              {KAOS_SIZES.map(s => (
                <QuantitySelector 
                  key={s.id} 
                  label={s.label} 
                  value={formData.kaos[s.id] || 0} 
                  onChange={(val) => {
                    const newKaos = {...formData.kaos, [s.id]: val};
                    const newTotal = Object.values(newKaos).reduce((a, b) => a + b, 0);
                    setFormData({
                      ...formData, 
                      kaos: newKaos,
                      lenganPanjangKaos: Math.min(formData.lenganPanjangKaos, newTotal),
                      lenganKerutKaos: Math.min(formData.lenganKerutKaos, newTotal - Math.min(formData.lenganPanjangKaos, newTotal))
                    });
                  }}
                  color="emerald"
                />
              ))}
            </div>

            <SleeveSection 
              totalQty={totalKaos}
              longValue={formData.lenganPanjangKaos}
              wrinkledValue={formData.lenganKerutKaos}
              onLongChange={(v) => setFormData({...formData, lenganPanjangKaos: v})}
              onWrinkledChange={(v) => setFormData({...formData, lenganKerutKaos: v})}
            />
          </div>

          {/* Section 4: Topi & Mug */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-lg border-l-8 border-orange-500 transition-all hover:shadow-xl">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3"><ShoppingCart className="text-orange-500" size={28}/> Topi & Mug</h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <QuantitySelector label="Topi (Rp 35rb)" value={formData.topi} onChange={(v) => setFormData({...formData, topi: v})} color="orange" />
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <QuantitySelector label="Mug (Rp 25rb)" value={formData.mug} onChange={(v) => setFormData({...formData, mug: v})} color="orange" />
              </div>
            </div>
          </div>
        </div>

        {/* Floating Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white/95 backdrop-blur-md border-t-2 border-slate-200 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Total Pembayaran</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl md:text-5xl font-black text-blue-600">Rp {calculateTotalHarga().toLocaleString()}</p>
                <p className="text-sm text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg">{totalItems} Item</p>
              </div>
            </div>
            
            <button 
              onClick={handleSubmit}
              disabled={loading || totalItems === 0 || !formData.nama || !formData.wilayah}
              className={`w-full md:w-auto px-16 py-5 md:py-6 rounded-[24px] text-xl md:text-2xl font-black shadow-2xl flex items-center justify-center gap-3 transition-all ${
                totalItems > 0 && formData.nama && formData.wilayah 
                ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-green-200 active:scale-95' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={32} /> : <><Send size={28}/> KIRIM</>}
            </button>
          </div>
          {error && <p className="text-center text-red-600 font-black mt-3 text-sm flex items-center justify-center gap-2 animate-bounce"><AlertCircle size={16}/> {error}</p>}
        </div>

      </div>
    </div>
  );
}