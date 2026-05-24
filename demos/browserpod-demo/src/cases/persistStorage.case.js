import {
  PERSIST_MARKER_PATH,
  PERSIST_STORAGE_KEY,
  readMarkerViaApi,
  writeMarkerViaTerminal,
} from '../persistVerify.js';

export const persistStorageCase = {
  id: 'persist-storage',
  name: 'IndexedDB 持久化',
  description: '验证固定 storageKey 下，终端写入文件能否在刷新后复用。',
  async mount(ctx) {
    const terminalHost = ctx.createTerminalHost(
      '持久化验证终端',
      '该 DOM 会保持挂载，供 BrowserPod terminal 持续输出。',
    );
    const terminal = await ctx.pod.createDefaultTerminal(terminalHost);

    ctx.root.innerHTML = `
      <p class="case-hint">
        使用固定 <code>storageKey</code>：<code>${PERSIST_STORAGE_KEY}</code>。
        点击写入后刷新页面；若终端写入的文件被持久化，刷新后应显示历史文件。
      </p>
      <div id="persist-status" class="persist-status persist-status--pending">正在检查历史文件...</div>
      <div class="persist-actions">
        <button type="button" id="persist-write-terminal" class="persist-btn">1. 终端写入测试文件</button>
        <button type="button" id="persist-read-api" class="persist-btn persist-btn--secondary">用 API 读取（对照）</button>
      </div>
      <pre id="persist-detail" class="persist-detail"></pre>
    `;

    const statusEl = ctx.root.querySelector('#persist-status');
    const detailEl = ctx.root.querySelector('#persist-detail');

    const setStatus = (kind, title, body = '') => {
      statusEl.className = `persist-status persist-status--${kind}`;
      statusEl.innerHTML = `<strong>${title}</strong>${body ? `<br/><span class="persist-status-body">${body}</span>` : ''}`;
    };

    const setDetail = (text) => {
      detailEl.textContent = text;
    };

    async function refreshCheck() {
      const content = await readMarkerViaApi(ctx.pod);
      if (content === null) {
        setStatus(
          'empty',
          '未读到历史文件',
          `路径 ${PERSIST_MARKER_PATH} 不存在或为空。请先点「终端写入」，再刷新本页验证。`,
        );
        setDetail('');
        return;
      }
      setStatus('ok', '已读到历史文件（说明 IndexedDB 持久化生效）', content.trim());
      setDetail(`API readFile 内容：\n${content}`);
    }

    ctx.root.querySelector('#persist-write-terminal').addEventListener('click', async () => {
      const btn = ctx.root.querySelector('#persist-write-terminal');
      btn.disabled = true;
      setStatus('pending', '正在通过终端 sh 写入...', '请看下方终端输出。');
      try {
        await writeMarkerViaTerminal(ctx.pod, terminal);
        const content = await readMarkerViaApi(ctx.pod);
        setStatus(
          'written',
          '终端写入完成',
          content
            ? `${content.trim()} - 请现在刷新页面，看是否仍能读到。`
            : '写入命令已执行，但 API 暂未读到内容；请查看终端是否报错。',
        );
        if (content) setDetail(`刚写入后 API 读到：\n${content}`);
      } catch (error) {
        setStatus('error', '终端写入失败', error instanceof Error ? error.message : String(error));
      } finally {
        btn.disabled = false;
      }
    });

    ctx.root.querySelector('#persist-read-api').addEventListener('click', () => {
      void refreshCheck();
    });

    await refreshCheck();
  },
};
