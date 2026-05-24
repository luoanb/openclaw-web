import { copyFile } from '../utils.js';

export const expressPortalCase = {
  id: 'express-portal',
  name: 'Express Portal',
  description: '保留官方 Express 示例，验证 npm install、服务运行和 Portal iframe。',
  async mount(ctx) {
    const terminalHost = ctx.createTerminalHost('Express 示例终端');
    const terminal = await ctx.pod.createDefaultTerminal(terminalHost);

    ctx.root.innerHTML = `
      <p class="case-hint">
        该用例会复制 <code>public/project</code> 到 Pod 内，执行
        <code>npm install</code>，再运行 <code>node main.js</code>。
        Portal URL 会展示在页面上方，并加载到 iframe。
      </p>
      <div class="case-actions">
        <button type="button" id="run-express-portal" class="persist-btn">启动 Express Portal</button>
      </div>
      <pre id="express-portal-result" class="persist-detail"></pre>
    `;

    const runBtn = ctx.root.querySelector('#run-express-portal');
    const resultEl = ctx.root.querySelector('#express-portal-result');

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      ctx.setStatus('pending', '运行中');
      resultEl.textContent = '正在准备 Express 示例项目...';

      try {
        const homePath = '/home/user';
        const projectPath = `${homePath}/project`;
        await ensureDirectory(ctx.pod, projectPath);
        await copyFile(ctx.pod, 'project/main.js', homePath);
        await copyFile(ctx.pod, 'project/package.json', homePath);
        await ctx.pod.run('npm', ['install'], { echo: true, terminal, cwd: projectPath });
        resultEl.textContent = 'npm install 完成，正在启动 node main.js。';
        await ctx.pod.run('node', ['main.js'], { echo: true, terminal, cwd: projectPath });
      } catch (error) {
        ctx.setStatus('error', error instanceof Error ? error.message : String(error));
        resultEl.textContent = error instanceof Error ? error.stack || error.message : String(error);
      }
    });
  },
};

async function ensureDirectory(pod, path) {
  try {
    await pod.createDirectory(path);
  } catch {
    // The demo uses a persistent storageKey; an existing project directory is fine.
  }
}
