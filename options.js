/**
 * @fileoverview Motor de Configurações e i18n Local.
 */

const DICT_OPTIONS = {
    "pt": {
        title_general: "⚙️ ZamDB - Geral",
        lbl_api: "API Key (GG.Deals)",
        plc_api: "Insira a chave de desenvolvedor...",
        lbl_lang: "Idioma da Interface",
        title_modules: "🧩 Módulos da Dashboard",
        chk_eco: "Exibir Economia e Histórico",
        chk_drm: "Exibir Proteção / Status de DRM",
        chk_dlc: "Exibir DLC Unlocker",
        chk_down: "Exibir Links de Download",
        chk_debug: "Exibir Trace Log de Auditoria",
        btn_save: "Salvar e Aplicar",
        msg_success: "Configurações salvas. Atualize a página da Steam."
    },
    "en": {
        title_general: "⚙️ ZamDB - General",
        lbl_api: "API Key (GG.Deals)",
        plc_api: "Insert developer key here...",
        lbl_lang: "Interface Language",
        title_modules: "🧩 Dashboard Modules",
        chk_eco: "Show Economy and History",
        chk_drm: "Show Protection / DRM Status",
        chk_dlc: "Show DLC Unlocker Viability",
        chk_down: "Show Download Links",
        chk_debug: "Show Audit Trace Log",
        btn_save: "Save and Apply",
        msg_success: "Settings saved. Refresh the Steam page."
    }
};

/**
 * Traduz a DOM com base no dicionário local.
 * @param {string} lang Código do idioma ('pt' ou 'en')
 */
function applyLanguage(lang) {
    const t = DICT_OPTIONS[lang] || DICT_OPTIONS['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t[el.getAttribute('data-i18n')];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t[el.getAttribute('data-i18n-placeholder')];
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Carrega o estado atual
    chrome.storage.local.get({
        apiKey: "", lang: "pt", 
        modEconomy: true, modDrm: true, modDlc: true, modDownloads: true, modDebug: true
    }, (prefs) => {
        document.getElementById('opt_api_key').value = prefs.apiKey;
        document.getElementById('opt_lang').value = prefs.lang;
        document.getElementById('mod_economy').checked = prefs.modEconomy;
        document.getElementById('mod_drm').checked = prefs.modDrm;
        document.getElementById('mod_dlc').checked = prefs.modDlc;
        document.getElementById('mod_downloads').checked = prefs.modDownloads;
        document.getElementById('mod_debug').checked = prefs.modDebug;
        
        applyLanguage(prefs.lang);
    });

    // Escuta mudança no menu de idioma e aplica em tempo real
    document.getElementById('opt_lang').addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });

    // Salva o novo estado
    document.getElementById('saveBtn').addEventListener('click', () => {
        const lang = document.getElementById('opt_lang').value;
        const payload = {
            apiKey: document.getElementById('opt_api_key').value.trim(),
            lang: lang,
            modEconomy: document.getElementById('mod_economy').checked,
            modDrm: document.getElementById('mod_drm').checked,
            modDlc: document.getElementById('mod_dlc').checked,
            modDownloads: document.getElementById('mod_downloads').checked,
            modDebug: document.getElementById('mod_debug').checked
        };

        chrome.storage.local.set(payload, () => {
            const status = document.getElementById('status');
            status.textContent = DICT_OPTIONS[lang].msg_success;
            setTimeout(() => status.textContent = '', 3000);
        });
    });
});