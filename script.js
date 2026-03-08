// Data structure to hold our entries (we'll save this to localStorage so data persists)
let workEntries = [];
let editId = null; // Keeps track of which entry we are currently editing

// DOM Elements - Grab all the sections of our HTML we need to interact with
const form = document.getElementById('tracker-form');
const dateInput = document.getElementById('work-date');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const entriesBody = document.getElementById('entries-body');
const weeklyTotalEl = document.getElementById('weekly-total');
const monthlyTotalEl = document.getElementById('monthly-total');
const submitBtn = document.getElementById('submit-btn');
const exportBtn = document.getElementById('export-btn');
const overtimeContainer = document.getElementById('overtime-container');

// Initialize the app
function init() {
    // Attempt to get saved data from the browser's localStorage
    const storedEntries = localStorage.getItem('workEntries');
    if (storedEntries) {
        // Convert the string back into a JavaScript array
        workEntries = JSON.parse(storedEntries);
    }

    // Set the default date input to today's date
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

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

    // 12:00 - 13:00 arası mola kesintisi hesaplaması
    let breakStart = new Date(2000, 0, 1, 12, 0);
    let breakEnd = new Date(2000, 0, 1, 13, 0);

    // Çalışma süresi mola saatine denk geliyorsa kesilecek süreyi hesapla
    let overlapStart = new Date(Math.max(startDate.getTime(), breakStart.getTime()));
    let overlapEnd = new Date(Math.min(endDate.getTime(), breakEnd.getTime()));

    if (overlapStart < overlapEnd) {
        let breakDuration = (overlapEnd - overlapStart) / (1000 * 60 * 60);
        diffInHours -= breakDuration;
    }

    return Math.round(diffInHours * 100) / 100; // Round to 2 decimal places to keep it clean
}

// Saatleri "6 saat 45 dakika" formatında okunabilir bir metne dönüştürür
function formatHours(decimalHours) {
    if (decimalHours <= 0) return "0 saat";

    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
        return `${hours} saat ${minutes} dakika`;
    } else if (hours > 0) {
        return `${hours} saat`;
    } else {
        return `${minutes} dakika`;
    }
}

// Helper function to get the Monday of the week for a given date
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
}

// Generate a string identifier for the week (e.g., "16 Ekim - 22 Ekim")
function getWeekLabel(dateStr) {
    const monday = getMonday(dateStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Yılın değiştiği haftaları (Aralık sonu/Ocak başı) daha net göstermek için
    if (monday.getFullYear() !== sunday.getFullYear()) {
        const options1 = { month: 'short', day: 'numeric', year: 'numeric' };
        const options2 = { month: 'short', day: 'numeric', year: 'numeric' };
        return `${monday.toLocaleDateString('tr-TR', options1)} - ${sunday.toLocaleDateString('tr-TR', options2)}`;
    } else {
        const options = { month: 'short', day: 'numeric' };
        return `${monday.toLocaleDateString('tr-TR', options)} - ${sunday.toLocaleDateString('tr-TR', options)}`;
    }
}

// Handle form submission (when the user clicks "Add Entry" or "Update Entry")
form.addEventListener('submit', function (e) {
    e.preventDefault(); // Stop the page from reloading

    const date = dateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    if (!date || !startTime || !endTime) return; // Basic validation

    const hours = calculateHours(startTime, endTime);

    if (editId !== null) {
        // If editId is set, we are updating an existing entry
        const index = workEntries.findIndex(entry => entry.id === editId);
        if (index !== -1) {
            workEntries[index] = {
                id: editId,
                date,
                startTime,
                endTime,
                hours
            };
        }
        editId = null; // Reset edit mode
        submitBtn.textContent = 'Kayıt Ekle';
    } else {
        // Create a brand new entry
        const newEntry = {
            id: Date.now().toString(), // Use timestamp as a simple unique ID
            date,
            startTime,
            endTime,
            hours
        };
        workEntries.push(newEntry);
    }

    // Clear the time inputs for the next entry, but keep the date
    startTimeInput.value = '';
    endTimeInput.value = '';

    // Save to localStorage and update the screen
    saveAndRender();
});

// Delete an entry from the list
window.deleteEntry = function (id) {
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
        // Keep only entries that DO NOT match the deleted ID
        workEntries = workEntries.filter(entry => entry.id !== id);
        saveAndRender();
    }
}

