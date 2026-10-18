import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Utensils,
  Banknote,
  Car,
  MinusCircle,
  Trash2,
  Pencil
} from "lucide-react";
import { apiFetch } from "../api";

function calculateBalanceData(allTransactions, categories) {
  const freshBalance = {
    "Total Balance": { amount: 0, income: 0, expenses: 0 },
  };

  categories.forEach((category) => {
    freshBalance[category] = { amount: 0, income: 0, expenses: 0 };
  });

  allTransactions.forEach((trx) => {
    const amount = parseInt(trx.amount, 10) || 0;
    const balanceKey = trx.balance;

    if (freshBalance[balanceKey]) {
      freshBalance[balanceKey].amount += amount;
      if (amount > 0) freshBalance[balanceKey].income += amount;
      else freshBalance[balanceKey].expenses += Math.abs(amount);
    }

    freshBalance["Total Balance"].amount += amount;
    if (amount > 0) freshBalance["Total Balance"].income += amount;
    else freshBalance["Total Balance"].expenses += Math.abs(amount);
  });

  return freshBalance;
}

export default function Home({ user, onOpenProfile }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState("Total Balance");

  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // State untuk popup edit nominal
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editAmount, setEditAmount] = useState("");

  const [transactions, setTransactions] = useState([]);

  // States for swipe to delete
  const [swipedTransactionId, setSwipedTransactionId] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for See all toggle
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Daftar rekening sekarang berasal dari database (bukan localStorage)
  const [accounts, setAccounts] = useState([]);
  const [balanceCategories, setBalanceCategories] = useState([]);

  const [balanceData, setBalanceData] = useState({
    "Total Balance": { amount: 0, income: 0, expenses: 0 },
  });

  useEffect(() => {
    let isCancelled = false;

    Promise.all([apiFetch("/api/transactions"), apiFetch("/api/accounts")])
      .then(([transactionsResult, accountsResult]) => {
        if (isCancelled) return;

        const transactionData = transactionsResult.data || [];
        const accountData = accountsResult.data || [];
        const accountNames = accountData.map((account) => account.name);

        setTransactions(transactionData);
        setAccounts(accountData);
        setBalanceCategories(accountNames);
        setBalanceData(calculateBalanceData(transactionData, accountNames));
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Gagal ambil data:", error);
          alert("Gagal memuat data: " + error.message);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSelectBalance = (category) => {
    setSelectedBalance(category);
    setIsExpanded(false);
  };

  // Fungsi untuk menambah rekening baru
  const handleAddCategory = () => {
    setNewCategoryInput("");
    setShowAddPrompt(true);
  };

  const confirmAddCategory = async (newCategory) => {
    const trimmedCategory = String(newCategory || "").trim();

    if (!trimmedCategory) {
      setShowAddPrompt(false);
      return;
    }

    const isDuplicate = accounts.some(
      (account) =>
        account.name.toLowerCase() === trimmedCategory.toLowerCase()
    );

    if (isDuplicate) {
      alert("Rekening tersebut sudah ada!");
      return;
    }

    try {
      const result = await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name: trimmedCategory }),
      });
      const newAccount = result.data;
      const updatedAccounts = [...accounts, newAccount];
      const updatedNames = updatedAccounts.map((account) => account.name);

      setAccounts(updatedAccounts);
      setBalanceCategories(updatedNames);
      setBalanceData(calculateBalanceData(transactions, updatedNames));
      setNewCategoryInput("");
      setShowAddPrompt(false);
    } catch (error) {
      alert(error.message);
    }
  };

  // Fungsi untuk MENGHAPUS kategori
  const handleDeleteCategory = (e, categoryName) => {
    e.stopPropagation(); // Mencegah klik nyasar yang malah memilih kartu
    setCategoryToDelete(categoryName);
    setShowDeletePrompt(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    const account = accounts.find((item) => item.name === categoryToDelete);

    if (!account) {
      setShowDeletePrompt(false);
      setCategoryToDelete(null);
      return;
    }

    try {
      await apiFetch(`/api/accounts/${account.id}`, { method: "DELETE" });

      const updatedTransactions = transactions.map((trx) =>
        trx.accountId === account.id || trx.balance === account.name
          ? { ...trx, balance: "Tanpa Rekening", type: "Tanpa Rekening" }
          : trx
      );
      const updatedAccounts = accounts.filter(
        (item) => item.id !== account.id
      );
      const updatedNames = updatedAccounts.map((item) => item.name);

      setAccounts(updatedAccounts);
      setBalanceCategories(updatedNames);
      setTransactions(updatedTransactions);
      setBalanceData(calculateBalanceData(updatedTransactions, updatedNames));

      if (selectedBalance === categoryToDelete) {
        setSelectedBalance("Total Balance");
      }

      setShowDeletePrompt(false);
      setCategoryToDelete(null);
    } catch (error) {
      alert(error.message);
    }
  };

  // --- EDIT NOMINAL TRANSAKSI ---
  const handleEditTransaction = (trx) => {
    const displayValue = Math.abs(parseInt(trx.amount, 10) || 0);
    setEditAmount(`Rp${displayValue.toLocaleString("id-ID")}`);
    setEditingTransaction(trx);
  };

  const handleEditAmountChange = (e) => {
    const rawValue = e.target.value;
    const numericValue = rawValue.replace(/\D/g, "");

    if (!numericValue) {
      setEditAmount("");
      return;
    }

    const formattedNumber = new Intl.NumberFormat("id-ID").format(numericValue);
    setEditAmount(`Rp${formattedNumber}`);
  };

  const confirmEditTransaction = async () => {
    if (!editingTransaction) return;

    const cleanAmount = parseInt(editAmount.replace(/\D/g, ""), 10) || 0;
    const finalAmount = editingTransaction.report === "Expenses"
      ? -Math.abs(cleanAmount)
      : Math.abs(cleanAmount);

    try {
      const result = await apiFetch(
        `/api/transactions/${editingTransaction.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ amount: finalAmount }),
        }
      );

      const updatedTransactions = transactions.map((trx) =>
        trx.id === result.data.id ? result.data : trx
      );

      setTransactions(updatedTransactions);
      setBalanceData(calculateBalanceData(updatedTransactions, balanceCategories));
      setEditingTransaction(null);
    } catch (error) {
      console.error("Error editing:", error);
      alert(error.message);
    }
  };

  // --- SWIPE TO DELETE LOGIC ---
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e, id) => {
    const touchCurrentX = e.touches[0].clientX;
    const diff = touchCurrentX - touchStartX;
    
    // Geser ke kanan (swipe right) memunculkan tombol hapus
    if (diff > 50) {
      setSwipedTransactionId(id);
    } 
    // Geser ke kiri menyembunyikan tombol hapus
    else if (diff < -50 && swipedTransactionId === id) {
      setSwipedTransactionId(null);
    }
  };

  // --- FILTER TRANSAKSI UNTUK BULAN INI ---
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();

  const getMonthAndYearFromDate = (dateString) => {
    if (!dateString) return null;
    const parts = String(dateString).split(" ");
    if (parts.length >= 3) {
      return { month: parts[0], year: parseInt(parts[2], 10) };
    }
    return null;
  };

  const filteredTransactions = showAllTransactions 
    ? transactions 
    : transactions.filter(trx => {
        const parsed = getMonthAndYearFromDate(trx.date);
        return parsed && parsed.month === currentMonthName && parsed.year === currentYear;
      });

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Yakin ingin menghapus transaksi ini?")) return;
    
    setIsDeleting(true);
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });

      const updatedTransactions = transactions.filter((trx) => trx.id !== id);
      setTransactions(updatedTransactions);
      setBalanceData(calculateBalanceData(updatedTransactions, balanceCategories));
      setSwipedTransactionId(null);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="screen-content">
      <header className="header home-header">
        <div>
          <h1>Home</h1>
          <p className="header-user">{user?.name}</p>
        </div>
        <button
          className="header-avatar"
          type="button"
          onClick={onOpenProfile}
          aria-label="Buka profile"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" />
          ) : (
            <span>
              {(user?.name || "?")
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")
                .toUpperCase() || "?"}
            </span>
          )}
        </button>
      </header>

{/* BALANCE CARD */}
      <section className={`balance-card ${isExpanded ? "expanded" : ""}`}>
        {/* HEADER */}
        <div className="balance-header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: "pointer" }}>
          <span className="balance-label">
            {selectedBalance} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
          <h2 className="total-amount">
            Rp{balanceData[selectedBalance]?.amount.toLocaleString("id-ID") ?? 0}
          </h2>
        </div>

        {/* LOGIKA TOGGLE: Tampilan Default (Collapsed) */}
          <div className={`balance-summary ${isExpanded ? "hidden" : ""}`}>
          <div className="summary-item">
            <span className="summary-label">Income</span>
            <span className="summary-value">Rp{balanceData[selectedBalance]?.income.toLocaleString("id-ID") ?? 0}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Expenses</span>
            <span className="summary-value">Rp{balanceData[selectedBalance]?.expenses.toLocaleString("id-ID") ?? 0}</span>
          </div>
        </div>

{/* LOGIKA TOGGLE: Tampilan Detail (Expanded) */}
        {/* Kita atur class 'hidden' aktif saat isExpanded = false */}
        <div className={`balance-details ${isExpanded ? "" : "hidden"}`}>
          
          <div className="balance-list-scrollable">
          {selectedBalance !== "Total Balance" && (
            <div className="detail-item" onClick={() => handleSelectBalance("Total Balance")} style={{ cursor: "pointer" }}>
              <span className="detail-label">Total Balance</span>
              <span className="detail-value">Rp{balanceData["Total Balance"].amount.toLocaleString("id-ID")}</span>
            </div>
          )}

          {balanceCategories.filter(cat => cat !== "Total Balance").map((key) => {
            return (
              <div 
                className="detail-item" 
                key={key} 
                onClick={() => handleSelectBalance(key)} 
                style={{ cursor: "pointer", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                {/* Bagian Teks (Kiri) */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <span className="detail-label">{key}</span>
                  <span className="detail-value">Rp{balanceData[key].amount.toLocaleString("id-ID")}</span>
                </div>
                
                {/* Tombol Hapus (Kanan) */}
                <MinusCircle 
                  size={20} 
                  color="#ffffff" 
                  onClick={(e) => handleDeleteCategory(e, key)}
                />
              </div>
            );
          })}
          </div>

          <button 
            className="add-category-btn" 
            style={{ marginTop: "12px", flexShrink: 0 }}
            onClick={handleAddCategory} 
          >
            <Plus size={16} /> Add Balance Category
          </button>
        </div>
      </section>

      {/* TRANSACTIONS SECTION */}
      <section className="transactions-section">
        <div className="section-header">
          <h3>Transactions</h3>
          <span 
            className="see-all" 
            onClick={() => setShowAllTransactions(!showAllTransactions)}
          >
            {showAllTransactions ? "Show less" : "See all"}
          </span>
        </div>
        <div className="transaction-list">
          {filteredTransactions.map((trx) => {
            let iconDisplay = <Banknote size={24} color="white" />; // default
            if (trx.category === "Food") iconDisplay = <Utensils size={24} color="white" />;
            if (trx.category === "Transport") iconDisplay = <Car size={24} color="white" />;

            return (
              <div 
                className="transaction-swipe-container" 
                key={trx.id}
                onTouchStart={handleTouchStart}
                onTouchMove={(e) => handleTouchMove(e, trx.id)}
              >
                {/* Tombol Hapus & Edit (Tersembunyi di kiri) */}
                <div className={`transaction-swipe-action ${swipedTransactionId === trx.id ? 'visible' : ''}`}>
                  <button 
                    className="delete-icon-btn" 
                    onClick={() => handleDeleteTransaction(trx.id)}
                    disabled={isDeleting}
                    style={{ opacity: isDeleting && swipedTransactionId === trx.id ? 0.5 : 1 }}
                  >
                    <Trash2 size={24} color={isDeleting && swipedTransactionId === trx.id ? "#888" : "#000"} />
                  </button>

                  <button 
                    className="edit-icon-btn" 
                    onClick={() => handleEditTransaction(trx)}
                  >
                    <Pencil size={20} color="#ffffff" />
                  </button>
                </div>

              
                

                {/* Konten Transaksi (Bergeser ke kanan saat di-swipe) */}
                <div 
                  className={`transaction-content-wrapper ${swipedTransactionId === trx.id ? 'swiped' : ''}`}
                  onClick={() => { if(swipedTransactionId === trx.id) setSwipedTransactionId(null) }}
                >
                  <div className="transaction-item">
                    <div className="transaction-icon-box">{iconDisplay}</div>
                    <div className="transaction-info">
                      <p className="transaction-title">{trx.title}</p>
                      <p className="transaction-type">{trx.type}</p>
                    </div>
                    <div className="transaction-amount-data">
                      <p
                        className={
                          trx.amount > 0 ? "amount-positive" : "amount-negative"
                        }
                      >
                        {trx.amount > 0 ? "+" : ""}Rp
                        {Math.abs(trx.amount).toLocaleString("id-ID")}
                      </p>
                      <p className="transaction-date">{trx.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CUSTOM PROMPT ADD CATEGORY */}
      {showAddPrompt && (
        <div className="custom-popup-overlay">
          <div className="custom-popup">
            <h3 className="custom-popup-title">Tambah Rekening</h3>
            <p className="custom-popup-desc">Masukkan nama rekening baru:</p>
            <input 
              type="text" 
              className="custom-popup-input"
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              placeholder="e.g. BCA, OVO, Gopay"
              autoFocus
            />
            <div className="custom-popup-actions">
              <button 
                className="popup-btn cancel" 
                onClick={() => setShowAddPrompt(false)}
              >
                Batal
              </button>
              <button 
                className="popup-btn confirm" 
                onClick={() => confirmAddCategory(newCategoryInput)}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE PROMPT */}
      {showDeletePrompt && (
        <div className="custom-popup-overlay">
          <div className="custom-popup">
            <h3 className="custom-popup-title">Hapus Rekening?</h3>
            <p className="custom-popup-desc">Yakin ingin menghapus rekening <b>"{categoryToDelete}"</b>?</p>
            <div className="custom-popup-actions">
              <button 
                className="popup-btn cancel" 
                onClick={() => setShowDeletePrompt(false)}
              >
                Batal
              </button>
              <button 
                className="popup-btn confirm" 
                onClick={confirmDeleteCategory}
                style={{ backgroundColor: "#e74c3c" }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM EDIT NOMINAL PROMPT */}
      {editingTransaction && (
        <div className="custom-popup-overlay">
          <div className="custom-popup">
            <h3 className="custom-popup-title">Edit Nominal</h3>
            <p className="custom-popup-desc">
              {editingTransaction.title} · {editingTransaction.report === "Expenses" ? "Pengeluaran" : "Pemasukan"}
            </p>
            <input 
              type="text"
              inputMode="numeric"
              className="custom-popup-input"
              value={editAmount}
              onChange={handleEditAmountChange}
              placeholder="Rp0"
              autoFocus
            />
            <div className="custom-popup-actions">
              <button 
                className="popup-btn cancel" 
                onClick={() => setEditingTransaction(null)}
              >
                Batal
              </button>
              <button 
                className="popup-btn confirm" 
                onClick={confirmEditTransaction}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
