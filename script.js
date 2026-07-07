//======================================================
// 1. KONFIGURASI & VARIABEL GLOBAL
//======================================================

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVW8Egd_kGlEMBT9Px6L9azaap_1Gxq_T3R460P7oKFoVhtfPbR2K4YHyNQVDVavg2/exec";

let daftarItem = [];
let dataBarang = [];
let total = 0;
let sudahDibayar = false;
let kasir = "";

// Sinkronisasi Data dari Cloud
let nomorTransaksi = 1; 
let riwayatTransaksi = []; 
let grafikLaporan = null; // Variabel grafik

//======================================================
// 2. INISIALISASI SAAT APLIKASI DIBUKA
//======================================================

window.onload = function () {
    tampilkanTanggal();
    ambilNamaKasir();
    
    // ⚡ Memuat Cache Barang agar langsung tampil (Instan)
    let cacheBarang = localStorage.getItem("cacheDataBarang");
    if (cacheBarang) {
        dataBarang = JSON.parse(cacheBarang);
        isiDropdownDanTabel(dataBarang);
    }
    
    // ⚡ Memuat Cache Riwayat agar Dashboard langsung tampil (Instan)
    let cacheRiwayat = localStorage.getItem("cacheDataRiwayat");
    if (cacheRiwayat) {
        riwayatTransaksi = JSON.parse(cacheRiwayat);
        nomorTransaksi = riwayatTransaksi.length + 1;
        let elNomor = document.getElementById("nomorTransaksi");
        if(elNomor) elNomor.innerHTML = "Transaksi #" + nomorTransaksi;
        
        tampilkanRiwayat();
        tampilkanRekapHariIni();
        updateDashboard();
    }
    
    // Tarik data terbaru dari Server di latar belakang
    ambilBarangDariSheet();
    ambilRiwayatDariSheet();
};

//======================================================
// 3. NAVIGASI MENU
//======================================================

function bukaMenu(menu) {
    // Sembunyikan semua menu terlebih dahulu
    let dashboard = document.getElementById("menuDashboard");
    if(dashboard) dashboard.style.display = "none";
    
    document.getElementById("menuKasir").style.display = "none";
    document.getElementById("menuBarang").style.display = "none";
    document.getElementById("menuLaporan").style.display = "none";
    document.getElementById("menuPengaturan").style.display = "none";

    // 🔌 SAKLAR OFF: Matikan kamera scanner jika kasir keluar dari Menu Kasir
    if (menu !== "kasir" && scannerKamera) {
        scannerKamera.clear().catch(err => console.log("Scanner dinonaktifkan."));
    }

    // Tampilkan menu yang dipilih
    if (menu == "dashboard") {
        if(dashboard) dashboard.style.display = "block";
        updateDashboard();
    }
    else if (menu == "kasir") {
        document.getElementById("menuKasir").style.display = "block";
        // 🔌 SAKLAR ON: Otomatis nyalakan kamera saat masuk menu kasir (diberi jeda mikro 100ms agar DOM siap)
        setTimeout(nyalakanScannerKamera, 100);
    }
    else if (menu == "barang") {
        document.getElementById("menuBarang").style.display = "block";
        tampilkanDataBarang();
    }
    else if (menu == "laporan") {
        document.getElementById("menuLaporan").style.display = "block";
        inisialisasiLaporan();
    }
   // ... (kode atas fungsi bukaMenu tetap sama) ...
    else if (menu == "pengaturan") {
        document.getElementById("menuPengaturan").style.display = "block";
        muatPengaturanToko(); // ⚡ Panggil fungsi pengisi form otomatis di sini
    }

}

//======================================================
// 5. TRANSAKSI KASIR
//======================================================

function simpanNamaKasir() {
    let namaKasir = document.getElementById("namaKasir").value;
    localStorage.setItem("namaKasir", namaKasir);
}

function ambilNamaKasir() {
    let namaKasir = localStorage.getItem("namaKasir");
    if (namaKasir !== null) {
        document.getElementById("namaKasir").value = namaKasir;
    }
}

function transaksiBaru() {
    daftarItem = [];
    total = 0;
    sudahDibayar = false;

    nomorTransaksi = riwayatTransaksi.length + 1;
    tampilkanTanggal();

    let elNomor = document.getElementById("nomorTransaksi");
    if(elNomor) elNomor.innerHTML = "Transaksi #" + nomorTransaksi;

    document.getElementById("tombolBayar").disabled = false;
    document.getElementById("tombolBayar").innerHTML = "Bayar";
    document.getElementById("tombolPrint").disabled = true;
    document.getElementById("tombolTambahBarang").disabled = false;

    document.getElementById("daftarBelanja").innerHTML = "";
    document.getElementById("totalBelanja").innerHTML = "Total Belanja: Rp 0";
    document.getElementById("uangBayar").value = "";
    document.getElementById("hasilKembalian").innerHTML = "Kembalian: Rp 0";
    document.getElementById("struk").innerHTML = "Belum ada struk.";

    kosongkanInputBarang();
    bukaInputTransaksi();
    tampilkanDaftarBelanja();
    updateTotalBelanja();
}

function updateTotalBelanja() {
    document.getElementById("totalBelanja").innerHTML = "Total Belanja: " + formatRupiah(total);
}

function tampilkanDaftarBelanja() {
    let tempat = document.getElementById("daftarBelanja");
    tempat.innerHTML = "";

    daftarItem.forEach(function(item, index) {
        let sisaStok = "-";
        if (item.stok !== "" && item.stok !== undefined) {
            sisaStok = Number(item.stok) - Number(item.jumlah);
        }

        let statusStok = "";
        if (sisaStok !== "-") {
            if (sisaStok < 0) statusStok = " <span style='color:#c54a38; font-weight:bold;'>🔴 Perlu Restok</span>";
            else if (sisaStok <= 5) statusStok = " <span style='color:#d69a2d; font-weight:bold;'>🟡 Hampir Habis</span>";
            else statusStok = " <span style='color:#146b5c;'>🟢</span>";
        }

        let teksLaba = (item.modal > 0) ? formatRupiah(item.laba) : "<span style='color:var(--red); font-size:12px;'>Modal belum diatur</span>";

        tempat.innerHTML +=
            "<div class='item-belanja'>" +
            "<strong>" + item.nama + "</strong><br>" +
            item.jumlah + " x " + formatRupiah(item.harga) +
            " = <strong>" + formatRupiah(item.subtotal) + "</strong>" +
            "<br>" +
            "Sisa Stok: " + sisaStok + statusStok +
            "<br>" +
            "Laba: " + teksLaba +
            "<br>" +
            "<button class='tombol-item' onclick='kurangiItem(" + index + ")'>-</button>" +
            "<button class='tombol-item' onclick='tambahItem(" + index + ")'>+</button>" +
            "<button class='tombol-hapus' onclick='hapusItem(" + index + ")'>Hapus</button>" +
            "</div>";
    });
}

