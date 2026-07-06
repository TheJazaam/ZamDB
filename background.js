/**
 * @fileoverview ZamDB Service Worker.
 * Arquitetura projetada para Zero Rate-Limit: O Cache TTL de 24h protege o usuário de ser bloqueado pelas APIs.
 */

const CACHE_TTL = 86400000;

/**
 * Gera variantes de query para contornar nomenclatura não padronizada de jogos.
 * @param {string} name Nome do jogo.
 * @returns {string[]} Array de queries de busca.
 */
function getNameVariants(name) {
    let variants = [name];
    const n = name.toLowerCase();
    if (n.includes(" 2")) variants.push(n.replace(" 2", " ii"));
    if (n.includes(" ii")) variants.push(n.replace(" ii", " 2"));
    if (n.includes(" 3")) variants.push(n.replace(" 3", " iii"));
    if (n.includes(" iii")) variants.push(n.replace(" iii", " 3"));
    return variants;
}

/**
 * Orquestra o pipeline de coleta de dados cruzando informações via API.
 */
async function fetchGameData(appId, gameName, drmType, hasLauncher, apiKey) {
    const t0 = performance.now();
    const cacheKey = `zamdb_v6_${appId}`;
    const cached = await chrome.storage.local.get(cacheKey);
    
    // Proteção Anti-Banimento: Retorna do disco se TTL for válido
    if (cached[cacheKey] && (Date.now() - cached[cacheKey].timestamp < CACHE_TTL)) {
        cached[cacheKey].data.telemetry.fromCache = true;
        cached[cacheKey].data.telemetry.latency = "0ms (Cache)";
        return cached[cacheKey].data;
    }

    let logs = { statusGG: 0, statusReddit: 0, searchQueries: [], fromCache: false };

    try {
        const cleanQuery = encodeURIComponent(gameName.replace(/[™®]/g, ''));
        const urlGG = `https://api.gg.deals/v1/prices/by-steam-app-id/?ids=${appId}&key=${apiKey}&region=br`;
        const urlReddit = `https://www.reddit.com/r/CrackWatch/search.json?q=${cleanQuery}&restrict_sr=1&sort=new`;

        // Execução não-bloqueante paralela
        const [ggRes, redditRes] = await Promise.all([
            apiKey ? fetch(urlGG).catch(() => ({ status: 500, json: () => ({ success: false }) })) : Promise.resolve({ status: 401, json: () => ({ success: false }) }),
            fetch(urlReddit).catch(() => ({ status: 500, json: () => ({ data: { children: [] } }) }))
        ]);

        logs.statusGG = ggRes.status;
        logs.statusReddit = redditRes.status;

        const ggData = await ggRes.json();
        const rdData = await redditRes.json();

        let economy = { retail: "N/A", keyshop: "N/A", histRetail: "N/A", histKeyshop: "N/A", isLowest: false, url: `https://gg.deals/steam/app/${appId}/` };
        if (ggData && ggData.success && ggData.data[appId]) {
            const p = ggData.data[appId].prices;
            economy.url = ggData.data[appId].url || economy.url;
            economy.retail = p.currentRetail ? `R$ ${p.currentRetail}` : "N/A";
            economy.keyshop = p.currentKeyshops ? `R$ ${p.currentKeyshops}` : "N/A";
            economy.histRetail = p.historicalRetail ? `R$ ${p.historicalRetail}` : "N/A";
            economy.histKeyshop = p.historicalKeyshops ? `R$ ${p.historicalKeyshops}` : "N/A";
            economy.isLowest = parseFloat(p.currentKeyshops || 9999) <= parseFloat(p.historicalKeyshops || 0);
        }

        // Engine Forense Dual-Crack
        let drmPayload = { baseDrm: drmType || "Launcher Proprietário", isLocked: true, isSteamOnly: (!drmType && !hasLauncher), cracks: [] };

        if (drmType || hasLauncher) {
            const kScenes = { "empress": "EMPRESS", "delusional": "Delusional", "denuvowo": "DenuvOwO" };
            const uScenes = { "rune": "RUNE", "flt": "FLT", "tenoke": "TENOKE", "razor1911": "Razor1911", "skidrow": "SKIDROW", "codex": "CODEX", "cpy": "CPY", "goldberg": "Goldberg", "voices": "Voices", "p2p": "P2P" };
            const repackers = { "fitgirl": "FitGirl", "dodi": "DODI", "elamigos": "ElAmigos", "kaos": "KaOsKrew" };
            const kWords = [...Object.keys(kScenes), "hypervisor", "bypass"];
            
            const variants = getNameVariants(gameName);
            let foundKernel = false;
            let foundUser = false;

            searchLoop: for (const query of variants) {
                logs.searchQueries.push(query);
                const posts = rdData.data?.children || [];
                
                for (const post of posts) {
                    const title = post.data.title.toLowerCase();
                    const cleanTitle = title.replace(/[^\w]/g, '');
                    const cleanTarget = query.toLowerCase().replace(/[^\w]/g, '');
                    
                    if (cleanTitle.includes(cleanTarget)) {
                        let fK = Object.keys(kScenes).find(k => title.includes(k)) || kWords.find(k => title.includes(k));
                        let fU = Object.keys(uScenes).find(k => title.includes(k));
                        let fR = Object.keys(repackers).find(k => title.includes(k));

                        if (fK && !foundKernel) {
                            drmPayload.cracks.push({ type: "kernel", group: kScenes[fK] || "Kernel Bypass", thread: post.data.title, url: `https://www.reddit.com${post.data.permalink}` });
                            foundKernel = true;
                            drmPayload.isLocked = false;
                        } 
                        
                        if ((fU || fR) && !foundUser) {
                            drmPayload.cracks.push({ type: fU ? "user" : "repack", group: fU ? uScenes[fU] : repackers[fR], thread: post.data.title, url: `https://www.reddit.com${post.data.permalink}` });
                            foundUser = true;
                            drmPayload.isLocked = false;
                        }

                        if (foundKernel && foundUser) break searchLoop;
                    }
                }
            }
        }

        logs.latency = (performance.now() - t0).toFixed(2) + "ms";
        const finalResponse = { success: true, data: { economy, drmPayload }, telemetry: logs };
        
        await chrome.storage.local.set({ [cacheKey]: { data: finalResponse, timestamp: Date.now() } });
        return finalResponse;

    } catch (error) {
        return { success: false, error: error.message };
    }
}

chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.action === 'GET_DATA') {
        fetchGameData(req.appId, req.gameName, req.drmType, req.hasLauncher, req.apiKey).then(res);
        return true; 
    }
});

/**
 * MÓDULO VISUAL: Gerenciamento de Estado do Ícone (ZamDB)
 * Garante consistência visual: Colorido na Steam (mesmo via cache), Cinza fora.
 */

function updateIconState(tabId, url) {
    if (!url) return;

    // Regex estrita para garantir correspondência exata com páginas de jogos
    const isSteamGamePage = /store\.steampowered\.com\/app\/\d+/.test(url);

    try {
        if (isSteamGamePage) {
            chrome.action.setIcon({
                tabId: tabId,
                path: {
                    "16": "icons/icon16.png",
                    "32": "icons/icon32.png",
                    "128": "icons/icon128.png"
                }
            }, () => { if (chrome.runtime.lastError) {} });
        } else {
            chrome.action.setIcon({
                tabId: tabId,
                path: {
                    "16": "icons/icon16_gray.png",
                    "32": "icons/icon32_gray.png",
                    "128": "icons/icon128_gray.png"
                }
            }, () => { if (chrome.runtime.lastError) {} });
        }
    } catch (e) {
        console.error("[ZamDB Icon Engine Error]", e);
    }
}

// Captura a troca de abas focadas
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;
        updateIconState(activeInfo.tabId, tab.url || tab.pendingUrl);
    });
});

// Captura mudanças de status de carregamento (essencial para mitigar falhas de cache de SPA)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Dispara tanto na mudança explícita de URL quanto no disparo de status de carregamento da aba
    if (changeInfo.url || changeInfo.status === "loading" || changeInfo.status === "complete") {
        updateIconState(tabId, tab.url);
    }
});