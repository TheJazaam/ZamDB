/**
 * @fileoverview ZamDB Content Script.
 * Lê a DOM e renderiza a Dashboard baseada em configuração de módulo.
 */

let isBooting = false; // Mutex Lock para prevenir concorrência de Observer.

const TRUSTED_SOURCES = {
    "cat_ddl": {
        "SteamRIP": { url: "https://steamrip.com/?s=", type: "query", color: "#bb86fc" },
        "AstralGames": { url: "https://astralgames.net/search?q=", type: "query", color: "#ff79c6" },
        "AnkerGames": { url: "https://ankergames.net/search/", type: "query", color: "#8be9fd" },
        "GameBounty": { url: "https://gamebounty.world/pt/", type: "slug", suffix: "-free-pc-download", color: "#ffb86c" }
    },
    "cat_repack": {
        "FitGirl": { url: "https://fitgirl-repacks.site/?s=", type: "query", color: "#a4d007" },
        "DODI": { url: "https://dodi-repacks.site/?s=", type: "query", color: "#ffcc00" }
    },
    "cat_forum": {
        "CS.RIN.RU": { url: "https://cs.rin.ru/forum/search.php?keywords=", type: "appid", color: "#67c1f5" },
        "Online-Fix": { url: "https://online-fix.me/index.php?do=search&subaction=search&story=", type: "query", color: "#ff4c4c" }
    }
};

const DICT = {
    "pt": {
        stores: "Lojas Oficiais", keyshops: "Mercado Cinza (Keys)",
        drm: "Proteção DRM", unreleased: "PRÉ-LANÇAMENTO",
        dlc: "Desbloqueio de DLC", lowest: "Menor Hist:", allTimeLow: "MENOR PREÇO",
        errApi: "⚠️ ERRO: API Key não configurada.",
        downTitle: "📥 DOWNLOADS VERIFICADOS",
        downThread: "🔗 Megathread r/Piracy",
        risk: "Risco de Ban", warn: "Possível (Ferramenta Externa)", safe: "Seguro (Local)",
        trace: "🛠️ ZAMDB TRACE LOG",
        cat_ddl: "DDL / Pré-Instalados", cat_repack: "Repacks", cat_forum: "Fóruns & Multiplayer",
        drm_steam: "Steam DRM / DRM-Free", drm_locked: "Não Crackeado", drm_cracked: "Crackeado",
        drm_repack: "Repack", drm_user: "User-mode", drm_kernel: "Hypervisor", link_source: "🔗"
    },
    "en": {
        stores: "Official Stores", keyshops: "Grey Market (Keys)",
        drm: "DRM Protection", unreleased: "UNRELEASED",
        dlc: "DLC Unlocker", lowest: "Hist. Low:", allTimeLow: "ALL-TIME LOW",
        errApi: "⚠️ ERROR: API Key missing.",
        downTitle: "📥 VERIFIED DOWNLOADS",
        downThread: "🔗 r/Piracy Megathread",
        risk: "Ban Risk", warn: "Possible (External)", safe: "Safe (Local)",
        trace: "🛠️ ZAMDB TRACE LOG",
        cat_ddl: "Direct Downloads (DDL)", cat_repack: "Repacks", cat_forum: "Forums & Multiplayer",
        drm_steam: "Steam DRM / DRM-Free", drm_locked: "Not Cracked", drm_cracked: "Cracked",
        drm_repack: "Repack", drm_user: "User-mode", drm_kernel: "Hypervisor", link_source: "🔗"
    }
};

function generateSlug(text) {
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');            
}

function getAppId() { return window.location.pathname.match(/\/app\/(\d+)/)?.[1] || null; }

function getGameName() {
    const el = document.getElementById('appHubAppName');
    return el ? el.textContent.trim().replace(/[™®]/g, '').split(":")[0].split(" - ")[0] : "Unknown";
}

function scanDRM() {
    for (let block of document.querySelectorAll('.DRM_notice')) {
        const text = block.textContent.trim();
        if (text.includes("3rd-party DRM:") || text.includes("DRM de terceiros:")) {
            let drmName = text.split(':')[1].trim();
            if (drmName.toLowerCase().includes("denuvo")) return "Denuvo Anti-Tamper";
            if (drmName.toLowerCase().includes("vm protect")) return "VMProtect";
            return drmName.split("machine activation")[0].replace(/\d+.*a day.*/i, "").trim() || "DRM Ativo";
        }
    }
    return false;
}

