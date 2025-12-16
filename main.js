
document.addEventListener('DOMContentLoaded', () => {
    const DB_VERSION = 2;

    // DOM Elements
    const fileSystem = document.getElementById('file-system');
    const contextMenu = document.getElementById('context-menu');
    const addressBar = document.getElementById('address-bar');
    const backButton = document.getElementById('back-button');
    const forwardButton = document.getElementById('forward-button');

    // Modals
    const tutorialModal = document.getElementById('tutorial-modal');
    const editFileModal = document.getElementById('edit-file-modal');
    const moveToModal = document.getElementById('move-to-modal');
    const renameModal = document.getElementById('rename-modal');
    const importLinkModal = document.getElementById('import-link-modal');
    const shareLinkModal = document.getElementById('share-link-modal');

    // Modal Controls
    const closeButtons = document.querySelectorAll('.close-button');
    const saveFileButton = document.getElementById('save-file-button');
    const editFileTextarea = document.getElementById('edit-file-textarea');
    const moveToOptions = document.getElementById('move-to-options');
    const renameInput = document.getElementById('rename-input');
    const saveRenameButton = document.getElementById('save-rename-button');
    const importInputTextarea = document.getElementById('import-input-textarea');
    const importConfirmButton = document.getElementById('import-confirm-button');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyShareLinkButton = document.getElementById('copy-share-link-button');

    // State Management
    let fsData = getInitialData();
    let selectedItem = null;
    let currentPath = []; // Array of folder IDs, [] is root
    let history = [[]];
    let historyIndex = 0;

    function migrateData(data) {
        if (!data.version) {
            // Migrate from unversioned array to version 2
            return { version: DB_VERSION, data: data };
        }
        if (data.version < DB_VERSION) {
            // Placeholder for future migrations
        }
        return data;
    }

    function getInitialData() {
        const hashData = window.location.hash;
        if (hashData && hashData.startsWith('?data=')) {
            try {
                const encodedData = hashData.substring(6);
                const decodedData = atob(encodedData);
                const parsedData = JSON.parse(decodedData);
                window.location.hash = ''; // Clean the URL
                return migrateData(parsedData).data;
            } catch (e) {
                console.error("Error parsing data from hash:", e);
            }
        }

        const savedData = localStorage.getItem('fileSystem_test');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                return migrateData(parsedData).data;
            } catch (e) {
                console.error("Error parsing data from localStorage:", e);
            }
        }

        // Default data
        return [
            { id: 1, type: 'folder', name: 'Test Documents', children: [] },
            { id: 2, type: 'file', name: 'test_notes.txt', content: 'Hello Test World!' },
            { id: 3, type: 'file', name: 'test_script.js', content: 'console.log("Hello from test_script.js");' },
        ];
    }

    // --- Data Persistence ---
    function saveData() {
        const dataToSave = { version: DB_VERSION, data: fsData };
        localStorage.setItem('fileSystem_test', JSON.stringify(dataToSave));
    }

    // --- Navigation ---
    function navigateTo(path) {
        currentPath = path;
        if (JSON.stringify(history[historyIndex]) !== JSON.stringify(path)) {
            history = history.slice(0, historyIndex + 1);
            history.push(path);
            historyIndex++;
        }
        saveAndRender();
        updateNavButtons();
    }

    backButton.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            navigateTo(history[historyIndex]);
        }
    });

    forwardButton.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            navigateTo(history[historyIndex]);
        }
    });

    function updateNavButtons() {
        backButton.disabled = historyIndex <= 0;
        forwardButton.disabled = historyIndex >= history.length - 1;
    }

    // --- Rendering ---
    function renderFileSystem() {
        fileSystem.innerHTML = '';
        const currentFolderContents = getFolderContents(currentPath);
        currentFolderContents.forEach(item => {
            const element = document.createElement('div');
            element.classList.add(item.type);
            const icon = document.createElement('i');
            icon.className = 'material-icons';

            if (item.type === 'folder') {
                icon.textContent = 'folder';
                element.textContent = item.name;
            } else {
                icon.textContent = 'description';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'file-name';
                const extSpan = document.createElement('span');
                extSpan.className = 'file-extension';
                const lastDotIndex = item.name.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    nameSpan.textContent = item.name.substring(0, lastDotIndex);
                    extSpan.textContent = item.name.substring(lastDotIndex);
                } else {
                    nameSpan.textContent = item.name;
                }
                element.appendChild(nameSpan);
                element.appendChild(extSpan);
            }
            element.prepend(icon);

            element.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedItem = item;
                showContextMenu(e.pageX, e.pageY);
            });
            if (item.type === 'folder') {
                element.addEventListener('dblclick', () => navigateTo([...currentPath, item.id]));
            }
            fileSystem.appendChild(element);
        });
        updateAddressBar();
    }

    function updateAddressBar() {
        let pathString = 'Home';
        let currentFolder = fsData;
        currentPath.forEach(folderId => {
            const folder = currentFolder.find(i => i.id === folderId);
            pathString += ` / ${folder ? folder.name : ''}`;
            currentFolder = folder ? folder.children : [];
        });
        addressBar.textContent = pathString;
    }

    // --- Context Menu ---
    function showContextMenu(x, y) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
    }

    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.action;
        if (action) {
            handleContextMenuAction(action);
            hideContextMenu();
        }
    });

    // --- Actions ---
    function handleContextMenuAction(action) {
        if (!selectedItem) return;
        switch (action) {
            case 'edit':
                if (selectedItem.type === 'folder') {
                    navigateTo([...currentPath, selectedItem.id]);
                } else {
                    openEditFileModal(selectedItem);
                }
                break;
            case 'rename':
                openRenameModal(selectedItem);
                break;
            case 'delete':
                deleteItem(selectedItem.id);
                saveAndRender();
                break;
            case 'move-to':
                openMoveToModal(selectedItem);
                break;
        }
    }

    // --- Modals ---
    function showModal(modal) { modal.classList.add('show'); }
    function hideModals() { document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show')); }
    closeButtons.forEach(btn => btn.addEventListener('click', hideModals));

    function openEditFileModal(file) {
        document.getElementById('edit-file-title').textContent = `Editing: ${file.name}`;
        editFileTextarea.value = file.content || '';
        saveFileButton.onclick = () => {
            file.content = editFileTextarea.value;
            hideModals();
            saveAndRender();
        };
        showModal(editFileModal);
    }

    function openRenameModal(item) {
        renameInput.value = item.name;
        renameInput.focus();
        saveRenameButton.onclick = () => {
            const newName = renameInput.value.trim();
            if (newName) {
                item.name = newName;
                hideModals();
                saveAndRender();
            }
        };
        showModal(renameModal);
    }

    function openMoveToModal(itemToMove) {
        moveToOptions.innerHTML = ''; // Clear previous options
        const possibleDestinations = getPossibleDestinations(itemToMove.id);
        if (currentPath.length > 0) {
            const homeOption = document.createElement('li');
            homeOption.textContent = 'Move to Home';
            homeOption.onclick = () => { moveItem(itemToMove.id, []); hideModals(); };
            moveToOptions.appendChild(homeOption);
        }
        possibleDestinations.forEach(dest => {
            const option = document.createElement('li');
            option.textContent = dest.name;
            option.onclick = () => { moveItem(itemToMove.id, dest.path.concat(dest.id)); hideModals(); };
            moveToOptions.appendChild(option);
        });
        showModal(moveToModal);
    }

    // --- Data Manipulation Helpers ---
    function getFolderContents(path) {
        let currentLevel = fsData;
        for (const folderId of path) {
            const folder = currentLevel.find(item => item.id === folderId && item.type === 'folder');
            currentLevel = folder ? folder.children : [];
        }
        return currentLevel;
    }

    function findItemAndParent(itemId, container = fsData) {
        for (const item of container) {
            if (item.id === itemId) return { item, parent: container };
            if (item.type === 'folder') {
                const found = findItemAndParent(itemId, item.children);
                if (found) return found;
            }
        }
        return null;
    }

    function deleteItem(itemId) {
        const { parent } = findItemAndParent(itemId) || {};
        if (parent) {
            const itemIndex = parent.findIndex(i => i.id === itemId);
            if (itemIndex > -1) parent.splice(itemIndex, 1);
        }
    }

    function moveItem(itemId, newParentPath) {
        const { item, parent } = findItemAndParent(itemId) || {};
        if (!item || !parent) return;
        const itemIndex = parent.findIndex(i => i.id === itemId);
        parent.splice(itemIndex, 1);
        getFolderContents(newParentPath).push(item);
        saveAndRender();
    }

    function getPossibleDestinations(itemIdToMove, currentLevel = fsData, path = []) {
        let destinations = [];
        currentLevel.forEach(item => {
            if (item.type === 'folder' && item.id !== itemIdToMove) {
                destinations.push({ ...item, path });
                destinations.push(...getPossibleDestinations(itemIdToMove, item.children, [...path, item.id]));
            }
        });
        return destinations;
    }

    // --- Toolbar Event Listeners ---
    document.getElementById('create-file').addEventListener('click', () => {
        getFolderContents(currentPath).push({ id: Date.now(), type: 'file', name: 'new_file.txt', content: '' });
        saveAndRender();
    });
    document.getElementById('create-folder').addEventListener('click', () => {
        getFolderContents(currentPath).push({ id: Date.now(), type: 'folder', name: 'New Folder', children: [] });
        saveAndRender();
    });
    document.getElementById('show-tutorial').addEventListener('click', () => showModal(tutorialModal));
    document.getElementById('export-data').addEventListener('click', () => {
        const dataToExport = { version: DB_VERSION, data: fsData };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const link = document.createElement('a');
        link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        link.download = 'filesystem.json';
        link.click();
    });
    document.getElementById('import-data').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const parsedData = JSON.parse(event.target.result);
                    fsData = migrateData(parsedData).data;
                    navigateTo([]);
                } catch (error) { alert('Error: Could not parse JSON file.'); }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    document.getElementById('check-data').addEventListener('click', () => {
        const dataToExport = { version: DB_VERSION, data: fsData };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    });

    document.getElementById('import-link-button').addEventListener('click', () => {
        showModal(importLinkModal);
    });

    importConfirmButton.addEventListener('click', async () => {
        const inputText = importInputTextarea.value.trim();
        if (!inputText) return;

        // 1. Try to parse as raw JSON first
        try {
            const parsedData = JSON.parse(inputText);
            fsData = migrateData(parsedData).data;
            navigateTo([]);
            hideModals();
            importInputTextarea.value = ''; // Clear input
            return; // Success
        } catch (e) {
            // Not raw JSON, proceed to treat as a URL
        }

        // 2. Try to treat as a URL
        try {
            const url = new URL(inputText);

            // Check if it's a shareable link from the same app
            if (url.origin === window.location.origin && url.hash.startsWith('#data=')) {
                window.location.href = inputText;
                return;
            }

            // It's a URL from another domain, so fetch it.
            const response = await fetch(inputText);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            fsData = migrateData(data).data;
            navigateTo([]);
            hideModals();
            importInputTextarea.value = ''; // Clear input

        } catch (error) {
            alert('Error: Input is not valid JSON, a valid shareable link, or a fetchable URL.');
            console.error(error);
        }
    });

    document.getElementById('share-data').addEventListener('click', () => {
        const dataToShare = { version: DB_VERSION, data: fsData };
        const dataStr = JSON.stringify(dataToShare);
        const encodedData = btoa(dataStr);
        const shareableLink = `${window.location.origin}${window.location.pathname}#data=${encodedData}`;
        shareLinkInput.value = shareableLink;
        showModal(shareLinkModal);
    });

    copyShareLinkButton.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
    });

    // --- Global Listeners ---
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideModals(); });

    // --- Final Setup ---
    function saveAndRender() {
        saveData();
        renderFileSystem();
    }

    // Initial Load
    navigateTo(currentPath);
});
