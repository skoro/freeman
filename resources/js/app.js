import Alpine from 'alpinejs';
import { JSONPath } from 'jsonpath-plus';
import './bootstrap';
import './freeman-utils.js';
import './freeman-store.js';
import './freeman-shell.js';
import './freeman-sidebar.js';
import './freeman-request-builder.js';
import './freeman-modals.js';

window.Alpine = Alpine;
window.JSONPath = JSONPath;
Alpine.start();