function hitungUlangTotal() {
    total = 0;
    daftarItem.forEach(function(item) {
        total += item.subtotal;
    });
}

function kurangiItem(index) {
    if (daftarItem[index].jumlah <= 1) {
        hapusItem(index);
        return;
    }
    daftarItem[index].jumlah--;
    daftarItem[index].subtotal = daftarItem[index].harga * daftarItem[index].jumlah;
    daftarItem[index].laba = (daftarItem[index].modal > 0) ? (daftarItem[index].harga - daftarItem[index].modal) * daftarItem[index].jumlah : 0;

    hitungUlangTotal();
    tampilkanDaftarBelanja();
    updateTotalBelanja();
}

function tambahItem(index) {
    let item = daftarItem[index];
    item.jumlah++;
    item.subtotal = item.harga * item.jumlah;
    item.laba = (item.modal > 0) ? (item.harga - item.modal) * item.jumlah : 0;

    hitungUlangTotal();
    tampilkanDaftarBelanja();
    updateTotalBelanja();
}

function hapusItem(index) {
    daftarItem.splice(index, 1);
    hitungUlangTotal();
    tampilkanDaftarBelanja();
    updateTotalBelanja();
}

function kunciInputTransaksi() {
    document.getElementById("pilihBarang").disabled = true;
    document.getElementById("namaBarang").disabled = true;
    document.getElementById("hargaBarang").disabled = true;
    document.getElementById("stokBarang").disabled = true;
    document.getElementById("jumlahBeli").disabled = true;
    document.getElementById("uangBayar").disabled = true;
}

function bukaInputTransaksi() {
    document.getElementById("pilihBarang").disabled = false;
    document.getElementById("namaBarang").disabled = false;
    document.getElementById("hargaBarang").disabled = false;
    document.getElementById("stokBarang").disabled = false;
    document.getElementById("jumlahBeli").disabled = false;
    document.getElementById("uangBayar").disabled = false;
}

function kosongkanInputBarang() {
    let pilihBarang = document.getElementById("pilihBarang");
    if(pilihBarang) pilihBarang.value = "";
    document.getElementById("namaBarang").value = "";
    document.getElementById("hargaBarang").value = "";
    document.getElementById("jumlahBeli").value = "";
    document.getElementById("stokBarang").value = "";
    if(document.getElementById("tambahStokBarang")) document.getElementById("tambahStokBarang").value = "";
    
    let inputNama = document.getElementById("namaBarang");
    inputNama.removeAttribute("data-kode");
    inputNama.removeAttribute("data-kategori");
    inputNama.removeAttribute("data-modal");
}

function tambahBarang() {
    if (sudahDibayar) {
        alert("Transaksi sudah dibayar. Klik Transaksi Baru untuk mulai.");
        return;
    }

    let nama = document.getElementById("namaBarang").value.trim();
    let harga = Number(document.getElementById("hargaBarang").value);
    let jumlah = Number(document.getElementById("jumlahBeli").value);
    let stok = document.getElementById("stokBarang").value;
    let kode = document.getElementById("namaBarang").getAttribute("data-kode") || "";
    let modal = Number(document.getElementById("namaBarang").getAttribute("data-modal") || 0);
    
    let laba = (modal > 0) ? (harga - modal) * jumlah : 0;

    if (nama === "" || harga <= 0 || jumlah <= 0) {
        alert("Nama barang, harga, dan jumlah wajib diisi.");
        return;
    }
    
    let subtotal = harga * jumlah;
    let barangSudahAda = daftarItem.find(function(item) {
        return item.nama.toLowerCase() === nama.toLowerCase();
    });

    if (barangSudahAda) {
        let jumlahBaru = barangSudahAda.jumlah + jumlah;
        if (stok !== "" && jumlahBaru > Number(stok)) {
            alert("Stok tidak mencukupi. Sisa stok: " + stok);
            return;
        }
        barangSudahAda.jumlah = jumlahBaru;
        barangSudahAda.subtotal = barangSudahAda.harga * barangSudahAda.jumlah;
        barangSudahAda.laba = (barangSudahAda.modal > 0) ? (barangSudahAda.harga - barangSudahAda.modal) * barangSudahAda.jumlah : 0;
    } else {
        daftarItem.push({
            kode: kode,
            nama: nama,
            harga: harga,
            modal: modal,
            jumlah: jumlah,
            stok: stok,
            stokAwal: stok,
            subtotal: subtotal,
            laba: laba
        });
    }

    hitungUlangTotal();
    tampilkanDaftarBelanja();
    updateTotalBelanja();
    kosongkanInputBarang();
    // ⚡ OPTIMASI TOUCH: Kembalikan fokus ke input nama barang/pencarian
    // Supaya kasir bisa langsung ketik barang kedua tanpa sentuh layar lagi
    setTimeout(() => {
        document.getElementById("namaBarang").focus();
    }, 50);
}

//======================================================
// 6. MASTER BARANG (SINKRONISASI GOOGLE SHEETS)
//======================================================

function ambilBarangDariSheet() {
    let elStatus = document.getElementById("statusSinkron");
    if (elStatus) {
        elStatus.innerHTML = "🔄 Menyinkronkan data...";
        elStatus.classList.add("show", "loading");
    }

    window.terimaDataBarang = function(data) {
        dataBarang = data;
        localStorage.setItem("cacheDataBarang", JSON.stringify(data));
        isiDropdownDanTabel(dataBarang);
        updateDashboard();
        
        if (elStatus) {
            elStatus.innerHTML = "✅ Data Sinkron";
            elStatus.classList.remove("loading");
            setTimeout(() => elStatus.classList.remove("show"), 2000);
        }
    };

    let lama = document.getElementById("loadBarang");
    if (lama) lama.remove();

    let script = document.createElement("script");
    script.id = "loadBarang";
    script.src = WEB_APP_URL + "?callback=terimaDataBarang";
    document.body.appendChild(script);
}

function isiDropdownDanTabel(data) {
    let select = document.getElementById("pilihBarang");
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Pilih Barang --</option>';

    data.forEach(function(barang) {
        if (!barang.nama || !barang.harga) return;
        
        let option = document.createElement("option");
        option.value = `${barang.kode}|${barang.nama}|${barang.harga}|${barang.kategori}|${barang.stok}|${barang.modal}`;
        option.textContent = barang.nama;
        select.appendChild(option);
    });

    buatDatalistBarang();
    
    if(document.getElementById("menuBarang").style.display === "block") {
        tampilkanDataBarang();
    }
}

function buatDatalistBarang() {
    let select = document.getElementById("pilihBarang");
    let datalist = document.getElementById("daftarBarang");
    if (!datalist) return;
    
    datalist.innerHTML = "";
    for (let i = 1; i < select.options.length; i++) {
        let data = select.options[i].value.split("|");
        let nama = data.length >= 5 ? data[1] : data[0];
        if (nama) datalist.innerHTML += `<option value="${nama}">`;
    }
}

