// freeman-modals.js
import Alpine from 'alpinejs';

// saveModalComponent — save-request modal state and save logic.
// collectionVarsModalComponent — collection variables modal.
// Both listen for window events dispatched by other components.

document.addEventListener('alpine:init', () => {

    // ── Save Modal ─────────────────────────────────────────────────────────
    Alpine.data('saveModalComponent', () => ({

        saveModal: {
            open:         false,
            name:         'New Request',
            collectionId: null,
            folderId:     null,
            saving:       false,
            error:        null,
            path:         [],
        },

        get saveModalBrowserItems() {
            const collections = Alpine.store('workspace').collections;
            if (!this.saveModal.path.length) {
                return collections.map(c => ({
                    id: c.id, name: c.name, type: 'collection',
                    hasChildren: (c.folders || []).some(f => (f.parent_folder_id ?? null) === null),
                }));
            }
            const col = collections.find(c => c.id == this.saveModal.collectionId);
            if (!col) return [];
            const last     = this.saveModal.path[this.saveModal.path.length - 1];
            const parentId = last.type === 'folder' ? last.id : null;
            return (col.folders || [])
                .filter(f => (f.parent_folder_id ?? null) == parentId)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(f => ({
                    id: f.id, name: f.name, type: 'folder',
                    hasChildren: (col.folders || []).some(cf => cf.parent_folder_id == f.id),
                }));
        },

        // ── Init — listen for save-request event from shell (Ctrl+S) and request-builder ──
        init() {
            window.addEventListener('freeman:save-request', () => this.saveRequest());
        },

        openSaveModal() {
            const tab = Alpine.store('workspace').activeTab;
            this.saveModal = {
                open:         true,
                name:         tab?.request.name || 'New Request',
                collectionId: null,
                folderId:     null,
                saving:       false,
                error:        null,
                path:         [],
            };
        },

        saveModalNavigateInto(item) {
            this.saveModal.path = [...this.saveModal.path, { id: item.id, name: item.name, type: item.type }];
            if (item.type === 'collection') {
                this.saveModal.collectionId = item.id;
                this.saveModal.folderId     = null;
            } else {
                this.saveModal.folderId = item.id;
            }
        },

        saveModalNavigateTo(index) {
            if (index < 0) {
                this.saveModal.path         = [];
                this.saveModal.collectionId = null;
                this.saveModal.folderId     = null;
            } else {
                this.saveModal.path = this.saveModal.path.slice(0, index + 1);
                const item = this.saveModal.path[index];
                if (item.type === 'collection') {
                    this.saveModal.collectionId = item.id;
                    this.saveModal.folderId     = null;
                } else {
                    this.saveModal.folderId = item.id;
                }
            }
        },

        async confirmSaveRequest() {
            const tab = Alpine.store('workspace').activeTab;
            if (!tab) return;
            if (!this.saveModal.collectionId) {
                this.saveModal.error = 'Please select a collection.';
                return;
            }
            this.saveModal.saving = true;
            this.saveModal.error  = null;
            try {
                const res = await fetch('/requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept':       'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    },
                    body: JSON.stringify({
                        name:          this.saveModal.name,
                        method:        tab.request.method,
                        url:           tab.request.url,
                        collection_id: this.saveModal.collectionId,
                        folder_id:     this.saveModal.folderId || null,
                        params:        tab.request.params.filter(p => p.key.trim()),
                        headers:       tab.request.headers.filter(h => h.key.trim()),
                        body_type:     tab.request.body_type,
                        raw_body_type: tab.request.raw_body_type,
                        body:          tab.request.body,
                        body_form:     tab.request.body_form.filter(r => r.key.trim()),
                        auth_type:     tab.request.auth_type,
                        auth_data:     tab.request.auth_data,
                    }),
                });
                const json = await res.json();
                if (!res.ok) {
                    this.saveModal.error = json.message || 'Failed to save.';
                    return;
                }
                tab.requestId             = json.data.id;
                tab.request.name          = this.saveModal.name;
                tab.request.collection_id = this.saveModal.collectionId;
                tab.savedSnapshot         = JSON.stringify(tab.request);
                tab.isDirty               = false;
                this.saveModal.open       = false;
                Alpine.store('workspace').persistTabs();
                await Alpine.store('workspace').loadCollections();
            } catch (e) {
                this.saveModal.error = 'An error occurred.';
                console.error('confirmSaveRequest:', e);
            } finally {
                this.saveModal.saving = false;
            }
        },

        async saveRequest() {
            const tab = Alpine.store('workspace').activeTab;
            if (!tab) return;
            if (!tab.requestId) { this.openSaveModal(); return; }
            try {
                await fetch(`/requests/${tab.requestId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept':       'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    },
                    body: JSON.stringify({
                        name:          tab.request.name,
                        method:        tab.request.method,
                        url:           tab.request.url,
                        params:        tab.request.params.filter(p => p.key.trim()),
                        headers:       tab.request.headers.filter(h => h.key.trim()),
                        body_type:     tab.request.body_type,
                        raw_body_type: tab.request.raw_body_type,
                        body:          tab.request.body,
                        body_form:     tab.request.body_form.filter(r => r.key.trim()),
                        auth_type:     tab.request.auth_type,
                        auth_data:     tab.request.auth_data,
                    }),
                });
                tab.savedSnapshot = JSON.stringify(tab.request);
                tab.isDirty       = false;
                await Alpine.store('workspace').loadCollections();
            } catch (e) {
                console.error('saveRequest:', e);
            }
        },
    }));

    // ── Collection Variables Modal ─────────────────────────────────────────
    Alpine.data('collectionVarsModalComponent', () => ({

        collectionVarsModal: {
            open:           false,
            collectionId:   null,
            collectionName: '',
            variables:      [],
            saving:         false,
        },

        // ── Init — listen for open event dispatched by sidebarComponent ────
        init() {
            window.addEventListener('freeman:open-collection-vars', (e) => {
                this.openCollectionVariables(e.detail.id, e.detail.name);
            });
        },

        async openCollectionVariables(collectionId, collectionName) {
            this.collectionVarsModal.collectionId   = collectionId;
            this.collectionVarsModal.collectionName = collectionName;
            this.collectionVarsModal.saving         = false;
            this.collectionVarsModal.variables      = [];
            this.collectionVarsModal.open           = true;

            try {
                const res  = await fetch(`/collections/${collectionId}/variables`, {
                    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                });
                const json = await res.json();
                this.collectionVarsModal.variables = (json.data && json.data.length)
                    ? json.data
                    : [{ key: '', value: '', enabled: true }];
            } catch (e) {
                console.error('openCollectionVariables:', e);
                this.collectionVarsModal.variables = [{ key: '', value: '', enabled: true }];
            }
        },

        addVariableRow() {
            this.collectionVarsModal.variables.push({ key: '', value: '', enabled: true });
        },

        removeVariableRow(i) {
            this.collectionVarsModal.variables.splice(i, 1);
            if (!this.collectionVarsModal.variables.length) {
                this.collectionVarsModal.variables.push({ key: '', value: '', enabled: true });
            }
        },

        async saveCollectionVariables() {
            this.collectionVarsModal.saving = true;
            try {
                await fetch(`/collections/${this.collectionVarsModal.collectionId}/variables`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type':     'application/json',
                        'Accept':           'application/json',
                        'X-CSRF-TOKEN':     document.querySelector('meta[name="csrf-token"]').content,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        variables: this.collectionVarsModal.variables.filter(v => v.key.trim()),
                    }),
                });
                await Alpine.store('workspace').loadCurrentCollectionVars(this.collectionVarsModal.collectionId);
                this.collectionVarsModal.open = false;
            } catch (e) {
                console.error('saveCollectionVariables:', e);
            } finally {
                this.collectionVarsModal.saving = false;
            }
        },
    }));
});
