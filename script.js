// Tank data will be loaded from an external JSON file

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Get references to the HTML elements
    const tankSelect = document.getElementById('tankSelect');
    const tankDetailsP = document.getElementById('tankDetails');
    const readingForm = document.getElementById('readingForm');
    const logTableBody = document.getElementById('logTableBody');
    const logTankIdSpan = document.getElementById('logTankId');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const importBtn = document.getElementById('importBtn');
    const importFileInput = document.getElementById('importFile');
    const submitBtn = readingForm.querySelector('button[type="submit"]');

    let currentTankId = ''; // Variable to store the currently active tank ID
    let tanks = []; // Will hold the tank list loaded from JSON
    let editingIndex = null; // Tracks which log entry is being edited

    // ---- NEW: Function to populate the dropdown menu ----
    const populateTankSelector = () => {
        tankSelect.innerHTML = '';
        tanks.forEach(tank => {
            const option = document.createElement('option');
            option.value = tank.id;
            option.textContent = `${tank.id} (${tank.capacity} L)`;
            tankSelect.appendChild(option);
        });
    };
    
    // ---- NEW: Function to handle when a new tank is selected ----
    const handleTankSelection = () => {
        currentTankId = tankSelect.value;
        const selectedTank = tanks.find(tank => tank.id === currentTankId);

        if (selectedTank) {
            tankDetailsP.textContent = `Capacity: ${selectedTank.capacity} L. Details: ${selectedTank.description}`;
        } else {
            tankDetailsP.textContent = '';
        }
        
        renderLog(); // Load and display the log for the selected tank
    };

    // Function to render the log entries in the table
    const renderLog = () => {
        logTableBody.innerHTML = '';
        const tankData = getTankData(currentTankId);
        logTankIdSpan.textContent = currentTankId;

        tankData.forEach((reading, index) => {
            const row = document.createElement('tr');
            const formattedTimestamp = new Date(reading.timestamp).toLocaleString();
            
            row.innerHTML = `
                <td>${formattedTimestamp}</td>
                <td>${reading.temperature || ''}</td>
                <td>${reading.sugar || ''}</td>
                <td>${reading.ph || ''}</td>
                <td>${reading.ta || ''}</td>
                <td>${reading.notes || ''}</td>
                <td>
                    <button class="edit-btn" data-index="${index}">Edit</button>
                    <button class="delete-btn" data-index="${index}">Delete</button>
                </td>
            `;
            
            logTableBody.appendChild(row);
        });
    };

    // Function to get data for a specific tank from localStorage
    const getTankData = (tankId) => {
        if (!tankId) return [];
        const data = localStorage.getItem(tankId);
        return data ? JSON.parse(data) : [];
    };
    
    // Function to save data for a specific tank to localStorage
    const saveTankData = (tankId, data) => {
        localStorage.setItem(tankId, JSON.stringify(data));
    };

    const toCSV = (data) => {
        if (!data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const parseCSV = (text) => {
        const [headerLine, ...lines] = text.trim().split(/\r?\n/);
        const headers = headerLine.split(',');
        return lines.filter(l => l.trim()).map(line => {
            const values = line.split(',');
            const entry = {};
            headers.forEach((h, i) => {
                let value = values[i];
                if (value) {
                    value = value.replace(/^"|"$/g, '');
                }
                entry[h] = value;
            });
            return entry;
        });
    };

    // --- Event Listeners ---

    // NEW: Listen for changes on the dropdown menu
    tankSelect.addEventListener('change', handleTankSelection);

    // Handle the form submission for a new reading
    readingForm.addEventListener('submit', (event) => {
        event.preventDefault(); 

        if (!currentTankId) {
            alert('Please select a tank from the dropdown.');
            return;
        }

        const timestamp = document.getElementById('timestamp').value.trim();
        const notes = document.getElementById('notes').value;

        const tempVal = document.getElementById('temperature').value.trim();
        const sugarVal = document.getElementById('sugar').value.trim();
        const phVal = document.getElementById('ph').value.trim();
        const taVal = document.getElementById('ta').value.trim();

        const temperature = tempVal === '' ? null : parseFloat(tempVal);
        const sugar = sugarVal === '' ? null : parseFloat(sugarVal);
        const ph = phVal === '' ? null : parseFloat(phVal);
        const ta = taVal === '' ? null : parseFloat(taVal);

        if (tempVal !== '' && !Number.isFinite(temperature)) {
            alert('Please enter a valid temperature.');
            return;
        }
        if (sugarVal !== '' && !Number.isFinite(sugar)) {
            alert('Please enter a valid sugar reading.');
            return;
        }
        if (phVal !== '' && !Number.isFinite(ph)) {
            alert('Please enter a valid pH value.');
            return;
        }
        if (taVal !== '' && !Number.isFinite(ta)) {
            alert('Please enter a valid total acidity.');
            return;
        }

        const newReading = { timestamp, notes };
        if (temperature !== null) newReading.temperature = temperature;
        if (sugar !== null) newReading.sugar = sugar;
        if (ph !== null) newReading.ph = ph;
        if (ta !== null) newReading.ta = ta;

        const tankData = getTankData(currentTankId);
        if (editingIndex !== null) {
            tankData[editingIndex] = newReading;
            editingIndex = null;
            submitBtn.textContent = 'Save Reading';
        } else {
            tankData.push(newReading);
        }
        tankData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        saveTankData(currentTankId, tankData);

        renderLog();
        readingForm.reset();
    });

    // Handle clicks on the Edit and Delete buttons
    logTableBody.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('edit-btn')) {
            const indexToEdit = parseInt(target.getAttribute('data-index'), 10);
            const tankData = getTankData(currentTankId);
            const entry = tankData[indexToEdit];
            document.getElementById('timestamp').value = entry.timestamp || '';
            document.getElementById('temperature').value = entry.temperature ?? '';
            document.getElementById('sugar').value = entry.sugar ?? '';
            document.getElementById('ph').value = entry.ph ?? '';
            document.getElementById('ta').value = entry.ta ?? '';
            document.getElementById('notes').value = entry.notes ?? '';
            editingIndex = indexToEdit;
            submitBtn.textContent = 'Update Reading';
        } else if (target.classList.contains('delete-btn')) {
            const indexToDelete = parseInt(target.getAttribute('data-index'), 10);

            if (confirm('Are you sure you want to delete this entry?')) {
                const tankData = getTankData(currentTankId);
                tankData.splice(indexToDelete, 1);
                saveTankData(currentTankId, tankData);
                renderLog();
            }
        }
    });

    const exportData = (format) => {
        if (!currentTankId) {
            alert('Please select a tank from the dropdown.');
            return;
        }
        const tankData = getTankData(currentTankId);
        if (tankData.length === 0) {
            alert('No data to export for this tank.');
            return;
        }
        let content, mime, ext;
        if (format === 'csv') {
            content = toCSV(tankData);
            mime = 'text/csv';
            ext = 'csv';
        } else {
            content = JSON.stringify(tankData, null, 2);
            mime = 'application/json';
            ext = 'json';
        }
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentTankId}_log.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    exportJsonBtn.addEventListener('click', () => exportData('json'));
    exportCsvBtn.addEventListener('click', () => exportData('csv'));

      importBtn.addEventListener('click', () => {
          if (!currentTankId) {
              alert('Please select a tank from the dropdown.');
              return;
          }
          importFileInput.click();
      });

      importFileInput.addEventListener('change', (event) => {
          const file = event.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  let imported;
                  if (file.name.toLowerCase().endsWith('.csv')) {
                      imported = parseCSV(e.target.result);
                  } else {
                      imported = JSON.parse(e.target.result);
                  }
                  if (!Array.isArray(imported)) throw new Error('Invalid file format');
                  const tankData = getTankData(currentTankId);
                  const merged = tankData.concat(imported);
                  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                  saveTankData(currentTankId, merged);
                  renderLog();
                  alert('Import successful!');
              } catch (err) {
                  alert('Failed to import file: ' + err.message);
              }
          };
          reader.readAsText(file);
          event.target.value = '';
      });
    
    // --- Initial Setup ---
    try {
        const response = await fetch('tanks.json');
        tanks = await response.json();
        populateTankSelector();
        handleTankSelection();
    } catch (error) {
        console.error('Failed to load tanks:', error);
    }
});
