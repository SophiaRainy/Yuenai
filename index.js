// Aurora Balance Checker - SillyTavern Extension
// 查询 love.auroralove.cc 的 API 余额

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const extensionName = 'aurora-balance';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
    apiKey: '',
    autoRefresh: false,
    refreshInterval: 60, // 秒
};

let refreshTimer = null;

/**
 * 加载扩展设置
 */
function loadSettings() {
    // 初始化默认设置
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    // 确保所有默认字段存在
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = value;
        }
    }

    // 同步 UI
    $('#aurora_api_key_input').val(extension_settings[extensionName].apiKey);
    $('#aurora_auto_refresh').prop('checked', extension_settings[extensionName].autoRefresh);
}

/**
 * 查询余额
 */
async function checkBalance() {
    const apiKey = extension_settings[extensionName].apiKey;

    if (!apiKey) {
        showResult('<span class="balance-error">⚠️ 请先填写 API Key</span>');
        toastr.warning('请先填写 Aurora API Key');
        return;
    }

    showResult('⏳ 查询中...');

    try {
        const response = await fetch('https://love.auroralove.cc/api/points', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': '*/*',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Aurora Balance]', data);

        // 根据 API 返回的数据结构显示余额
        // 常见的返回格式可能是: { points: 123 } 或 { balance: 123 } 或 { data: { points: 123 } }
        let balanceText = '';

        if (typeof data === 'number') {
            balanceText = `<span class="balance-value">${data}</span> 点数`;
        } else if (data.points !== undefined) {
            balanceText = `<span class="balance-value">${data.points}</span> 点数`;
        } else if (data.balance !== undefined) {
            balanceText = `<span class="balance-value">${data.balance}</span>`;
        } else if (data.data && data.data.points !== undefined) {
            balanceText = `<span class="balance-value">${data.data.points}</span> 点数`;
        } else {
            // 如果不确定结构，直接显示原始 JSON
            balanceText = `<pre style="margin:0;white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>`;
        }

        const now = new Date().toLocaleTimeString('zh-CN');
        showResult(`💰 余额: ${balanceText}<br><small style="opacity:0.6;">更新于 ${now}</small>`);
        toastr.success('余额查询成功！');

    } catch (error) {
        console.error('[Aurora Balance] Error:', error);
        showResult(`<span class="balance-error">❌ 查询失败: ${error.message}</span>`);
        toastr.error(`查询失败: ${error.message}`);
    }
}

/**
 * 显示结果
 */
function showResult(html) {
    $('#aurora-balance-result').html(html);
}

/**
 * 管理自动刷新定时器
 */
function manageAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    if (extension_settings[extensionName].autoRefresh && extension_settings[extensionName].apiKey) {
        const interval = extension_settings[extensionName].refreshInterval * 1000;
        refreshTimer = setInterval(checkBalance, interval);
        console.log(`[Aurora Balance] 自动刷新已启动，间隔 ${extension_settings[extensionName].refreshInterval}s`);
    }
}

/**
 * 初始化 - jQuery ready
 */
jQuery(async () => {
    // 创建 UI 面板 HTML
    const settingsHtml = `
    <div id="aurora-balance-panel" class="aurora-balance-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🌌 Aurora 余额查询</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div>
                    <label for="aurora_api_key_input">
                        <small>Aurora API Key</small>
                    </label>
                    <input id="aurora_api_key_input" class="text_pole" type="password" 
                           placeholder="输入你的 Aurora API Key (如: Aurora-H5VFLn...)" />
                </div>

                <label id="aurora-auto-refresh-label">
                    <input id="aurora_auto_refresh" type="checkbox" />
                    <span>自动刷新 (每60秒)</span>
                </label>

                <div id="aurora-check-balance-btn" class="menu_button menu_button_icon">
                    <i class="fa-solid fa-coins"></i>
                    <span>查询余额</span>
                </div>

                <div id="aurora-balance-result">
                    <small style="opacity:0.5;">点击上方按钮查询余额</small>
                </div>
            </div>
        </div>
    </div>
    `;

    // 将面板添加到扩展设置区域
    $('#extensions_settings').append(settingsHtml);

    // 加载设置
    loadSettings();

    // ===== 事件绑定 =====

    // API Key 输入
    $('#aurora_api_key_input').on('input', function () {
        extension_settings[extensionName].apiKey = $(this).val().trim();
        saveSettingsDebounced();
        manageAutoRefresh();
    });

    // 查询按钮点击
    $('#aurora-check-balance-btn').on('click', checkBalance);

    // 自动刷新开关
    $('#aurora_auto_refresh').on('change', function () {
        extension_settings[extensionName].autoRefresh = $(this).prop('checked');
        saveSettingsDebounced();
        manageAutoRefresh();
    });

    // 启动自动刷新（如果之前开启了）
    manageAutoRefresh();

    console.log('[Aurora Balance] 插件已加载 ✅');
});