function isiBarangOtomatis() {
    let pilihan = document.getElementById("pilihBarang").value;
    if (pilihan === "") return;

    let data = pilihan.split("|");
    document.getElementById("namaBarang").value = data[1];
    document.getElementById("hargaBarang").value = Number(data[2]);
    document.getElementById("stokBarang").value = data[4] === "" ? "" : data[4];
    
    // Default jumlah beli diatur ke 1
    let inputJumlah = document.getElementById("jumlahBeli");
    inputJumlah.value = 1;

    let inputNama = document.getElementById("namaBarang");
    inputNama.setAttribute("data-kode", data[0]);
    inputNama.setAttribute("data-kategori", data[3]);
    inputNama.setAttribute("data-modal", data[5] || 0);

    // ⚡ OPTIMASI TOUCH: Otomatis fokus dan blok teks di input jumlah beli
    // Jadi kasir tinggal ketik angka baru di keyboard HP tanpa perlu menghapus angka "1" terlebih dahulu
    setTimeout(() => {
        inputJumlah.focus();
        inputJumlah.select();
    }, 50);
}
function filterBarangKategori() {
    let kategoriDipilih = document.getElementById("filterKategori").value;
    let selectBarang = document.getElementById("pilihBarang");

    for (let i = 1; i < selectBarang.options.length; i++) {
        let data = selectBarang.options[i].value.split("|");
        let kategoriBarang = data.length >= 5 ? data[3] : data[2];

        if (kategoriDipilih === "Semua" || kategoriBarang === kategoriDipilih) {
            selectBarang.options[i].hidden = false;
        } else {
            selectBarang.options[i].hidden = true;
        }
    }
    selectBarang.value = "";
    kosongkanInputBarang();
}

function cariBarangDariKetik() {
    let inputNama = document.getElementById("namaBarang");
    let namaDiketik = inputNama.value.trim().toLowerCase();
    let select = document.getElementById("pilihBarang");

    if (namaDiketik === "") {
        kosongkanInputBarang();
        return;
    }

    for (let i = 1; i < select.options.length; i++) {
        let value = select.options[i].value;
        if (value === "") continue;

        let data = value.split("|");
        if (data[1] && data[1].toLowerCase() === namaDiketik) {
            document.getElementById("pilihBarang").value = value;
            document.getElementById("hargaBarang").value = Number(data[2]);
            document.getElementById("stokBarang").value = data[4] === "" ? "" : data[4];
            document.getElementById("jumlahBeli").value = 1;

            inputNama.setAttribute("data-kode", data[0]);
            inputNama.setAttribute("data-kategori", data[3]);
            inputNama.setAttribute("data-modal", data[5] || 0);
            return;
        }
    }
}

function tampilkanDataBarang() {
    let tbody = document.getElementById("bodyBarangMaster");
    if (!tbody) return;
    tbody.innerHTML = "";

    dataBarang.forEach(function(barang, index) {
        let modal = Number(barang.modal) || 0;
        let harga = Number(barang.harga) || 0;
        let laba = (modal > 0) ? (harga - modal) : 0;
        let stok = Number(barang.stok) || 0;
        
        let badgeClass = "badge-green";
        if (stok <= 0) badgeClass = "badge-red";
        else if (stok <= 5) badgeClass = "badge-yellow";

        let teksLaba = (modal > 0) ? formatRupiah(laba) : "<span style='color:var(--red); font-size:12px;'>-</span>";

        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="text-align: center;">${index + 1}</td>
            <td>${barang.kode || '-'}</td>
            <td title="${barang.nama}">${barang.nama}</td>
            <td>${barang.kategori || 'Lainnya'}</td>
            <td style="color: var(--muted);">${formatRupiah(modal)}</td>
            <td style="font-weight: bold;">${formatRupiah(harga)}</td>
            <td style="color: var(--green-dark); font-weight: bold;">${teksLaba}</td>
            <td style="text-align: center;"><span class="badge ${badgeClass}">${stok}</span></td>
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-mini btn-mini-edit" onclick="bukaModalEdit('${barang.kode}', '${barang.nama}', ${modal}, ${harga}, '${barang.kategori}')" title="Edit Barang">📝</button>
                    <button class="btn-mini btn-mini-stok" onclick="bukaModalStok('${barang.kode}', '${barang.nama}')" title="Tambah Stok">📦</button>
                    <button class="btn-mini btn-mini-hapus" onclick="bukaModalHapus('${barang.kode}', '${barang.nama}')" title="Hapus Barang">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ======================================================
// FUNGSI KONTROL CUSTOM MODAL
// ======================================================
function tutupModal() {
    document.getElementById("modalOverlay").style.display = "none";
}
function tutupModalBarang() {
    document.getElementById("modalBarang").style.display = "none";
}

// [BUG FIX 1] Sinkronisasi ID Modal Baru dengan HTML Terkini
function bukaModalBarang(mode) {
    document.getElementById("modalTitleBarang").innerText = "Tambah Barang Baru";
    document.getElementById("modalMode").value = mode || "tambah";
    document.getElementById("modalKodeLama").value = "";
    
    document.getElementById("modalKode").value = "";
    document.getElementById("modalNama").value = "";
    document.getElementById("modalKategori").value = "Makanan";
    document.getElementById("modalStok").value = "";
    document.getElementById("modalModal").value = "";
    document.getElementById("modalHarga").value = "";
    
    document.getElementById("modalBarang").style.display = "flex";
}

// [BUG FIX 2] Implementasi Payload Pengiriman Form CRUD Barang Baru / Update
function simpanBarangModal() {
    let mode = document.getElementById("modalMode").value;
    let kodeLama = document.getElementById("modalKodeLama").value;
    let kodeBaru = document.getElementById("modalKode").value;
    let nama = document.getElementById("modalNama").value.trim();
    let kategori = document.getElementById("modalKategori").value;
    let stok = document.getElementById("modalStok").value;
    let modalRp = document.getElementById("modalModal").value; 
    let harga = document.getElementById("modalHarga").value;   

    if(nama === "" || harga === "") {
        alert("Nama Barang dan Harga Jual wajib diisi!");
        return;
    }

    let payload = {
        tipe: (mode === "edit") ? "update_barang" : "barang_baru",
        kode: (mode === "edit") ? kodeLama : (kodeBaru || "BRG-" + Date.now()),
        nama: nama,
        kategori: kategori,
        stok: stok || 0,
        modal: modalRp || 0,
        harga: harga
    };
    
    tutupModalBarang();
    let elStatus = document.getElementById("statusSinkron");
    if (elStatus) {
        elStatus.innerHTML = "⏳ Memproses data...";
        elStatus.classList.add("show", "loading");
    }
    
    fetch(WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload)
    })
    .then(() => {
        alert("Data berhasil diproses ke server!");
        setTimeout(ambilBarangDariSheet, 2000);
    })
    .catch(err => {
        console.error("Gagal kirim:", err);
        if(elStatus) elStatus.classList.remove("show");
    });
}

function bukaModalEdit(kode, nama, modalLama, hargaLama, kategoriLama) {
    document.getElementById("modalTitleBarang").innerText = "Edit Data Barang";
    document.getElementById("modalMode").value = "edit";
    document.getElementById("modalKodeLama").value = kode;
    
    document.getElementById("modalKode").value = kode;
    document.getElementById("modalNama").value = nama;
    document.getElementById("modalKategori").value = kategoriLama || "Makanan";
    
    let targetBarang = dataBarang.find(b => b.kode === kode);
    document.getElementById("modalStok").value = targetBarang ? targetBarang.stok : 0;
    
    document.getElementById("modalModal").value = modalLama;
    document.getElementById("modalHarga").value = hargaLama;
    
    document.getElementById("modalBarang").style.display = "flex";
}

function bukaModalStok(kode, nama) {
    document.getElementById("modalTitleGeneral").innerText = "Tambah Stok";
    document.getElementById("modalBody").innerHTML = `
        <p>Barang: <strong>${nama}</strong></p>
        <div class="filter-group">
            <label>Jumlah Penambahan Stok</label>
            <input type="number" id="modTambahStok" placeholder="Contoh: 10">
        </div>
    `;
    document.getElementById("modalFooter").innerHTML = `
        <button class="secondary-button" onclick="tutupModal()">Batal</button>
        <button onclick="eksekusiTambahStok('${kode}', '${nama}')">Simpan Stok</button>
    `;
    document.getElementById("modalOverlay").style.display = "flex";
}

function eksekusiTambahStok(kode, nama) {
    let jumlah = Number(document.getElementById("modTambahStok").value);
    if (jumlah <= 0) return alert("Jumlah stok harus lebih dari 0!");
    
    tutupModal();
    let elStatus = document.getElementById("statusSinkron");
    if (elStatus) {
        elStatus.innerHTML = "⏳ Memproses data...";
        elStatus.classList.add("show", "loading");
    }
    
    window.responTambahStok = function(respons) { ambilBarangDariSheet(); };

    let scriptLama = document.getElementById("kirimStokMaster");
    if (scriptLama) scriptLama.remove();
    let url = WEB_APP_URL + `?callback=responTambahStok&tipe=tambah_stok&kode=${encodeURIComponent(kode)}&nama=${encodeURIComponent(nama)}&jumlahTambah=${jumlah}`;
    let script = document.createElement("script");
    script.id = "kirimStokMaster";
    script.src = url;
    document.body.appendChild(script);
}

function bukaModalHapus(kode, nama) {
    document.getElementById("modalTitleGeneral").innerText = "Hapus Barang";
    document.getElementById("modalBody").innerHTML = `
        <p>Apakah Anda yakin ingin menghapus <strong>${nama}</strong> dari database?</p>
        <p style="color: var(--red); font-size: 13px; margin-top:5px;">⚠️ Peringatan: Tindakan ini tidak dapat dibatalkan.</p>
    `;
    document.getElementById("modalFooter").innerHTML = `
        <button class="secondary-button" onclick="tutupModal()">Batal</button>
        <button class="danger-button" onclick="eksekusiHapus('${kode}')">Ya, Hapus</button>
    `;
    document.getElementById("modalOverlay").style.display = "flex";
}

function eksekusiHapus(kode) {
    tutupModal();
    let elStatus = document.getElementById("statusSinkron");
    if (elStatus) {
        elStatus.innerHTML = "⏳ Memproses data...";
        elStatus.classList.add("show", "loading");
    }
    fetch(WEB_APP_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipe: "remove_barang", kode: kode }) });
    setTimeout(ambilBarangDariSheet, 2000);
}

