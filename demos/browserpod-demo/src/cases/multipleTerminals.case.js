export const multipleTerminalsCase = {
  id: 'multiple-terminals',
  name: '多默认终端',
  description: '验证同一个 BrowserPod 实例能否同时创建两个默认终端。',
  async mount(ctx) {
    ctx.root.innerHTML = `
      <p class="case-hint">
        该用例会在同一个 <code>pod</code> 上连续调用两次
        <code>createDefaultTerminal</code>，再把两个 <code>pod.run</code>
        分别绑定到不同 terminal。两个终端都出现对应输出才算通过。
      </p>
      <div class="case-actions">
        <button type="button" id="run-multiple-terminals" class="persist-btn">运行多终端验证</button>
      </div>
      <pre id="multiple-terminals-result" class="persist-detail"></pre>
    `;

    const terminalAHost = ctx.createTerminalHost('Terminal A');
    const terminalBHost = ctx.createTerminalHost('Terminal B');
    const terminalA = await ctx.pod.createDefaultTerminal(terminalAHost);
    const terminalB = await ctx.pod.createDefaultTerminal(terminalBHost);
    const resultEl = ctx.root.querySelector('#multiple-terminals-result');
    const runBtn = ctx.root.querySelector('#run-multiple-terminals');

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      ctx.setStatus('pending', '运行中');
      resultEl.textContent = '正在分别向 Terminal A / Terminal B 运行 sh -c echo ...';

      try {
        await Promise.all([
          ctx.pod.run(
            'sh',
            ['-c', "echo 'multiple-terminals: output from terminal A'"],
            { echo: true, terminal: terminalA, cwd: '/home/user' },
          ),
          ctx.pod.run(
            'sh',
            ['-c', "echo 'multiple-terminals: output from terminal B'"],
            { echo: true, terminal: terminalB, cwd: '/home/user' },
          ),
        ]);
        ctx.setStatus('ready', '验证完成');
        resultEl.textContent = [
          'BrowserPod 已接受两个默认 terminal 对象。',
          '人工判定：Terminal A / Terminal B 区域应分别出现对应 output。',
        ].join('\n');
      } catch (error) {
        ctx.setStatus('error', error instanceof Error ? error.message : String(error));
        resultEl.textContent = error instanceof Error ? error.stack || error.message : String(error);
      } finally {
        runBtn.disabled = false;
      }
    });
  },
};
