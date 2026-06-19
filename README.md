# ZUPIUM 🌌
AI Chat Assistant — gelap·biru, cepat, gratis, bisa diakses publik.

Stack: **Flask (Python)** + **Groq API** (otak AI-nya, gratis & super cepat) + **HTML/CSS/JS** (frontend, dark-blue theme, markdown + syntax highlighting, multi-conversation history).

---

## 1. Jalankan di komputer kamu dulu

### a. Dapatkan API Key Groq (gratis)
1. Buka https://console.groq.com
2. Daftar/login (bisa pakai Google)
3. Masuk ke menu **API Keys** → **Create API Key**
4. Salin key-nya (formatnya `gsk_...`)

> Groq gratis, modelnya (Llama 3.3 70B) jalan di hardware khusus (LPU) makanya balasannya sangat cepat — hampir instan, jauh dari "lag".

### b. Setup project
```bash
cd zupium
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Buat file `.env` (copy dari `.env.example`):
```
GROQ_API_KEY=gsk_isi_dengan_key_kamu
GROQ_MODEL=llama-3.3-70b-versatile
PORT=5000
```

### c. Jalankan
```bash
python app.py
```
Buka `http://localhost:5000` di browser. Selesai — ZUPIUM jalan lokal.

---

## 2. Deploy ke publik, GRATIS, tanpa kartu kredit

Rekomendasi: **Render.com** (free tier, paling gampang untuk Flask).

### Langkah-langkah:
1. **Push project ke GitHub**
   ```bash
   git init
   git add .
   git commit -m "ZUPIUM initial commit"
   ```
   Buat repo baru di GitHub, lalu:
   ```bash
   git remote add origin https://github.com/USERNAME/zupium.git
   git push -u origin main
   ```
   ⚠️ Pastikan file `.env` **tidak** ikut ter-push (sudah diatasi oleh `.gitignore`).

2. **Buat Web Service di Render**
   - Buka https://render.com → daftar/login (bisa pakai GitHub)
   - Klik **New +** → **Web Service**
   - Pilih repo `zupium` kamu
   - Isi konfigurasi:
     | Setting | Value |
     |---|---|
     | Runtime | Python 3 |
     | Build Command | `pip install -r requirements.txt` |
     | Start Command | `gunicorn app:app` |
     | Instance Type | **Free** |

3. **Set Environment Variable**
   Di tab **Environment**, tambahkan:
   - `GROQ_API_KEY` = key Groq kamu
   - `GROQ_MODEL` = `llama-3.3-70b-versatile`

4. Klik **Deploy**. Tunggu ~2-3 menit → kamu dapat URL publik seperti:
   `https://zupium.onrender.com`

   Itu sudah bisa diakses siapa saja, gratis, tanpa biaya.

### Alternatif lain (juga gratis)
- **Railway.app** — caranya hampir sama, kadang lebih cepat cold-start-nya.
- **Vercel** — cocok kalau mau full serverless, tapi butuh sedikit penyesuaian (Flask perlu wrapper WSGI khusus untuk Vercel). Render/Railway lebih simpel untuk Flask murni.

---

## 3. Soal "tidak lag"

ZUPIUM didesain cepat dengan 3 kunci:
- **Groq sebagai otak AI** — inference tercepat di kelasnya saat ini, jauh lebih cepat dari rata-rata API gratis lain.
- **Streaming response (SSE)** — token AI muncul sambil "mengetik", bukan nunggu jawaban penuh selesai dulu, jadi terasa instan.
- **Render free tier** akan "sleep" kalau tidak ada trafik 15 menit → request pertama setelah idle butuh ~30-50 detik untuk "bangun". Ini bukan lag aplikasi, tapi karakteristik free tier. Kalau mau benar-benar selalu standby 24/7 tanpa sleep, opsinya:
  - Pakai **uptime monitor gratis** (contoh: UptimeRobot) yang ping server kamu setiap 10 menit, supaya tidak sleep.
  - Atau upgrade ke paid tier kapan-kapan kalau trafiknya sudah besar.

---

## 4. Struktur project

```
zupium/
├── app.py                 # Backend Flask + Groq streaming
├── requirements.txt
├── Procfile                # untuk Render/Railway
├── runtime.txt
├── .env.example
├── templates/
│   └── index.html
└── static/
    ├── css/style.css       # tema gelap-biru
    └── js/app.js           # logic chat, history, streaming, markdown
```

## 5. Fitur yang sudah ada
- ✅ Multi-conversation history (tersimpan di `localStorage` browser pengguna)
- ✅ Markdown rendering (heading, list, bold, link, dst)
- ✅ Syntax highlighting untuk code block + tombol "Salin"
- ✅ Streaming jawaban real-time (efek mengetik)
- ✅ Responsive (mobile-friendly, sidebar collapsible)
- ✅ Tema gelap-biru dengan aksen gradient cyan→blue

## 6. Ide pengembangan selanjutnya (opsional)
- Tambah login user + simpan history di database (biar history ikut akun, bukan cuma per-browser)
- Rate limiting per-IP biar tidak disalahgunakan saat publik
- Voice input/output
- Upload gambar/file untuk dianalisis (perlu model vision)
