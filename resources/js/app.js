import Alpine from 'alpinejs';
import { JSONPath } from 'jsonpath-plus';
import './bootstrap';
import './utils.js';
import './store.js';
import './shell.js';
import './sidebar.js';
import './request-builder.js';
import './modals.js';

window.Alpine = Alpine;
window.JSONPath = JSONPath;
Alpine.start();
