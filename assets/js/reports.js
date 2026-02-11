import { DataStore } from './data.js';

// Libraries are loaded in the HTML via CDN for now (SheetJS, jsPDF)
// We assume XLSX and jspdf are available on window

export const Reports = {
    async download(format, filters) {
        /*
            filters = {
                jenjang: 'SD' | 'SMP' | 'PAUD' | '',
                tahun: '2026',
                bulan: '01' | ''
            }
        */

        try {
            // 1. Fetch Data
            let data = await DataStore.getPrestasi();
            const schools = await DataStore.getSekolah();

            // Build School Level Map
            const schoolLevelMap = {};
            schools.forEach(s => {
                if (s.nama) schoolLevelMap[s.nama.trim().toLowerCase()] = s.jenjang;
            });

            // 2. Filter Data
            const filteredData = data.filter(item => {
                // Normalize
                const sName = (item.sekolah || item.school || '').trim().toLowerCase();
                const sDate = item.tanggal || ''; // YYYY-MM-DD

                // A. Check Jenjang
                let levelMatch = true;
                if (filters.jenjang) {
                    const realLevel = schoolLevelMap[sName];
                    if (realLevel) {
                        levelMatch = (realLevel === filters.jenjang);
                    } else {
                        // Fallback inference
                        const target = filters.jenjang.toLowerCase();
                        if (target === 'sd') levelMatch = (sName.includes('sd') || sName.includes('mi'));
                        else if (target === 'smp') levelMatch = (sName.includes('smp') || sName.includes('mts'));
                        else if (target === 'paud') levelMatch = (sName.includes('paud') || sName.includes('tk'));
                        else levelMatch = false;
                    }
                }

                // B. Check Year
                let yearMatch = true;
                if (filters.tahun) {
                    yearMatch = sDate.startsWith(filters.tahun);
                }

                // C. Check Month
                let monthMatch = true;
                if (filters.bulan) {
                    const monthPart = sDate.substring(5, 7);
                    monthMatch = (monthPart === filters.bulan);
                }

                return levelMatch && yearMatch && monthMatch;
            });

            if (filteredData.length === 0) {
                return { success: false, message: "Tidak ada data yang ditemukan untuk filter ini." };
            }

            // 3. Generate Filename
            const filename = `Laporan_Prestasi_${filters.jenjang || 'Semua'}_${filters.tahun}_${filters.bulan || 'Full'}`;

            // 4. Export
            if (format === 'excel') {
                this.exportExcel(filteredData, filename);
            } else {
                this.exportPDF(filteredData, filename, filters);
            }

            return { success: true };

        } catch (err) {
            console.error("Report Error:", err);
            return { success: false, message: err.message };
        }
    },

    exportExcel(data, filename) {
        if (!window.XLSX) {
            throw new Error("Library SheetJS (XLSX) belum dimuat.");
        }

        const rows = data.map(item => ({
            "Tanggal": item.tanggal,
            "Nama Siswa": item.nama || item.siswa,
            "Sekolah": item.sekolah || item.school,
            "Lomba": item.lomba,
            "Tingkat": item.tingkat,
            "Peringkat": item.peringkat
        }));

        const worksheet = window.XLSX.utils.json_to_sheet(rows);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Data Prestasi");

        // Auto width
        const wscols = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
        worksheet['!cols'] = wscols;

        window.XLSX.writeFile(workbook, `${filename}.xlsx`);
    },

    exportPDF(data, filename, filters) {
        if (!window.jspdf) {
            throw new Error("Library jsPDF belum dimuat.");
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const title = `Laporan Data Prestasi PUSDASTRA`;
        doc.setFontSize(14);
        doc.text(title, 14, 15);

        doc.setFontSize(10);
        const jenjangLabel = filters.jenjang || 'Semua Jenjang';
        doc.text(`Jenjang: ${jenjangLabel} | Periode: ${filters.tahun}`, 14, 22);

        const tableColumn = ["Tanggal", "Siswa", "Sekolah", "Lomba", "Tingkat", "Peringkat"];
        const tableRows = [];

        data.forEach(item => {
            const row = [
                item.tanggal,
                item.nama || item.siswa,
                item.sekolah || item.school,
                item.lomba,
                item.tingkat,
                item.peringkat
            ];
            tableRows.push(row);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
        });

        doc.save(`${filename}.pdf`);
    }
};
