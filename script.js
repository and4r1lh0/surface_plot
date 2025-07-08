document.addEventListener('DOMContentLoaded', function() {
    const HEIGHT = 10.0;
    const WIDTH = 3.0;
    const STORAGE_KEY = 'surfacePlotState';
    const MAX_GRID_POINTS = 500;

    const PLOT_CONFIG_2D = { displayModeBar: false, scrollZoom: false, dragmode: 'zoom', locale: 'ru' };
    const PLOT_CONFIG_3D = { displayModeBar: false, locale: 'ru' };

    const DEFAULTS = {
        gridPoints: 40, minVal: 0, maxVal: 10,
        titleX: 'X', titleY: 'Y', titleZ: 'Z'
    };
    
    let settings = {};
    let x_data, z_data, y_x_data, y_z_data;
    let isDragging = false;

    const plotElements = {
        plotX: document.getElementById('plotX'),
        plotZ: document.getElementById('plotZ'),
        plot3D: document.getElementById('plot3D')
    };
    const controlsForm = document.getElementById('controls-form');
    const tableWrapperX = document.getElementById('tableWrapperX');
    const tableWrapperZ = document.getElementById('tableWrapperZ');

    const linspace = (start, stop, num) => Array.from({ length: num }, (_, i) => start + (stop - start) / (num - 1) * i);
    
    const makeFunction = (coords) => {
        const center = (settings.minVal + settings.maxVal) / 2;
        const sigma = WIDTH / (2 * Math.sqrt(2 * Math.log(2)));
        return coords.map(coord => HEIGHT * Math.exp(-((coord - center) ** 2) / (2 * sigma ** 2)));
    };
    
    const outerProduct = (v1, v2) => v1.map(e1 => v2.map(e2 => e1 * e2));

    function saveState() {
        const stateToSave = { ...settings, y_x_data, y_z_data };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }

    function loadState() {
        const savedStateJSON = localStorage.getItem(STORAGE_KEY);
        if (savedStateJSON) {
            try {
                const savedState = JSON.parse(savedStateJSON);
                settings = { ...DEFAULTS, ...savedState };
                y_x_data = savedState.y_x_data;
                y_z_data = savedState.y_z_data;
            } catch (e) { resetToDefaults(); }
        } else {
            resetToDefaults();
        }
    }

    function resetToDefaults() {
        settings = { ...DEFAULTS };
        y_x_data = null;
        y_z_data = null;
    }

    function updateUIFromSettings() {
        Object.keys(DEFAULTS).forEach(key => {
            const inputId = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            if (document.getElementById(inputId)) document.getElementById(inputId).value = settings[key];
        });
    }

    function generateInitialData() {
        x_data = linspace(settings.minVal, settings.maxVal, settings.gridPoints);
        z_data = linspace(settings.minVal, settings.maxVal, settings.gridPoints);
        if (!y_x_data || y_x_data.length !== settings.gridPoints) {
            y_x_data = makeFunction(x_data);
        }
        if (!y_z_data || y_z_data.length !== settings.gridPoints) {
            y_z_data = makeFunction(z_data);
        }
    }

    function getLayouts() {
        const allYData = [...y_x_data, ...y_z_data];
        const globalMinY = Math.min(...allYData);
        const globalMaxY = Math.max(...allYData);
        const padding = (globalMaxY - globalMinY) * 0.1 || 1;
        const yRange = [globalMinY - padding, globalMaxY + padding];
        
        const commonYAxis = { title: settings.titleY, range: yRange };
        
        return {
            layoutX: { title: `Зависимость ${settings.titleY} от ${settings.titleX}`, xaxis: { title: settings.titleX }, yaxis: commonYAxis, margin: { l: 50, r: 20, b: 50, t: 50 } },
            layoutZ: { title: `Зависимость ${settings.titleY} от ${settings.titleZ}`, xaxis: { title: settings.titleZ }, yaxis: commonYAxis, margin: { l: 50, r: 20, b: 50, t: 50 } },
            layout3D: { title: `3D Поверхность`, scene: { xaxis: { title: settings.titleX }, yaxis: { title: settings.titleZ }, zaxis: { title: settings.titleY, range: yRange } }, margin: { l: 0, r: 0, b: 0, t: 40 } }
        };
    }

    function updateAllGraphs() {
        const { layoutX, layoutZ, layout3D } = getLayouts();
        Plotly.react(plotElements.plotX, [{ x: x_data, y: y_x_data, mode: 'lines+markers', marker: { size: 5, color: '#007bff' } }], layoutX, PLOT_CONFIG_2D);
        Plotly.react(plotElements.plotZ, [{ x: z_data, y: y_z_data, mode: 'lines+markers', marker: { size: 5, color: '#dc3545' } }], layoutZ, PLOT_CONFIG_2D);
        
        const surfaceData = outerProduct(y_z_data, y_x_data);
        const normalizedSurface = surfaceData.map(row => row.map(val => val / HEIGHT));
        Plotly.react(plotElements.plot3D, [{ x: x_data, y: z_data, z: normalizedSurface, type: 'surface', colorscale: 'Viridis' }], layout3D, PLOT_CONFIG_3D);
    }
    
    function renderTables() {
        const generateTableHTML = (profileTitle, xTitle, yTitle, x_vals, y_vals) => {
            let html = `<h3>${profileTitle}</h3><table><thead><tr><th>${xTitle}</th><th>${yTitle}</th></tr></thead><tbody>`;
            html += y_vals.map((y, i) => `<tr><td>${x_vals[i].toFixed(2)}</td><td><input type="number" step="0.1" value="${y.toFixed(3)}" data-index="${i}"></td></tr>`).join('');
            html += `</tbody></table>`;
            return html;
        };
        tableWrapperX.innerHTML = generateTableHTML(`Зависимость ${settings.titleY} от ${settings.titleX}`, settings.titleX, settings.titleY, x_data, y_x_data);
        tableWrapperZ.innerHTML = generateTableHTML(`Зависимость ${settings.titleY} от ${settings.titleZ}`, settings.titleZ, settings.titleY, z_data, y_z_data);
    }

    function fullRedraw() {
        generateInitialData();
        updateAllGraphs();
        renderTables();
    }

    function updateAllLayoutsAndSave() {
        updateAllGraphs();
        renderTables();
        saveState();
    }

    const heavyControls = ['grid-points', 'min-val', 'max-val'];
    controlsForm.addEventListener('change', (e) => {
        if (!heavyControls.includes(e.target.id)) return;

        const input = e.target;
        const camelCaseId = input.id.replace(/-([a-z])/g, g => g[1].toUpperCase());
        let value = parseFloat(input.value);

        if (isNaN(value)) {
            input.value = settings[camelCaseId];
            return;
        }

        if (input.id === 'grid-points') {
            if (value > MAX_GRID_POINTS) value = MAX_GRID_POINTS;
            if (value < 2) value = 2;
            input.value = value;
        }
        
        y_x_data = null; 
        y_z_data = null; 
        
        settings[camelCaseId] = value;
        fullRedraw();
        saveState();
    });


    const lightControls = ['title-x', 'title-y', 'title-z'];
    controlsForm.addEventListener('input', (e) => {
        if (!lightControls.includes(e.target.id)) return;
        
        const camelCaseId = e.target.id.replace(/-([a-z])/g, g => g[1].toUpperCase());
        settings[camelCaseId] = e.target.value;

        updateAllLayoutsAndSave();
    });

    document.getElementById('reset-button').addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
        }
    });

    document.querySelectorAll('.plot-export-buttons button').forEach(button => {
        button.addEventListener('click', (e) => {
            const plotId = e.target.dataset.plotId;
            const format = e.target.dataset.format;
            const plotDiv = plotElements[plotId];
            Plotly.downloadImage(plotDiv, { format: format, width: plotDiv.clientWidth * 1.5, height: plotDiv.clientHeight * 1.5, filename: `${plotId}_export` });
        });
    });
    
    window.addEventListener('mousedown', (e) => { if (e.button === 2) { isDragging = true; document.body.style.cursor = 'ns-resize'; }});
    window.addEventListener('mouseup', (e) => {
        if (e.button === 2 && isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            updateAllLayoutsAndSave();
        }
    });

    function setupPlotInteraction(plotDiv) {
        plotDiv.oncontextmenu = (e) => e.preventDefault(); 
        plotDiv.on('plotly_hover', (eventData) => {
            if (!isDragging || !eventData.points.length) return;
            
            const pointIndex = eventData.points[0].pointNumber;
            const newY = eventData.yvals[0];
            const dataArray = plotDiv === plotElements.plotX ? y_x_data : y_z_data;
            dataArray[pointIndex] = newY;
            
            Plotly.restyle(plotDiv, { y: [dataArray] }, [0]);
            
            const tableWrapper = plotDiv === plotElements.plotX ? tableWrapperX : tableWrapperZ;
            const tableInput = tableWrapper.querySelector(`input[data-index="${pointIndex}"]`);
            if (tableInput) tableInput.value = dataArray[pointIndex].toFixed(3);
        });
    }

function init() {
    loadState();
    updateUIFromSettings();
    fullRedraw();
    
    setupPlotInteraction(plotElements.plotX);
    setupPlotInteraction(plotElements.plotZ);
    
    document.querySelector('.table-section').addEventListener('change', (e) => {
        if (e.target.tagName !== 'INPUT' || !e.target.dataset.index) return;

        const tableWrapper = e.target.closest('.table-container');
        if (!tableWrapper) return;

        const isXTable = tableWrapper.id === 'tableWrapperX';
        const dataArray = isXTable ? y_x_data : y_z_data;
        const plotDiv = isXTable ? plotElements.plotX : plotElements.plotZ;
        
        const index = parseInt(e.target.dataset.index);
        const value = parseFloat(e.target.value);

        if (!isNaN(value) && dataArray[index] !== undefined) {
            dataArray[index] = value;
            
            Plotly.restyle(plotDiv, { y: [dataArray] }, [0]);
            updateAllLayoutsAndSave();
        } else {
            e.target.value = dataArray[index]?.toFixed(3) || 0;
        }
    });

    document.querySelector('.table-section').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.target.blur();
            e.preventDefault();
        }
    });
}

    init();
});
