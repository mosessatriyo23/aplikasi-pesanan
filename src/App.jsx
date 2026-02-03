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

// Konfigurasi Firebase menggunakan variabel global lingkungan eksekusi
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
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
        await signInAnonymously(auth);
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

  const getTotalQty = (type) => {
    return Object.values(formData[type] || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
  };

  const totalPolo = getTotalQty('polo');
  const totalKaos = getTotalQty('kaos');
  const totalItems = totalPolo + totalKaos + (parseInt(formData.topi) || 0) + (parseInt(formData.mug) || 0);

  const calculateTotalHarga = () => {
    let total = 0;
    Object.keys(formData.polo).forEach(size => {
      const qty = parseInt(formData.polo[size]) || 0;
      const sizePrice = POLO_SIZES.find(s => s.id === size)?.extra || 0;
      total += qty * (PRICES.POLO_BASE + sizePrice);
    });
    total += (formData.lenganPanjangPolo * PRICES.LENGAN_PANJANG);
    total += (formData.lenganKerutPolo * PRICES.LENGAN_KERUT);

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
    if (formData.lenganPanjangPolo + formData.lenganKerutPolo > totalPolo) {
      setError("Pilihan lengan Polo melebihi jumlah baju.");
      return;
    }
    if (formData.lenganPanjangKaos + formData.lenganKerutKaos > totalKaos) {
      setError("Pilihan lengan Kaos melebihi jumlah baju.");
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
      setError("Gagal mengirim pesanan."); 
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
  const QuantitySelector = ({ label, value, onChange, colorClass = "blue", subtitle = "" }) => (
    <div className="qty-row">
      <div className="qty-info">
        <span className="qty-label">{label}</span>
        {subtitle && <p className="qty-subtitle">{subtitle}</p>}
      </div>
      <div className="qty-controls">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="qty-btn-minus">-</button>
        <span className="qty-number">{value}</span>
        <button onClick={() => onChange(value + 1)} className={`qty-btn-plus qty-btn-plus-${colorClass}`}>+</button>
      </div>
    </div>
  );

  const SleeveSection = ({ totalQty, longValue, wrinkledValue, onLongChange, onWrinkledChange }) => {
    if (totalQty === 0) return null;
    return (
      <div className="sleeve-card">
        <p className="sleeve-title"><Info size={18}/> Atur Jenis Lengan (Total {totalQty} Baju)</p>
        <QuantitySelector 
          label="Lengan Panjang" 
          subtitle="+Rp 5.000 / baju"
          value={longValue} 
          onChange={(v) => { if (v + wrinkledValue <= totalQty) onLongChange(v); }}
          colorClass="indigo"
        />
        <QuantitySelector 
          label="Lengan Kerut" 
          subtitle="+Rp 7.000 / baju"
          value={wrinkledValue} 
          onChange={(v) => { if (v + longValue <= totalQty) onWrinkledChange(v); }}
          colorClass="indigo"
        />
        <p className="sleeve-footer">Sisa {totalQty - (longValue + wrinkledValue)} baju otomatis Lengan Pendek (Standar).</p>
      </div>
    );
  };

  return (
    <div className="app-wrapper">
      <style>{`
        :root {
          --primary: #4f46e5;
          --primary-hover: #4338ca;
          --bg-soft: #f8fafc;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --white: #ffffff;
          --green: #22c55e;
          --red: #ef4444;
          --indigo: #6366f1;
          --emerald: #10b981;
          --orange: #f97316;
          --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

        .app-wrapper {
          background-color: var(--bg-soft);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 40px 24px 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .container { 
          width: 100%; 
          max-width: 100%; /* Menghilangkan batas 680px */
          margin: 0; 
        }

        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-size: clamp(2rem, 8vw, 3.5rem); font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.05em; line-height: 1.1; }
        .header p { font-size: 1.25rem; color: var(--text-muted); margin-top: 15px; font-weight: 500; }

        .card {
          background: var(--white);
          padding: clamp(20px, 4vw, 40px);
          border-radius: 32px;
          box-shadow: var(--shadow);
          border-top: 8px solid var(--primary);
          margin-bottom: 30px;
          transition: transform 0.2s ease;
          width: 100%;
        }
        .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

        .card-indigo { border-top-color: var(--indigo); }
        .card-emerald { border-top-color: var(--emerald); }
        .card-orange { border-top-color: var(--orange); }

        .section-title { font-size: 1.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 30px; display: flex; align-items: center; gap: 15px; }

        .grid-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        
        .input-wrapper { display: flex; flex-direction: column; gap: 10px; }
        .input-wrapper label { font-size: 0.9rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .input-field { 
          width: 100%; padding: 22px; font-size: 1.25rem; border: 3px solid #e2e8f0; 
          border-radius: 20px; outline: none; transition: all 0.2s ease; background: #fff; 
        }
        .input-field:focus { border-color: var(--primary); box-shadow: 0 0 0 6px rgba(79, 70, 229, 0.1); }

        /* Penyesuaian Grid untuk Ukuran Baju agar tidak terlalu memanjang di layar lebar */
        .sizes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 0 40px;
        }

        .qty-row { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 2px solid #f1f5f9; }
        .qty-row:last-child { border-bottom: none; }
        .qty-info { flex: 1; padding-right: 20px; }
        .qty-label { font-size: 1.4rem; font-weight: 700; color: #1e293b; display: block; }
        .qty-subtitle { font-size: 0.95rem; color: var(--text-muted); margin: 4px 0 0; font-weight: 600; }

        .qty-controls { display: flex; align-items: center; gap: 24px; }
        .qty-btn-minus, .qty-btn-plus { 
          width: 56px; height: 56px; border-radius: 20px; border: none; font-size: 2rem; 
          font-weight: 700; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
          display: flex; align-items: center; justify-content: center;
        }
        .qty-btn-minus { background: #f1f5f9; color: var(--text-main); }
        .qty-btn-minus:active { background: #e2e8f0; transform: scale(0.9); }
        
        .qty-btn-plus-blue { background: #eff6ff; color: #2563eb; }
        .qty-btn-plus-indigo { background: #eef2ff; color: var(--indigo); }
        .qty-btn-plus-emerald { background: #ecfdf5; color: var(--emerald); }
        .qty-btn-plus-orange { background: #fff7ed; color: var(--orange); }
        .qty-btn-plus:active { transform: scale(0.95); opacity: 0.8; }

        .qty-number { font-size: 1.75rem; font-weight: 900; width: 40px; text-align: center; color: var(--text-main); }

        .sleeve-card { margin-top: 40px; padding: 32px; background: #f8fafc; border-radius: 28px; border: 3px dashed #cbd5e1; }
        .sleeve-title { font-size: 1.1rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin: 0 0 24px; display: flex; align-items: center; gap: 10px; }
        .sleeve-footer { font-size: 1rem; color: var(--text-muted); font-style: italic; margin-top: 20px; font-weight: 500; }

        .footer { 
          position: fixed; bottom: 0; left: 0; right: 0; 
          background: rgba(255,255,255,0.95); backdrop-filter: blur(16px); 
          padding: 24px 40px; border-top: 2px solid #e2e8f0; z-index: 100; 
          box-shadow: 0 -15px 30px -5px rgba(0,0,0,0.1); 
        }
        .footer-content { 
          width: 100%; 
          max-width: 100%; 
          margin: 0 auto; 
          display: flex; 
          flex-direction: row; 
          justify-content: space-between; 
          align-items: center; 
          gap: 30px; 
        }
        
        @media (max-width: 640px) {
          .footer-content { flex-direction: column; text-align: center; gap: 20px; }
          .price-display { width: 100%; }
        }

        .price-display { flex: 1; }
        .price-label { font-size: 1rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
        .price-val { font-size: clamp(2.5rem, 6vw, 3.5rem); font-weight: 950; color: var(--primary); margin: 0; line-height: 1; display: flex; align-items: center; gap: 15px; }
        .item-count { font-size: 1.1rem; color: #1e293b; font-weight: 900; background: #f1f5f9; padding: 6px 16px; border-radius: 12px; }

        .btn-submit { 
          padding: 24px 60px; border-radius: 24px; font-size: 1.75rem; font-weight: 900; 
          border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          display: flex; align-items: center; justify-content: center; gap: 15px; 
          box-shadow: 0 15px 25px -5px rgba(34, 197, 94, 0.3); 
          min-width: 320px;
        }
        .btn-submit:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; box-shadow: none; transform: none; }
        .btn-submit:not(:disabled) { background: var(--green); color: var(--white); }
        .btn-submit:not(:disabled):hover { background: #15803d; transform: translateY(-4px); box-shadow: 0 20px 30px -10px rgba(34, 197, 94, 0.4); }

        .admin-trigger { position: fixed; top: 24px; right: 24px; color: #cbd5e1; border: none; background: transparent; cursor: pointer; transition: all 0.3s; z-index: 150; }
        .admin-trigger:hover { color: var(--primary); transform: rotate(15deg) scale(1.1); }

        .admin-panel { position: fixed; inset: 0; background: #f1f5f9; z-index: 200; padding: clamp(20px, 4vw, 40px); overflow-y: auto; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .table-container { background: var(--white); border-radius: 32px; overflow-x: auto; box-shadow: var(--shadow-lg); border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background: var(--primary); color: var(--white); padding: 24px; font-weight: 800; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.05em; }
        td { padding: 24px; border-bottom: 1px solid #f1f5f9; font-size: 1.05rem; }
        
        .badge { display: inline-block; padding: 6px 12px; border-radius: 10px; font-weight: 800; margin-right: 8px; font-size: 0.85rem; text-transform: uppercase; }
        .badge-indigo { background: #eef2ff; color: var(--indigo); border: 2px solid #e0e7ff; }
        .badge-emerald { background: #ecfdf5; color: var(--emerald); border: 2px solid #d1fae5; }

        .success-screen { position: fixed; inset: 0; background: #f0fdf4; display: flex; align-items: center; justify-content: center; z-index: 300; padding: 24px; animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .success-card { background: var(--white); padding: 60px; border-radius: 48px; text-align: center; max-width: 520px; width: 100%; border-bottom: 15px solid var(--green); box-shadow: 0 35px 70px -15px rgba(0,0,0,0.2); }
        .success-icon { width: 120px; height: 120px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px; color: var(--green); }
        
        .btn-restart { width: 100%; padding: 24px; border-radius: 24px; font-size: 1.5rem; font-weight: 800; border: none; background: #1e293b; color: var(--white); cursor: pointer; transition: 0.3s ease; }
        .btn-restart:hover { background: #0f172a; transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }

        .error-msg { text-align: center; color: var(--red); font-weight: 800; font-size: 1.1rem; margin-top: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <button onClick={() => setView('admin')} className="admin-trigger"><Database size={40}/></button>

      {view === 'admin' ? (
        <div className="admin-panel">
          <div className="admin-header">
            <h1 style={{fontSize: '2.5rem', fontStyle: 'normal', fontWeight: 900}}><Database size={40} style={{verticalAlign: 'middle', marginRight: '15px'}} color="var(--primary)"/> Data Pesanan</h1>
            <button onClick={() => setView('user')} style={{background: '#1e293b', color: 'white', padding: '15px 30px', borderRadius: '20px', border: 'none', fontStyle: 'normal', fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--shadow)'}}>Tutup Admin</button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pendaftar</th>
                  <th>Baju & Ukuran</th>
                  <th>Aksesori</th>
                  <th style={{textAlign: 'right'}}>Total Harga</th>
                  <th style={{textAlign: 'center'}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {responses.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign: 'center', padding: '80px', color: '#94a3b8', fontSize: '1.5rem', fontStyle: 'normal', fontWeight: 600}}>Belum ada pesanan masuk.</td></tr>
                ) : responses.map(order => (
                  <tr key={order.id}>
                    <td>
                      <div style={{fontWeight: 800, color: '#1e293b', fontSize: '1.25rem', fontStyle: 'normal'}}>{order.nama}</div>
                      <div style={{fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontStyle: 'normal', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 700}}>{order.wilayah}</div>
                    </td>
                    <td>
                      <div style={{marginBottom: '10px'}}>
                        {Object.entries(order.polo || {}).filter(([_, q]) => q > 0).map(([s, q]) => (
                          <span key={s} className="badge badge-indigo">Polo {s}:{q}</span>
                        ))}
                      </div>
                      <div>
                        {Object.entries(order.kaos || {}).filter(([_, q]) => q > 0).map(([s, q]) => (
                          <span key={s} className="badge badge-emerald">Kaos {s}:{q}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{fontSize: '1rem', fontStyle: 'normal', fontWeight: 700, color: '#475569'}}>
                      {order.topi > 0 && <div>Topi: {order.topi}</div>}
                      {order.mug > 0 && <div>Mug: {order.mug}</div>}
                    </td>
                    <td style={{textAlign: 'right', fontStyle: 'normal', fontWeight: 900, color: 'var(--primary)', fontSize: '1.5rem'}}>Rp {order.totalHarga?.toLocaleString()}</td>
                    <td style={{textAlign: 'center'}}>
                      {deleteConfirmId === order.id ? (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center'}}>
                          <button onClick={() => deleteOrder(order.id)} style={{background: 'var(--red)', color: 'white', fontSize: '0.8rem', padding: '8px 16px', borderRadius: '10px', border: 'none', fontStyle: 'normal', fontWeight: 900}}>HAPUS</button>
                          <button onClick={() => setDeleteConfirmId(null)} style={{fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'underline', border: 'none', background: 'transparent', fontStyle: 'normal', fontWeight: 700}}>Batal</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(order.id)} style={{color: '#fca5a5', border: 'none', background: 'transparent', cursor: 'pointer', transition: '0.2s'}}><Trash2 size={32}/></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : submitted ? (
        <div className="success-screen">
          <div className="success-card">
            <div className="success-icon"><CheckCircle size={80} /></div>
            <h1 style={{fontSize: '3rem', fontStyle: 'normal', fontWeight: 950, marginBottom: '15px'}}>Berhasil!</h1>
            <p style={{fontSize: '1.5rem', color: '#64748b', marginBottom: '40px', fontWeight: 600}}>Data pesanan Anda sudah masuk ke sistem kami.</p>
            <button 
              onClick={() => {
                setSubmitted(false);
                setFormData({nama:'', wilayah:'', polo:{}, lenganPanjangPolo:0, lenganKerutPolo:0, kaos:{}, lenganPanjangKaos:0, lenganKerutKaos:0, topi:0, mug:0});
              }}
              className="btn-restart"
            >
              Buat Pesanan Baru
            </button>
          </div>
        </div>
      ) : (
        <div className="container">
          <header className="header">
            <h1>Form Pesanan</h1>
            <p>Silakan isi identitas dan pilih pesanan Anda di bawah ini.</p>
          </header>

          {/* Identitas */}
          <div className="card">
            <h2 className="section-title"><User color="var(--primary)" size={40}/> Identitas Anda</h2>
            <div className="grid-inputs">
              <div className="input-wrapper">
                <label>Nama Lengkap</label>
                <input 
                  type="text" 
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})}
                  className="input-field" 
                  placeholder="Contoh: Budi Santoso"
                />
              </div>
              <div className="input-wrapper">
                <label>Wilayah / Cabang</label>
                <input 
                  type="text" 
                  value={formData.wilayah} 
                  onChange={(e) => setFormData({...formData, wilayah: e.target.value})}
                  className="input-field" 
                  placeholder="Contoh: Jakarta Selatan"
                />
              </div>
            </div>
          </div>

          {/* Polo Section */}
          <div className="card card-indigo">
            <h2 className="section-title"><Package color="var(--indigo)" size={40}/> Pesanan Polo (Rp 85rb)</h2>
            <div className="sizes-grid">
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
                  colorClass="indigo"
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

          {/* Kaos Section */}
          <div className="card card-emerald">
            <h2 className="section-title"><Package color="var(--emerald)" size={40}/> Pesanan Kaos (Rp 75rb)</h2>
            <div className="sizes-grid">
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
                  colorClass="emerald"
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

          {/* Aksesori Section */}
          <div className="card card-orange">
            <h2 className="section-title"><ShoppingCart color="var(--orange)" size={40}/> Aksesori Tambahan</h2>
            <div className="sizes-grid">
              <QuantitySelector label="Topi (Rp 35rb)" value={formData.topi} onChange={(v) => setFormData({...formData, topi: v})} colorClass="orange" />
              <QuantitySelector label="Mug (Rp 25rb)" value={formData.mug} onChange={(v) => setFormData({...formData, mug: v})} colorClass="orange" />
            </div>
          </div>

          {/* Footer - Price & Submit */}
          <div className="footer">
            <div className="footer-content">
              <div className="price-display">
                <p className="price-label">Estimasi Total Pembayaran</p>
                <div className="price-val">
                  Rp {calculateTotalHarga().toLocaleString()}
                  <span className="item-count">{totalItems} Item</span>
                </div>
              </div>
              <button 
                onClick={handleSubmit}
                disabled={loading || totalItems === 0 || !formData.nama || !formData.wilayah}
                className="btn-submit"
              >
                {loading ? <Loader2 style={{animation: 'spin 1s linear infinite'}} size={40} /> : <><Send size={40}/> KIRIM PESANAN</>}
              </button>
            </div>
            {error && <p className="error-msg"><AlertCircle size={24}/> {error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}