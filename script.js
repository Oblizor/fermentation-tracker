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
    const importJsonBtn = document.getElementById('importJsonBtn');
    const importCsvBtn = document.getElementById('importCsvBtn');
    const importFileInput = document.getElementById('importFile');
    const submitBtn = readingForm.querySelector('button[type="submit"]');
    const overviewTableBody = document.getElementById('overviewTableBody');
    const toggleOverviewBtn = document.getElementById('toggleOverviewBtn');
    const overviewSection = document.querySelector('.overview');

    let currentTankId = ''; // Variable to store the currently active tank ID
    let tanks = []; // Will hold the tank list loaded from JSON
    let editingIndex = null; // Track index of reading being edited
    let importFormat = null; // Track desired import format

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
        renderLog(); // Load and display the log for the selected tank
        readingForm.reset();
        editingIndex = null;
        submitBtn.textContent = 'Save Reading';
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
                <td>${reading.sg || ''}</td>
                <td>${reading.ph || ''}</td>
                <td>${reading.ta || ''}</td>
                <td>${reading.volume || ''}</td>
                <td>${reading.notes || ''}</td>
                <td>
                    <button class="edit-btn" data-index="${index}">Edit</button>
                    <button class="delete-btn" data-index="${index}">Delete</button>
                </td>
            `;
            
            logTableBody.appendChild(row);
        });
        updateTankDetails();
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

    // Update the tank details section with capacity and latest volume
    function updateTankDetails() {
        const selectedTank = tanks.find(tank => tank.id === currentTankId);
        if (!selectedTank) {
            tankDetailsP.textContent = '';
            return;
        }
        const tankData = getTankData(currentTankId);
        let latestVolume = null;
        if (tankData.length > 0) {
            const latest = tankData.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
            if (latest.volume !== undefined) {
                latestVolume = latest.volume;
            }
        }
        const volumeDisplay = latestVolume !== null ? `${latestVolume} / ${selectedTank.capacity} L` : `N/A / ${selectedTank.capacity} L`;
        tankDetailsP.textContent = `Volume: ${volumeDisplay}. Details: ${selectedTank.description}`;
    }

    // Render the overview table with the latest reading for each tank
    const renderOverview = () => {
        if (!overviewTableBody) return;
        overviewTableBody.innerHTML = '';
        tanks.forEach(tank => {
            const tankData = getTankData(tank.id);
            if (tankData.length === 0) {
                return; // Skip tanks with no readings
            }
            let latest = null;
            if (tankData.length > 0) {
                latest = tankData.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
            }
            const row = document.createElement('tr');
            const formattedTimestamp = latest ? new Date(latest.timestamp).toLocaleString() : '';
            row.innerHTML = `
                <td>${tank.id}</td>
                <td>${formattedTimestamp}</td>
                <td>${latest?.temperature ?? ''}</td>
                <td>${latest?.sugar ?? ''}</td>
                <td>${latest?.sg ?? ''}</td>
                <td>${latest?.ph ?? ''}</td>
                <td>${latest?.ta ?? ''}</td>
                <td><button class="view-log-btn" data-tank="${tank.id}">View Log</button></td>
            `;
            overviewTableBody.appendChild(row);
        });
    };

    const toCSV = (data) => {
        if (!data.length) return '';
        const headers = Array.from(new Set(data.flatMap(d => Object.keys(d))));
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

    // Helper to merge tank readings using timestamp as a unique key.
    // Existing entries with the same timestamp are overwritten by the
    // imported ones, ensuring a single record per timestamp.
    const mergeReadings = (existing, imported) => {
        const map = new Map();
        existing.forEach(entry => map.set(entry.timestamp, entry));
        imported.forEach(entry => map.set(entry.timestamp, entry));
        // Convert the map back to an array sorted by timestamp (newest first)
        return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    };

    // --- Additive Calculator ---
    const calcVolumeInput = document.getElementById('calcVolume');
    if (calcVolumeInput) {
        const calcFields = [
            {
                name: 'Nutrients',
                rateInput: document.getElementById('nutrientRate'),
                resultSpan: document.getElementById('nutrientAmount'),
                button: document.getElementById('nutrientSave'),
                unit: 'g',
                calc: (vol, rate) => vol * rate / 100
            },
            {
                name: 'Enzymes',
                rateInput: document.getElementById('enzymeRate'),
                resultSpan: document.getElementById('enzymeAmount'),
                button: document.getElementById('enzymeSave'),
                unit: 'g',
                calc: (vol, rate) => vol * rate / 100
            },
            {
                name: 'SO₂ (KMS)',
                rateInput: document.getElementById('kmsRate'),
                resultSpan: document.getElementById('kmsAmount'),
                button: document.getElementById('kmsSave'),
                unit: 'g',
                calc: (vol, rate) => vol * rate / 1000
            },
            {
                name: 'Bentonite',
                rateInput: document.getElementById('bentoniteRate'),
                resultSpan: document.getElementById('bentoniteAmount'),
                button: document.getElementById('bentoniteSave'),
                unit: 'g',
                calc: (vol, rate) => vol * rate / 100
            },
            {
                name: 'Tannins',
                rateInput: document.getElementById('tanninRate'),
                resultSpan: document.getElementById('tanninAmount'),
                button: document.getElementById('tanninSave'),
                unit: 'g',
                calc: (vol, rate) => vol * rate / 100
            }
        ];

        const updateCalculator = () => {
            const volume = parseFloat(calcVolumeInput.value);
            calcFields.forEach(field => {
                const rate = parseFloat(field.rateInput.value);
                if (!Number.isNaN(volume) && !Number.isNaN(rate)) {
                    const amount = field.calc(volume, rate);
                    field.latestAmount = amount;
                    field.resultSpan.textContent = amount.toFixed(2);
                } else {
                    field.latestAmount = null;
                    field.resultSpan.textContent = '';
                }
            });
        };

        calcVolumeInput.addEventListener('input', updateCalculator);
        calcFields.forEach(field => {
            field.rateInput.addEventListener('input', updateCalculator);
            field.button.addEventListener('click', () => {
                if (!currentTankId) {
                    alert('Please select a tank from the dropdown.');
                    return;
                }
                if (field.latestAmount == null) {
                    alert('Please enter volume and dosage rate first.');
                    return;
                }
                const tankData = getTankData(currentTankId);
                tankData.push({
                    timestamp: new Date().toISOString(),
                    notes: `${field.name}: ${field.latestAmount.toFixed(2)} ${field.unit}`
                });
                saveTankData(currentTankId, tankData);
                renderLog();
                renderOverview();
            });
        });
    }

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

        const newReading = { timestamp, notes };
        const numericFields = ['temperature', 'sugar', 'sg', 'ph', 'ta', 'volume'];

        for (const field of numericFields) {
            const value = document.getElementById(field).value.trim();
            if (value === '') continue;
            const parsed = parseFloat(value);
            if (Number.isNaN(parsed)) {
                alert(`Please enter a valid ${field}.`);
                return;
            }
            newReading[field] = parsed;
        }

        const tankData = getTankData(currentTankId);
        if (editingIndex !== null) {
            tankData[editingIndex] = newReading;
        } else {
            tankData.push(newReading);
        }
        tankData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          saveTankData(currentTankId, tankData);

          renderLog();
          renderOverview();
          readingForm.reset();
          editingIndex = null;
          submitBtn.textContent = 'Save Reading';
      });

    // Handle clicks on the Edit and Delete buttons
    logTableBody.addEventListener('click', (event) => {
        const index = parseInt(event.target.getAttribute('data-index'), 10);

        if (event.target.classList.contains('edit-btn')) {
            const tankData = getTankData(currentTankId);
            const entry = tankData[index];
            document.getElementById('timestamp').value = entry.timestamp;
            document.getElementById('temperature').value = entry.temperature ?? '';
            document.getElementById('sugar').value = entry.sugar ?? '';
            document.getElementById('sg').value = entry.sg ?? '';
            document.getElementById('ph').value = entry.ph ?? '';
            document.getElementById('ta').value = entry.ta ?? '';
            document.getElementById('volume').value = entry.volume ?? '';
            document.getElementById('notes').value = entry.notes ?? '';
            editingIndex = index;
            submitBtn.textContent = 'Update Reading';
        } else if (event.target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this entry?')) {
                const tankData = getTankData(currentTankId);
                tankData.splice(index, 1);
                saveTankData(currentTankId, tankData);
                renderLog();
                renderOverview();
            }
        }
    });

      overviewTableBody.addEventListener('click', (event) => {
          if (event.target.classList.contains('view-log-btn')) {
              const tankId = event.target.getAttribute('data-tank');
              tankSelect.value = tankId;
              handleTankSelection();
              document.querySelector('.log-display').scrollIntoView({ behavior: 'smooth' });
          }
      });

      const handleExport = (format) => {
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

      exportJsonBtn.addEventListener('click', () => handleExport('json'));
      exportCsvBtn.addEventListener('click', () => handleExport('csv'));

      importJsonBtn.addEventListener('click', () => {
          if (!currentTankId) {
              alert('Please select a tank from the dropdown.');
              return;
          }
          importFormat = 'json';
          importFileInput.click();
      });

      importCsvBtn.addEventListener('click', () => {
          if (!currentTankId) {
              alert('Please select a tank from the dropdown.');
              return;
          }
          importFormat = 'csv';
          importFileInput.click();
      });

      importFileInput.addEventListener('change', (event) => {
          const file = event.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  let imported;
                  if (importFormat === 'csv' || file.name.toLowerCase().endsWith('.csv')) {
                      imported = parseCSV(e.target.result);
                  } else {
                      imported = JSON.parse(e.target.result);
                  }
                  if (!Array.isArray(imported)) throw new Error('Invalid file format');

                  const existingData = getTankData(currentTankId);
                  const numericFields = ['temperature', 'sugar', 'sg', 'ph', 'ta', 'volume'];

                  imported.forEach(entry => {
                      numericFields.forEach(field => {
                          if (entry[field] !== undefined && entry[field] !== '') {
                              const num = parseFloat(entry[field]);
                              if (!Number.isNaN(num)) {
                                  entry[field] = num;
                              }
                          }
                      });
                  });

                  // Merge while deduplicating by timestamp. Imported entries
                  // overwrite existing ones that share the same timestamp.
                  const merged = mergeReadings(existingData, imported);
                    saveTankData(currentTankId, merged);
                    renderLog();
                    renderOverview();
                    alert('Import successful!');
                } catch (err) {
                    alert('Failed to import file: ' + err.message);
                }
          };
          reader.readAsText(file);
          event.target.value = '';
          importFormat = null;
      });

      toggleOverviewBtn.addEventListener('click', () => {
          const isHidden = overviewSection.classList.toggle('hidden');
          toggleOverviewBtn.textContent = isHidden ? 'Show Overview' : 'Hide Overview';
          if (!isHidden) {
              overviewSection.scrollIntoView({ behavior: 'smooth' });
          }
      });

    // --- Initial Setup ---
    try {
        const response = await fetch('tanks.json');
        tanks = await response.json();
        populateTankSelector();
        handleTankSelection();
        renderOverview();
    } catch (error) {
        console.error('Failed to load tanks:', error);
    }
});
