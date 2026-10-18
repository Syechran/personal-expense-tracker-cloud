import { useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LogOut,
  Pencil,
} from "lucide-react";
import { apiFetch } from "../api";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 512 * 1024;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto tidak bisa dibaca."));
    image.src = source;
  });
}

async function makeAvatarDataUrl(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const size = Math.min(image.naturalWidth, image.naturalHeight);

    if (!size) {
      throw new Error("Ukuran foto tidak valid.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Browser tidak mendukung pengolahan foto.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(
      image,
      (image.naturalWidth - size) / 2,
      (image.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256
    );

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Profile({ user, onUserUpdate, onLogout, onBack }) {
  const fileInputRef = useRef(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isExporting, setIsExporting] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const initials =
    (user?.name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  const openNameEditor = () => {
    setNameInput(user?.name || "");
    setError("");
    setNotice("");
    setIsEditingName(true);
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setError("");
    setNotice("");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Format foto harus JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > MAX_SOURCE_BYTES) {
      setError("Ukuran file foto maksimal 5 MB.");
      return;
    }

    setIsUploading(true);

    try {
      const dataUrl = await makeAvatarDataUrl(file);
      const base64Length = dataUrl.length - dataUrl.indexOf(",") - 1;
      const estimatedBytes = Math.ceil((base64Length * 3) / 4);

      if (estimatedBytes > MAX_AVATAR_BYTES) {
        throw new Error("Foto masih terlalu besar setelah dikompres.");
      }

      const result = await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar: dataUrl }),
      });

      onUserUpdate(result.data);
      setNotice("Foto profil berhasil diperbarui.");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveName = async (event) => {
    event.preventDefault();
    const name = nameInput.trim();

    if (!name) {
      setError("Nama tidak boleh kosong.");
      return;
    }

    setIsSavingName(true);
    setError("");

    try {
      const result = await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });

      onUserUpdate(result.data);
      setIsEditingName(false);
      setNotice("Nama berhasil diperbarui.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleExport = async (days) => {
    setIsExporting(days);
    setError("");

    try {
      const response = await fetch(`/api/transactions/export?days=${days}`, {
        credentials: "include",
      });

      if (response.status === 401) {
        window.dispatchEvent(new Event("auth:expired"));
        throw new Error("Sesi berakhir. Silakan masuk kembali.");
      }

      if (!response.ok) {
        let message = "Gagal mengunduh file Excel.";

        try {
          const payload = await response.json();
          message = payload.message || message;
        } catch {
          // Respons bukan JSON; gunakan pesan default.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const filename = `transaksi-${days}hari-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setIsExportOpen(false);
      setNotice(`Data ${days} hari terakhir berhasil diunduh.`);
    } catch (exportError) {
      setError(exportError.message);
    } finally {
      setIsExporting(null);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await onLogout();
    setIsLoggingOut(false);
  };

  return (
    <div className="screen-content profile-screen">
      <header className="header profile-header">
        <button
          className="profile-back"
          type="button"
          onClick={onBack}
          aria-label="Kembali ke Home"
        >
          <ChevronLeft size={24} />
        </button>
        <h1>Account</h1>
        <span className="profile-header-spacer" />
      </header>

      <section className="profile-hero">
        <button
          className="profile-avatar"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Ubah foto profil"
        >
          <span className="profile-avatar-image">
            {user?.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <span>{initials}</span>
            )}
          </span>
          <span className="avatar-badge">
            <Camera size={15} />
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarChange}
          hidden
        />

        <h2>{user?.name}</h2>
        <p>{user?.email}</p>
        {isUploading && <p className="profile-uploading">Mengunggah foto...</p>}
      </section>

      <div className="profile-menu">
        <button className="profile-row" type="button" onClick={openNameEditor}>
          <Pencil size={18} />
          <span className="profile-row-label">Edit Profile</span>
          <ChevronRight size={18} className="profile-chevron" />
        </button>

        <button
          className="profile-row"
          type="button"
          onClick={() => {
            setError("");
            setNotice("");
            setIsExportOpen(true);
          }}
        >
          <FileSpreadsheet size={18} />
          <span className="profile-row-label">Export ke Excel</span>
          <ChevronRight size={18} className="profile-chevron" />
        </button>

        <button
          className="profile-row danger"
          type="button"
          onClick={() => {
            setError("");
            setNotice("");
            setIsLogoutOpen(true);
          }}
        >
          <LogOut size={18} />
          <span className="profile-row-label">Logout</span>
          <ChevronRight size={18} className="profile-chevron" />
        </button>
      </div>

      {notice && <p className="profile-notice">{notice}</p>}
      {error && <p className="profile-error">{error}</p>}

      {isEditingName && (
        <div className="custom-popup-overlay">
          <form className="custom-popup" onSubmit={handleSaveName}>
            <h3 className="custom-popup-title">Edit Profile</h3>
            <p className="custom-popup-desc">Ubah nama yang tampil di aplikasi.</p>
            <input
              type="text"
              className="custom-popup-input"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              maxLength={60}
              autoFocus
            />
            {error && <p className="auth-error">{error}</p>}
            <div className="custom-popup-actions">
              <button
                className="popup-btn cancel"
                type="button"
                onClick={() => setIsEditingName(false)}
                disabled={isSavingName}
              >
                Batal
              </button>
              <button
                className="popup-btn confirm"
                type="submit"
                disabled={isSavingName}
              >
                {isSavingName ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isExportOpen && (
        <div className="custom-popup-overlay">
          <div className="custom-popup">
            <h3 className="custom-popup-title">Export ke Excel</h3>
            <p className="custom-popup-desc">
              Pilih rentang transaksi yang ingin diunduh.
            </p>
            <div className="export-options">
              <button
                className="export-option"
                type="button"
                onClick={() => handleExport(7)}
                disabled={isExporting !== null}
              >
                {isExporting === 7 ? "Menyiapkan..." : "7 hari terakhir"}
              </button>
              <button
                className="export-option"
                type="button"
                onClick={() => handleExport(30)}
                disabled={isExporting !== null}
              >
                {isExporting === 30 ? "Menyiapkan..." : "30 hari terakhir"}
              </button>
            </div>
            {error && <p className="auth-error">{error}</p>}
            <div className="custom-popup-actions">
              <button
                className="popup-btn cancel"
                type="button"
                onClick={() => setIsExportOpen(false)}
                disabled={isExporting !== null}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {isLogoutOpen && (
        <div className="custom-popup-overlay">
          <div className="custom-popup">
            <h3 className="custom-popup-title">Logout?</h3>
            <p className="custom-popup-desc">
              Kamu perlu masuk kembali untuk membuka aplikasi.
            </p>
            <div className="custom-popup-actions">
              <button
                className="popup-btn cancel"
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                disabled={isLoggingOut}
              >
                Batal
              </button>
              <button
                className="popup-btn confirm"
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{ backgroundColor: "#e74c3c" }}
              >
                {isLoggingOut ? "Keluar..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
