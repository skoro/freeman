// freeman-sidebar.js
import Alpine from 'alpinejs';
import { methodColor } from './utils.js';

// sidebarComponent — sidebar UI state, collection/folder CRUD, import/export.
// Reads shared data from Alpine.store('workspace'). Communicates via window events.

document.addEventListener('alpine:init', () => {
    Alpine.data('sidebarComponent', () => ({

        // ── Sidebar state ──────────────────────────────────────────────────
        expandedCollections: {},
        expandedFolders:     {},
        collectionMenuOpen:  null,
        importNotification:  null,
        addCollectionMenuOpen: false,
        newCollectionModal:  false,
        newCollectionName:   '',
        newCollectionLoading: false,
        newCollectionError:  null,

        folderModal:            { open: false, collectionId: null, parentFolderId: null, parentFolderName: null, name: '', loading: false, error: null },
        renameFolderModal:      { open: false, folderId: null, collectionId: null, name: '', loading: false, error: null },
        renameCollectionModal:  { open: false, collectionId: null, name: '', loading: false, error: null },
        addRequestModal:        { open: false, collectionId: null, folderId: null, name: '', loading: false, error: null },
        folderMenuOpen:         null,
        requestMenuOpen:        null,

        // ── Store proxies ──────────────────────────────────────────────────
        get collections()        { return Alpine.store('workspace').collections; },
        get collectionsLoading() { return Alpine.store('workspace').collectionsLoading; },
        get activeTab()          { return Alpine.store('workspace').activeTab; },

        // ── Tab actions (delegated to store) ───────────────────────────────
        newRequest()        { Alpine.store('workspace').newTab(); },
        openRequest(id)     { Alpine.store('workspace').openRequest(id); },
        methodColor(m)      { return methodColor(m); },

        // ── Collection vars modal (dispatches to collectionVarsModalComponent) ─
        openCollectionVariables(id, name) {
            window.dispatchEvent(new CustomEvent('freeman:open-collection-vars', { detail: { id, name } }));
        },

        // ── Expand / collapse ──────────────────────────────────────────────
        toggleCollection(id) {
            this.expandedCollections = { ...this.expandedCollections, [id]: !this.expandedCollections[id] };
        },
        isCollectionExpanded(id) { return !!this.expandedCollections[id]; },

        toggleFolder(id) {
            this.expandedFolders = { ...this.expandedFolders, [id]: !this.expandedFolders[id] };
        },
        isFolderExpanded(id) { return !!this.expandedFolders[id]; },

        // ── Flat depth-first tree for sidebar rendering ────────────────────
        flatCollectionTree(col) {
            const rows      = [];
            const allFolders = col.folders || [];
            const childMap  = {};
            for (const f of allFolders) {
                const pid = f.parent_folder_id ?? null;
                if (!childMap[pid]) childMap[pid] = [];
                childMap[pid].push(f);
            }
            const walk = (parentId, depth) => {
                const children = childMap[parentId] || [];
                for (const folder of children) {
                    rows.push({ type: 'folder', folder, depth, collectionId: col.id });
                    if (this.isFolderExpanded(folder.id)) {
                        for (const req of (folder.requests || [])) {
                            rows.push({ type: 'request', req, depth: depth + 1 });
                        }
                        walk(folder.id, depth + 1);
                    }
                }
            };
            for (const req of (col.requests || [])) {
                rows.push({ type: 'request', req, depth: 0 });
            }
            walk(null, 0);
            return rows;
        },

        // ── Context menus ──────────────────────────────────────────────────
        toggleCollectionMenu(id) {
            this.collectionMenuOpen = this.collectionMenuOpen === id ? null : id;
        },
        toggleFolderMenu(id) {
            this.folderMenuOpen = this.folderMenuOpen === id ? null : id;
        },
        toggleRequestMenu(id) {
            this.requestMenuOpen = this.requestMenuOpen === id ? null : id;
        },

        // ── Export ────────────────────────────────────────────────────────
        exportCollection(id) {
            window.location.href = `/collections/${id}/export`;
        },

        // ── Create folder ──────────────────────────────────────────────────
        openNewFolderModal(collectionId, parentFolderId = null, parentFolderName = null) {
            this.folderModal = { open: true, collectionId, parentFolderId, parentFolderName, name: '', loading: false, error: null };
            this.collectionMenuOpen = null;
            this.folderMenuOpen     = null;
        },

        async createFolder() {
            const name = this.folderModal.name.trim();
            if (!name) return;
            this.folderModal.loading = true;
            this.folderModal.error   = null;
            const payload = { name };
            if (this.folderModal.parentFolderId) payload.parent_folder_id = this.folderModal.parentFolderId;
            try {
                const res  = await fetch(`/collections/${this.folderModal.collectionId}/folders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type':     'application/json',
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (res.ok) {
                    this.folderModal.open = false;
                    await Alpine.store('workspace').loadCollections();
                    this.expandedCollections = { ...this.expandedCollections, [this.folderModal.collectionId]: true };
                    if (this.folderModal.parentFolderId) {
                        this.expandedFolders = { ...this.expandedFolders, [this.folderModal.parentFolderId]: true };
                    }
                } else {
                    this.folderModal.error = json.message || 'Could not create folder.';
                }
            } catch (e) {
                this.folderModal.error = 'Network error.';
            } finally {
                this.folderModal.loading = false;
            }
        },

        // ── Rename folder ──────────────────────────────────────────────────
        openRenameFolderModal(folderId, collectionId, currentName) {
            this.renameFolderModal = { open: true, folderId, collectionId, name: currentName, loading: false, error: null };
            this.folderMenuOpen = null;
        },

        async saveRenameFolder() {
            const name = this.renameFolderModal.name.trim();
            if (!name) return;
            this.renameFolderModal.loading = true;
            this.renameFolderModal.error   = null;
            try {
                const res  = await fetch(`/collections/${this.renameFolderModal.collectionId}/folders/${this.renameFolderModal.folderId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type':     'application/json',
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ name }),
                });
                const json = await res.json();
                if (res.ok) {
                    this.renameFolderModal.open = false;
                    await Alpine.store('workspace').loadCollections();
                } else {
                    this.renameFolderModal.error = json.message || 'Could not rename folder.';
                }
            } catch (e) {
                this.renameFolderModal.error = 'Network error.';
            } finally {
                this.renameFolderModal.loading = false;
            }
        },

        // ── Delete folder ──────────────────────────────────────────────────
        async deleteFolder(folderId, collectionId) {
            if (!confirm('Delete this folder and all its contents?')) return;
            try {
                await fetch(`/collections/${collectionId}/folders/${folderId}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                this.folderMenuOpen = null;
                await Alpine.store('workspace').loadCollections();
            } catch (e) {
                console.error('deleteFolder:', e);
            }
        },

        // ── Delete request ────────────────────────────────────────────────
        async deleteRequest(requestId) {
            if (!confirm('Delete this request?')) return;
            this.requestMenuOpen = null;
            const store = Alpine.store('workspace');
            try {
                await fetch(`/requests/${requestId}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                const tab = store.tabs.find(t => t.requestId === requestId);
                if (tab) store.removeTab(tab.id);
                await store.loadCollections();
            } catch (e) {
                console.error('deleteRequest:', e);
            }
        },

        // ── Duplicate request ─────────────────────────────────────────────
        async duplicateRequest(requestId) {
            this.requestMenuOpen = null;
            const store = Alpine.store('workspace');
            try {
                const res  = await fetch(`/requests/${requestId}/duplicate`, {
                    method: 'POST',
                    headers: {
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                const json = await res.json();
                if (res.ok) {
                    await store.loadCollections();
                    store.openRequest(json.data.id);
                }
            } catch (e) {
                console.error('duplicateRequest:', e);
            }
        },

        // ── Create collection ──────────────────────────────────────────────
        async createCollection() {
            const name = this.newCollectionName.trim();
            if (!name) return;
            this.newCollectionLoading = true;
            this.newCollectionError   = null;
            try {
                const res  = await fetch('/collections', {
                    method: 'POST',
                    headers: {
                        'Content-Type':     'application/json',
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ name }),
                });
                const json = await res.json();
                if (res.ok) {
                    this.newCollectionModal = false;
                    this.newCollectionName  = '';
                    await Alpine.store('workspace').loadCollections();
                } else {
                    this.newCollectionError = json.message || 'Could not create collection.';
                }
            } catch (e) {
                this.newCollectionError = 'Network error.';
            } finally {
                this.newCollectionLoading = false;
            }
        },

        // ── Rename collection ──────────────────────────────────────────────
        openRenameCollectionModal(collectionId, currentName) {
            this.renameCollectionModal = { open: true, collectionId, name: currentName, loading: false, error: null };
            this.collectionMenuOpen = null;
        },

        async saveRenameCollection() {
            const name = this.renameCollectionModal.name.trim();
            if (!name) return;
            this.renameCollectionModal.loading = true;
            this.renameCollectionModal.error   = null;
            try {
                const res  = await fetch(`/collections/${this.renameCollectionModal.collectionId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type':     'application/json',
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ name }),
                });
                const json = await res.json();
                if (res.ok) {
                    this.renameCollectionModal.open = false;
                    await Alpine.store('workspace').loadCollections();
                } else {
                    this.renameCollectionModal.error = json.message || 'Could not rename collection.';
                }
            } catch (e) {
                this.renameCollectionModal.error = 'Network error.';
            } finally {
                this.renameCollectionModal.loading = false;
            }
        },

        // ── Import ────────────────────────────────────────────────────────
        importCollection() {
            this.$refs.importFileInput.value = '';
            this.$refs.importFileInput.click();
        },

        async handleImportFile(files) {
            if (!files || !files[0]) return;
            const formData = new FormData();
            formData.append('file', files[0]);
            try {
                const res  = await fetch('/collections/import', {
                    method: 'POST',
                    headers: {
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: formData,
                });
                const json = await res.json();
                if (res.ok) {
                    this.importNotification = { ok: true, msg: `Imported "${json.data.name}" successfully.` };
                    await Alpine.store('workspace').loadCollections();
                } else {
                    this.importNotification = { ok: false, msg: json.message || 'Import failed.' };
                }
            } catch (e) {
                this.importNotification = { ok: false, msg: 'Network error during import.' };
            }
            setTimeout(() => { this.importNotification = null; }, 4000);
        },

        // ── Add request directly to collection / folder ───────────────────
        openAddRequestModal(collectionId, folderId = null) {
            this.addRequestModal = { open: true, collectionId, folderId, name: '', loading: false, error: null };
            this.collectionMenuOpen = null;
            this.folderMenuOpen     = null;
        },

        async createRequestInCollection() {
            const name = this.addRequestModal.name.trim();
            if (!name) return;
            this.addRequestModal.loading = true;
            this.addRequestModal.error   = null;
            try {
                const res  = await fetch('/requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type':     'application/json',
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        name,
                        method:        'GET',
                        url:           '',
                        collection_id: this.addRequestModal.collectionId,
                        folder_id:     this.addRequestModal.folderId || null,
                        body_type:     'none',
                        auth_type:     'none',
                    }),
                });
                const json = await res.json();
                if (res.ok) {
                    const { collectionId, folderId } = this.addRequestModal;
                    this.addRequestModal.open = false;
                    await Alpine.store('workspace').loadCollections();
                    this.expandedCollections = { ...this.expandedCollections, [collectionId]: true };
                    if (folderId) {
                        this.expandedFolders = { ...this.expandedFolders, [folderId]: true };
                    }
                    Alpine.store('workspace').openRequest(json.data.id);
                } else {
                    this.addRequestModal.error = json.message || 'Could not create request.';
                }
            } catch (e) {
                this.addRequestModal.error = 'Network error.';
            } finally {
                this.addRequestModal.loading = false;
            }
        },

        // ── Delete collection ──────────────────────────────────────────────
        async deleteCollection(id) {
            if (!confirm('Delete this collection and all its requests?')) return;
            try {
                await fetch(`/collections/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                // Close any open tabs that belonged to this collection
                const store = Alpine.store('workspace');
                const tabsToClose = store.tabs
                    .filter(t => t.request.collection_id === id)
                    .map(t => t.id);
                tabsToClose.forEach(tabId => store.removeTab(tabId));
                await store.loadCollections();
            } catch (e) {
                console.error('deleteCollection:', e);
            }
        },
    }));
});