// [BUG FIX 3] Memperbaiki target pencarian index cell pencarian barang master
function filterBarangMaster() {
    let keyword = document.getElementById("cariBarangMaster").value.toLowerCase().trim();
    let kategori = document.getElementById("filterKategoriMaster").value;
    let tbody = document.getElementById("bodyBarangMaster");
    if (!tbody) return;
    
    let baris = tbody.getElementsByTagName("tr");
    for (let i = 0; i < baris.length; i++) {
        let cells = baris[i].getElementsByTagName("td");
        if (cells.length < 4) continue;

        let txtKode = cells[1].innerText.toLowerCase();
        let txtNama = cells[2].innerText.toLowerCase();
        let txtKategori = cells[3].innerText; 

        let cocokKeyword = txtKode.includes(keyword) || txtNama.includes(keyword);
        let cocokKategori = (kategori === "Semua" || txtKategori === kategori);

        baris[i].style.display = (cocokKeyword && cocokKategori) ? "" : "none";
    }
}

function tambahStokKeSheet() {
    let inputNama = document.getElementById("namaBarang");
    let kode = inputNama.getAttribute("data-kode") || "";
    let nama = inputNama.value.trim();
    let jumlah = Number(document.getElementById("tambahStokBarang").value || 0);
    
    if (nama === "" || kode === "") return alert("Pilih barang dari daftar terlebih dahulu!");
    if (jumlah <= 0) return alert("Jumlah stok harus lebih dari 0.");

    let elStatus = document.getElementById("statusSinkron");
    if (elStatus) {
        elStatus.innerHTML = "⏳ Memproses stok...";
        elStatus.classList.add("show", "loading");
    }

    window.responTambahStok = function(respons) {
        alert(`Berhasil menambah stok sebanyak ${jumlah} untuk ${nama}.`);
        ambilBarangDariSheet();
    };

    let scriptLama = document.getElementById("kirimStokMaster");
    if (scriptLama) scriptLama.remove();

    let url = WEB_APP_URL + `?callback=responTambahStok&tipe=tambah_stok&kode=${encodeURIComponent(kode)}&nama=${encodeURIComponent(nama)}&jumlahTambah=${jumlah}`;
    let script = document.createElement("script");
    script.id = "kirimStokMaster";
    script.src = url;
    document.body.appendChild(script);
    
    document.getElementById("tambahStokBarang").value = "";
}

//======================================================
// 7. PEMBAYARAN KASIR
//======================================================

function hitungKembalian() {
    if (sudahDibayar) return alert("Transaksi sudah dibayar.");

    let bayar = Number(document.getElementById("uangBayar").value);
    let kasirNama = document.getElementById("namaKasir").value;

    if (kasirNama === "") return alert("Nama kasir wajib diisi.");
    if (total <= 0) return alert("Keranjang kosong.");
    if (bayar < total) return alert("Uang bayar kurang.");

    let kembalian = bayar - total;
    document.getElementById("hasilKembalian").innerHTML = "Kembalian: " + formatRupiah(kembalian);

    buatStruk();

    sudahDibayar = true;
    document.getElementById("tombolBayar").disabled = true;
    document.getElementById("tombolBayar").innerHTML = "Sudah Dibayar";
    document.getElementById("tombolPrint").disabled = false;
    document.getElementById("tombolTambahBarang").disabled = true;
    
    kunciInputTransaksi();
    tampilkanDaftarBelanja();
}

