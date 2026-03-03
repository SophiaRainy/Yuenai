import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const extensionName = 'aurora-balance';
const defaultSettings = {
    apiKey: '',
};

// ========== 加载设置 ==========
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (!extension_settings[extensionName].apiKey) {
        extension_settings[extensionName].apiKey = defaultSettings.apiKey;
    }
    $('#aurora_api_key_input').val(extension_settings[extensionName].apiKey);
}

// ========== 查询余额（通过酒馆后端代理，避免 CORS） ==========
async function checkBalance() {
    const apiKey = extension_settings[extensionName].apiKey;

    if (!apiKey || apiKey.trim() === '') {
        showResult('<span class="aurora-balance-error">⚠️ 请先填写 API Key！</span>');
        toastr.warning('请先输入你的 Aurora API Key');
        return;
    }

    showResult('⏳ 正在查询余额...');
    $('#aurora-check-balance-btn').prop('disabled', true);

    try {
        // === 方法1：直接请求（如果没有 CORS 问题） ===
        let response;
        let data;

        try {
            response = await fetch('https://love.auroralove.cc/api/points', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Accept': '*/*',
                },
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errText.substring(0, 200)}`);
            }

            // 尝试解析为 JSON
            const contentType = response.headers.get('content-type') || '';
            const rawText = await response.text();

            // 检查是否返回了 HTML（维护页面）
            if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
                throw new Error('服务器返回了 HTML 页面（可能正在维护中）');
            }

            try {
                data = JSON.parse(rawText);
            } catch {
                // 如果不是 JSON，直接显示原始文本
                data = rawText;
            }

        } catch (fetchError) {
            // === 方法2：如果直接请求失败，尝试通过酒馆代理 ===
            console.warn('[Aurora] 直接请求失败，尝试通过代理...', fetchError.message);

            try {
                response = await fetch('/api/extensions/fetch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: 'https://love.auroralove.cc/api/points',
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${apiKey.trim()}`,
                        },
                    }),
                });

                const rawText = await response.text();

                if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
                    throw new Error('🔧 Aurora 服务器正在维护中，请稍后再试！');
                }

                try {
                    data = JSON.parse(rawText);
                } catch {
                    data = rawText;
                }

            } catch (proxyError) {
                throw new Error(proxyError.message || fetchError.message);
            }
        }

        // ========== 显示结果 ==========
        console.log('[Aurora Balance] 返回数据:', data);

        const now = new Date().toLocaleTimeString('zh-CN');
        let balanceHtml = '';

        if (data === null || data === undefined) {
            balanceHtml = '<span class="aurora-balance-error">返回数据为空</span>';
        } else if (typeof data === 'string') {
            balanceHtml = `<span class="aurora-balance-value">${data}</span>`;
        } else if (typeof data === 'number') {
            balanceHtml = `💰 余额: <span class="aurora-balance-value">${data}</span>`;
        } else if (typeof data === 'object') {
            // 尝试各种可能的字段名
            const points = data.points ?? data.point ?? data.balance ?? 
                           data.credit ?? data.credits ?? data.remaining ??
                           (data.data && (data.data.points ?? data.data.balance ?? data.data.credit)) ??
                           null;

            if (points !== null && points !== undefined) {
                balanceHtml = `💰 余额: <span class="aurora-balance-value">${points}</span> 点数`;
            } else {
                // 显示完整 JSON 方便调试
                balanceHtml = `<pre style="margin:0;white-space:pre-wrap;font-size:12px;">${JSON.stringify(data, null, 2)}</pre>`;
            }
        }

        showResult(`
            ${balanceHtml}
            <div class="aurora-balance-time">🕐 更新于 ${now}</div>
        `);
        toastr.success('余额查询成功！');

    } catch (error) {
        console.error('[Aurora Balance] 查询失败:', error);

        let errorMsg = error.message;
        if (errorMsg.includes('维护')) {
            showResult(`<span class="aurora-balance-error">🔧 Aurora 服务器正在维护中</span>
                <div class="aurora-balance-time">请稍后再试</div>`);
            toastr.error('Aurora 服务器维护中');
        } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
            showResult(`<span class="aurora-balance-error">🌐 网络错误或 CORS 被阻止</span>
                <div class="aurora-balance-time">请检查网络连接</div>`);
            toastr.error('网络连接失败');
        } else {
            showResult(`<span class="aurora-balance-error">❌ ${errorMsg}</span>`);
            toastr.error(`查询失败: ${errorMsg}`);
        }
    } finally {
        $('#aurora-check-balance-btn').prop('disabled', false);
    }
}

// ========== 显示结果 ==========
function showResult(html) {
    $('#aurora-balance-result').html(html);
}

// ========== 初始化 ==========
jQuery(async () => {
    const settingsHtml = `
    <div id="aurora-balance-panel">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🌌 Aurora 余额查询</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div>
                    <label for="aurora_api_key_input">
                        <small>Aurora API Key：</small>
                    </label>
                    <input id="aurora_api_key_input" 
                           class="text_pole" 
                           type="password" 
                           placeholder="例如: Aurora-H5VFLnVI7NwqaMyf6LC2Hh" />
                </div>

                <div id="aurora-check-balance-btn" class="menu_button menu_button_icon">
                    <i class="fa-solid fa-coins"></i>
                    <span>查询余额</span>
                </div>

                <div id="aurora-balance-result">
                    <small style="opacity:0.5;">点击上方按钮查询余额</small>
                </div>
            </div>
        </div>
    </div>`;

    // 添加到扩展设置面板
    $('#extensions_settings').append(settingsHtml);

    // 加载已保存的设置
    loadSettings();

    // 绑定事件
    $('#aurora_api_key_input').on('input', function () {
        extension_settings[extensionName].apiKey = $(this).val().trim();
        saveSettingsDebounced();
    });

    $('#aurora-check-balance-btn').on('click', function () {
        if (!$(this).prop('disabled')) {
            checkBalance();
        }
    });

    console.log('[Aurora Balance Checker] ✅ 插件加载完成');
});