function checkCreamApiRisk() {
    const dom = document.body.textContent.toLowerCase();
    const categoryRisk = document.querySelector('a[href*="category=8"], a[href*="category=20"], a[href*="category=35"]') !== null;
    const antiCheat = dom.includes("anti-cheat") || dom.includes("battleye") || dom.includes("nprotect") || dom.includes("vm protect") || dom.includes("arxan") || dom.includes("aceville");
    const extLauncher = dom.includes("requires 3rd-party account") || dom.includes("requer conta de terceiros") || dom.includes("rockstar games");
    
    let status = "safe";
    if (categoryRisk || antiCheat) status = "danger";
    else if (extLauncher) status = "warning";
    return { status, triggers: { categoryRisk, antiCheat, extLauncher } };
}

function generateButtons(gameName, appId, t) {
    const cleanQuery = encodeURIComponent(gameName);
    const gameSlug = generateSlug(gameName);
    const btnCSS = "display: inline-block; padding: 4px 8px; margin: 0 4px 4px 0; font-size: 11px; border-radius: 2px; text-decoration: none; transition: 0.2s; background-color: rgba(0,0,0,0.4);";
    let html = '';
    
    for (const [catKey, sources] of Object.entries(TRUSTED_SOURCES)) {
        html += `<div style="margin-top: 8px; margin-bottom: 2px;"><span style="color: #8f98a0; font-size: 10px; text-transform: uppercase;">${t[catKey]}</span></div><div style="display: flex; flex-wrap: wrap;">`;
        for (const [name, config] of Object.entries(sources)) {
            let url = config.type === "query" ? config.url + cleanQuery : (config.type === "appid" ? config.url + appId : config.url + gameSlug + (config.suffix || ""));
            html += `<a href="${url}" target="_blank" style="${btnCSS} color: ${config.color}; border: 1px solid rgba(255,255,255,0.1);" onmouseover="this.style.backgroundColor='${config.color}'; this.style.color='#000';" onmouseout="this.style.backgroundColor='rgba(0,0,0,0.4)'; this.style.color='${config.color}';">${name}</a>`;
        }
        html += `</div>`;
    }
    return html;
}