function enterBayar(event) {
    if (event.key === "Enter") hitungKembalian();
}
function enterTambahBarang(event) {
    if (event.key === "Enter") tambahBarang();
}

function buatStruk() {
    let kasirNama = document.getElementById("namaKasir").value;
    let tanggal = document.getElementById("tanggalTransaksi").innerHTML;
    let bayar = Number(document.getElementById("uangBayar").value);
    let kembalian = bayar - total;
    let daftar = "";
    let totalLaba = hitungTotalLaba();

    // Ambil data profil toko secara real-time dari localStorage
    let namaToko = localStorage.getItem("setNamaToko") || "WARUNG BAROKAH TANJUNG";
    let alamatToko = localStorage.getItem("setAlamatToko") || "";
    let telpToko = localStorage.getItem("setTelpToko") || "";
    let footerToko = localStorage.getItem("setKakiStruk") || "Terima Kasih";

    // ⚡ AMBIL NOMOR TOKEN YANG DIKETIK KASIR
    let nomorToken = document.getElementById("nomorTokenListrik").value.trim();
    let barisToken = "";
    
    // Jika kasir mengisi nomor token, susun teksnya untuk struk
    if (nomorToken !== "") {
        barisToken = `--------------------------------\n` +
                     `⚡ NOMOR TOKEN PLN / VOUCHER:\n` +
                     `${nomorToken}\n`;
    }

    daftarItem.forEach(function(item) {
        daftar += `${item.nama}\n  ${item.jumlah} x ${formatRupiah(item.harga)} = ${formatRupiah(item.subtotal)}\n`;
    });

    // Susun struk belanja dinamis
    document.getElementById("struk").innerHTML =
        `${namaToko}\n` +
        `${alamatToko}\n` +
        `Telp: ${telpToko}\n` +
        `--------------------------------\n` +
        `No: Transaksi #${nomorTransaksi}\n` +
        `Tgl: ${tanggal}\n` +
        `Kasir: ${kasirNama}\n` +
        `--------------------------------\n` +
        daftar + 
        `--------------------------------\n` +
        `TOTAL     : ${formatRupiah(total)}\n` +
        `BAYAR     : ${formatRupiah(bayar)}\n` +
        `KEMBALIAN : ${formatRupiah(kembalian)}\n` +
        barisToken + // ⚡ Nomor token otomatis terselip di sini jika ada isinya
        `--------------------------------\n` +
        `${footerToko}\n`;

    // Kirim data ke Google Sheets
    let dataTransaksi = {
        tanggal: tanggal,
        kasir: kasirNama,
        daftar: daftar,
        total: total,
        bayar: bayar,
        kembalian: kembalian,
        totalLaba: totalLaba,
        token: nomorToken, // Tambahkan data token agar ikut terarsip di cloud jika perlu
        items: JSON.parse(JSON.stringify(daftarItem))
    };

    fetch(WEB_APP_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(dataTransaksi) });

    // Kosongkan kembali input token setelah transaksi selesai
    document.getElementById("nomorTokenListrik").value = "";

    setTimeout(function() {
        ambilBarangDariSheet();
        ambilRiwayatDariSheet();
    }, 2000);
}
//======================================================
// PHASE 5: MODUL PENGATURAN TOKO & STRUK DINAMIS
//======================================================

// Fungsi memuat data toko saat menu pengaturan dibuka
function muatPengaturanToko() {
    document.getElementById("setNamaToko").value = localStorage.getItem("setNamaToko") || "WARUNG BAROKAH TANJUNG";
    document.getElementById("setAlamatToko").value = localStorage.getItem("setAlamatToko") || "Jalan Wisata RT1 Tanjung Harapan";
    document.getElementById("setTelpToko").value = localStorage.getItem("setTelpToko") || "0812-5333-3996";
    document.getElementById("setKakiStruk").value = localStorage.getItem("setKakiStruk") || "Terima Kasih";
}

// Fungsi menyimpan data ke localStorage
function simpanPengaturanToko() {
    let nama = document.getElementById("setNamaToko").value.trim() || "WARUNG BAROKAH TANJUNG";
    let alamat = document.getElementById("setAlamatToko").value.trim() || "Jalan Wisata RT1 Tanjung Harapan";
    let telp = document.getElementById("setTelpToko").value.trim() || "0812-5333-3996";
    let footer = document.getElementById("setKakiStruk").value.trim() || "Terima Kasih";

    localStorage.setItem("setNamaToko", nama.toUpperCase());
    localStorage.setItem("setAlamatToko", alamat);
    localStorage.setItem("setTelpToko", telp);
    localStorage.setItem("setKakiStruk", footer);
    if(document.getElementById("namaTokoDashboard")) {
        document.getElementById("namaTokoDashboard").innerText = nama.toUpperCase();
    }
    
    alert("✅ Profil warung berhasil diperbarui!");
    updateDashboard(); //[cite: 3]

}

// Pemicu otomatis memuat data saat halaman dimuat pertama kali
let onloadLama = window.onload;
window.onload = function() {
    if (onloadLama) onloadLama();
    // Pastikan data default langsung tersimpan jika cache masih kosong
    if (!localStorage.getItem("setNamaToko")) {
    localStorage.setItem("setNamaToko", "WARUNG BAROKAH TANJUNG");
    localStorage.setItem("setAlamatToko", "Jln Nelayan RT1 Tanjung Harapan");
    localStorage.setItem("setTelpToko", "0812-5333-3996");
    localStorage.setItem("setKakiStruk", "Terima Kasih, Selamat Belanja Kembali");
}
};

//======================================================
// 8. RIWAYAT TRANSAKSI DARI CLOUD
//======================================================

function ambilRiwayatDariSheet() {
    window.terimaDataRiwayat = function(data) {
        riwayatTransaksi = data;
        localStorage.setItem("cacheDataRiwayat", JSON.stringify(data));
        
        nomorTransaksi = riwayatTransaksi.length + 1;
        let elNomor = document.getElementById("nomorTransaksi");
        if(elNomor) elNomor.innerHTML = "Transaksi #" + nomorTransaksi;
        
        tampilkanRiwayat();
        tampilkanRekapHariIni();
        updateDashboard();
        
        if(document.getElementById("menuLaporan").style.display === "block") {
            filterLaporan();
        }
    };

    let scriptLama = document.getElementById("loadRiwayat");
    if (scriptLama) scriptLama.remove();

    let script = document.createElement("script");
    script.id = "loadRiwayat";
    script.src = WEB_APP_URL + "?callback=terimaDataRiwayat&tipe=riwayat"; 
    document.body.appendChild(script);
}

