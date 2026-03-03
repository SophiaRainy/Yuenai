import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const extensionName = 'SillyTavern-AuroraBalance';
const defaultSettings = { apiKey: '' };

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (!extension_settings[extensionName].apiKey) {
        extension_settings[extensionName].apiKey = '';
    }
    $('#aurora_api_key_input').val(extension_settings[extensionName].apiKey);
}

function showResult(html) {
    $('#aurora-balance-result').html(html);
}

async function checkBalance() {
    const apiKey = extension_settings[extensionName].apiKey;
    if (!apiKey || !apiKey.trim()) {
        showResult('<span class="aurora-err">⚠️ 请先填写 API Key</span>');
        toastr.warning('请先输入 Aurora API Key');
        return;
    }

    showResult('⏳ 查询中...');
    $('#aurora-check-balance-btn').addClass('disabled');

    try {
        let data = null;
        let raw = '';

        // 先尝试直接请求
        try {
            const resp = await fetch('https://love.auroralove.cc/api/points', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + apiKey.trim(),
                    'Accept': '*/*',
                },
            });
            raw = await resp.text();
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
        } catch (e) {
            // 直接请求失败，尝试酒馆代理
            console.warn('[Aurora] 直接请求失败，尝试代理:', e.message);
            const resp2 = await fetch('/api/extensions/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://love.auroralove.cc/api/points',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + apiKey.trim() },
                }),
            });
            raw = await resp2.text();
        }

        // 检测维护页面
        if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
            throw new Error('🔧 Aurora 服务器正在维护中，请稍后再试');
        }

        try { data = JSON.parse(raw); } catch { data = raw; }

        console.log('[Aurora]', data);
        const now = new Date().toLocaleTimeString('zh-CN');
        let html = '';

        if (typeof data === 'number' || typeof data === 'string') {
            html = '💰 余额: <span class="aurora-val">' + data + '</span>';
        } else if (data && typeof data === 'object') {
            const p = data.points ?? data.point ?? data.balance ?? data.credit ?? data.credits ??
                      (data.data && (data.data.points ?? data.data.balance)) ?? null;
            if (p !== null) {
                html = '💰 余额: <span class="aurora-val">' + p + '</span> 点数';
            } else {
                html = '<pre style="margin:0;white-space:pre-wrap;font-size:12px;">' +
                       JSON.stringify(data, null, 2) + '</pre>';
            }
        }

        showResult(html + '<div class="aurora-time">🕐 ' + now + '</div>');
        toastr.success('查询成功');

    } catch (err) {
        console.error('[Aurora]', err);
        showResult('<span class="aurora-err">❌ ' + err.message + '</span>');
        toastr.error(err.message);
    } finally {
        $('#aurora-check-balance-btn').removeClass('disabled');
    }
}

jQuery(async () => {
    const html = `
    <div id="aurora-balance-panel">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🌌 Aurora 余额查询</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label><small>Aurora API Key：</small></label>
                <input id="aurora_api_key_input" class="text_pole" type="password"
                       placeholder="例如: Aurora-H5VFLnVI7NwqaMyf6LC2Hh" />
                <div id="aurora-check-balance-btn" class="menu_button menu_button_icon">
                    <i class="fa-solid fa-coins"></i>
                    <span>查询余额</span>
                </div>
                <div id="aurora-balance-result">
                    <small style="opacity:0.5;">点击按钮查询余额</small>
                </div>
            </div>
        </div>
    </div>`;

    $('#extensions_settings').append(html);
    loadSettings();

    $('#aurora_api_key_input').on('input', function () {
        extension_settings[extensionName].apiKey = $(this).val().trim();
        saveSettingsDebounced();
    });

    $('#aurora-check-balance-btn').on('click', checkBalance);

    console.log('[Aurora Balance] ✅ 已加载');
});
