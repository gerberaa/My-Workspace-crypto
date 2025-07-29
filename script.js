document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const pageTitle = document.querySelector('.page-header h1');
    const editorArea = document.querySelector('.editor-area');
    const pagesList = document.getElementById('pages-list');
    const newPageBtn = document.getElementById('new-page-btn');
    const toolbar = document.querySelector('.toolbar');
    const fontColorPicker = document.getElementById('font-color-picker');
    const backColorPicker = document.getElementById('back-color-picker');

    // Context Menus
    const pageContextMenu = document.getElementById('context-menu');
    const textContextMenu = document.getElementById('text-context-menu');

    // Modals
    const passwordModal = document.getElementById('password-modal');
    const passwordModalTitle = document.getElementById('password-modal-title');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordCancel = document.getElementById('password-cancel');

    const inputModal = document.getElementById('input-modal');
    const inputModalTitle = document.getElementById('input-modal-title');
    const inputModalInput = document.getElementById('input-modal-input');
    const inputModalSubmit = document.getElementById('input-modal-submit');
    const inputModalCancel = document.getElementById('input-modal-cancel');

    // --- Settings Sidebar Elements ---
    const settingsSidebar = document.getElementById('settings-sidebar');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const themeSelect = document.getElementById('theme-select');
    const fontSelect = document.getElementById('font-select');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const lineHeightSlider = document.getElementById('line-height-slider');
    const lineHeightValue = document.getElementById('line-height-value');
    const bgUrlInput = document.getElementById('bg-url-input');
    const bgUrlSubmit = document.getElementById('bg-url-submit');
    const bgClear = document.getElementById('bg-clear');
    const autoSaveCheckbox = document.getElementById('auto-save');
    const spellCheckCheckbox = document.getElementById('spell-check');
    const wordWrapCheckbox = document.getElementById('word-wrap');
    const autoResizeImagesCheckbox = document.getElementById('auto-resize-images');
    const showImageControlsCheckbox = document.getElementById('show-image-controls');
    const searchCaseSensitiveCheckbox = document.getElementById('search-case-sensitive');
    const searchWholeWordsCheckbox = document.getElementById('search-whole-words');
    const defaultImageSizeSelect = document.getElementById('default-image-size');
    const maxPagesSlider = document.getElementById('max-pages-slider');
    const maxPagesValue = document.getElementById('max-pages-value');
    const clearImageCacheBtn = document.getElementById('clear-image-cache');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');

    // --- App State ---
    let state = {};
    let passwordPromise = {};
    let inputPromise = {};
    let contextPageId = null;

    const defaultSettings = {
        theme: 'dark',
        font: "'Unbounded', sans-serif",
        fontSize: 16,
        lineHeight: 1.6,
        backgroundUrl: '',
        autoSave: true,
        spellCheck: true,
        wordWrap: true,
        autoResizeImages: true,
        showImageControls: true,
        searchCaseSensitive: false,
        searchWholeWords: false,
        defaultImageSize: 'medium',
        maxPages: 50
    };

    // --- Security Settings ---
    const MAX_ATTEMPTS = 3;
    const LOCKOUT_DURATIONS = [5, 15, 30];
    const getSecurityState = () => JSON.parse(localStorage.getItem('notionCloneSecurity')) || { attempts: 0, lockoutLevel: 0, lockoutUntil: null };
    const setSecurityState = (secState) => localStorage.setItem('notionCloneSecurity', JSON.stringify(secState));
    const resetSecurityState = () => setSecurityState({ attempts: 0, lockoutLevel: 0, lockoutUntil: null });

    // --- Encryption ---
    const encryptData = (data, password) => CryptoJS.AES.encrypt(JSON.stringify(data), password).toString();
    const decryptData = (encryptedData, password) => {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, password);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (e) { return null; }
    };

    // --- UI Handlers (Modals, Context Menus, Sidebar) ---
    const askForPassword = (title) => {
        passwordModalTitle.textContent = title;
        passwordInput.value = '';
        passwordModal.style.display = 'flex';
        return new Promise((resolve, reject) => { passwordPromise = { resolve, reject }; });
    };
    passwordSubmit.addEventListener('click', () => {
        if (passwordInput.value) {
            passwordPromise.resolve(passwordInput.value);
            passwordModal.style.display = 'none';
        }
    });
    passwordCancel.addEventListener('click', () => {
        passwordPromise.reject('Password entry cancelled.');
        passwordModal.style.display = 'none';
    });

    const askForInput = (title, placeholder = '') => {
        inputModalTitle.textContent = title;
        inputModalInput.value = '';
        inputModalInput.placeholder = placeholder;
        inputModal.style.display = 'flex';
        return new Promise((resolve, reject) => { inputPromise = { resolve, reject }; });
    };
    inputModalSubmit.addEventListener('click', () => {
        if (inputModalInput.value) {
            inputPromise.resolve(inputModalInput.value);
            inputModal.style.display = 'none';
        }
    });
    inputModalCancel.addEventListener('click', () => {
        inputPromise.reject('Input cancelled.');
        inputModal.style.display = 'none';
    });

    settingsBtn.addEventListener('click', () => settingsSidebar.classList.add('is-open'));
    settingsCloseBtn.addEventListener('click', () => settingsSidebar.classList.remove('is-open'));

    const hideContextMenus = () => {
        pageContextMenu.style.display = 'none';
        textContextMenu.style.display = 'none';
    };
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu') && !e.target.closest('.nav-item')) {
            hideContextMenus();
        }
        if (!settingsSidebar.contains(e.target) && !e.target.matches('#settings-btn')) {
            settingsSidebar.classList.remove('is-open');
        }
    });

    // --- State Management & Rendering ---
    const saveState = () => localStorage.setItem('notionCloneData', JSON.stringify(state));
    const loadState = () => {
        const savedData = localStorage.getItem('notionCloneData');
        if (savedData) {
            state = JSON.parse(savedData);
        } else {
            const firstPageId = Date.now().toString();
            state = { 
                pages: [{ id: firstPageId, title: 'Untitled Page', content: '<p><br></p>' }], 
                activePageId: firstPageId, 
                settings: { ...defaultSettings }
            };
        }
        if (!state.settings) {
            state.settings = { ...defaultSettings };
        }
    };

    const applySettings = () => {
        const theme = state.settings.theme || 'dark';
        const font = state.settings.font || "'Unbounded', sans-serif";
        const fontSize = state.settings.fontSize || 16;
        const lineHeight = state.settings.lineHeight || 1.6;
        const bgUrl = state.settings.backgroundUrl || '';
        const autoSave = state.settings.autoSave !== false;
        const spellCheck = state.settings.spellCheck !== false;
        const wordWrap = state.settings.wordWrap !== false;
        const autoResizeImages = state.settings.autoResizeImages !== false;
        const showImageControls = state.settings.showImageControls !== false;
        const searchCaseSensitive = state.settings.searchCaseSensitive || false;
        const searchWholeWords = state.settings.searchWholeWords || false;
        const defaultImageSize = state.settings.defaultImageSize || 'medium';
        const maxPages = state.settings.maxPages || 50;

        document.body.className = theme === 'light' ? 'light-theme' : '';
        document.body.style.fontFamily = font;
        document.body.style.fontSize = fontSize + 'px';
        document.body.style.lineHeight = lineHeight;
        
        // Apply editor settings
        editorArea.spellcheck = spellCheck;
        editorArea.style.whiteSpace = wordWrap ? 'pre-wrap' : 'nowrap';
        
        // Apply background image
        const mainContent = document.querySelector('.main-content');
        if (bgUrl) {
            mainContent.style.backgroundImage = `url(${bgUrl})`;
            mainContent.style.backgroundSize = 'cover';
            mainContent.style.backgroundPosition = 'center';
            mainContent.style.backgroundRepeat = 'no-repeat';
            mainContent.style.backgroundColor = 'transparent';
        } else {
            mainContent.style.backgroundImage = 'none';
            mainContent.style.backgroundColor = '';
        }

        // Update UI elements
        document.getElementById('theme-select').value = theme;
        document.getElementById('font-select').value = font;
        document.getElementById('font-size-slider').value = fontSize;
        document.getElementById('font-size-value').textContent = fontSize;
        document.getElementById('line-height-slider').value = lineHeight;
        document.getElementById('line-height-value').textContent = lineHeight;
        document.getElementById('bg-url-input').value = bgUrl;
        autoSaveCheckbox.checked = autoSave;
        spellCheckCheckbox.checked = spellCheck;
        wordWrapCheckbox.checked = wordWrap;
        autoResizeImagesCheckbox.checked = autoResizeImages;
        showImageControlsCheckbox.checked = showImageControls;
        searchCaseSensitiveCheckbox.checked = searchCaseSensitive;
        searchWholeWordsCheckbox.checked = searchWholeWords;
        defaultImageSizeSelect.value = defaultImageSize;
        maxPagesSlider.value = maxPages;
        maxPagesValue.textContent = maxPages;
    };

    const renderPagesList = () => {
        pagesList.innerHTML = '';
        state.pages.forEach(page => {
            const pageElement = document.createElement('a');
            pageElement.href = '#';
            pageElement.classList.add('nav-item');
            pageElement.dataset.id = page.id;
            pageElement.textContent = page.title;
            if (page.id === state.activePageId) {
                pageElement.style.backgroundColor = 'var(--button-hover-bg)';
            }
            pagesList.appendChild(pageElement);
        });
    };

    const loadActivePage = () => {
        const activePage = state.pages.find(p => p.id === state.activePageId);
        if (activePage) {
            pageTitle.innerHTML = activePage.title;
            editorArea.innerHTML = activePage.content;
        } else if (state.pages.length > 0) {
            state.activePageId = state.pages[0].id;
            saveState();
            loadActivePage();
        } else {
            pageTitle.innerHTML = 'No Pages';
            editorArea.innerHTML = '';
        }
    };

    const render = () => { renderPagesList(); loadActivePage(); };

    // --- Event Handlers ---
    newPageBtn.addEventListener('click', () => {
        const newPageId = Date.now().toString();
        state.pages.push({ id: newPageId, title: 'Untitled', content: '<p><br></p>' });
        state.activePageId = newPageId;
        saveState();
        render();
    });

    pagesList.addEventListener('click', (e) => {
        if (e.target.matches('.nav-item')) {
            state.activePageId = e.target.dataset.id;
            saveState();
            render();
        }
    });

    pagesList.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        hideContextMenus();
        const targetPage = e.target.closest('.nav-item');
        if (targetPage) {
            contextPageId = targetPage.dataset.id;
            pageContextMenu.style.top = `${e.clientY}px`;
            pageContextMenu.style.left = `${e.clientX}px`;
            pageContextMenu.style.display = 'block';
        }
    });

    pageContextMenu.addEventListener('click', (e) => {
        const action = e.target.closest('li')?.dataset.action;
        if (action === 'delete') {
            if (!contextPageId) return;
            const pageIndex = state.pages.findIndex(p => p.id === contextPageId);
            if (pageIndex > -1) {
                state.pages.splice(pageIndex, 1);
                if (state.activePageId === contextPageId) {
                    state.activePageId = state.pages.length > 0 ? state.pages[0].id : null;
                }
                saveState();
                render();
            }
        }
        hideContextMenus();
    });

    editorArea.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        hideContextMenus();
        
        // Position context menu with viewport boundary checking
        const menuWidth = 200;
        const menuHeight = 300;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = e.clientX;
        let top = e.clientY;
        
        // Adjust position if menu would go off-screen
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 10;
        }
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 10;
        }
        
        textContextMenu.style.top = `${top}px`;
        textContextMenu.style.left = `${left}px`;
        textContextMenu.style.display = 'block';
        
        // Store current selection for later use
        window.currentSelection = window.getSelection().getRangeAt(0).cloneRange();
    });

    textContextMenu.addEventListener('click', async (e) => {
        const listItem = e.target.closest('li');
        if (!listItem) return;
        
        const command = listItem.dataset.command;
        const value = listItem.dataset.value;
        
        if (command) {
            // Restore the original selection before applying command
            if (window.currentSelection) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(window.currentSelection);
            }
            
            if (command === 'createLink' || command === 'insertImage') {
                const type = command === 'createLink' ? 'Link' : 'Image';
                try {
                    const url = await askForInput(`Enter ${type} URL:`);
                    document.execCommand(command, false, url);
                    if (command === 'insertImage') {
                        // Make inserted images responsive
                        const images = editorArea.getElementsByTagName('img');
                        for (let img of images) {
                            if (!img.style.maxWidth) {
                                img.style.maxWidth = '100%';
                                img.style.height = 'auto';
                            }
                        }
                    }
                } catch (err) {
                    // User cancelled the modal
                }
            } else {
                document.execCommand(command, false, value || null);
            }
            editorArea.focus();
        }
        hideContextMenus();
    });

    const updateActivePageContent = () => {
        const activePage = state.pages.find(p => p.id === state.activePageId);
        if (activePage) {
            activePage.title = pageTitle.textContent; // Use textContent for title
            activePage.content = editorArea.innerHTML;
            saveState();
            const sidebarItem = pagesList.querySelector(`[data-id='${state.activePageId}']`);
            if (sidebarItem) sidebarItem.textContent = activePage.title;
        }
    };
    pageTitle.addEventListener('keyup', updateActivePageContent);
    editorArea.addEventListener('input', updateActivePageContent);

    editorArea.addEventListener('paste', async (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const urlRegex = /\b(https?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        
        console.log('Pasted text:', text);
        
        if (urlRegex.test(text)) {
            const url = text.match(urlRegex)[0];
            console.log('Found URL:', url);
            try {
                // Using a proxy/service to fetch metadata to avoid CORS issues.
                console.log('Fetching metadata for:', url);
                const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
                console.log('Response status:', response.status);
                if (!response.ok) throw new Error('Failed to fetch metadata');

                const data = await response.json();
                console.log('Full API response:', data);
                const previewData = data.data;
                console.log('Preview data:', previewData);

                if (previewData && previewData.title && previewData.image) {
                    const previewId = 'preview-' + Date.now();
                    const previewHtml = `
                        <div class="link-preview-wrapper" style="margin: 15px 0;">
                            <a href="${previewData.url}" target="_blank" class="link-preview" contenteditable="false" data-preview-id="${previewId}" draggable="true">
                                <div class="link-preview-controls">
                                    <button class="link-preview-btn delete-btn" onclick="this.closest('.link-preview-wrapper').remove(); event.preventDefault(); event.stopPropagation();" title="Delete">×</button>
                                </div>
                                <img src="${previewData.image.url}" class="link-preview-image" alt="Preview Image">
                                <div class="link-preview-content">
                                    <div class="link-preview-title">${previewData.title}</div>
                                    <div class="link-preview-description">${previewData.description || ''}</div>
                                    <div class="link-preview-sitename">${previewData.publisher || ''}</div>
                                </div>
                                <div class="link-preview-resize-handle"></div>
                            </a>
                        </div>
                        <p><br></p>
                    `;
                    document.execCommand('insertHTML', false, previewHtml);
                    
                    // Add drag and drop functionality to the newly created preview
                    setTimeout(() => {
                        const newPreview = editorArea.querySelector(`[data-preview-id="${previewId}"]`);
                        if (newPreview) {
                            setupDragAndDrop(newPreview);
                        }
                    }, 100);
                } else {
                     console.log('Could not generate preview. Data from API:', previewData);
                     document.execCommand('insertText', false, text);
                }
            } catch (error) {
                console.error('Error creating link preview:', error);
                document.execCommand('insertText', false, text);
            }
        } else {
            document.execCommand('insertText', false, text);
        }
    });

    // --- Image Drag & Drop Functionality ---
    editorArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    editorArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        
        for (let file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imageId = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    const imageHtml = `
                        <div class="draggable-image" data-image-id="${imageId}" draggable="true" style="width: 300px; height: 200px;">
                            <div class="image-controls">
                                <button class="image-control-btn" onclick="this.closest('.draggable-image').remove(); event.stopPropagation();" title="Delete">×</button>
                                <button class="image-control-btn" onclick="openFullscreenImage(this.parentElement.nextElementSibling.src); event.stopPropagation();" title="Fullscreen">⛶</button>
                            </div>
                            <img src="${event.target.result}" alt="Uploaded Image" onclick="openFullscreenImage(this.src)">
                            <div class="image-resize-handle"></div>
                        </div>
                    `;
                    
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    if (range) {
                        range.insertNode(document.createRange().createContextualFragment(imageHtml));
                        
                        // Setup drag functionality for the new image
                        setTimeout(() => {
                            const newImage = editorArea.querySelector(`[data-image-id="${imageId}"]`);
                            if (newImage) {
                                setupImageDragAndDrop(newImage);
                            }
                        }, 100);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    });

    toolbar.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const command = button.dataset.command;
        if (!command) return;

        const value = button.dataset.value || null;

        if (command === 'createLink' || command === 'insertImage') {
            const type = command === 'createLink' ? 'Link' : 'Image';
            try {
                const url = await askForInput(`Enter ${type} URL:`);
                document.execCommand(command, false, url);
                if (command === 'insertImage') {
                    // Make inserted images responsive
                    const images = editorArea.getElementsByTagName('img');
                    for (let img of images) {
                        if (!img.style.maxWidth) {
                            img.style.maxWidth = '100%';
                            img.style.height = 'auto';
                        }
                    }
                }
            } catch (err) {
                // User cancelled the modal
            }
        } else if (command === 'insertVideo') {
            try {
                const url = await askForInput('Enter Video URL (YouTube)');
                let videoId = '';
                if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1].split('?')[0];
                } else if (url.includes('watch?v=')) {
                    videoId = url.split('watch?v=')[1].split('&')[0];
                }

                if (videoId) {
                    const iframe = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
                    document.execCommand('insertHTML', false, iframe + '<p><br></p>');
                } else if (url) {
                    alert('Invalid YouTube URL.');
                }
            } catch (err) {
                 // User cancelled the modal
            }
        } else {
            document.execCommand(command, false, value);
        }

        editorArea.focus();
    });

    fontColorPicker.addEventListener('input', (e) => { document.execCommand('foreColor', false, e.target.value); editorArea.focus(); });
    backColorPicker.addEventListener('input', (e) => { document.execCommand('backColor', false, e.target.value); editorArea.focus(); });

    // --- Settings Handlers ---
    themeSelect.addEventListener('input', (e) => {
        state.settings.theme = e.target.value;
        applySettings();
        saveState();
    });

    fontSelect.addEventListener('input', (e) => {
        state.settings.font = e.target.value;
        applySettings();
        saveState();
    });

    fontSizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        fontSizeValue.textContent = size;
        state.settings.fontSize = size;
        applySettings();
        saveState();
    });

    lineHeightSlider.addEventListener('input', (e) => {
        const lineHeight = e.target.value;
        lineHeightValue.textContent = lineHeight;
        state.settings.lineHeight = lineHeight;
        applySettings();
        saveState();
    });

    bgUrlSubmit.addEventListener('click', () => {
        state.settings.backgroundUrl = bgUrlInput.value;
        applySettings();
        saveState();
    });

    // Settings sidebar toggle
    settingsBtn.addEventListener('click', () => {
        settingsSidebar.classList.add('active');
    });
    
    settingsCloseBtn.addEventListener('click', () => {
        settingsSidebar.classList.remove('active');
    });
    
    // Background clear
    bgClear.addEventListener('click', () => {
        bgUrlInput.value = '';
        state.settings.backgroundUrl = '';
        applySettings();
        saveState();
    });
    
    // Max pages slider
    maxPagesSlider.addEventListener('input', (e) => {
        const maxPages = e.target.value;
        maxPagesValue.textContent = maxPages;
        state.settings.maxPages = parseInt(maxPages);
        saveState();
    });
    
    // Checkbox settings
    autoSaveCheckbox.addEventListener('change', (e) => {
        state.settings.autoSave = e.target.checked;
        applySettings();
        saveState();
    });
    
    spellCheckCheckbox.addEventListener('change', (e) => {
        state.settings.spellCheck = e.target.checked;
        applySettings();
        saveState();
    });
    
    wordWrapCheckbox.addEventListener('change', (e) => {
        state.settings.wordWrap = e.target.checked;
        applySettings();
        saveState();
    });
    
    autoResizeImagesCheckbox.addEventListener('change', (e) => {
        state.settings.autoResizeImages = e.target.checked;
        saveState();
    });
    
    showImageControlsCheckbox.addEventListener('change', (e) => {
        state.settings.showImageControls = e.target.checked;
        saveState();
    });
    
    searchCaseSensitiveCheckbox.addEventListener('change', (e) => {
        state.settings.searchCaseSensitive = e.target.checked;
        saveState();
    });
    
    searchWholeWordsCheckbox.addEventListener('change', (e) => {
        state.settings.searchWholeWords = e.target.checked;
        saveState();
    });
    
    // Default image size
    defaultImageSizeSelect.addEventListener('change', (e) => {
        state.settings.defaultImageSize = e.target.value;
        saveState();
    });
    
    // Clear image cache
    clearImageCacheBtn.addEventListener('click', () => {
        localStorage.removeItem('notionClone_imageSizes');
        if (confirm('Image cache cleared! Reload the page to see changes.')) {
            location.reload();
        }
    });
    
    resetSettingsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all appearance settings?')) {
            state.settings = { ...state.settings, ...defaultSettings };
            applySettings();
            saveState();
        }
    });

    // --- Data Management ---
    exportBtn.addEventListener('click', async () => {
        try {
            const password = await askForPassword('Enter password to encrypt:');
            const encryptedData = encryptData(state, password);
            const blob = new Blob([encryptedData], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'notion-clone-encrypted.txt';
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (error) { console.log(error); }
    });

    importBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const securityState = getSecurityState();
        if (securityState.lockoutUntil && securityState.lockoutUntil > Date.now()) {
            const remainingMinutes = Math.ceil((securityState.lockoutUntil - Date.now()) / 60000);
            alert(`Too many failed attempts. Please try again in ${remainingMinutes} minutes.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const encryptedData = e.target.result;
            try {
                const password = await askForPassword('Enter password to decrypt:');
                const decryptedState = decryptData(encryptedData, password);
                if (decryptedState && decryptedState.pages) {
                    state = decryptedState;
                    // Ensure settings exist, if not, apply defaults
                    if (!state.settings) {
                        state.settings = { ...defaultSettings };
                    }
                    resetSecurityState();
                    saveState();
                    render();
                    applySettings();
                } else {
                    alert('Decryption failed. Wrong password or corrupted file.');
                    let secState = getSecurityState();
                    secState.attempts++;
                    if (secState.attempts >= MAX_ATTEMPTS) {
                        const lockoutMinutes = LOCKOUT_DURATIONS[secState.lockoutLevel];
                        secState.lockoutUntil = Date.now() + lockoutMinutes * 60 * 1000;
                        alert(`Too many failed attempts. Import is locked for ${lockoutMinutes} minutes.`);
                        secState.attempts = 0;
                        if (secState.lockoutLevel < LOCKOUT_DURATIONS.length - 1) secState.lockoutLevel++;
                    }
                    setSecurityState(secState);
                }
            } catch (error) { console.log(error); }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    // --- Advanced Search Functionality ---
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const searchResults = document.getElementById('search-results');
    const searchCount = document.getElementById('search-count');
    const searchList = document.getElementById('search-list');
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    
    let currentSearchResults = [];
    let currentResultIndex = -1;
    let originalContent = '';

    function performSearch() {
        const query = searchInput.value.trim();
        
        if (!query) {
            clearSearch();
            return;
        }
        
        // Store original content if not already stored
        if (!originalContent) {
            originalContent = editorArea.innerHTML;
        }
        
        // Get clean text content without HTML tags and attributes
        const textContent = getCleanTextContent(editorArea);
        const regex = new RegExp(escapeRegExp(query), 'gi');
        const matches = [];
        let match;
        
        while ((match = regex.exec(textContent)) !== null) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(textContent.length, match.index + match[0].length + 50);
            const context = textContent.substring(start, end);
            
            matches.push({
                index: match.index,
                text: match[0],
                context: context,
                start: start,
                end: end,
                matchStart: match.index - start,
                matchEnd: match.index - start + match[0].length
            });
        }
        
        currentSearchResults = matches;
        currentResultIndex = matches.length > 0 ? 0 : -1;
        
        updateSearchUI();
        highlightAllMatches(query);
        
        if (matches.length > 0) {
            searchResults.style.display = 'block';
        }
    }
    
    function updateSearchUI() {
        const count = currentSearchResults.length;
        searchCount.textContent = count === 0 ? 'No results' : `${count} result${count > 1 ? 's' : ''}`;
        
        // Update navigation buttons
        searchPrev.disabled = currentResultIndex <= 0;
        searchNext.disabled = currentResultIndex >= count - 1;
        
        // Clear and populate results list
        searchList.innerHTML = '';
        
        currentSearchResults.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = `search-result-item ${index === currentResultIndex ? 'active' : ''}`;
            
            const contextBefore = result.context.substring(0, result.matchStart);
            const matchText = result.context.substring(result.matchStart, result.matchEnd);
            const contextAfter = result.context.substring(result.matchEnd);
            
            item.innerHTML = `
                <div class="search-result-text">
                    ${contextBefore}<span class="search-match">${matchText}</span>${contextAfter}
                </div>
                <div class="search-result-context">Match ${index + 1} of ${currentSearchResults.length}</div>
            `;
            
            item.addEventListener('click', () => {
                currentResultIndex = index;
                updateSearchUI();
                scrollToResult(index);
            });
            
            searchList.appendChild(item);
        });
    }
    
    function highlightAllMatches(query) {
        if (!query) return;
        
        // Restore original content first
        editorArea.innerHTML = originalContent;
        
        // Highlight all matches
        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        editorArea.innerHTML = editorArea.innerHTML.replace(regex, '<mark class="highlight">$1</mark>');
    }
    
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    function getCleanTextContent(element) {
        let cleanText = '';
        
        // Get page title
        const pageTitle = document.querySelector('h1[contenteditable="true"]');
        if (pageTitle && pageTitle.textContent.trim()) {
            cleanText += pageTitle.textContent.trim() + ' ';
        }
        
        // Create a temporary div to safely extract text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = element.innerHTML;
        
        // Remove all non-text elements
        const elementsToRemove = tempDiv.querySelectorAll('script, style, img, video, iframe, canvas, svg, [contenteditable="false"], .link-preview, .draggable-image, .search-results, .context-menu, .toolbar, [class*="control"], [class*="btn"], [class*="button"], [style*="display:none"], [style*="display: none"]');
        elementsToRemove.forEach(el => el.remove());
        
        // Remove all attributes to clean up any remaining technical data
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach(el => {
            // Keep only the tag, remove all attributes
            const tagName = el.tagName;
            const textContent = el.textContent;
            if (textContent.trim()) {
                // Only keep elements that have actual text content
                const allowedTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'DIV', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'U'];
                if (allowedTags.includes(tagName)) {
                    cleanText += textContent.trim() + ' ';
                }
            }
        });
        
        // Final cleanup
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        
        // Remove any remaining HTML-like patterns
        cleanText = cleanText.replace(/<[^>]*>/g, '');
        cleanText = cleanText.replace(/\b\w+="[^"]*"/g, '');
        cleanText = cleanText.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, '');
        
        return cleanText;
    }
    
    function scrollToResult(index) {
        const highlights = editorArea.querySelectorAll('.highlight');
        if (highlights[index]) {
            highlights[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add temporary extra highlighting
            highlights[index].style.backgroundColor = '#ff5722';
            setTimeout(() => {
                highlights[index].style.backgroundColor = '';
            }, 1000);
        }
    }
    
    function navigateResults(direction) {
        if (currentSearchResults.length === 0) return;
        
        if (direction === 'next' && currentResultIndex < currentSearchResults.length - 1) {
            currentResultIndex++;
        } else if (direction === 'prev' && currentResultIndex > 0) {
            currentResultIndex--;
        }
        
        updateSearchUI();
        scrollToResult(currentResultIndex);
    }

    function clearSearch() {
        searchInput.value = '';
        searchResults.style.display = 'none';
        currentSearchResults = [];
        currentResultIndex = -1;
        
        if (originalContent) {
            editorArea.innerHTML = originalContent;
            originalContent = '';
        }
    }
    
    // Event listeners
    searchInput.addEventListener('input', performSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchPrev.addEventListener('click', () => navigateResults('prev'));
    searchNext.addEventListener('click', () => navigateResults('next'));
    
    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.style.display = 'none';
        }
    });
    
    // Show search results when focusing on search input
    searchInput.addEventListener('focus', () => {
        if (currentSearchResults.length > 0) {
            searchResults.style.display = 'block';
        }
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateResults('next');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateResults('prev');
        } else if (e.key === 'Escape') {
            clearSearch();
        }
    });

    // --- Drag and Drop Functionality ---
    function setupDragAndDrop(preview) {
        let draggedElement = null;
        let dropZone = null;

        preview.addEventListener('dragstart', (e) => {
            draggedElement = e.target.closest('.link-preview-wrapper');
            draggedElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', draggedElement.outerHTML);
        });

        preview.addEventListener('dragend', (e) => {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
                draggedElement = null;
            }
        });

        // Make editor area a drop zone
        editorArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        editorArea.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedElement) {
                const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (range) {
                    // Remove original element
                    const originalElement = draggedElement;
                    originalElement.remove();
                    
                    // Insert at new position
                    range.insertNode(originalElement);
                    
                    // Re-setup drag and drop for the moved element
                    const movedPreview = originalElement.querySelector('.link-preview');
                    if (movedPreview) {
                        setupDragAndDrop(movedPreview);
                    }
                }
            }
        });
    }


    // --- Image Size Persistence Functions ---
    function saveImageSizes() {
        const images = editorArea.querySelectorAll('.draggable-image');
        const imageSizes = {};
        
        images.forEach((container, index) => {
            const img = container.querySelector('img');
            if (img && container.style.width && container.style.height) {
                // Use image src hash and index as unique identifier
                const imageId = btoa(img.src.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '') + '_' + index;
                imageSizes[imageId] = {
                    width: container.style.width,
                    height: container.style.height
                };
            }
        });
        
        localStorage.setItem('notionClone_imageSizes', JSON.stringify(imageSizes));
    }
    
    function restoreImageSizes() {
        const savedSizes = localStorage.getItem('notionClone_imageSizes');
        if (!savedSizes) return;
        
        try {
            const imageSizes = JSON.parse(savedSizes);
            const images = editorArea.querySelectorAll('.draggable-image');
            
            images.forEach((container, index) => {
                const img = container.querySelector('img');
                if (img) {
                    const imageId = btoa(img.src.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '') + '_' + index;
                    if (imageSizes[imageId]) {
                        container.style.width = imageSizes[imageId].width;
                        container.style.height = imageSizes[imageId].height;
                    }
                }
            });
        } catch (e) {
            console.error('Error restoring image sizes:', e);
        }
    }

    // --- Image Drag & Drop Setup Function ---
    function setupImageDragAndDrop(imageElement) {
        let draggedElement = null;

        imageElement.addEventListener('dragstart', (e) => {
            draggedElement = e.target.closest('.draggable-image');
            draggedElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', draggedElement.outerHTML);
        });

        imageElement.addEventListener('dragend', (e) => {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
                draggedElement = null;
            }
        });
    }

    // --- Fullscreen Image Functions ---
    window.openFullscreenImage = function(imageSrc) {
        const modal = document.getElementById('fullscreen-image-modal');
        const fullscreenImg = document.getElementById('fullscreen-image');
        fullscreenImg.src = imageSrc;
        modal.classList.add('active');
    };

    window.closeFullscreenImage = function() {
        const modal = document.getElementById('fullscreen-image-modal');
        modal.classList.remove('active');
    };

    // Close fullscreen on click outside image
    document.getElementById('fullscreen-image-modal').addEventListener('click', (e) => {
        if (e.target.id === 'fullscreen-image-modal') {
            closeFullscreenImage();
        }
    });

    // Close fullscreen on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFullscreenImage();
        }
    });

    // --- Initial Load ---
    loadState();
    render();
    applySettings();
    
    // Restore image sizes after content is loaded
    setTimeout(() => {
        restoreImageSizes();
    }, 1000);
    
    // Save image sizes when page is about to unload
    window.addEventListener('beforeunload', () => {
        saveImageSizes();
    });
    
    // Auto-save image sizes when content changes
    editorArea.addEventListener('input', () => {
        setTimeout(() => saveImageSizes(), 500);
    });
});
