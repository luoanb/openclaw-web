/** 固定 storageKey，刷新后复用同一块 IndexedDB 虚拟盘 */
export const PERSIST_STORAGE_KEY = 'browserpod-demo-persist-lab';

export const PERSIST_MARKER_PATH = '/home/user/.bp-persist-verify.txt';

/**
 * @param {import('@leaningtech/browserpod').BrowserPod} pod
 */
export async function readMarkerViaApi(pod) {
  try {
    const f = await pod.openFile(PERSIST_MARKER_PATH, 'utf-8');
    const size = await f.getSize();
    if (size === 0) {
      await f.close();
      return null;
    }
    const text = await f.read(size);
    await f.close();
    return text;
  } catch {
    return null;
  }
}

/**
 * 通过 Pod 内 sh 写入标记文件（模拟「只在终端里产生文件」）
 * @param {import('@leaningtech/browserpod').BrowserPod} pod
 * @param {import('@leaningtech/browserpod').Terminal} terminal
 */
export async function writeMarkerViaTerminal(pod, terminal) {
  const stamp = new Date().toISOString();
  const script = [
    `echo "terminal-write ${stamp}" > ${PERSIST_MARKER_PATH}`,
    `cat ${PERSIST_MARKER_PATH}`,
  ].join(' && ');
  await pod.run('sh', ['-c', script], {
    echo: true,
    terminal,
    cwd: '/home/user',
  });
}

/**
 * @param {HTMLElement} root
 * @param {import('@leaningtech/browserpod').BrowserPod} pod
 * @param {import('@leaningtech/browserpod').Terminal} terminal
 */
export function mountPersistVerifyUi(root, pod, terminal) {
  root.innerHTML = `
    <h2 class="persist-title">IndexedDB 持久化验证（终端写入）</h2>
    <p class="persist-hint">
      使用固定 <code>storageKey</code>：<code>${PERSIST_STORAGE_KEY}</code>。
      点击下方按钮后<strong>刷新页面</strong>；若终端写入的文件被持久化，刷新后应显示「已读到历史文件」。
    </p>
    <div id="persist-status" class="persist-status persist-status--pending">正在检查历史文件…</div>
    <div class="persist-actions">
      <button type="button" id="persist-write-terminal" class="persist-btn">1. 终端写入测试文件</button>
      <button type="button" id="persist-read-api" class="persist-btn persist-btn--secondary">用 API 读取（对照）</button>
    </div>
    <pre id="persist-detail" class="persist-detail"></pre>
  `;

  const statusEl = root.querySelector('#persist-status');
  const detailEl = root.querySelector('#persist-detail');

  const setStatus = (kind, title, body = '') => {
    statusEl.className = `persist-status persist-status--${kind}`;
    statusEl.innerHTML = `<strong>${title}</strong>${body ? `<br/><span class="persist-status-body">${body}</span>` : ''}`;
  };

  const setDetail = (text) => {
    detailEl.textContent = text;
  };

  async function refreshCheck() {
    const content = await readMarkerViaApi(pod);
    if (content === null) {
      setStatus(
        'empty',
        '未读到历史文件',
        `路径 ${PERSIST_MARKER_PATH} 不存在或为空。请先点「终端写入」，再刷新本页验证。`,
      );
      setDetail('');
      return;
    }
    setStatus(
      'ok',
      '已读到历史文件（说明 IndexedDB 持久化生效）',
      content.trim(),
    );
    setDetail(`API readFile 内容：\n${content}`);
  }

  root.querySelector('#persist-write-terminal').addEventListener('click', async () => {
    const btn = root.querySelector('#persist-write-terminal');
    btn.disabled = true;
    setStatus('pending', '正在通过终端 sh 写入…', '请看右侧终端输出。');
    try {
      await writeMarkerViaTerminal(pod, terminal);
      const content = await readMarkerViaApi(pod);
      setStatus(
        'written',
        '终端写入完成',
        content
          ? `${content.trim()} — 请现在<strong>刷新页面</strong>，看是否仍能读到。`
          : '写入命令已执行，但 API 暂未读到内容；请查看终端是否报错。',
      );
      if (content) setDetail(`刚写入后 API 读到：\n${content}`);
    } catch (e) {
      setStatus('error', '终端写入失败', e instanceof Error ? e.message : String(e));
    } finally {
      btn.disabled = false;
    }
  });

  root.querySelector('#persist-read-api').addEventListener('click', () => {
    void refreshCheck();
  });

  void refreshCheck();
}