// Edit an entry
window.editEntry = function (id) {
    // Find the entry we want to edit
    const entry = workEntries.find(e => e.id === id);
    if (entry) {
        // Populate the form with the entry's data
        dateInput.value = entry.date;
        startTimeInput.value = entry.startTime;
        endTimeInput.value = entry.endTime;

        editId = id; // Set the edit mode state
        submitBtn.textContent = 'Kaydı Güncelle'; // Change button text

        // Scroll to the top so the user sees the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

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

    // Sort entries so the newest date is at the top
    const sortedEntries = [...workEntries].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedEntries.forEach(entry => {
        // Create a new HTML table row
        const row = document.createElement('tr');

        // Fill it with data and action buttons
        row.innerHTML = `
            <td>${entry.date}</td>
            <td>${entry.startTime}</td>
            <td>${entry.endTime}</td>
            <td><strong>${formatHours(entry.hours)}</strong></td>
            <td>
                <button class="action-btn edit-btn" onclick="editEntry('${entry.id}')">Düzenle</button>
                <button class="action-btn delete-btn" onclick="deleteEntry('${entry.id}')">Sil</button>
            </td>
        `;

        // Add the row to the table body
        entriesBody.appendChild(row);
    });
}

// Process entries to find weekly and monthly totals based on the current date
function calculateSummaries() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Şu an bulunduğumuz günün "Pazartesi"sini bul
    const currentWeekMonday = getMonday(today);
    const currentWeekMondayStr = currentWeekMonday.toISOString().split('T')[0];

    let monthlyTotal = 0;
    let weeklyTotal = 0;

    workEntries.forEach(entry => {
        const entryDate = new Date(entry.date);

        // Aylık kontrol
        if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
            monthlyTotal += entry.hours;
        }

        // Haftalık kontrol: Kaydın haftası (Pazartesisi) bu haftanın Pazartesisi ile aynı mı?
        const entryMonday = getMonday(entry.date);
        const entryMondayStr = entryMonday.toISOString().split('T')[0];

        if (entryMondayStr === currentWeekMondayStr) {
            weeklyTotal += entry.hours;
        }
    });

    // Update the HTML text with our calculated numbers
    monthlyTotalEl.textContent = formatHours(monthlyTotal);
    weeklyTotalEl.textContent = formatHours(weeklyTotal);

    calculateOvertime();
}

// Mesai Hesabı (Pazartesi başlayan haftalara göre 45 saat üzeri)
function calculateOvertime() {
    const weeklySummary = {};

    // Bütün verileri dolaşarak ait oldukları haftaya (Pazartesi başlangıçlı) göre grupla
    workEntries.forEach(entry => {
        const mondayDate = getMonday(entry.date);
        const mondayStr = mondayDate.toISOString().split('T')[0]; // Haftanın ID'si olarak Pazartesi tarihini kullan

        if (!weeklySummary[mondayStr]) {
            weeklySummary[mondayStr] = {
                mondayDate: mondayDate,
                label: getWeekLabel(entry.date),
                totalHours: 0
            };
        }
        weeklySummary[mondayStr].totalHours += entry.hours;
    });

    // Haftaları kronolojik olarak tersine sırala (en güncel hafta en üstte)
    const sortedWeeks = Object.values(weeklySummary).sort((a, b) => b.mondayDate - a.mondayDate);

    overtimeContainer.innerHTML = '';

    if (sortedWeeks.length === 0) {
        overtimeContainer.innerHTML = '<p style="color: #6b7280; font-style: italic;">Henüz mesai kaydı bulunmuyor.</p>';
        return;
    }

    sortedWeeks.forEach(week => {
        // 30 saati geçen kısım mesai sayılır
        const overTimeHours = week.totalHours > 30 ? week.totalHours - 30 : 0;

        const weekDiv = document.createElement('div');
        weekDiv.style.display = 'flex';
        weekDiv.style.justifyContent = 'space-between';
        weekDiv.style.padding = '10px';
        weekDiv.style.backgroundColor = 'white';
        weekDiv.style.borderRadius = '5px';
        weekDiv.style.border = '1px solid #e5e7eb';
        weekDiv.style.marginBottom = '8px';

        let overTimeDisplay = overTimeHours > 0
            ? `<span style="color: #059669; font-weight: bold;">+${formatHours(overTimeHours)} Mesai</span>`
            : `<span style="color: #6b7280;">Fazla Mesai Yok</span>`;

        weekDiv.innerHTML = `
            <div>
                <strong>${week.label}</strong>
                <div style="font-size: 0.85rem; color: #4b5563;">Haftalık Toplam: ${formatHours(week.totalHours)}</div>
            </div>
            <div style="display: flex; align-items: center;">
                ${overTimeDisplay}
            </div>
        `;

        overtimeContainer.appendChild(weekDiv);
    });
}

// Excel için CSV dışa aktarma fonksiyonu
exportBtn.addEventListener('click', function () {
    if (workEntries.length === 0) {
        alert("Dışa aktarılacak kayıt bulunamadı.");
        return;
    }

    // CSV başlıkları (Türkçe karakter sorununu en aza indirmek için BOM ekliyoruz)
    const BOM = "\uFEFF";
    // Türkçe Excel versiyonlarında sütunları ayırmak için virgül (,) yerine noktalı virgül (;) kullanılması gerekir
    let csvContent = BOM + "Tarih;Gün;Başlangıç Saati;Bitiş Saati;Toplam Saat\n";

    // Verileri ekleme
    // Tarihe göre sıralı olarak aktarmak en iyisidir
    const sortedEntries = [...workEntries].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Gün isimleri
    const gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    sortedEntries.forEach(entry => {
        const tarihObjesi = new Date(entry.date);
        const gunAdi = gunler[tarihObjesi.getDay()];

        // formatHours("5 saat 30 dakika") yazisini temiz sayiya ("5.5" veya "5,5") de donusturebiliriz ama 
        // patronun gormesi icin mevcut metin formati genelde uygundur. Istenirse sadece sayi (entry.hours) da yazilabilir.
        const row = `${entry.date};${gunAdi};${entry.startTime};${entry.endTime};"${formatHours(entry.hours).replace(/"/g, '""')}"`;
        csvContent += row + "\n";
    });

    // Indirme islemi
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "calisma_saatleri_ozeti.csv");
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Start everything when the file loads
init();
