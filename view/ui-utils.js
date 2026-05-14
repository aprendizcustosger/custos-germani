export function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
export function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
export function formatCurrencyBRL(value) { return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
export function formatDateTimeBR(value) { if (!value) return '-'; const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) return '-'; return parsed.toLocaleString('pt-BR'); }
export function formatDateBR(value) { if (!value) return '-'; const parsed = new Date(value + 'T00:00:00'); if (Number.isNaN(parsed.getTime())) return '-'; return parsed.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }); }
export function showToast(icon, text) { Swal.fire({ toast: true, position: 'top-end', timer: 2600, showConfirmButton: false, icon, text }); }
