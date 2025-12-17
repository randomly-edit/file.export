
document.addEventListener('DOMContentLoaded', () => {
    const DB_VERSION = 2;

    // DOM Elements
    const fileSystem = document.getElementById('file-system');
    const contextMenu = document.getElementById('context-menu');
    const addressBar = document.getElementById('address-bar');
    const backButton = document.getElementById('back-button');
    const forwardButton = document.getElementById('forward-button');
    const selectModeButton = document.getElementById('select-mode-button');
    const container = document.querySelector('.container');

    // Modals & Controls
    const closeButtons = document.querySelectorAll('.close-button');
    const modals = {
        tutorial: document.getElementById('tutorial-modal'),
        editFile: document.getElementById('edit-file-modal'),
        moveTo: document.getElementById('move-to-modal'),
        rename: document.getElementById('rename-modal'),
        importLink: document.getElementById('import-link-modal'),
        shareLink: document.getElementById('share-link-modal'),
    };
    const editFileTextarea = document.getElementById('edit-file-textarea');
    const saveFileButton = document.getElementById('save-file-button');
    const renameInput = document.getElementById('rename-input');
    const saveRenameButton = document.getElementById('save-rename-button');
    const importInputTextarea = document.getElementById('import-input-textarea');
    const importConfirmButton = document.getElementById('import-confirm-button');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyShareLinkButton = document.getElementById('copy-share-link-button');
    const moveToOptions = document.getElementById('move-to-options');


    // State Management
    let fsData = [];
    let selectedItems = new Set();
    let contextMenuItem = null; // The item the context menu is open for
    let currentPath = [];
    let history = [[]];
    let historyIndex = 0;
    let selectionMode = false;

    // --- Initialization ---
    function getInitialData() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');

        if (dataParam) {
            try {
                const decodedData = atob(dataParam);
                const parsedData = JSON.parse(decodedData);
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                return migrateData(parsedData).data;
            } catch (e) {
                console.error("Error parsing data from URL:", e);
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

        // Default data if nothing else is found
        return [
            { id: 1, type: 'folder', name: 'My Documents', children: [] },
            { id: 2, type: 'file', name: 'welcome.txt', content: btoa('Hello and welcome to your new file system!') },
        ];
    }

    function migrateData(data) {
        // This is a placeholder for more complex migrations in the future.
        if (!data.version || data.version < DB_VERSION) {
            // In a real scenario, you'd have specific migration paths, e.g., from v2 to v3.
            // For now, we just update the version.
            data.version = DB_VERSION;
        }
        return data;
    }

    // --- Data Persistence ---
    function saveData() {
        const dataToSave = { version: DB_VERSION, data: fsData };
        localStorage.setItem('fileSystem_test', JSON.stringify(dataToSave));
    }

    // --- Rendering ---
    function renderFileSystem() {
        fileSystem.innerHTML = '';
        const currentFolderContents = getFolderContents(currentPath);
        currentFolderContents.forEach(item => {
            const element = document.createElement('div');
            element.className = `file-system-item ${item.type}`;
            if (selectedItems.has(item.id)) {
                element.classList.add('selected');
            }

            const icon = document.createElement('i');
            icon.className = 'material-icons';
            icon.textContent = item.type === 'folder' ? 'folder' : 'description';

            const name = document.createElement('span');
            name.className = 'item-name';
            name.textContent = item.name;

            element.appendChild(icon);
            element.appendChild(name);
            element.dataset.itemId = item.id;

            element.addEventListener('click', (e) => handleItemClick(e, item));
            element.addEventListener('dblclick', () => {
                if (item.type === 'folder') {
                    navigateTo([...currentPath, item.id]);
                }
            });
            fileSystem.appendChild(element);
        });
        updateAddressBar();
        hideContextMenu();
    }

    function updateAddressBar() {
        let pathString = 'Home';
        let currentFolder = { children: fsData };
        currentPath.forEach(folderId => {
            const folder = currentFolder.children.find(i => i.id === folderId);
            pathString += ` / ${folder ? folder.name : ''}`;
            currentFolder = folder;
        });
        addressBar.textContent = pathString;
    }

    // --- Event Handlers ---
    function handleItemClick(e, item) {
        e.stopPropagation();
        if (selectionMode) {
            toggleSelection(item.id);
        } else {
            contextMenuItem = item;
            showContextMenu(e.pageX, e.pageY);
        }
    }

    // --- Navigation ---
    function navigateTo(path) {
        currentPath = path;
        if (JSON.stringify(history[historyIndex]) !== JSON.stringify(path)) {
            history = history.slice(0, historyIndex + 1);
            history.push(path);
            historyIndex++;
        }
        selectedItems.clear();
        selectionMode = false;
        toggleSelectionModeVisuals();
        saveAndRender();
        updateNavButtons();
    }

    backButton.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            // We call the function directly without pushing to history again
            currentPath = history[historyIndex];
            selectedItems.clear();
            saveAndRender();
            updateNavButtons();
        }
    });

    forwardButton.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            // We call the function directly without pushing to history again
            currentPath = history[historyIndex];
            selectedItems.clear();
            saveAndRender();
            updateNavButtons();
        }
    });

    function updateNavButtons() {
        backButton.disabled = historyIndex <= 0;
        forwardButton.disabled = historyIndex >= history.length - 1;
    }


    // --- Selection Mode ---
    function toggleSelectionMode() {
        selectionMode = !selectionMode;
        if (!selectionMode) {
            selectedItems.clear();
        }
        toggleSelectionModeVisuals();
        saveAndRender();
    }

    function toggleSelectionModeVisuals() {
        selectModeButton.classList.toggle('active', selectionMode);
        container.classList.toggle('selection-mode', selectionMode);
    }

    function toggleSelection(itemId) {
        if (selectedItems.has(itemId)) {
            selectedItems.delete(itemId);
        } else {
            selectedItems.add(itemId);
        }
        renderFileSystem(); // Re-render to show selection change
    }

    // --- Context Menu ---
    function showContextMenu(x, y) {
        contextMenu.innerHTML = '';
        const actions = [];

        if (selectedItems.size > 1 && selectedItems.has(contextMenuItem.id)) {
            // Multiple items selected
            actions.push({ label: `Zip (${selectedItems.size} items)`, action: 'zip' });
            actions.push({ label: `Delete (${selectedItems.size} items)`, action: 'delete-selected' });
        } else {
            // Single item context menu
            actions.push({ label: 'Edit', action: 'edit' });
            actions.push({ label: 'Rename', action: 'rename' });
            actions.push({ label: 'Move To...', action: 'move-to' });
            actions.push({ label: 'Delete', action: 'delete' });
            if (contextMenuItem.type === 'file' && contextMenuItem.name.endsWith('.zip')) {
                actions.push({ label: 'Unzip', action: 'unzip' });
            }
        }

        actions.forEach(({ label, action }) => {
            const li = document.createElement('li');
            li.textContent = label;
            li.dataset.action = action;
            contextMenu.appendChild(li);
        });

        contextMenu.style.display = 'block';
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const bodyWidth = document.body.clientWidth;
        const bodyHeight = document.body.clientHeight;
        contextMenu.style.left = x + menuWidth > bodyWidth ? `${x - menuWidth}px` : `${x}px`;
        contextMenu.style.top = y + menuHeight > bodyHeight ? `${y - menuHeight}px` : `${y}px`;
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
    }

    contextMenu.addEventListener('click', e => {
        e.stopPropagation();
        handleContextMenuAction(e.target.dataset.action);
        hideContextMenu();
    });

    async function handleContextMenuAction(action) {
        if (!contextMenuItem && action !== 'zip' && action !== 'delete-selected') return;

        switch (action) {
            case 'edit':
                if (contextMenuItem.type === 'folder') navigateTo([...currentPath, contextMenuItem.id]);
                else openEditFileModal(contextMenuItem);
                break;
            case 'rename': openRenameModal(contextMenuItem); break;
            case 'move-to': openMoveToModal(contextMenuItem); break;
            case 'delete':
                deleteItems([contextMenuItem.id]);
                break;
            case 'delete-selected':
                deleteItems([...selectedItems]);
                break;
            case 'unzip': await unzipFile(contextMenuItem); break;
            case 'zip': await zipSelectedItems(); break;
        }
    }

    // --- Actions & Data Manipulation ---
    function deleteItems(itemIds) {
        itemIds.forEach(id => {
            const { parent } = findItemAndParent(id, fsData);
            if (parent) {
                const index = parent.findIndex(i => i.id === id);
                if (index > -1) parent.splice(index, 1);
            }
        });
        selectedItems.clear();
        saveAndRender();
    }

    async function zipSelectedItems() {
        const zip = new JSZip();
        const itemsToZip = getFolderContents(currentPath).filter(i => selectedItems.has(i.id));

        for (const item of itemsToZip) {
            await addItemToZip(zip, item);
        }

        const content = await zip.generateAsync({ type: 'base64' });
        getFolderContents(currentPath).push({
            id: Date.now(),
            type: 'file',
            name: 'archive.zip',
            content: content
        });
        selectedItems.clear();
        saveAndRender();
    }

    async function addItemToZip(zip, item) {
        if (item.type === 'file') {
            const decodedContent = atob(item.content);
            zip.file(item.name, decodedContent);
        } else if (item.type === 'folder') {
            const folderZip = zip.folder(item.name);
            for (const child of item.children) {
                await addItemToZip(folderZip, child);
            }
        }
    }

    async function unzipFile(file) {
        if (!file.content) {
            alert('File is empty and cannot be unzipped.');
            return;
        }
        try {
            const zip = await JSZip.loadAsync(file.content, { base64: true });
            const newFolderName = file.name.endsWith('.zip') ? file.name.slice(0, -4) : `${file.name}-unzipped`;
            const newFolder = { id: Date.now(), type: 'folder', name: newFolderName, children: [] };

            for (const filename in zip.files) {
                const zipEntry = zip.files[filename];
                if (!zipEntry.dir) {
                    const content = await zipEntry.async('base64');
                    // This can be improved to handle folder structures within the zip
                    newFolder.children.push({ id: Date.now() + Math.random(), type: 'file', name: filename, content });
                }
            }
            getFolderContents(currentPath).push(newFolder);
            saveAndRender();
        } catch (e) {
            console.error("Unzip error:", e);
            alert("Failed to unzip. File may be corrupt or not a valid zip.");
        }
    }

    function dataURLtoBlob(dataurl) {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    // --- Toolbar Buttons ---
    document.getElementById('create-file').addEventListener('click', () => {
        getFolderContents(currentPath).push({ id: Date.now(), type: 'file', name: 'new_file.txt', content: btoa('') });
        saveAndRender();
    });
    document.getElementById('create-folder').addEventListener('click', () => {
        getFolderContents(currentPath).push({ id: Date.now(), type: 'folder', name: 'New Folder', children: [] });
        saveAndRender();
    });
    selectModeButton.addEventListener('click', toggleSelectionMode);
    document.getElementById('show-tutorial').addEventListener('click', () => showModal(modals.tutorial));
    document.getElementById('export-db').addEventListener('click', () => {
        const dataStr = JSON.stringify({ version: DB_VERSION, data: fsData }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'filesystem-db.json';
        link.click();
    });
    document.getElementById('import-files').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = e => {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = event => {
                    const base64Content = event.target.result.split(',')[1];
                    getFolderContents(currentPath).push({ id: Date.now() + Math.random(), type: 'file', name: file.name, content: base64Content });
                    saveAndRender();
                };
                reader.readAsDataURL(file);
            });
        };
        input.click();
    });
    document.getElementById('export-selected').addEventListener('click', async () => {
        if (selectedItems.size === 0) return alert('No items selected.');
        const items = getFolderContents(currentPath).filter(i => selectedItems.has(i.id));
        if (items.length === 1 && items[0].type === 'file') {
            const item = items[0];
            const blob = dataURLtoBlob(`data:application/octet-stream;base64,${item.content}`);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = item.name;
            link.click();
        } else {
            const zip = new JSZip();
            for (const item of items) {
                await addItemToZip(zip, item);
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'export.zip';
            link.click();
        }
    });
    // ... (rest of the modal and helper functions: findItemAndParent, getFolderContents, etc.)

    // --- Helper Functions (some might need slight adjustments) ---
    function getFolderContents(path) {
        let currentLevel = fsData;
        for (const folderId of path) {
            const folder = currentLevel.find(item => item.id === folderId && item.type === 'folder');
            if (!folder) return []; // Path is invalid
            currentLevel = folder.children;
        }
        return currentLevel;
    }

    function findItemAndParent(itemId, container = fsData, parent = null) {
        for (const item of container) {
            if (item.id === itemId) return { item, parent };
            if (item.type === 'folder') {
                const found = findItemAndParent(itemId, item.children, item);
                if (found) return found;
            }
        }
        return null;
    }

    // --- Modals ---
    function showModal(modal) { modal.classList.add('show'); }
    function hideModals() { document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show')); }
    closeButtons.forEach(btn => btn.addEventListener('click', hideModals));

    function openEditFileModal(file) {
        const content = file.content ? atob(file.content) : '';
        document.getElementById('edit-file-title').textContent = `Editing: ${file.name}`;
        editFileTextarea.value = content;
        saveFileButton.onclick = () => {
            file.content = btoa(editFileTextarea.value);
            hideModals();
            saveAndRender();
        };
        showModal(modals.editFile);
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
        showModal(modals.rename);
    }

    // ... (other functions like share, import link, check data, move to...)
    // These functions should also be reviewed to ensure they work with the new data structure.

    // Final setup
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideModals(); });

    function saveAndRender() {
        saveData();
        renderFileSystem();
    }

    fsData = getInitialData();
    navigateTo(currentPath);
});

