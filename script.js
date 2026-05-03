// Data structure to hold our entries (we'll save this to localStorage so data persists)
let workEntries = [];
let editId = null; // Keeps track of which entry we are currently editing

// DOM Elements - Grab all the sections of our HTML we need to interact with
const form = document.getElementById('tracker-form');
const dateInput = document.getElementById('work-date');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const dailyDocInput = document.getElementById('daily-doc');
const entriesBody = document.getElementById('entries-body');
const weeklyTotalEl = document.getElementById('weekly-total');
const monthlyTotalEl = document.getElementById('monthly-total');
const submitBtn = document.getElementById('submit-btn');
const exportBtn = document.getElementById('export-btn');
const overtimeContainer = document.getElementById('overtime-container');
var backupMonthInput = document.getElementById('backup-month');
var backupBtn = document.getElementById('backup-btn');
var restoreFileInput = document.getElementById('restore-file');
var backupStatus = document.getElementById('backup-status');

function normalizeEntryHours(entry) {
    if (entry.startTime && entry.endTime) {
        entry.hours = calculateHours(entry.startTime, entry.endTime);
    }
    return entry;
}

// Initialize the app
function init() {
    // Attempt to get saved data from the browser's localStorage
    // Veriler 'workEntries' anahtarında saklanır — kod güncellemeleri bu veriyi SİLMEZ.
    var storedEntries = localStorage.getItem('workEntries');
    if (storedEntries) {
        try {
            // Convert the string back into a JavaScript array and normalize hours
            var parsedEntries = JSON.parse(storedEntries);
            workEntries = parsedEntries.map(normalizeEntryHours);
            localStorage.setItem('workEntries', JSON.stringify(workEntries));
        } catch (e) {
            console.error('Kayıtlar yüklenirken hata oluştu, eski veriler korunuyor:', e);
            try {
                workEntries = JSON.parse(storedEntries);
            } catch(e2) {
                workEntries = [];
            }
        }
    }

    // Set the default date input to today's date
    var today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    // Set default backup month to current month (YYYY-MM format)
    backupMonthInput.value = today.substring(0, 7);

    // Render the table and calculate totals
    updateUI();
}

// Calculate hours between two time strings ("HH:MM")
function calculateHours(start, end) {
    // Split the time strings into hours and minutes
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    // Create Date objects (using a dummy date, we only care about the time)
    let startDate = new Date(2000, 0, 1, startHour, startMin);
    let endDate = new Date(2000, 0, 1, endHour, endMin);

    // If end time is earlier than start time, assume the work crossed midnight to the next day
    if (endDate < startDate) {
        endDate.setDate(endDate.getDate() + 1);
    }

    // Get the difference in milliseconds and convert to hours
    let diffInMs = endDate - startDate;
    let diffInHours = diffInMs / (1000 * 60 * 60);

    return Math.round(diffInHours * 100) / 100; // Round to 2 decimal places to keep it clean
}

// Saatleri "6 saat 45 dakika" formatinda okunabilir bir metne donusturur
function formatHours(decimalHours) {
    if (decimalHours <= 0) return "0 saat";

    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
        return hours + ' saat ' + minutes + ' dakika';
    } else if (hours > 0) {
        return hours + ' saat';
    } else {
        return minutes + ' dakika';
    }
}

// Helper function to get the Monday of the week for a given date
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
}

