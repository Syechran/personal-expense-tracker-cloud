import { useState, useEffect } from "react";
import { Banknote, ChevronDown, Utensils, Car, ShoppingBag, Zap, Tv } from "lucide-react";
import { apiFetch } from "../api";

export default function Overview() {
  const [overviewTab, setOverviewTab] = useState("statistics");
  const [statFilter, setStatFilter] = useState("income");
  const [selectedBalance, setSelectedBalance] = useState("Total Balance");
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);

  // --- 1. STATE UNTUK DATA ASLI DARI DATABASE ---
  const [transactions, setTransactions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().getDate()); // Default tanggal hari ini
  const [currentMonthView, setCurrentMonthView] = useState(new Date());

  // State untuk tab Statistics
  const [statMonthView, setStatMonthView] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(null);

  // Daftar rekening diambil dari backend, bukan localStorage
  const [balanceCategories, setBalanceCategories] = useState(["Total Balance"]);

  // --- 2. FETCH DATA DARI BACKEND ---
  useEffect(() => {
    let isCancelled = false;

    Promise.all([apiFetch("/api/transactions"), apiFetch("/api/accounts")])
      .then(([transactionResult, accountResult]) => {
        if (isCancelled) return;

        const fetchedData = Array.isArray(transactionResult.data)
          ? transactionResult.data
          : [];
        const accountNames = (accountResult.data || []).map(
          (account) => account.name
        );

        setTransactions(fetchedData);
        setBalanceCategories(["Total Balance", ...accountNames]);
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Gagal ambil data:", error);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // --- 3. LOGIKA PEMROSESAN DATA ---

    // A. Filter berdasarkan Dropdown "Balance Category" (Kanan atas)
    const transactionsByBalance = transactions.filter(trx =>
      selectedBalance === "Total Balance" ? true : trx.balance === selectedBalance
    );

    // D. Fungsi pembantu untuk mengambil angka tanggal dari string "April 06, 2026"
    const getDayFromDate = (dateString) => {
      if (!dateString) return null;
      const parts = String(dateString).split(" ");
      if (parts.length >= 2 && parts[1]) {
        return parseInt(parts[1].replace(",", ""), 10);
      }
      return null;
    };

    const getMonthAndYearFromDate = (dateString) => {
      if (!dateString) return null;
      const parts = String(dateString).split(" ");
      if (parts.length >= 3) {
        return { month: parts[0], year: parseInt(parts[2], 10) };
      }
      return null;
    };

    // Bulan aktif berdasarkan tab yang sedang dibuka
    const activeMonthView = overviewTab === 'statistics' ? statMonthView : currentMonthView;
    const activeMonthName = activeMonthView.toLocaleString('en-US', { month: 'long' });
    const activeYear = activeMonthView.getFullYear();

    // B. Hitung Total untuk Summary Cards (Kotak Hitam di Atas) - HANYA UNTUK BULAN AKTIF
    let totalIncome = 0;
    let totalExpenses = 0;
    transactionsByBalance.forEach(trx => {
      const parsed = getMonthAndYearFromDate(trx.date);
      if (parsed && parsed.month === activeMonthName && parsed.year === activeYear) {
        const amt = parseInt(trx.amount) || 0;
        if (amt > 0) totalIncome += amt;
        else totalExpenses += Math.abs(amt);
      }
    });

    // --- LOGIKA STATISTICS ---
    const statMonthName = statMonthView.toLocaleString('en-US', { month: 'long' });
    const statYear = statMonthView.getFullYear();

    // Filter transaksi untuk bulan yang dipilih di Statistics
    const currentMonthStatTransactions = transactionsByBalance.filter(trx => {
      const parsed = getMonthAndYearFromDate(trx.date);
      return parsed && parsed.month === statMonthName && parsed.year === statYear;
    });

    const weeklyData = [
      { week: 1, income: 0, expense: 0 },
      { week: 2, income: 0, expense: 0 },
      { week: 3, income: 0, expense: 0 },
      { week: 4, income: 0, expense: 0 },
    ];

    let maxChartValue = 0;

    // Kelompokkan transaksi ke dalam minggu yang sesuai (HANYA BULAN INI)
    currentMonthStatTransactions.forEach((trx) => {
      const day = getDayFromDate(trx.date);
      if (!day) return;

      let weekIndex = 0;
      if (day > 7 && day <= 14) weekIndex = 1;
      else if (day > 14 && day <= 21) weekIndex = 2;
      else if (day > 21) weekIndex = 3;

      const amt = parseInt(trx.amount) || 0;
      if (amt > 0) {
        weeklyData[weekIndex].income += amt;
      } else {
        weeklyData[weekIndex].expense += Math.abs(amt);
      }
    });

    weeklyData.forEach(w => {
      if (w.income > maxChartValue) maxChartValue = w.income;
      if (w.expense > maxChartValue) maxChartValue = w.expense;
    });
    if (maxChartValue === 0) maxChartValue = 1;

    // C. Filter untuk List di tab "Statistics" (berdasarkan tombol Income/Expenses dan week)
    const statisticsList = currentMonthStatTransactions.filter(trx => {
      const amt = parseInt(trx.amount) || 0;
      const isCorrectType = statFilter === "income" ? amt > 0 : amt < 0;
      if (!isCorrectType) return false;

      if (selectedWeek !== null) {
        const day = getDayFromDate(trx.date);
        let weekIndex = 0;
        if (day > 7 && day <= 14) weekIndex = 1;
        else if (day > 14 && day <= 21) weekIndex = 2;
        else if (day > 21) weekIndex = 3;

        return weekIndex === (selectedWeek - 1);
      }
      return true;
    });

    // --- LOGIKA KALENDER ---
    const currentYear = currentMonthView.getFullYear();
    const currentMonth = currentMonthView.getMonth(); // 0 (Jan) sampai 11 (Des)
    const monthName = currentMonthView.toLocaleString('en-US', { month: 'long' });

    // Filter transaksi untuk bulan yang dipilih di Kalender
    const currentMonthCalendarTransactions = transactionsByBalance.filter(trx => {
      const parsed = getMonthAndYearFromDate(trx.date);
      return parsed && parsed.month === monthName && parsed.year === currentYear;
    });

    // E. Ambil tanggal berapa saja yang punya transaksi bulan ini (untuk titik merah di Kalender)
    const transactionDates = currentMonthCalendarTransactions
      .map(trx => getDayFromDate(trx.date))
      .filter(day => day !== null);

    // F. Ambil transaksi khusus untuk hari yang sedang di-klik di Kalender
    const calendarTransactions = currentMonthCalendarTransactions.filter(trx =>
      getDayFromDate(trx.date) === selectedDate
    );

    // Hitung total uang masuk/keluar di hari yang dipilih tersebut
    let dailyTotal = 0;
    calendarTransactions.forEach(trx => {
      dailyTotal += (parseInt(trx.amount) || 0);
    });

    // 1. Cari tahu bulan ini ada berapa hari
    const daysInMonthCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

    // 2. Cari tahu tanggal 1 jatuh di hari apa?
    let firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const emptyBoxes = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    // 3. Fungsi untuk tombol navigasi bulan
    const handlePrevMonth = () => {
      setCurrentMonthView(new Date(currentYear, currentMonth - 1, 1));
      setSelectedDate(null);
    };

    const handleNextMonth = () => {
      setCurrentMonthView(new Date(currentYear, currentMonth + 1, 1));
      setSelectedDate(null);
    };

    const handlePrevStatMonth = () => {
      setStatMonthView(new Date(statYear, statMonthView.getMonth() - 1, 1));
      setSelectedWeek(null);
    };

    const handleNextStatMonth = () => {
      setStatMonthView(new Date(statYear, statMonthView.getMonth() + 1, 1));
      setSelectedWeek(null);
    };

    // Fungsi Render Icon Dinamis
    const renderIcon = (category) => {
      switch (category) {
        case "Food": return <Utensils size={24} color="white" />;
        case "Transport": return <Car size={24} color="white" />;
        case "Shoppings": return <ShoppingBag size={24} color="white" />;
        case "Utilities": return <Zap size={24} color="white" />;
        case "Entertainment": return <Tv size={24} color="white" />;
        default: return <Banknote size={24} color="white" />;
      }
    };

    return (
      <div className="screen-content">
        <header className="header">
          <h1>Overview</h1>
        </header>

        {/* TOP SUMMARY CARDS (Sekarang Datanya Dinamis) */}
        <section className="overview-summary">
          <div className="summary-card">
            <span className="summary-label">Total Income</span>
            <h3 className="summary-value">Rp{totalIncome.toLocaleString("id-ID")}</h3>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Expenses</span>
            <h3 className="summary-value">Rp{totalExpenses.toLocaleString("id-ID")}</h3>
          </div>
        </section>

        {/* TABS & BALANCE DROPDOWN */}
        <section className="overview-header-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", marginBottom: "24px" }}>
          <div className="overview-tabs" style={{ padding: 0, marginBottom: 0, borderBottom: "none" }}>
            <span className={`tab-item ${overviewTab === "statistics" ? "active" : ""}`} onClick={() => setOverviewTab("statistics")}>
              Statistics
            </span>
            <span className={`tab-item ${overviewTab === "calendar" ? "active" : ""}`} onClick={() => setOverviewTab("calendar")}>
              Calender
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <div className="overview-balance-btn" onClick={() => setIsBalanceOpen(!isBalanceOpen)}>
              <span>{selectedBalance === "Total Balance" ? "All" : selectedBalance}</span>
              <ChevronDown size={14} style={{ transform: isBalanceOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </div>

            {isBalanceOpen && (
              <div className="balance-dropdown-list" style={{ top: "35px", right: "0", left: "auto", minWidth: "120px", zIndex: 20 }}>
                {balanceCategories.map((item) => (
                  <div key={item} className={`dropdown-item ${selectedBalance === item ? "active" : ""}`} onClick={() => { setSelectedBalance(item); setIsBalanceOpen(false); }}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CONTENT AREA */}
        <div className="tab-content-area">

          {/* === TAMPILAN: STATISTICS === */}
          {overviewTab === "statistics" && (
            <div className="statistics-content">

              {/* Header Kalender untuk Statistics */}
              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "20px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span onClick={handlePrevStatMonth} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>&lt;</span>
                  <h3 style={{ margin: 0, fontSize: "16px" }}>{statMonthName} {statYear}</h3>
                  <span onClick={handleNextStatMonth} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>&gt;</span>
                </div>
              </div>

              {/* Bar Chart Dinamis */}
              <div className="chart-area" style={{ marginBottom: "40px" }}>
                <div className="y-axis">
                  <span>Rp3jt</span><span>Rp2jt</span><span>Rp1jt</span><span>Rp500k</span><span>Rp0</span>
                </div>
                <div className="bars-container">
                  <div className="chart-grid-line line-1jt"></div>
                  <div className="chart-grid-line line-2jt"></div>
                  <div className="chart-grid-line line-3jt"></div>

                  {/* Looping data mingguan untuk membuat batang grafik yang merespon data */}
                  {weeklyData.map((data) => {
                    const incPercent = (data.income / maxChartValue) * 100;
                    const expPercent = (data.expense / maxChartValue) * 100;

                    return (
                      <div
                        className="bar-group"
                        key={`week-${data.week}`}
                        onClick={() => setSelectedWeek(selectedWeek === data.week ? null : data.week)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="bar bar-inc" style={{ height: `${incPercent}%`, transition: "height 0.5s ease" }}></div>
                        <div className="bar bar-exp" style={{ height: `${expPercent}%`, transition: "height 0.5s ease" }}></div>

                        <div style={{ position: "absolute", bottom: "-30px", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: "10px", color: "#888", whiteSpace: "nowrap" }}>week {data.week}</span>
                          {/* Indikator Pill untuk minggu yang dipilih */}
                          <div style={{
                            height: "4px",
                            width: "30px",
                            backgroundColor: selectedWeek === data.week ? "black" : "transparent",
                            borderRadius: "4px",
                            marginTop: "2px",
                            transition: "background-color 0.2s ease"
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable frame untuk filter + list transaksi statistics */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
                <div className="stat-filters">
                  <button className={`filter-btn ${statFilter === "income" ? "active" : ""}`} onClick={() => setStatFilter("income")}>Income</button>
                  <button className={`filter-btn ${statFilter === "expenses" ? "active" : ""}`} onClick={() => setStatFilter("expenses")}>Expenses</button>
                </div>

                {/* List Transaksi Statistics Dinamis */}
                <div className="transaction-list">
                  {statisticsList.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>Belum ada data.</p>
                  ) : (
                    statisticsList.map((trx) => (
                      <div className="transaction-item" key={trx.id}>
                        <div className="transaction-icon-box">{renderIcon(trx.category)}</div>
                        <div className="transaction-info">
                          <p className="transaction-title">{trx.title}</p>
                          <p className="transaction-type">{trx.type}</p>
                        </div>
                        <div className="transaction-amount-data">
                          <p className={trx.amount > 0 ? "amount-positive" : "amount-negative"}>
                            {trx.amount > 0 ? "+" : ""}Rp{Math.abs(trx.amount).toLocaleString("id-ID")}
                          </p>
                          <p className="transaction-date">{trx.date}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === TAMPILAN: CALENDAR === */}
          {overviewTab === "calendar" && (
            <div className="calendar-content">
              {/* HEADER KALENDER: < Bulan > Tahun */}
              <div className="calendar-month-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>

                {/* Bagian Kiri: Navigasi Bulan */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span onClick={handlePrevMonth} style={{ cursor: "pointer", fontSize: "18px", fontWeight: "bold" }}>&lt;</span>
                  <h3 style={{ margin: 0 }}>{monthName}</h3>
                  <span onClick={handleNextMonth} style={{ cursor: "pointer", fontSize: "18px", fontWeight: "bold" }}>&gt;</span>
                </div>

                {/* Bagian Kanan: Tahun */}
                <h3 style={{ margin: 0, fontWeight: "normal" }}>{currentYear}</h3>

              </div>

              <div className="calendar-grid">
                {/* 1. Header Hari (Sekarang dimulai dari Sunday / Su) */}
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="cal-day-name">{day}</div>
                ))}

                {/* 2. Kotak Kosong Pendorong Tanggal 1 (Diberi &nbsp; agar tidak collapse) */}
                {emptyBoxes.map((_, index) => (
                  <div key={`empty-${index}`} className="cal-day-box empty">&nbsp;</div>
                ))}

                {/* 3. Render angka tanggal seperti biasa */}
                {daysInMonth.map((num) => (
                  <div
                    key={num}
                    className={`cal-day-box ${num === selectedDate ? "active" : ""}`}
                    onClick={() => setSelectedDate(num)}
                  >
                    <span className="cal-date-num">{num}</span>
                    {transactionDates.includes(num) && <div className="cal-dot"></div>}
                  </div>
                ))}
              </div>

              {/* Scrollable frame untuk summary + list transaksi kalender */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
                <div className="calendar-daily-summary">
                  <h4>Date: {selectedDate}</h4>
                  <span className={dailyTotal > 0 ? "amount-positive" : "daily-total-expense"}>
                    {dailyTotal > 0 ? "+" : ""}Rp{Math.abs(dailyTotal).toLocaleString("id-ID")}
                  </span>
                </div>

                {/* List Transaksi Calendar Dinamis */}
                <div className="transaction-list">
                  {calendarTransactions.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>Tidak ada transaksi di hari ini.</p>
                  ) : (
                    calendarTransactions.map((trx) => (
                      <div className="transaction-item" key={trx.id}>
                        <div className="transaction-icon-box">{renderIcon(trx.category)}</div>
                        <div className="transaction-info">
                          <p className="transaction-title">{trx.title}</p>
                          <p className="transaction-type">{trx.type}</p>
                        </div>
                        <div className="transaction-amount-data">
                          <p className={trx.amount > 0 ? "amount-positive" : "amount-negative"}>
                            {trx.amount > 0 ? "+" : ""}Rp{Math.abs(trx.amount).toLocaleString("id-ID")}
                          </p>
                          <p className="transaction-date">{trx.date}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
}