function tampilkanRiwayat() {
    let tempat = document.getElementById("riwayat");
    if (!tempat) return;
    tempat.innerHTML = "";

    riwayatTransaksi.forEach(function(t, index) {
        let jumlahItem = 0;
        if (t.daftar && t.daftar.trim() !== "") {
            jumlahItem = t.daftar.trim().split('\n').length;
        }

        let baris = `
        <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>${t.tanggal}</td>
            <td>${t.kasir}</td>
            <td style="text-align: center;">${jumlahItem}</td>
            <td>${formatRupiah(t.total)}</td>
            <td style="color: #146b5c; font-weight: bold;">${formatRupiah(t.totalLaba || 0)}</td>
        </tr>
        `;
        tempat.innerHTML += baris;
    });
}

function hapusRiwayat() {
    alert("Data riwayat sekarang tersinkronisasi aman di sistem Cloud Google Sheets.\nPenghapusan manual dinonaktifkan untuk menjaga keamanan data.");
}

function tampilkanRekapHariIni() {
    let elJumlah = document.getElementById("jumlahTransaksiHariIni");
    let elOmzet = document.getElementById("omzetHariIni");
    if(!elJumlah || !elOmzet) return;

    let hariIni = new Date().toLocaleDateString("id-ID");
    let totalT = 0;
    let totalO = 0;

    riwayatTransaksi.forEach(function(t) {
        if (t.tanggal && t.tanggal.includes(hariIni)) {
            totalT++;
            totalO += Number(t.total || 0);
        }
    });

    elJumlah.innerHTML = "Jumlah Transaksi: " + totalT;
    elOmzet.innerHTML = "Omzet Hari Ini: " + formatRupiah(totalO);
}

//======================================================
// 9. MENU LAPORAN (FILTER & GRAFIK)
//======================================================

function inisialisasiLaporan() {
    setFilterCepat('hari_ini');
}

function setFilterCepat(tipe) {
    let tglAwal = document.getElementById("lapTanggalAwal");
    let tglAkhir = document.getElementById("lapTanggalAkhir");
    let hariIni = new Date();
    
    const formatDate = (dateObj) => dateObj.toISOString().split('T')[0];

    if (tipe === 'semua') {
        tglAwal.value = "";
        tglAkhir.value = "";
    } 
    else if (tipe === 'hari_ini') {
        tglAwal.value = formatDate(hariIni);
        tglAkhir.value = formatDate(hariIni);
    } 
    else if (tipe === 'minggu_ini') {
        let mingguLalu = new Date(hariIni);
        mingguLalu.setDate(hariIni.getDate() - 6);
        tglAwal.value = formatDate(mingguLalu);
        tglAkhir.value = formatDate(hariIni);
    } 
    else if (tipe === 'bulan_ini') {
        let awalBulan = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
        let akhirBulan = new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, 0);
        tglAwal.value = formatDate(awalBulan);
        tglAkhir.value = formatDate(akhirBulan);
    } 
    else if (tipe === 'tahun_ini') {
        let awalTahun = new Date(hariIni.getFullYear(), 0, 1);
        let akhirTahun = new Date(hariIni.getFullYear(), 11, 31);
        tglAwal.value = formatDate(awalTahun);
        tglAkhir.value = formatDate(akhirTahun);
    }
    filterLaporan();
}

function parseTanggalID(tglString) {
    if (!tglString) return new Date();
    
    // Pecah string jika mengandung koma (misal: "06/07/2026, 17.54.44")
    let murniTgl = tglString.split(',')[0].trim();
    let bagian = murniTgl.split('/');
    
    if (bagian.length === 3) {
        let hari = parseInt(bagian[0], 10);
        let bulan = parseInt(bagian[1], 10) - 1; // Bulan di JS dimulai dari indeks 0
        let tahun = parseInt(bagian[2], 10);
        return new Date(tahun, bulan, hari);
    }
    
    return new Date(tglString);
}

function filterLaporan() {
    let strAwal = document.getElementById("lapTanggalAwal").value;
    let strAkhir = document.getElementById("lapTanggalAkhir").value;

    let tglAwal = strAwal ? new Date(strAwal) : null;
    let tglAkhir = strAkhir ? new Date(strAkhir) : null;
    if (tglAwal) tglAwal.setHours(0, 0, 0, 0);
    if (tglAkhir) tglAkhir.setHours(23, 59, 59, 999);

    let riwayatData = JSON.parse(localStorage.getItem("cacheDataRiwayat")) || [];

    let dataTersaring = riwayatData.filter(function(t) {
        let tglTransaksi = parseTanggalID(t.tanggal);
        if (tglAwal && tglTransaksi < tglAwal) return false;
        if (tglAkhir && tglTransaksi > tglAkhir) return false;
        return true;
    });

    renderTabelLaporan(dataTersaring);
    renderGrafikPenjualan(dataTersaring);
}

function renderTabelLaporan(data) {
    let tbody = document.getElementById("bodyLaporan");
    if(!tbody) return;
    tbody.innerHTML = "";

    let totalOmzet = 0;
    let totalLaba = 0;
    let totalTransaksi = data.length;

    data.forEach(function(t) {
        let jumlahItem = 0;
        if (t.daftar && t.daftar.trim() !== "") jumlahItem = t.daftar.trim().split('\n').length;
        
        let omzet = Number(t.total) || 0;
        let laba = Number(t.totalLaba) || 0;
        totalOmzet += omzet;
        totalLaba += laba;

        let bagianTgl = t.tanggal.split(',');
        let tglPendek = bagianTgl[0];
        let jamPendek = bagianTgl[1] || "";

        tbody.innerHTML += `<tr>
            <td>${tglPendek} <span style="font-size:11px; color:#6d6a61;">${jamPendek}</span></td>
            <td>${t.kasir}</td>
            <td style="text-align: center;">${jumlahItem}</td>
            <td>${formatRupiah(omzet)}</td>
            <td style="color: var(--green-dark); font-weight: bold;">${formatRupiah(laba)}</td>
        </tr>`;
    });

    if (data.length === 0) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Belum ada transaksi.</td></tr>`;

    document.getElementById("lapOmzet").innerText = formatRupiah(totalOmzet);
    document.getElementById("lapLaba").innerText = formatRupiah(totalLaba);
    document.getElementById("lapTransaksi").innerText = totalTransaksi;
}

function renderGrafikPenjualan(dataTersaring) {
    let ctxEl = document.getElementById('grafikPenjualan');
    if(!ctxEl) return;
    let ctx = ctxEl.getContext('2d');
    
    let rekapHarian = {};
    dataTersaring.forEach(t => {
        let tgl = t.tanggal.split(',')[0];
        if (!rekapHarian[tgl]) rekapHarian[tgl] = 0;
        rekapHarian[tgl] += Number(t.total) || 0;
    });

    let labelsTanggal = Object.keys(rekapHarian);
    let dataOmzet = Object.values(rekapHarian);

    if (grafikLaporan) grafikLaporan.destroy();

    grafikLaporan = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsTanggal.length > 0 ? labelsTanggal : ['Belum ada data'],
            datasets: [{
                label: 'Omzet Penjualan (Rp)',
                data: dataOmzet.length > 0 ? dataOmzet : [0],
                borderColor: '#146b5c',
                backgroundColor: 'rgba(20, 107, 92, 0.15)',
                borderWidth: 3,
                pointBackgroundColor: '#d69a2d',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function exportCSVLaporan() {
    let riwayatData = JSON.parse(localStorage.getItem("cacheDataRiwayat")) || [];
    if (riwayatData.length === 0) return alert("Tidak ada data transaksi.");

    let csv = "\uFEFFTanggal,Kasir,Jumlah Item,Total Omzet,Total Laba,Rincian Barang\n";
    
    let strAwal = document.getElementById("lapTanggalAwal").value;
    let strAkhir = document.getElementById("lapTanggalAkhir").value;
    let tglAwal = strAwal ? new Date(strAwal) : null;
    let tglAkhir = strAkhir ? new Date(strAkhir) : null;
    if (tglAwal) tglAwal.setHours(0, 0, 0, 0);
    if (tglAkhir) tglAkhir.setHours(23, 59, 59, 999);

    let dataTersaring = riwayatData.filter(function(t) {
        let tglTransaksi = parseTanggalID(t.tanggal);
        if (tglAwal && tglTransaksi < tglAwal) return false;
        if (tglAkhir && tglTransaksi > tglAkhir) return false;
        return true;
    });

    csv += dataTersaring.map(t => {
        let jml = 0;
        if (t.daftar && t.daftar.trim() !== "") jml = t.daftar.trim().split('\n').length;
        return `"${t.tanggal}","${t.kasir}",${jml},${t.total},${t.totalLaba || 0},"${(t.daftar || "").replace(/\n/g, " | ")}"`;
    }).join("\n");

    let blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Warung_${Date.now()}.csv`;
    link.click();
}