// Generate a string identifier for the week (e.g., "16 Eki - 22 Eki")
function getWeekLabel(dateStr) {
    const monday = getMonday(dateStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    if (monday.getFullYear() !== sunday.getFullYear()) {
        var options1 = { month: 'short', day: 'numeric', year: 'numeric' };
        var options2 = { month: 'short', day: 'numeric', year: 'numeric' };
        return monday.toLocaleDateString('tr-TR', options1) + ' - ' + sunday.toLocaleDateString('tr-TR', options2);
    } else {
        var options = { month: 'short', day: 'numeric' };
        return monday.toLocaleDateString('tr-TR', options) + ' - ' + sunday.toLocaleDateString('tr-TR', options);
    }
}

// Handle form submission (when the user clicks "Add Entry" or "Update Entry")
form.addEventListener('submit', function (e) {
    e.preventDefault(); // Stop the page from reloading

    var date = dateInput.value;
    var startTime = startTimeInput.value;
    var endTime = endTimeInput.value;
    var dailyDoc = dailyDocInput.value;

    if (!date || !startTime || !endTime) return; // Basic validation

    var hours = calculateHours(startTime, endTime);

    if (editId !== null) {
        // If editId is set, we are updating an existing entry
        var index = workEntries.findIndex(function(entry) { return entry.id === editId; });
        if (index !== -1) {
            workEntries[index] = {
                id: editId,
                date: date,
                startTime: startTime,
                endTime: endTime,
                hours: hours,
                dailyDoc: dailyDoc
            };
        }
        editId = null; // Reset edit mode
        submitBtn.textContent = 'Kayit Ekle';
    } else {
        // Create a brand new entry
        var newEntry = {
            id: Date.now().toString(), // Use timestamp as a simple unique ID
            date: date,
            startTime: startTime,
            endTime: endTime,
            hours: hours,
            dailyDoc: dailyDoc
        };
        workEntries.push(newEntry);
    }

    // Clear the time inputs for the next entry, but keep the date
    startTimeInput.value = '';
    endTimeInput.value = '';
    dailyDocInput.value = '';

    // Save to localStorage and update the screen
    saveAndRender();
});

// Delete an entry from the list
window.deleteEntry = function (id) {
    if (confirm('Bu kaydi silmek istediginize emin misiniz?')) {
        // Keep only entries that DO NOT match the deleted ID
        workEntries = workEntries.filter(function(entry) { return entry.id !== id; });
        saveAndRender();
    }
};

// Edit an entry
window.editEntry = function (id) {
    // Find the entry we want to edit
    var entry = workEntries.find(function(e) { return e.id === id; });
    if (entry) {
        // Populate the form with the entry's data
        dateInput.value = entry.date;
        startTimeInput.value = entry.startTime;
        endTimeInput.value = entry.endTime;
        dailyDocInput.value = entry.dailyDoc || '';

        editId = id; // Set the edit mode state
        submitBtn.textContent = 'Kaydi Guncelle'; // Change button text

        // Scroll to the top so the user sees the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Save data and refresh the visual interface
function saveAndRender() {
    // Convert array to a string to save in localStorage
    localStorage.setItem('workEntries', JSON.stringify(workEntries));
    updateUI();
}

// Helper to update the parts of our page that change
function updateUI() {
    renderTable();
    calculateSummaries();
}

// Update the HTML table with our data
function renderTable() {
    entriesBody.innerHTML = ''; // Clear out the old table rows

    var today = new Date();
    var currentMonth = today.getMonth();
    var currentYear = today.getFullYear();

    // Only show entries from the current month
    var monthEntries = workEntries.slice().filter(function(entry) {
        var entryDate = new Date(entry.date);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    if (monthEntries.length === 0) {
        var emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="5" style="text-align:center; padding:20px; color:#6b7280;">Bu ay icin kayit bulunamadi.</td>';
        entriesBody.appendChild(emptyRow);
        return;
    }

    monthEntries.forEach(function(entry) {
        // Create a new HTML table row
        var row = document.createElement('tr');

        // Fill it with data and action buttons
        row.innerHTML = '<td>' + entry.date + '</td>' +
            '<td>' + entry.startTime + '</td>' +
            '<td>' + entry.endTime + '</td>' +
            '<td><strong>' + formatHours(entry.hours) + '</strong></td>' +
            '<td>' +
                '<button class="action-btn edit-btn" onclick="editEntry(\'' + entry.id + '\')">Duzenle</button>' +
                '<button class="action-btn delete-btn" onclick="deleteEntry(\'' + entry.id + '\')">Sil</button>' +
                '<button class="action-btn word-btn" onclick="exportWord(\'' + entry.id + '\')" title="Word Olarak Indir">Word</button>' +
            '</td>';

        // Add the row to the table body
        entriesBody.appendChild(row);
    });
}

// Process entries to find weekly and monthly totals based on the current date
function calculateSummaries() {
    var today = new Date();
    var currentMonth = today.getMonth();
    var currentYear = today.getFullYear();

    // Su an bulundugumuz gunun "Pazartesi"sini bul
    var currentWeekMonday = getMonday(today);
    var currentWeekMondayStr = currentWeekMonday.toISOString().split('T')[0];

    var monthlyTotal = 0;
    var weeklyTotal = 0;

    workEntries.forEach(function(entry) {
        var entryDate = new Date(entry.date);

        // Aylik kontrol
        if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
            monthlyTotal += entry.hours;
        }

        // Haftalik kontrol
        var entryMonday = getMonday(entry.date);
        var entryMondayStr = entryMonday.toISOString().split('T')[0];

        if (entryMondayStr === currentWeekMondayStr) {
            weeklyTotal += entry.hours;
        }
    });

    // Update the HTML text with our calculated numbers
    monthlyTotalEl.textContent = formatHours(monthlyTotal);
    weeklyTotalEl.textContent = formatHours(weeklyTotal);

    calculateOvertime();
}

// Mesai Hesabi (Pazartesi baslayan haftalara gore 30 saat uzeri)
function calculateOvertime() {
    var today = new Date();
    var currentMonth = today.getMonth();
    var currentYear = today.getFullYear();
    var previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    var previousMonth = previousMonthDate.getMonth();
    var previousYear = previousMonthDate.getFullYear();

    var weeklySummary = {};

    workEntries.forEach(function(entry) {
        var entryDate = new Date(entry.date);
        var entryMonth = entryDate.getMonth();
        var entryYear = entryDate.getFullYear();

        // Sadece bu ay ve bir onceki ay kayitlarini dahil et
        var isCurrentOrPreviousMonth =
            (entryYear === currentYear && entryMonth === currentMonth) ||
            (entryYear === previousYear && entryMonth === previousMonth);

        if (!isCurrentOrPreviousMonth) {
            return;
        }

        var mondayDate = getMonday(entry.date);
        var mondayStr = mondayDate.toISOString().split('T')[0];

        if (!weeklySummary[mondayStr]) {
            weeklySummary[mondayStr] = {
                mondayDate: mondayDate,
                label: getWeekLabel(entry.date),
                totalHours: 0
            };
        }
        weeklySummary[mondayStr].totalHours += entry.hours;
    });

    var sortedWeeks = Object.values(weeklySummary).sort(function(a, b) { return b.mondayDate - a.mondayDate; });

    overtimeContainer.innerHTML = '';

    if (sortedWeeks.length === 0) {
        overtimeContainer.innerHTML = '<p style="color: #6b7280; font-style: italic;">Henuz mesai kaydi bulunmuyor.</p>';
        return;
    }

    sortedWeeks.forEach(function(week) {
        // 30 saati gecen kisim mesai sayilir
        var overTimeHours = week.totalHours > 30 ? week.totalHours - 30 : 0;

        var weekDiv = document.createElement('div');
        weekDiv.style.display = 'flex';
        weekDiv.style.justifyContent = 'space-between';
        weekDiv.style.padding = '10px';
        weekDiv.style.backgroundColor = 'white';
        weekDiv.style.borderRadius = '5px';
        weekDiv.style.border = '1px solid #e5e7eb';
        weekDiv.style.marginBottom = '8px';

        var overTimeDisplay = '';
        if (overTimeHours > 0) {
            overTimeDisplay = '<span style="color: #059669; font-weight: bold;">+' + formatHours(overTimeHours) + ' Mesai</span>';
        } else {
            overTimeDisplay = '<span style="color: #6b7280;">Fazla Mesai Yok</span>';
        }

        weekDiv.innerHTML = '<div>' +
            '<strong>' + week.label + '</strong>' +
            '<div style="font-size: 0.85rem; color: #4b5563;">Haftalik Toplam: ' + formatHours(week.totalHours) + '</div>' +
            '</div>' +
            '<div style="display: flex; align-items: center;">' +
            overTimeDisplay +
            '</div>';

        overtimeContainer.appendChild(weekDiv);
    });
}

// Excel icin CSV disa aktarma fonksiyonu
exportBtn.addEventListener('click', function () {
    if (workEntries.length === 0) {
        alert("Disa aktarilacak kayit bulunamadi.");
        return;
    }

    // CSV basliklari (Turkce karakter sorununu en aza indirmek icin BOM ekliyoruz)
    var BOM = "\uFEFF";
    var csvContent = BOM + "Tarih;Gun;Baslangic Saati;Bitis Saati;Toplam Saat\n";

    var sortedEntries = workEntries.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    // Gun isimleri
    var gunler = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];

    sortedEntries.forEach(function(entry) {
        var tarihObjesi = new Date(entry.date);
        var gunAdi = gunler[tarihObjesi.getDay()];
        var row = entry.date + ';' + gunAdi + ';' + entry.startTime + ';' + entry.endTime + ';"' + formatHours(entry.hours) + '"';
        csvContent += row + "\n";
    });

    // Indirme islemi
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement("a");
    var url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "calisma_saatleri_ozeti.csv");
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

window.exportMonthToCsv = function(year, month) {
    var monthEntries = workEntries.filter(function(entry) {
        var d = new Date(entry.date);
        return d.getFullYear() === year && d.getMonth() === month;
    }).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

    if (monthEntries.length === 0) {
        alert('Bu ay icin kayit bulunamadi.');
        return;
    }

    var gunler = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];
    var BOM = "\uFEFF";
    var csvContent = BOM + "Tarih;Gun;Baslangic Saati;Bitis Saati;Toplam Saat\n";

    monthEntries.forEach(function(entry) {
        var d = new Date(entry.date);
        var gunAdi = gunler[d.getDay()];
        var row = entry.date + ';' + gunAdi + ';' + entry.startTime + ';' + entry.endTime + ';"' + formatHours(entry.hours) + '"';
        csvContent += row + "\n";
    });

    var monthLabel = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik'][month];
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Puantaj_' + monthLabel + '_' + year + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Gunluk dokumantasyonu Word olarak disa aktar
window.exportWord = function (id) {
    var entry = workEntries.find(function(e) { return e.id === id; });
    if (!entry) return;

    var docContent = entry.dailyDoc ? entry.dailyDoc.replace(/\n/g, '<br>') : 'Bu gun icin dokumantasyon girilmedi.';

    var html = '<div style="font-family: Arial, sans-serif; line-height: 1.6;">' +
        '<h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">' + entry.date + ' - Gunluk Calisma Raporu</h2>' +
        '<p><strong>Baslangic Saati:</strong> ' + entry.startTime + '</p>' +
        '<p><strong>Bitis Saati:</strong> ' + entry.endTime + '</p>' +
        '<p><strong>Toplam Calisma:</strong> ' + formatHours(entry.hours) + '</p>' +
        '<hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;">' +
        '<h3>Yapilan Isler (Dokumantasyon):</h3>' +
        '<div style="background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; min-height: 100px;">' +
        docContent +
        '</div></div>';

    var preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Gunluk Rapor</title></head><body>";
    var postHtml = "</body></html>";
    var htmlContent = preHtml + html + postHtml;

    var blob = new Blob([htmlContent], {
        type: 'text/html;charset=utf-8'
    });

    var downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);
    var url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = 'Gunluk_Rapor_' + entry.date + '.html';
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

// --- AYLIK PUANTAJ YEDEKLEME ---
var ayIsimleri = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];

backupBtn.addEventListener('click', function() {
    var selectedMonth = backupMonthInput.value; // "2026-03" gibi
    if (!selectedMonth) {
        alert('Lutfen bir ay secin.');
        return;
    }

    var parts = selectedMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]) - 1; // 0-indexed

    // Secilen aya ait kayitlari filtrele
    var monthEntries = workEntries.filter(function(entry) {
        var d = new Date(entry.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    if (monthEntries.length === 0) {
        backupStatus.textContent = 'Secilen ayda kayit bulunamadi.';
        backupStatus.style.color = '#dc2626';
        return;
    }

    // JSON olarak disa aktar
    var backupData = {
        appName: 'Calisma Saatleri Takibi',
        backupDate: new Date().toISOString(),
        month: selectedMonth,
        monthLabel: ayIsimleri[month] + ' ' + year,
        totalEntries: monthEntries.length,
        entries: monthEntries
    };

    var jsonStr = JSON.stringify(backupData, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Puantaj_' + ayIsimleri[month] + '_' + year + '.json';
    link.click();

    backupStatus.textContent = ayIsimleri[month] + ' ' + year + ' puantaji basariyla yedeklendi (' + monthEntries.length + ' kayit).';
    backupStatus.style.color = '#059669';
});

// --- YEDEK DOSYASI YUKLEME ---
restoreFileInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var fileName = file.name.toLowerCase();
    var isJson = fileName.endsWith('.json');
    var isCsv = fileName.endsWith('.csv');

    if (!isJson && !isCsv) {
        backupStatus.textContent = 'Lutfen gecerli bir JSON veya CSV yedek dosyasi secin.';
        backupStatus.style.color = '#dc2626';
        // Dosya secimini sifirla
        setTimeout(function() { restoreFileInput.value = ''; }, 100);
        return;
    }

    backupStatus.textContent = 'Dosya okunuyor...';
    backupStatus.style.color = '#2563eb';

    var reader = new FileReader();
    reader.onload = function(event) {
        try {
            var addedCount = 0;

            if (isJson) {
                var data = JSON.parse(event.target.result);

                if (!data.entries || !Array.isArray(data.entries)) {
                    backupStatus.textContent = 'Gecersiz yedek dosyasi. Lutfen dogru dosyayi secin.';
                    backupStatus.style.color = '#dc2626';
                    // Dosya secimini sifirla
                    setTimeout(function() { restoreFileInput.value = ''; }, 100);
                    return;
                }

                // Mevcut ID'leri topla (ayni kaydi tekrar eklememe icin)
                var existingIds = {};
                workEntries.forEach(function(entry) {
                    existingIds[entry.id] = true;
                });

                data.entries.forEach(function(entry) {
                    if (!existingIds[entry.id]) {
                        normalizeEntryHours(entry);
                        workEntries.push(entry);
                        addedCount++;
                    }
                });

                var monthLabel = data.monthLabel || data.month || 'Bilinmeyen ay';
                if (addedCount > 0) {
                    backupStatus.textContent = monthLabel + ' puantaji basariyla yuklendi. ' + addedCount + ' yeni kayit eklendi.';
                    backupStatus.style.color = '#059669';
                } else {
                    backupStatus.textContent = monthLabel + ' puantajindaki tum kayitlar zaten mevcut. Yeni kayit eklenmedi.';
                    backupStatus.style.color = '#d97706';
                }
            } else if (isCsv) {
                // BOM karakterini temizle + Windows \r\n satir sonlarini normalize et
                var csvText = event.target.result
                    .replace(/^\uFEFF/, '')   // BOM
                    .replace(/\r\n/g, '\n')   // Windows CRLF → LF
                    .replace(/\r/g, '\n');    // Eski Mac CR → LF

                var lines = csvText.split('\n').filter(function(line) { return line.trim().length > 0; });

                if (lines.length < 2) {
                    backupStatus.textContent = 'CSV dosyasi bos veya gecersiz. (' + lines.length + ' satir bulundu)';
                    backupStatus.style.color = '#dc2626';
                    setTimeout(function() { restoreFileInput.value = ''; }, 100);
                    return;
                }

                // Ayrac tespit et: ; mi , mi?
                var delimiter = lines[0].indexOf(';') !== -1 ? ';' : ',';

                // Baslik satirini parse et ve sutun indekslerini bul
                var headerCols = lines[0].split(delimiter).map(function(h) { return h.trim().toLowerCase(); });

                // Sutun indekslerini tespit et (esnek eslestirme)
                var colDate = -1, colStart = -1, colEnd = -1;
                headerCols.forEach(function(col, idx) {
                    var c = col.replace(/[^a-zA-Z\u00C0-\u024F]/g, '').toLowerCase();
                    if (c.startsWith('tar')) colDate = idx;       // Tarih
                    if (c.startsWith('ba') || c.startsWith('gir') || c.startsWith('start')) colStart = idx; // Baslangic / Giris
                    if (c.startsWith('bi') || c.startsWith('end') || c.startsWith('cik')) colEnd = idx;    // Bitis / Cikis
                });

                // Eger kolon bulunamazsa sira tabanli dene (Tarih, Gun, Baslangic, Bitis formatı)
                if (colDate === -1) colDate = 0;
                if (colStart === -1) colStart = (headerCols.length >= 3) ? 2 : 1;
                if (colEnd === -1) colEnd = (headerCols.length >= 4) ? 3 : 2;

                // Mevcut tarihleri topla (ayni tarihte tekrar eklememe icin)
                var existingDates = {};
                workEntries.forEach(function(entry) {
                    existingDates[entry.date] = true;
                });

                var skippedCount = 0;
                for (var i = 1; i < lines.length; i++) {
                    var csvParts = lines[i].split(delimiter);
                    if (csvParts.length > Math.max(colDate, colStart, colEnd)) {
                        var date      = (csvParts[colDate]  || '').replace(/"/g, '').trim();
                        var startTime = (csvParts[colStart] || '').replace(/"/g, '').trim();
                        var endTime   = (csvParts[colEnd]   || '').replace(/"/g, '').trim();

                        // Tarih formatini dogrula (YYYY-MM-DD)
                        var validDate  = /^\d{4}-\d{2}-\d{2}$/.test(date);
                        // Saat formatini dogrula (HH:MM)
                        var validStart = /^\d{1,2}:\d{2}$/.test(startTime);
                        var validEnd   = /^\d{1,2}:\d{2}$/.test(endTime);

                        if (validDate && validStart && validEnd && !existingDates[date]) {
                            var hours = calculateHours(startTime, endTime);
                            var newEntry = {
                                id: Date.now().toString() + '_' + i,
                                date: date,
                                startTime: startTime,
                                endTime: endTime,
                                hours: hours,
                                dailyDoc: ''
                            };
                            workEntries.push(newEntry);
                            addedCount++;
                            existingDates[date] = true;
                        } else if (validDate && existingDates[date]) {
                            skippedCount++;
                        }
                    }
                }

                if (addedCount > 0) {
                    var msg = 'CSV puantaji basariyla yuklendi. ' + addedCount + ' yeni kayit eklendi.';
                    if (skippedCount > 0) msg += ' (' + skippedCount + ' kayit zaten vardi, atildi.)';
                    backupStatus.textContent = msg;
                    backupStatus.style.color = '#059669';
                } else if (skippedCount > 0) {
                    backupStatus.textContent = 'CSV puantajindaki tum kayitlar (' + skippedCount + ' adet) zaten mevcut. Yeni kayit eklenmedi.';
                    backupStatus.style.color = '#d97706';
                } else {
                    backupStatus.textContent = 'CSV dosyasindan hicbir kayit yuklenemedi. Dosya formatini kontrol edin. (Ayrac: "' + delimiter + '", Sutunlar: ' + headerCols.join(' | ') + ')';
                    backupStatus.style.color = '#dc2626';
                }
            }

            saveAndRender();
        } catch (err) {
            console.error('Restore error:', err);
            backupStatus.textContent = 'Dosya okunamadi: ' + err.message;
            backupStatus.style.color = '#dc2626';
        }
        // Dosya okuma tamamlandiktan SONRA sifirla
        setTimeout(function() { restoreFileInput.value = ''; }, 200);
    };

    reader.onerror = function() {
        backupStatus.textContent = 'Dosya okuma hatasi. Lutfen tekrar deneyin.';
        backupStatus.style.color = '#dc2626';
        setTimeout(function() { restoreFileInput.value = ''; }, 200);
    };

    reader.readAsText(file, 'UTF-8');
});

// --- GECMIS AYLAR ARSIVI ---
var archiveModal = document.getElementById('archive-modal');
var archiveContent = document.getElementById('archive-content');
var archiveBtn = document.getElementById('archive-btn');
var archiveCloseBtn = document.getElementById('archive-close-btn');

var gunIsimleri = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];

// Modal ac
archiveBtn.addEventListener('click', function() {
    archiveModal.style.display = 'block';
    showMonthList();
});

// Modal kapat
archiveCloseBtn.addEventListener('click', function() {
    archiveModal.style.display = 'none';
});

// Modal disina tiklaninca kapat
archiveModal.addEventListener('click', function(e) {
    if (e.target === archiveModal) {
        archiveModal.style.display = 'none';
    }
});

// Aylari listele
function showMonthList() {
    // Kayitlardan benzersiz ay-yil ciflerini bul
    var monthMap = {};
    workEntries.forEach(function(entry) {
        var d = new Date(entry.date);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!monthMap[key]) {
            monthMap[key] = {
                year: d.getFullYear(),
                month: d.getMonth(),
                count: 0,
                totalHours: 0
            };
        }
        monthMap[key].count++;
        monthMap[key].totalHours += entry.hours;
    });

    var keys = Object.keys(monthMap).sort().reverse();

    if (keys.length === 0) {
        archiveContent.innerHTML = '<h2 style="color:#7c3aed; margin-bottom:15px;">Gecmis Aylar Arsivi</h2>' +
            '<p style="color:#6b7280; font-style:italic;">Henuz kayit bulunmuyor.</p>';
        return;
    }

    var html = '<h2 style="color:#7c3aed; margin-bottom:20px;">Gecmis Aylar Arsivi</h2>' +
        '<p style="color:#6b7280; margin-bottom:15px;">Detaylarini gormek istediginiz aya tiklayin:</p>';

    keys.forEach(function(key) {
        var info = monthMap[key];
        var label = ayIsimleri[info.month] + ' ' + info.year;
        html += '<div onclick="showMonthDetail(\'' + key + '\')" style="display:flex; justify-content:space-between; align-items:center; padding:15px; margin-bottom:10px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; transition:all 0.2s;"' +
            ' onmouseover="this.style.backgroundColor=\'#eff6ff\'; this.style.borderColor=\'#7c3aed\';"' +
            ' onmouseout="this.style.backgroundColor=\'#f9fafb\'; this.style.borderColor=\'#e5e7eb\';">' +
            '<div>' +
            '<strong style="font-size:1.1rem; color:#1f2937;">' + label + '</strong>' +
            '<div style="font-size:0.85rem; color:#6b7280;">' + info.count + ' kayit</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
            '<span style="font-size:1.1rem; font-weight:700; color:#7c3aed;">' + formatHours(info.totalHours) + '</span>' +
            '<div style="font-size:0.75rem; color:#6b7280;">toplam</div>' +
            '</div>' +
            '</div>';
    });

    archiveContent.innerHTML = html;
}

// Secilen ayin detaylarini goster
window.showMonthDetail = function(key) {
    var parts = key.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]) - 1;
    var label = ayIsimleri[month] + ' ' + year;

    // Bu aya ait kayitlari filtrele ve tarihe gore sirala
    var monthEntries = workEntries.filter(function(entry) {
        var d = new Date(entry.date);
        return d.getMonth() === month && d.getFullYear() === year;
    }).sort(function(a, b) {
        return new Date(a.date) - new Date(b.date);
    });

    var totalHours = 0;
    monthEntries.forEach(function(e) { totalHours += e.hours; });

    var html = '<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:15px;">' +
        '<button onclick="showMonthList()" style="background:#7c3aed; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.9rem;">&larr; Aylara Don</button>' +
        '<button onclick="exportMonthToCsv(' + year + ',' + month + ')" style="background:#10b981; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.9rem;">Excel\'e Aktar</button>' +
        '</div>' +
        '<h2 style="color:#1f2937; margin-bottom:5px;">' + label + '</h2>' +
        '<p style="color:#6b7280; margin-bottom:15px;">Toplam: <strong style="color:#7c3aed;">' + formatHours(totalHours) + '</strong> | ' + monthEntries.length + ' gun</p>' +
        '<div class="table-container"><table style="width:100%; border-collapse:collapse;">' +
        '<thead><tr>' +
        '<th style="padding:10px; text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; background:#f9fafb;">Tarih</th>' +
        '<th style="padding:10px; text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; background:#f9fafb;">Gun</th>' +
        '<th style="padding:10px; text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; background:#f9fafb;">Giris</th>' +
        '<th style="padding:10px; text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; background:#f9fafb;">Cikis</th>' +
        '<th style="padding:10px; text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; background:#f9fafb;">Toplam</th>' +
        '<th style="padding:10px; text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; background:#f9fafb;">Rapor</th>' +
        '</tr></thead><tbody>';

    monthEntries.forEach(function(entry) {
        var d = new Date(entry.date);
        var gunAdi = gunIsimleri[d.getDay()];
        var hasDoc = entry.dailyDoc && entry.dailyDoc.trim().length > 0;
        var docIcon = hasDoc ? ' &#9989;' : '';

        html += '<tr style="border-bottom:1px solid #e5e7eb;">' +
            '<td style="padding:10px;">' + entry.date + '</td>' +
            '<td style="padding:10px;">' + gunAdi + '</td>' +
            '<td style="padding:10px;">' + entry.startTime + '</td>' +
            '<td style="padding:10px;">' + entry.endTime + '</td>' +
            '<td style="padding:10px;"><strong>' + formatHours(entry.hours) + '</strong></td>' +
            '<td style="padding:10px;">' +
            '<button class="action-btn word-btn" onclick="exportWord(\'' + entry.id + '\')" style="background:#2563eb; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.85rem; font-weight:600;">Word</button>' +
            docIcon +
            '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';

    archiveContent.innerHTML = html;
};

// Start everything when the file loads
init();