function renderDashboard(appId, drmType, data, creamData, telemetry, isUnreleased, prefs) {
    if (!prefs.modEconomy && !prefs.modDrm && !prefs.modDlc && !prefs.modDownloads && !prefs.modDebug) return null;

    const t = DICT[prefs.lang] || DICT['en'];
    const ec = data?.economy;
    const div = document.createElement('div');
    div.id = 'zamdb-dashboard';
    
    div.style.cssText = `background: rgba(0,0,0,0.3); padding: 16px; margin-top: 16px; margin-bottom: 16px; border-radius: 4px; color: #c6d4df; font-family: "Motiva Sans", sans-serif; border: 1px solid rgba(255,255,255,0.05);`;
    const gridCSS = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;`;
    const labelCSS = `color: #556772; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;`;
    
    if (!ec && prefs.modEconomy) {
        div.innerHTML = `<div style="color:#ff4c4c; font-weight:bold;">${t.errApi}</div>`;
        return div;
    }

    let drmHTML = "";
    const pld = data.drmPayload;

    if (pld.isSteamOnly) {
        drmHTML = `<b style="font-size:13px; color:#a4d007;">${t.drm_steam}</b>`;
    } else if (pld.isLocked) {
        drmHTML = `<b style="font-size:13px; color:#67c1f5;">${pld.baseDrm} (${t.drm_locked})</b>`;
    } else {
        pld.cracks.forEach(c => {
            let color = c.type === 'kernel' ? '#ff4c4c' : '#a4d007';
            drmHTML += `
                <div style="margin-top:2px;">
                    <b style="font-size:13px; color:${color};">${t.drm_cracked} (${c.group} | ${t[`drm_${c.type}`]})</b>
                    <a href="${c.url}" target="_blank" style="color:#67c1f5; text-decoration:none; margin-left:4px; font-size:11px;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#67c1f5'">${t.link_source}</a>
                </div>
            `;
        });
    }

    const creamMap = { "danger": { color: "#ff4c4c", text: t.risk }, "warning": { color: "#ffcc00", text: t.warn }, "safe": { color: "#a4d007", text: t.safe } };
    const releaseTag = isUnreleased ? `<span style="background:#e0a000; color:#000; font-size:10px; padding:2px 6px; border-radius:2px; margin-left:6px; font-weight:bold;">${t.unreleased}</span>` : '';
    
    let html = `<div style="${gridCSS}">`;

    if (prefs.modEconomy) {
        const tagHtml = ec.isLowest ? `<span style="background:#a4d007; color:#000; font-size:10px; padding:2px 6px; border-radius:2px; margin-left:6px; font-weight:bold;">${t.allTimeLow}</span>` : '';
        html += `
            <div style="display:flex; flex-direction:column;">
                <div style="${labelCSS}">${t.stores}</div>
                <a href="${ec.url}" target="_blank" style="color:#fff; text-decoration:none;"><b style="font-size:18px;">${ec.retail}</b></a>
                <div style="font-size:11px; color:#67c1f5;">${t.lowest} ${ec.histRetail}</div>
            </div>
            <div style="display:flex; flex-direction:column; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 16px;">
                <div style="${labelCSS}">${t.keyshops}</div>
                <a href="${ec.url}" target="_blank" style="color:#fff; text-decoration:none;"><b style="font-size:18px;">${ec.keyshop} ${tagHtml}</b></a>
                <div style="font-size:11px; color:#67c1f5;">${t.lowest} ${ec.histKeyshop}</div>
            </div>
        `;
    }

    if (prefs.modDrm) {
        html += `
            <div style="display:flex; flex-direction:column; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 16px;">
                <div style="${labelCSS}">${t.drm} ${releaseTag}</div><div style="display:flex; flex-direction:column; justify-content:center; flex:1;">${drmHTML}</div>
            </div>
        `;
    }

    if (prefs.modDlc) {
        html += `
            <div style="display:flex; flex-direction:column; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 16px;">
                <div style="${labelCSS}">${t.dlc}</div><b style="font-size:13px; color:${creamMap[creamData.status].color}; margin-top:4px;">${creamMap[creamData.status].text}</b>
            </div>
        `;
    }
    html += `</div>`;

    if (prefs.modDownloads) {
        const borderTop = (prefs.modEconomy || prefs.modDrm || prefs.modDlc) ? `margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05);` : ``;
        html += `
            <div style="${borderTop}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="color: #fff; font-size: 12px; font-weight: bold;">${t.downTitle}</div>
                    <a href="https://rentry.org/megathread" target="_blank" style="color: #67c1f5; font-size: 10px; text-decoration: none;">${t.downThread}</a>
                </div>
                ${generateButtons(getGameName(), appId, t)}
            </div>
        `;
    }

    if (prefs.modDebug) {
        let threadLogs = "N/A";
        if (pld.cracks && pld.cracks.length > 0) {
            threadLogs = pld.cracks.map(c => `[${c.type.toUpperCase()}] ${c.thread}`).join("<br>");
        }
        
        // Agora injeta a "Console Table" diretamente na interface HTML sem custo de performance
        html += `
            <details style="margin-top: 12px; font-family: monospace; font-size: 10px; color: #8f98a0; padding: 8px; border: 1px dashed ${telemetry.fromCache ? '#a4d007' : '#ff4c4c'}; background: rgba(0,0,0,0.6);">
                <summary style="cursor: pointer; color: ${telemetry.fromCache ? '#a4d007' : '#ff4c4c'}; font-weight: bold; outline: none;">[${t.trace} ${telemetry.fromCache ? '(CACHE)' : ''}]</summary>
                
                <div style="margin-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div><b>[MATCH]</b><br>AppID: ${appId}<br>Query: ${telemetry.searchQueries?.[0] || 'N/A'}<br>Threads:<br><span style="color:#a4d007">${threadLogs}</span></div>
                    <div><b>[STATS]</b><br>Latency: ${telemetry.latency}<br>API HTTP (GG/Reddit): ${telemetry.statusGG} / ${telemetry.statusReddit}</div>
                </div>

                <div style="margin-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    <b style="color: #67c1f5;">[DOM EXTRACTOR]</b><br>
                    DRM Nativo (Loja): <span style="color:#fff">${drmType || "Nenhum"}</span><br>
                    Anti-Cheat / Servidor: <span style="color:#fff">${creamData.triggers.antiCheat || creamData.triggers.categoryRisk}</span><br>
                    Launcher Proprietário: <span style="color:#fff">${creamData.triggers.extLauncher}</span>
                </div>

                <div style="margin-top: 8px;">
                    <b style="color: #a4d007;">[GG.DEALS PAYLOAD]</b><br>
                    Retail Oficial: <span style="color:#fff">${ec ? ec.retail : 'N/A'}</span> (Hist: ${ec ? ec.histRetail : 'N/A'})<br>
                    Keyshops Cinzas: <span style="color:#fff">${ec ? ec.keyshop : 'N/A'}</span> (Hist: ${ec ? ec.histKeyshop : 'N/A'})
                </div>
            </details>
        `;
    }

    div.innerHTML = html;
    return div;
}