function printLaporan() {
    let isiLaporan = document.getElementById("tabelLaporan").outerHTML;
    let omzet = document.getElementById("lapOmzet").innerText;
    let laba = document.getElementById("lapLaba").innerText;
    let trx = document.getElementById("lapTransaksi").innerText;

    let jendelaPrint = window.open('', '_blank');
    jendelaPrint.document.write(`
        <html><head><title>Laporan Warung</title>
        <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f4f4f4}.summary{display:flex;justify-content:space-around;background:#eee;padding:15px;font-weight:bold}</style>
        </head><body>
        <h2 style="text-align:center">LAPORAN PENJUALAN KASIR</h2>
        <div class="summary"><div>Transaksi: ${trx}</div><div>Omzet: ${omzet}</div><div>Laba: ${laba}</div></div>
        ${isiLaporan}
        <script>setTimeout(() => {window.print(); window.close();}, 800);</script>
        </body></html>
    `);
    jendelaPrint.document.close();
}

//======================================================
// 10. UTILITAS
//======================================================

function formatRupiah(angka) {
    return "Rp " + (Number(angka) || 0).toLocaleString("id-ID");
}

function tampilkanTanggal() {
    let el = document.getElementById("tanggalTransaksi");
    if(el) el.innerHTML = new Date().toLocaleString("id-ID");
}

function resetNomorTransaksi() {
    alert("Penomoran otomatis diatur oleh sistem Cloud.");
}

function hitungTotalLaba() {
    let tl = 0;
    daftarItem.forEach(i => tl += Number(i.laba || 0));
    return tl;
}
//======================================================
// PHASE 7: MODUL BARCODE SCANNER KAMERA 
//======================================================

let scannerKamera = null;
let sistemSedangMembaca = false; // Pengunci agar tidak terjadi scan ganda dalam 1 detik

// 1. Fungsi menyalakan mesin kamera
function nyalakanScannerKamera() {
    let wadahKamera = document.getElementById("reader");
    if (!wadahKamera) return;

    // Jika mesin scanner sebelumnya masih menggantung, bersihkan dulu
    if (scannerKamera) {
        scannerKamera.clear();
    }

    // Set tampilan teks indikator bawah kamera
    let statusTxt = document.getElementById("statusScan");
    if (statusTxt) {
        statusTxt.innerHTML = "🟢 Kamera Aktif (Dekatkan Barcode Produk)";
        statusTxt.style.color = "var(--green)";
    }

    // Inisialisasi konfigurasi Html5QrcodeScanner
    scannerKamera = new Html5QrcodeScanner("reader", { 
        fps: 15,                             // Kecepatan membaca frame per detik
        qrbox: { width: 260, height: 160 },   // Dimensi kotak target barcode di layar
        aspectRatio: 1.0
    }, false);

    // Jalankan kamera dan pasang fungsi tangkapan sukses
    scannerKamera.render(ketikaBarcodeTerbaca, ketikaScanGagal);
}

