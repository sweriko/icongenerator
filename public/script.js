document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const initialStep = document.getElementById('initial-step');
    const generationStep = document.getElementById('generation-step');
    const editStep = document.getElementById('edit-step');
    const finalStep = document.getElementById('final-step');
    const previewControls = document.getElementById('preview-controls');
    const appDescription = document.getElementById('app-description');
    const generateBtn = document.getElementById('generate-btn');
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    const startOverBtn = document.getElementById('start-over-btn');
    const stylePresetBtns = document.querySelectorAll('.style-preset-btn');
    const previewCanvas = document.getElementById('preview-canvas');
    const editCanvas = document.getElementById('edit-canvas');
    const finalCanvas = document.getElementById('final-canvas');
    const loadingOverlay = document.getElementById('loading-overlay');
    const editorLoadingOverlay = document.getElementById('editor-loading-overlay');
    const cancelBtn = document.getElementById('cancel-btn');
    const confirmBtn = document.getElementById('confirm-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadMenu = document.getElementById('download-menu');
    const downloadSingle = document.getElementById('download-single');
    const downloadAll = document.getElementById('download-all');
    const sizeItems = document.querySelectorAll('.size-item');
    const editBtn = document.getElementById('edit-btn');
    const phoneEmulator = document.getElementById('phone-emulator');
    const editCanvasWrapper = document.querySelector('.edit-canvas-wrapper');
    
    // Canvas contexts
    const previewCtx = previewCanvas.getContext('2d');
    const editCtx = editCanvas.getContext('2d');
    const finalCtx = finalCanvas.getContext('2d');
    
    // App state
    let currentImage = null;
    let finalIcon = null;
    let selectionBox = {
        x: 0,
        y: 0,
        size: 400,
        isDragging: false,
        isResizing: false,
        dragStartX: 0,
        dragStartY: 0,
        resizeStartPosition: { x: 0, y: 0 },
        resizeStartSize: 0
    };

    // For throttling redraws on rapid events
    let redrawScheduled = false;
    function scheduleRedraw() {
        if (!redrawScheduled) {
            redrawScheduled = true;
            requestAnimationFrame(() => {
                redrawScheduled = false;
                drawSelectionOverlay();
            });
        }
    }
    
    // Function to check which style presets are in the text and update button states
    function updateStylePresetButtons() {
        const currentText = appDescription.value.trim();
        
        stylePresetBtns.forEach(btn => {
            const style = btn.getAttribute('data-style');
            if (currentText.includes(style)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Check active styles when text changes
    appDescription.addEventListener('input', updateStylePresetButtons);
    
    // Icon sizes configurations
    const iconSizes = {
        ios: [
            { size: 120, name: 'iPhone-Home-Screen@2x', folder: 'iOS/AppIcon.appiconset' },
            { size: 180, name: 'iPhone-Home-Screen@3x', folder: 'iOS/AppIcon.appiconset' },
            { size: 167, name: 'iPad-Pro-Home-Screen', folder: 'iOS/AppIcon.appiconset' },
            { size: 152, name: 'iPad-Home-Screen', folder: 'iOS/AppIcon.appiconset' },
            { size: 80, name: 'Spotlight@2x', folder: 'iOS/AppIcon.appiconset' },
            { size: 120, name: 'Spotlight@3x', folder: 'iOS/AppIcon.appiconset' },
            { size: 58, name: 'Settings@2x', folder: 'iOS/AppIcon.appiconset' },
            { size: 87, name: 'Settings@3x', folder: 'iOS/AppIcon.appiconset' },
            { size: 76, name: 'Notifications@2x', folder: 'iOS/AppIcon.appiconset' },
            { size: 114, name: 'Notifications@3x', folder: 'iOS/AppIcon.appiconset' }
        ],
        android: [
            { size: 36, name: 'ldpi', folder: 'Android' },
            { size: 48, name: 'mdpi', folder: 'Android' },
            { size: 72, name: 'hdpi', folder: 'Android' },
            { size: 96, name: 'xhdpi', folder: 'Android' },
            { size: 144, name: 'xxhdpi', folder: 'Android' },
            { size: 192, name: 'xxxhdpi', folder: 'Android' },
            { size: 512, name: 'playstore', folder: 'Android' }
        ]
    };
    
    // Create and cache a checkerboard pattern to improve performance
    let checkerPattern;
    function getCheckerboardPattern(ctx) {
        if (!checkerPattern) {
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = 32;
            patternCanvas.height = 32;
            const pctx = patternCanvas.getContext('2d');
            // Base color
            pctx.fillStyle = '#f0f0f0';
            pctx.fillRect(0, 0, 32, 32);
            // Draw alternating squares
            pctx.fillStyle = '#e0e0e0';
            pctx.fillRect(0, 0, 16, 16);
            pctx.fillRect(16, 16, 16, 16);
            checkerPattern = ctx.createPattern(patternCanvas, 'repeat');
        }
        return checkerPattern;
    }
    
    // Optimized drawCheckerboard using the cached pattern
    function drawCheckerboard(ctx, width, height) {
        ctx.fillStyle = getCheckerboardPattern(ctx);
        ctx.fillRect(0, 0, width, height);
    }
    
    // Initialize preview canvas
    function initPreviewCanvas() {
        drawCheckerboard(previewCtx, previewCanvas.width, previewCanvas.height);
    }
    
    // Initialize canvas on load
    initPreviewCanvas();
    
    // Initialize style preset buttons
    updateStylePresetButtons();
    
    // Scale factor for high DPI displays
    const getScaleFactor = (canvas) => {
        const rect = canvas.getBoundingClientRect();
        return canvas.width / rect.width;
    };
    
    // Show loading state
    function showLoading(show) {
        loadingOverlay.classList.toggle('hidden', !show);
    }
    
    // Change app step
    function setStep(step) {
        initialStep.classList.toggle('hidden', step !== 'initial');
        generationStep.classList.toggle('hidden', step !== 'generation');
        editStep.classList.toggle('hidden', step !== 'edit');
        finalStep.classList.toggle('hidden', step !== 'final');
        
        if (step !== 'edit') {
            phoneEmulator.classList.add('hidden');
            phoneEmulator.classList.remove('visible');
            editCanvasWrapper.style.transform = '';
        } else {
            document.querySelector('.edit-container').style.width = '100%';
        }
    }
    
    // Draw the selection overlay with rounded rect and grid guide
    function drawSelectionOverlay() {
        // Clear and draw background
        editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
        drawCheckerboard(editCtx, editCanvas.width, editCanvas.height);
        editCtx.drawImage(currentImage, 0, 0, editCanvas.width, editCanvas.height);
        editCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        editCtx.fillRect(0, 0, editCanvas.width, editCanvas.height);
        
        // Save context and clip to rounded rectangle
        editCtx.save();
        const radius = 80;
        const x = selectionBox.x;
        const y = selectionBox.y;
        const size = selectionBox.size;
        editCtx.beginPath();
        editCtx.moveTo(x + radius, y);
        editCtx.lineTo(x + size - radius, y);
        editCtx.quadraticCurveTo(x + size, y, x + size, y + radius);
        editCtx.lineTo(x + size, y + size - radius);
        editCtx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
        editCtx.lineTo(x + radius, y + size);
        editCtx.quadraticCurveTo(x, y + size, x, y + size - radius);
        editCtx.lineTo(x, y + radius);
        editCtx.quadraticCurveTo(x, y, x + radius, y);
        editCtx.closePath();
        editCtx.clip();
        
        editCtx.clearRect(x, y, size, size);
        editCtx.drawImage(currentImage, 0, 0, editCanvas.width, editCanvas.height);
        
        // Draw red grid overlay
        drawIconGrid(editCtx, x, y, size);
        editCtx.restore();
        
        // Draw the rounded rectangle border
        editCtx.strokeStyle = '#ff4444';
        editCtx.lineWidth = 3;
        editCtx.beginPath();
        editCtx.moveTo(x + radius, y);
        editCtx.lineTo(x + size - radius, y);
        editCtx.quadraticCurveTo(x + size, y, x + size, y + radius);
        editCtx.lineTo(x + size, y + size - radius);
        editCtx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
        editCtx.lineTo(x + radius, y + size);
        editCtx.quadraticCurveTo(x, y + size, x, y + size - radius);
        editCtx.lineTo(x, y + radius);
        editCtx.quadraticCurveTo(x, y, x + radius, y);
        editCtx.closePath();
        editCtx.stroke();
        
        // Draw resize handle with adjusted dot
        editCtx.fillStyle = '#ff4444';
        editCtx.strokeStyle = '#ff4444';
        editCtx.lineWidth = 3;
        const dotOffset = 2;
        const dotRadius = 12;
        const dotX = x + size - 8 + dotOffset;
        const dotY = y + size - 8 + dotOffset;
        editCtx.beginPath();
        editCtx.moveTo(x + size - 24, y + size - 24);
        editCtx.lineTo(dotX, dotY);
        editCtx.stroke();
        editCtx.beginPath();
        editCtx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        editCtx.fill();
        
        // Update emulator icon
        updateEmulatorIcon();
    }
    
    // Draw icon grid overlay guide (red)
    function drawIconGrid(ctx, x, y, size) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        const center = { x: x + size / 2, y: y + size / 2 };
        for (let i = 1; i < 3; i++) {
            const posX = x + (size * i / 3);
            ctx.beginPath();
            ctx.moveTo(posX, y);
            ctx.lineTo(posX, y + size);
            ctx.stroke();
        }
        for (let i = 1; i < 3; i++) {
            const posY = y + (size * i / 3);
            ctx.beginPath();
            ctx.moveTo(x, posY);
            ctx.lineTo(x + size, posY);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(center.x, y);
        ctx.lineTo(center.x, y + size);
        ctx.moveTo(x, center.y);
        ctx.lineTo(x + size, center.y);
        ctx.stroke();
        const radiusSizes = [size * 0.1, size * 0.2, size * 0.35, size * 0.5];
        radiusSizes.forEach(radius => {
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.stroke();
        ctx.restore();
    }
    
    // Draw the final icon on the canvas
    function drawFinalIcon() {
        finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
        drawCheckerboard(finalCtx, finalCanvas.width, finalCanvas.height);
        if (finalIcon) {
            finalCtx.drawImage(finalIcon, 0, 0, finalCanvas.width, finalCanvas.height);
        }
    }
    
    // Update emulator icon
    function updateEmulatorIcon() {
        if (phoneEmulator.classList.contains('hidden')) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = selectionBox.size;
        tempCanvas.height = selectionBox.size;
        const tempCtx = tempCanvas.getContext('2d');
        const radius = 80 * (selectionBox.size / 400);
        tempCtx.beginPath();
        tempCtx.moveTo(radius, 0);
        tempCtx.lineTo(selectionBox.size - radius, 0);
        tempCtx.quadraticCurveTo(selectionBox.size, 0, selectionBox.size, radius);
        tempCtx.lineTo(selectionBox.size, selectionBox.size - radius);
        tempCtx.quadraticCurveTo(selectionBox.size, selectionBox.size, selectionBox.size - radius, selectionBox.size);
        tempCtx.lineTo(radius, selectionBox.size);
        tempCtx.quadraticCurveTo(0, selectionBox.size, 0, selectionBox.size - radius);
        tempCtx.lineTo(0, radius);
        tempCtx.quadraticCurveTo(0, 0, radius, 0);
        tempCtx.closePath();
        tempCtx.clip();
        tempCtx.drawImage(
            currentImage,
            selectionBox.x, selectionBox.y, selectionBox.size, selectionBox.size,
            0, 0, selectionBox.size, selectionBox.size
        );
        const iconUrl = tempCanvas.toDataURL('image/png');
        if (window.IconPreview) {
            window.IconPreview.updateIcon(iconUrl, "Your App");
        }
    }
    
    // Initialize phone emulator
    function initPhoneEmulator() {
        const phoneWidth = 300;
        const phoneHeight = phoneWidth * (147.6/71.6);
        const iconSize = phoneWidth * 0.15;
        document.getElementById('iphonePreview').style.width = `${phoneWidth}px`;
        document.getElementById('iphonePreview').style.height = `${phoneHeight}px`;
        document.getElementById('weatherWidget').style.width = `42%`;
        document.getElementById('weatherWidget').style.height = `${phoneWidth * 0.32}px`;
        document.getElementById('calendarWidget').style.width = `42%`;
        document.getElementById('calendarWidget').style.height = `${phoneWidth * 0.32}px`;
        function updateTime() {
            const now = new Date();
            let hours = now.getHours();
            let minutes = now.getMinutes();
            if (hours < 10) hours = '0' + hours;
            if (minutes < 10) minutes = '0' + minutes;
            document.getElementById('statusTime').innerHTML = `<span>${hours}:${minutes}</span>`;
        }
        updateTime();
        setInterval(updateTime, 60000);
        function createAppIcon(iconUrl, name, bgColor, highlighted = false) {
            const iconContainer = document.createElement('div');
            iconContainer.className = highlighted ? 'app-icon-wrapper highlighted' : 'app-icon-wrapper';
            let html = '';
            if (highlighted) {
                html += `<div class="highlight-border"></div>`;
            }
            html += `
                <div class="app-icon" style="width: ${iconSize}px; height: ${iconSize}px;">
                    ${bgColor ? `<div class="app-bg ${bgColor}"></div>` : ''}
                    <img 
                        src="${iconUrl}" 
                        alt="${name}" 
                        class="app-img" 
                        style="width: ${iconSize}px; height: ${iconSize}px;"
                    />
                </div>
                <span class="app-name" style="max-width: ${iconSize}px;">${name}</span>
            `;
            iconContainer.innerHTML = html;
            return iconContainer;
        }
        const displayIcon = "/api/placeholder/180/180";
        const appGrid = document.getElementById('appGrid');
        appGrid.innerHTML = '';
        const appIcons = [
            { url: "/api/placeholder/180/180", name: "FaceTime", bgClass: "bg-green-400" },
            { url: "/api/placeholder/180/180", name: "Calendar", bgClass: "bg-yellow-400" },
            { url: "/api/placeholder/180/180", name: "Photos", bgClass: "bg-gradient-1" },
            { url: "/api/placeholder/180/180", name: "Camera", bgClass: "bg-gray-700" },
            { url: "/api/placeholder/180/180", name: "Mail", bgClass: "bg-blue-400" },
            { url: "/api/placeholder/180/180", name: "Notes", bgClass: "bg-yellow-200" },
            { url: "/api/placeholder/180/180", name: "Reminders", bgClass: "bg-white" },
            { url: "/api/placeholder/180/180", name: "Clock", bgClass: "bg-black" },
            { url: "/api/placeholder/180/180", name: "TV", bgClass: "bg-black" },
            { url: "/api/placeholder/180/180", name: "Podcasts", bgClass: "bg-gradient-2" },
            { url: displayIcon, name: "Your App", bgClass: "", highlighted: true },
            { url: "/api/placeholder/180/180", name: "Maps", bgClass: "bg-gradient-3" },
            { url: "/api/placeholder/180/180", name: "Health", bgClass: "bg-red-500" },
            { url: "/api/placeholder/180/180", name: "Wallet", bgClass: "bg-gradient-4" },
            { url: "/api/placeholder/180/180", name: "Settings", bgClass: "bg-gray-200" },
            { url: "/api/placeholder/180/180", name: "App Store", bgClass: "bg-blue-500" }
        ];
        appIcons.forEach(app => {
            appGrid.appendChild(createAppIcon(app.url, app.name, app.bgClass, app.highlighted));
        });
        const dockIcons = document.getElementById('dockIcons');
        dockIcons.innerHTML = '';
        const dockApps = [
            { url: "/api/placeholder/180/180", name: "Phone", bgClass: "bg-green-500" },
            { url: displayIcon, name: "Your App", bgClass: "", highlighted: true },
            { url: "/api/placeholder/180/180", name: "Messages", bgClass: "bg-green-400" },
            { url: "/api/placeholder/180/180", name: "Music", bgClass: "bg-gradient-5" }
        ];
        dockApps.forEach(app => {
            dockIcons.appendChild(createAppIcon(app.url, app.name, app.bgClass, app.highlighted));
        });
        window.IconPreview = {
            updateIcon: function(newIconUrl, newIconName) {
                const iconToUpdate = newIconUrl || displayIcon;
                const nameToUpdate = newIconName || "Your App";
                document.querySelectorAll('.highlighted .app-img').forEach(img => {
                    img.src = iconToUpdate;
                    img.alt = nameToUpdate;
                });
                document.querySelectorAll('.highlighted .app-name').forEach(span => {
                    span.textContent = nameToUpdate;
                });
            }
        };
    }
    
    initPhoneEmulator();
    
    // Generate Icon Button Click
    generateBtn.addEventListener('click', async () => {
        const description = appDescription.value.trim();
        if (!description) {
            alert('Please enter an app description first.');
            return;
        }
        setStep('generation');
        showLoading(true);
        previewControls.classList.add('hidden');
    
        try {
            const response = await fetch('/api/generate-icon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appDescription: description })
            });
    
            if (!response.ok) {
                throw new Error('Failed to generate icon');
            }
    
            const data = await response.json();
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function() {
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                drawCheckerboard(previewCtx, previewCanvas.width, previewCanvas.height);
                const ratio = img.width / img.height;
                let drawWidth = previewCanvas.width;
                let drawHeight = previewCanvas.width / ratio;
                if (drawHeight > previewCanvas.height) {
                    drawHeight = previewCanvas.height;
                    drawWidth = previewCanvas.height * ratio;
                }
                const x = (previewCanvas.width - drawWidth) / 2;
                const y = (previewCanvas.height - drawHeight) / 2;
                previewCtx.drawImage(img, x, y, drawWidth, drawHeight);
                currentImage = img;
                showLoading(false);
                previewControls.classList.remove('hidden');
            };
            
            img.onerror = function() {
                showLoading(false);
                alert('Failed to load the generated image. Please try again.');
                setStep('initial');
            };
            
            img.src = data.imageUrl;
    
        } catch (error) {
            console.error('Error generating icon:', error);
            alert('An error occurred while generating the icon. Please try again.');
            showLoading(false);
            setStep('initial');
        }
    });
    
    // Accept button click - move to editor
    acceptBtn.addEventListener('click', function() {
        if (!currentImage) return;
        editStep.style.transition = 'none';
        document.querySelector('.edit-container').style.width = '100%';
        setStep('edit');
        selectionBox.x = (editCanvas.width - selectionBox.size) / 2;
        selectionBox.y = (editCanvas.height - selectionBox.size) / 2;
        drawSelectionOverlay();
        void editStep.offsetWidth;
        editStep.style.transition = '';
        setTimeout(() => {
            editCanvasWrapper.style.transform = 'translateX(-15%)';
            setTimeout(() => {
                phoneEmulator.classList.remove('hidden');
                setTimeout(() => {
                    phoneEmulator.classList.add('visible');
                    updateEmulatorIcon();
                }, 100);
            }, 300);
        }, 100);
    });
    
    // Reject button click - regenerate
    rejectBtn.addEventListener('click', function() {
        generateBtn.click();
    });
    
    // Start Over button click - go back to initial step
    startOverBtn.addEventListener('click', function() {
        setStep('initial');
        initPreviewCanvas();
        updateStylePresetButtons();
    });
    
    // Style preset buttons
    stylePresetBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const style = this.getAttribute('data-style');
            const isActive = this.classList.contains('active');
            let currentText = appDescription.value.trim();
            
            if (isActive) {
                if (currentText.includes(style)) {
                    if (currentText === style) {
                        currentText = '';
                    } else if (currentText.includes(', ' + style + ', ')) {
                        currentText = currentText.replace(', ' + style, '');
                    } else if (currentText.includes(style + ', ')) {
                        currentText = currentText.replace(style + ', ', '');
                    } else if (currentText.includes(', ' + style)) {
                        currentText = currentText.replace(', ' + style, '');
                    }
                    appDescription.value = currentText;
                }
                this.classList.remove('active');
            } else {
                if (currentText) {
                    if (!currentText.endsWith(',')) {
                        currentText += ', ';
                    } else if (!currentText.endsWith(', ')) {
                        currentText += ' ';
                    }
                    appDescription.value = currentText + style;
                } else {
                    appDescription.value = style;
                }
                this.classList.add('active');
            }
            appDescription.focus();
        });
    });
    
    // Enter key press in textarea triggers generate
    appDescription.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateBtn.click();
        }
    });
    
    // Mouse down event for dragging and resizing
    editCanvas.addEventListener('mousedown', function(e) {
        const rect = editCanvas.getBoundingClientRect();
        const scaleFactor = getScaleFactor(editCanvas);
        const mouseX = (e.clientX - rect.left) * scaleFactor;
        const mouseY = (e.clientY - rect.top) * scaleFactor;
        
        const dotOffset = 2;
        const dotRadius = 12;
        const dotX = selectionBox.x + selectionBox.size - 8 + dotOffset;
        const dotY = selectionBox.y + selectionBox.size - 8 + dotOffset;
        
        const dx = mouseX - dotX;
        const dy = mouseY - dotY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= dotRadius + 5) {
            selectionBox.isResizing = true;
            selectionBox.isDragging = false;
            selectionBox.resizeStartPosition = { x: mouseX, y: mouseY };
            selectionBox.resizeStartSize = selectionBox.size;
        } else if (
            mouseX >= selectionBox.x && 
            mouseX <= selectionBox.x + selectionBox.size && 
            mouseY >= selectionBox.y && 
            mouseY <= selectionBox.y + selectionBox.size
        ) {
            selectionBox.isDragging = true;
            selectionBox.isResizing = false;
            selectionBox.dragStartX = mouseX - selectionBox.x;
            selectionBox.dragStartY = mouseY - selectionBox.y;
        }
    });
    
    // Mouse move event for dragging and resizing (using requestAnimationFrame for throttling)
    editCanvas.addEventListener('mousemove', function(e) {
        if (!selectionBox.isDragging && !selectionBox.isResizing) return;
        const rect = editCanvas.getBoundingClientRect();
        const scaleFactor = getScaleFactor(editCanvas);
        const mouseX = (e.clientX - rect.left) * scaleFactor;
        const mouseY = (e.clientY - rect.top) * scaleFactor;
        
        if (selectionBox.isDragging) {
            let newX = mouseX - selectionBox.dragStartX;
            let newY = mouseY - selectionBox.dragStartY;
            newX = Math.max(0, Math.min(newX, editCanvas.width - selectionBox.size));
            newY = Math.max(0, Math.min(newY, editCanvas.height - selectionBox.size));
            selectionBox.x = newX;
            selectionBox.y = newY;
            scheduleRedraw();
        } else if (selectionBox.isResizing) {
            const deltaX = mouseX - selectionBox.resizeStartPosition.x;
            const deltaY = mouseY - selectionBox.resizeStartPosition.y;
            const delta = Math.max(deltaX, deltaY);
            let newSize = selectionBox.resizeStartSize + delta;
            newSize = Math.max(100, Math.min(newSize, Math.min(
                editCanvas.width - selectionBox.x, 
                editCanvas.height - selectionBox.y
            )));
            selectionBox.size = newSize;
            scheduleRedraw();
        }
    });
    
    // Mouse up and mouse leave events
    function endDragResize() {
        selectionBox.isDragging = false;
        selectionBox.isResizing = false;
    }
    editCanvas.addEventListener('mouseup', endDragResize);
    editCanvas.addEventListener('mouseleave', endDragResize);
    
    // Keyboard navigation for precise control (using throttled redraw)
    document.addEventListener('keydown', function(e) {
        if (editStep.classList.contains('hidden')) return;
        const moveStep = e.shiftKey ? 10 : 1;
        let moved = false;
        switch (e.key) {
            case 'ArrowUp':
                if (selectionBox.y > 0) {
                    selectionBox.y = Math.max(0, selectionBox.y - moveStep);
                    moved = true;
                }
                break;
            case 'ArrowDown':
                if (selectionBox.y + selectionBox.size < editCanvas.height) {
                    selectionBox.y = Math.min(editCanvas.height - selectionBox.size, selectionBox.y + moveStep);
                    moved = true;
                }
                break;
            case 'ArrowLeft':
                if (selectionBox.x > 0) {
                    selectionBox.x = Math.max(0, selectionBox.x - moveStep);
                    moved = true;
                }
                break;
            case 'ArrowRight':
                if (selectionBox.x + selectionBox.size < editCanvas.width) {
                    selectionBox.x = Math.min(editCanvas.width - selectionBox.size, selectionBox.x + moveStep);
                    moved = true;
                }
                break;
        }
        if (moved) {
            e.preventDefault();
            scheduleRedraw();
        }
    });
    
    // Touch events for mobile support
    editCanvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        editCanvas.dispatchEvent(mouseEvent);
    });
    editCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        editCanvas.dispatchEvent(mouseEvent);
    });
    editCanvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup');
        editCanvas.dispatchEvent(mouseEvent);
    });
    
    // Toggle download menu when clicking the download button
    downloadBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        downloadMenu.classList.toggle('active');
    });
    document.addEventListener('click', function() {
        downloadMenu.classList.remove('active');
    });
    downloadMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Confirm selection button
    confirmBtn.addEventListener('click', function() {
        if (!currentImage) return;
        editorLoadingOverlay.classList.remove('hidden');
        const offscreenCanvas = document.createElement('canvas');
        const offscreenCtx = offscreenCanvas.getContext('2d');
        offscreenCanvas.width = selectionBox.size;
        offscreenCanvas.height = selectionBox.size;
        offscreenCtx.drawImage(
            currentImage,
            selectionBox.x, selectionBox.y, selectionBox.size, selectionBox.size,
            0, 0, selectionBox.size, selectionBox.size
        );
        const iconCanvas = document.createElement('canvas');
        const iconCtx = iconCanvas.getContext('2d');
        iconCanvas.width = 1024;
        iconCanvas.height = 1024;
        const cornerRadiusScale = 1024 / selectionBox.size;
        const radius = 80 * cornerRadiusScale;
        iconCtx.beginPath();
        iconCtx.moveTo(radius, 0);
        iconCtx.lineTo(1024 - radius, 0);
        iconCtx.quadraticCurveTo(1024, 0, 1024, radius);
        iconCtx.lineTo(1024, 1024 - radius);
        iconCtx.quadraticCurveTo(1024, 1024, 1024 - radius, 1024);
        iconCtx.lineTo(radius, 1024);
        iconCtx.quadraticCurveTo(0, 1024, 0, 1024 - radius);
        iconCtx.lineTo(0, radius);
        iconCtx.quadraticCurveTo(0, 0, radius, 0);
        iconCtx.closePath();
        iconCtx.clip();
        iconCtx.drawImage(offscreenCanvas, 0, 0, selectionBox.size, selectionBox.size, 0, 0, 1024, 1024);
        finalIcon = new Image();
        finalIcon.onload = function() {
            editorLoadingOverlay.classList.add('hidden');
            setStep('final');
            drawFinalIcon();
        };
        finalIcon.src = iconCanvas.toDataURL('image/png');
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
        setStep('generation');
        previewControls.classList.remove('hidden');
    });
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        setStep('initial');
        initPreviewCanvas();
        updateStylePresetButtons();
    });
    
    // Edit button - return to edit screen with the original image
    editBtn.addEventListener('click', function() {
        setStep('edit');
        drawSelectionOverlay();
        setTimeout(() => {
            editCanvasWrapper.style.transform = 'translateX(-20%)';
            setTimeout(() => {
                phoneEmulator.classList.remove('hidden');
                setTimeout(() => {
                    phoneEmulator.classList.add('visible');
                    updateEmulatorIcon();
                }, 100);
            }, 300);
        }, 100);
    });
    
    // Function to resize the icon to a specific size
    function resizeIcon(sourceImage, targetSize) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            const radius = targetSize * (80 / 1024);
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(targetSize - radius, 0);
            ctx.quadraticCurveTo(targetSize, 0, targetSize, radius);
            ctx.lineTo(targetSize, targetSize - radius);
            ctx.quadraticCurveTo(targetSize, targetSize, targetSize - radius, targetSize);
            ctx.lineTo(radius, targetSize);
            ctx.quadraticCurveTo(0, targetSize, 0, targetSize - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(sourceImage, 0, 0, targetSize, targetSize);
            const dataURL = canvas.toDataURL('image/png');
            const img = new Image();
            img.onload = () => resolve({ size: targetSize, dataURL, img });
            img.src = dataURL;
        });
    }
    
    // Function to convert data URL to Blob
    function dataURLToBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    }
    
    // Download single icon (1024x1024)
    downloadSingle.addEventListener('click', async function() {
        if (!finalIcon) return;
        editorLoadingOverlay.classList.remove('hidden');
        try {
            const resizedIcon = await resizeIcon(finalIcon, 1024);
            const link = document.createElement('a');
            link.download = 'app-icon-1024.png';
            link.href = resizedIcon.dataURL;
            link.click();
        } catch (error) {
            console.error('Error resizing icon:', error);
        } finally {
            editorLoadingOverlay.classList.add('hidden');
            downloadMenu.classList.remove('active');
        }
    });
    
    // Download all icon sizes
    downloadAll.addEventListener('click', async function() {
        if (!finalIcon) return;
        editorLoadingOverlay.classList.remove('hidden');
        try {
            const zip = new JSZip();
            const ios = zip.folder("iOS");
            const iosIconset = ios.folder("AppIcon.appiconset");
            const android = zip.folder("Android");
            for (const iconConfig of iconSizes.ios) {
                const { size, name } = iconConfig;
                const resizedIcon = await resizeIcon(finalIcon, size);
                iosIconset.file(`${name}.png`, dataURLToBlob(resizedIcon.dataURL));
            }
            for (const iconConfig of iconSizes.android) {
                const { size, name } = iconConfig;
                const resizedIcon = await resizeIcon(finalIcon, size);
                android.file(`icon_${size}x${size}_${name}.png`, dataURLToBlob(resizedIcon.dataURL));
            }
            const iosContents = {
                "images": iconSizes.ios.map(({ size, name }) => ({
                    "size": `${size}x${size}`,
                    "idiom": "ios-marketing",
                    "filename": `${name}.png`,
                    "scale": "1x"
                })),
                "info": {
                    "version": 1,
                    "author": "AI Icon Generator"
                }
            };
            iosIconset.file("Contents.json", JSON.stringify(iosContents, null, 2));
            zip.file("app-icon-1024.png", dataURLToBlob(finalIcon.src));
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.download = 'app-icons.zip';
            link.href = URL.createObjectURL(zipBlob);
            link.click();
            URL.revokeObjectURL(link.href);
            downloadMenu.classList.remove('active');
        } catch (error) {
            console.error('Error creating zip file:', error);
        } finally {
            editorLoadingOverlay.classList.add('hidden');
        }
    });
    
    // Add event listeners for individual size items
    sizeItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!finalIcon) return;
            const size = parseInt(item.getAttribute('data-size'));
            if (!size) return;
            editorLoadingOverlay.classList.remove('hidden');
            try {
                const resizedIcon = await resizeIcon(finalIcon, size);
                const link = document.createElement('a');
                link.download = `app-icon-${size}.png`;
                link.href = resizedIcon.dataURL;
                link.click();
            } catch (error) {
                console.error(`Error resizing icon to ${size}px:`, error);
            } finally {
                editorLoadingOverlay.classList.add('hidden');
                downloadMenu.classList.remove('active');
            }
        });
    });
});