function dumpTablesToConsole(appId, gameName, drmType, creamData, apiData) {
    console.groupCollapsed(`[ZamDB OSINT] Auditoria Forense: ${gameName} (${appId})`);
    console.log("%c[1. Extrator DOM local]", "color: #67c1f5; font-weight: bold;");
    console.table({ "DRM Nativo": drmType || "Nenhum", "Risco Anti-Cheat": creamData.triggers.antiCheat || creamData.triggers.categoryRisk, "Risco Launcher": creamData.triggers.extLauncher });
    console.log("%c[2. Reddit Engine API (Cracks)]", "color: #ff4c4c; font-weight: bold;");
    if (apiData.data.drmPayload.cracks && apiData.data.drmPayload.cracks.length > 0) console.table(apiData.data.drmPayload.cracks);
    else console.log("Nenhum crack detectado (Protegido ou Steam-Free).");
    console.log("%c[3. GG.Deals Economia]", "color: #a4d007; font-weight: bold;");
    if(apiData.data.economy) console.table(apiData.data.economy);
    console.groupEnd();
}

/**
 * Função de inicialização com Mutex.
 */
function boot() {
    if (isBooting || document.getElementById('zamdb-dashboard')) return;
    
    const appId = getAppId();
    if (!appId) return;

    isBooting = true; 

    chrome.storage.local.get({
        apiKey: "", lang: "pt", 
        modEconomy: true, modDrm: true, modDlc: true, modDownloads: true, modDebug: true
    }, (prefs) => {
        const gameName = getGameName();
        const drmType = scanDRM();
        const creamData = checkCreamApiRisk();
        const isUnreleased = document.querySelector('.game_area_comingsoon') !== null;

        chrome.runtime.sendMessage({ action: 'GET_DATA', appId, gameName, drmType, hasLauncher: creamData.triggers.extLauncher, apiKey: prefs.apiKey }, (res) => {
            isBooting = false;

            if (!res || res.error) return;

            // Se ainda quiser que saia no F12, descomente a linha abaixo
            // if (prefs.modDebug) dumpTablesToConsole(appId, gameName, drmType, creamData, res);

            // ÂNCORA DEFINITIVA: 
            // Coluna da esquerda oficial da Steam. Força a largura máxima a ~616px.
            // Ao usar prepend, a UI injeta ACIMA do Early Access, dos Curadores e das Caixas de Compra.
            const anchor = document.querySelector('.leftcol.game_description_column');
            if (anchor) {
                const ui = renderDashboard(appId, drmType, res.data, creamData, res.telemetry, isUnreleased, prefs);
                if (ui) {
                    // Prepend coloca como o "primeiro filho" da coluna da esquerda
                    anchor.prepend(ui);
                }
            }
        });
    });
}

boot();
const observer = new MutationObserver(() => {
    // Escuta a coluna principal de descrição e evita enfileiramento (isBooting)
    if(!document.getElementById('zamdb-dashboard') && document.querySelector('.leftcol.game_description_column') && !isBooting) {
        boot();
    }
});
observer.observe(document.body, { childList: true, subtree: true });