// 2. Fungsi eksekusi ketika kamera berhasil mengenali kode barcode
function ketikaBarcodeTerbaca(decodedText, decodedResult) {
    if (sistemSedangMembaca) return; // Kunci frame agar tidak duplikasi scan[cite: 3]
    sistemSedangMembaca = true; //[cite: 3]

    bunyiBipKasir(); // Bunyi cekrek kasir[cite: 3]

    document.getElementById("statusScan").innerHTML = `⚡ Barcode Terbaca: ${decodedText}`; //[cite: 3]
    document.getElementById("statusScan").style.color = "var(--yellow)"; //[cite: 2, 3]

    let selectElement = document.getElementById("pilihBarang"); //[cite: 3]
    let ketemu = false; //[cite: 3]

    // 1. TAHAP SATU: Cari di Database Internal Toko Anda Sendiri[cite: 3]
    for (let i = 1; i < selectElement.options.length; i++) { //[cite: 3]
        let valueData = selectElement.options[i].value; //[cite: 3]
        if (valueData === "") continue; //[cite: 3]

        let pecahData = valueData.split("|"); //[cite: 3]
        let kodeDatabase = pecahData[0]; //[cite: 3]

        if (kodeDatabase === decodedText) { //[cite: 3]
            selectElement.value = valueData; //[cite: 3]
            isiBarangOtomatis(); // Masukkan form[cite: 3]
            tambahBarang(); // Masukkan keranjang belanja[cite: 3]
            
            document.getElementById("statusScan").innerHTML = `✅ Masuk Keranjang: ${pecahData[1]}`; //[cite: 3]
            document.getElementById("statusScan").style.color = "var(--green)"; //[cite: 1, 3]
            ketemu = true; //[cite: 3]
            break; //[cite: 3]
        }
    }
// Tambahkan ini di bagian paling bawah file script.js Anda:
function ketikaScanGagal(error) {
    // Dibiarkan kosong agar tidak membanjiri tab console browser 
    // saat kamera sedang berkedip mencari fokus barcode produk
}
    // 2. TAHAP DUA: Jika Tidak Ada di Toko, Cari Otomatis ke Kamus 32rb Barcode (Cloud)
    if (!ketemu) {
        document.getElementById("statusScan").innerHTML = "🔍 Mencari di Kamus Nasional...";
        document.getElementById("statusScan").style.color = "var(--muted)"; //[cite: 1]
        
        // Fungsi callback penangkap respon dari server Google Sheets
        window.responKamusBarcode = function(hasil) {
            if (hasil.ketemu) {
                // Jika ketemu di Kamus 32rb data, langsung pindah menu dan tembak form modal
                bukaMenu('barang'); //[cite: 3]
                bukaModalBarang('tambah'); //[cite: 3]
                
                // Isi form otomatis secara instan tanpa ketik!
                document.getElementById("modalKode").value = decodedText; //
                document.getElementById("modalNama").value = hasil.nama; //
                document.getElementById("modalKategori").value = hasil.kategori || "Makanan"; //[cite: 2]
                
                document.getElementById("statusScan").innerHTML = `✨ Terdeteksi: ${hasil.nama}`;
                document.getElementById("statusScan").style.color = "var(--green)"; //[cite: 1]
                
                // Fokuskan kursor langsung ke form Harga Jual biar kasir tinggal ketik angka harga saja
                setTimeout(() => {
                    document.getElementById("modalHarga").focus(); //[cite: 2]
                }, 150);
                
                alert(`📦 Produk Dikenal!\n"${hasil.nama}" otomatis diinput ke sistem.\n\nSilakan isi Harga Modal, Harga Jual, dan Stok untuk mendaftarkannya di toko Anda.`);
            } else {
                // Jika benar-benar asing (tidak ada di kamus juga)
                let mauDaftar = confirm(`Barcode "${decodedText}" tidak ada di toko maupun kamus nasional.\nMau daftarkan manual dari nol?`);
                if (mauDaftar) {
                    bukaMenu('barang'); //[cite: 3]
                    bukaModalBarang('tambah'); //[cite: 3]
                    document.getElementById("modalKode").value = decodedText; //[cite: 2]
                }
            }
        };

        // Kirim perintah JSONP aman ke Google Sheets Tab Kamus
        let scriptLama = document.getElementById("cariKamus");
        if (scriptLama) scriptLama.remove();
        
        let script = document.createElement("script");
        script.id = "cariKamus";
        script.src = WEB_APP_URL + `?callback=responKamusBarcode&tipe=cari_kamus_barcode&kode=${decodedText}`; //[cite: 3]
        document.body.appendChild(script);
    }

    // Mengunci scanner selama 2 detik sebelum scan item berikutnya[cite: 3]
    setTimeout(() => {
        sistemSedangMembaca = false; //[cite: 3]
        if (document.getElementById("menuKasir").style.display === "block") { //[cite: 3]
            document.getElementById("statusScan").innerHTML = "🟢 Kamera Aktif (Dekatkan Barcode Produk)"; //[cite: 3]
            document.getElementById("statusScan").style.color = "var(--green)"; //[cite: 1, 3]
        }
    }, 2000);
}

// 3. Pembuat efek suara digital pendek (Bip!) tanpa aset file eksternal
function bunyiBipKasir() {
    try {
        let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = 1300; // Frekuensi suara kasir nyaring
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.07); // Durasi bunyi pendek
    } catch (e) {
        console.log("Audio konteks tertahan keamanan browser.");
    }
}
//======================================================
// PHASE 3: MODUL LOGIKA DASHBOARD UTAMA
//======================================================
function updateDashboard() {
    let elOmzet = document.getElementById("dashOmzet");
    let elLaba = document.getElementById("dashLaba");
    let elTransaksi = document.getElementById("dashTransaksi");
    let elHampirHabis = document.getElementById("dashHampirHabis");
    let elHabis = document.getElementById("dashHabis");

    // Pastikan elemen dashboard ada di HTML sebelum diisi
    if (!elOmzet) return; 

    let hariIni = new Date().toLocaleDateString("id-ID");
    let totalOmzet = 0;
    let totalLaba = 0;
    let totalTransaksi = 0;

    // 1. Hitung Rekap Transaksi Hari Ini berdasarkan Cache Riwayat Cloud
    let riwayatData = JSON.parse(localStorage.getItem("cacheDataRiwayat")) || [];
    riwayatData.forEach(function(t) {
        if (t.tanggal && t.tanggal.includes(hariIni)) {
            totalTransaksi++;
            totalOmzet += Number(t.total || 0);
            totalLaba += Number(t.totalLaba || 0);
        }
    });

    // 2. Hitung Status Stok Barang berdasarkan Cache Data Barang
    let jmlHampirHabis = 0;
    let jmlHabis = 0;
    
    let barangData = JSON.parse(localStorage.getItem("cacheDataBarang")) || [];
    barangData.forEach(function(b) {
        let stok = Number(b.stok || 0);
        if (stok <= 0) {
            jmlHabis++;
        } else if (stok <= 5) {
            jmlHampirHabis++;
        }
    });

    // 3. Tampilkan Hasil Hitungan ke Layar Dashboard Utama
    elOmzet.innerText = formatRupiah(totalOmzet);
    elLaba.innerText = formatRupiah(totalLaba);
    elTransaksi.innerText = totalTransaksi;
    elHampirHabis.innerText = jmlHampirHabis;
    elHabis.innerText = jmlHabis;
}
//======================================================
// INTERAKSI DASHBOARD KE MASTER BARANG
//======================================================
function klikDashboardStok(kondisi) {
    // 1. Pindah halaman ke menu data barang terlebih dahulu
    bukaMenu('barang');
    
    // 2. Kosongkan kolom pencarian teks agar tidak bentrok
    let inputCari = document.getElementById("cariBarangMaster");
    let selectKategori = document.getElementById("filterKategoriMaster");
    if (inputCari) inputCari.value = "";
    if (selectKategori) selectKategori.value = "Semua";

    // 3. Saring baris tabel berdasarkan kondisi stoknya
    let tbody = document.getElementById("bodyBarangMaster");
    if (!tbody) return;
    
    let baris = tbody.getElementsByTagName("tr");
    for (let i = 0; i < baris.length; i++) {
        let cells = baris[i].getElementsByTagName("td");
        if (cells.length < 8) continue;

        // Ambil angka stok asli yang berada di dalam badge (kolom ke-8 / indeks 7)
        let badgeSpan = cells[7].querySelector(".badge");
        let stok = badgeSpan ? parseInt(badgeSpan.innerText, 10) : 0;

        if (kondisi === 'habis') {
            // Tampilkan hanya jika stoknya 0 atau kurang
            baris[i].style.display = (stok <= 0) ? "" : "none";
        } else if (kondisi === 'hampir_habis') {
            // Tampilkan hanya jika stoknya di antara 1 sampai 5
            baris[i].style.display = (stok > 0 && stok <= 5) ? "" : "none";
        }
    }
}
