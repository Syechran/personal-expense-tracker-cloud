import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Utensils,
  ShoppingBag,
  Zap,
  Car,
  Tv,
  ChevronDown,
  Banknote,
} from "lucide-react";
import { apiFetch } from "../api";

const CATEGORY_ICONS = {
  Food: <Utensils size={20} />,
  Shoppings: <ShoppingBag size={20} />,
  Utilities: <Zap size={20} />,
  Transport: <Car size={20} />,
  Entertainment: <Tv size={20} />,
  Other: <Banknote size={20} />,
};

function readDraft(key) {
  try {
    const rawDraft = localStorage.getItem(key);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch {
    return null;
  }
}

export default function AddTransaction({ onClose, user }) {
  const draftKey = `txDraft:${user?.id ?? "guest"}`;
  const [initialDraft] = useState(() => readDraft(draftKey));

  const [isClosing, setIsClosing] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [amount, setAmount] = useState(initialDraft?.amount || "");
  const [description, setDescription] = useState(
    initialDraft?.description || ""
  );
  const [reportType, setReportType] = useState(
    initialDraft?.reportType || "Income"
  );
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categoryId, setCategoryId] = useState(
    initialDraft?.categoryId ?? null
  );
  const [accountId, setAccountId] = useState(initialDraft?.accountId ?? null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedAccount = accounts.find((item) => item.id === accountId);

  const handleBack = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleDraft = () => {
    const draftData = {
      amount,
      description,
      reportType,
      categoryId,
      accountId,
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    handleBack();
  };

  const handleSave = async () => {
    const cleanAmount = parseInt(amount.replace(/\D/g, ""), 10) || 0;

    if (!selectedCategory || !selectedAccount) {
      alert("Pilih kategori dan rekening terlebih dahulu.");
      return;
    }

    if (cleanAmount <= 0) {
      alert("Nominal harus lebih dari 0.");
      return;
    }

    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const newTransaction = {
      title: description || "Tanpa Keterangan",
      amount: cleanAmount,
      report: reportType,
      date: today,
      categoryId,
      accountId,
    };

    setIsSaving(true);

    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify(newTransaction),
      });

      localStorage.removeItem(draftKey);
      setShowSuccessPopup(true);
    } catch (error) {
      console.error("Error saving:", error);
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAmountChange = (e) => {
    const rawValue = e.target.value;
    const numericValue = rawValue.replace(/\D/g, "");

    if (!numericValue) {
      setAmount("");
      return;
    }

    const formattedNumber = new Intl.NumberFormat("id-ID").format(numericValue);
    setAmount(`Rp${formattedNumber}`);
  };

  useEffect(() => {
    let isCancelled = false;

    Promise.all([apiFetch("/api/categories"), apiFetch("/api/accounts")])
      .then(([categoryResult, accountResult]) => {
        if (isCancelled) return;

        const categoryList = categoryResult.data || [];
        const accountList = accountResult.data || [];

        setCategories(categoryList);
        setAccounts(accountList);
        setCategoryId(
          (previous) =>
            previous ??
            categoryList.find((item) => item.name === "Transport")?.id ??
            categoryList[0]?.id ??
            null
        );
        setAccountId(
          (previous) =>
            previous ??
            accountList.find((item) => item.name === "Bank")?.id ??
            accountList[0]?.id ??
            null
        );
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Gagal memuat pilihan:", error);
          alert("Gagal memuat kategori/rekening: " + error.message);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingOptions(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="add-transaction-overlay">
      <div className={`add-tx-modal ${isClosing ? "closing" : ""}`}>
        <div className="back-btn-container" onClick={handleBack}>
          <ChevronLeft size={24} />
          <span className="back-text">Back</span>
        </div>
        <h2 className="modal-title">Transaction</h2>

        <div className="tx-input-box">
          <label className="tx-input-name">Amount</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Rp0"
            value={amount}
            onChange={handleAmountChange}
            className="tx-input-field amount-text"
          />
        </div>

        <div className="tx-input-box">
          <label className="tx-input-name">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="tx-input-field desc-text"
            placeholder="..."
          />
        </div>

        <div className="tx-section">
          <h4 className="section-label">Category</h4>
          <div className="category-grid">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`category-item ${categoryId === cat.id ? "active" : ""}`}
                onClick={() => setCategoryId(cat.id)}
              >
                {CATEGORY_ICONS[cat.name] || <Banknote size={20} />}
                <span>{cat.name}</span>
              </div>
            ))}
          </div>
          {!isLoadingOptions && categories.length === 0 && (
            <p className="options-empty">Belum ada kategori.</p>
          )}
        </div>

        <div className="tx-section">
          <h4 className="section-label">Report</h4>
          <div className="report-toggle-container">
            <button
              className={`report-btn ${reportType === "Income" ? "active" : ""}`}
              onClick={() => setReportType("Income")}
            >
              Income
            </button>
            <button
              className={`report-btn ${reportType === "Expenses" ? "active" : ""}`}
              onClick={() => setReportType("Expenses")}
            >
              Expenses
            </button>
          </div>
        </div>

        <div className="tx-section" style={{ position: 'relative' }}> 
          <h4 className="section-label">Balance Category</h4>
          
          <div 
            className="balance-select-btn" 
            onClick={() => setIsBalanceOpen(!isBalanceOpen)}
          >
            <span>{selectedAccount?.name || "Pilih rekening"}</span>
            <ChevronDown 
              size={18} 
              style={{ 
                marginLeft: 'auto', 
                transform: isBalanceOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s' 
              }} 
            />
          </div>

          {isBalanceOpen && (
            <div className="balance-dropdown-list">
              {accounts.map((item) => (
                <div 
                  key={item.id} 
                  className={`dropdown-item ${accountId === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setAccountId(item.id); 
                    setIsBalanceOpen(false); 
                  }}
                >
                  {item.name}
                </div>
              ))}
              {!isLoadingOptions && accounts.length === 0 && (
                <div className="dropdown-item">Belum ada rekening</div>
              )}
            </div>
          )}
        </div>

        <div className="tx-actions">
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={isSaving || isLoadingOptions}
          >
            {isSaving ? "Menyimpan..." : "Save"}
          </button>
          <button className="btn-draft" onClick={handleDraft}>
            Draft
          </button>
        </div>
      </div>

      {/* CUSTOM SUCCESS POPUP */}
      {showSuccessPopup && (
        <div className="custom-popup-overlay">
          <div className="custom-popup" style={{ alignItems: "center" }}>
            <div style={{ backgroundColor: "#2ecc71", width: "48px", height: "48px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "8px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 className="custom-popup-title">Yeay!</h3>
            <p className="custom-popup-desc">Transaksi berhasil disimpan.</p>
            <div className="custom-popup-actions" style={{ width: "100%" }}>
              <button 
                className="popup-btn confirm" 
                onClick={() => {
                  setShowSuccessPopup(false);
                  handleBack();
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}