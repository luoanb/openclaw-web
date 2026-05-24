export function mountCaseRunner(root, cases, context) {
  root.innerHTML = `
    <div class="case-runner">
      <aside class="case-sidebar" aria-label="BrowserPod 验证用例">
        <h2 class="case-sidebar-title">验证用例</h2>
        <div class="case-list"></div>
      </aside>
      <section class="case-stage" aria-live="polite"></section>
    </div>
  `;

  const listEl = root.querySelector('.case-list');
  const stageEl = root.querySelector('.case-stage');
  const mountedCases = new Set();
  const buttons = new Map();
  const panels = new Map();

  for (const testCase of cases) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'case-list-btn';
    button.dataset.caseId = testCase.id;
    button.innerHTML = `
      <span class="case-list-name">${testCase.name}</span>
      <span class="case-list-desc">${testCase.description}</span>
    `;
    listEl.append(button);
    buttons.set(testCase.id, button);

    const panel = document.createElement('article');
    panel.className = 'case-panel is-hidden';
    panel.dataset.caseId = testCase.id;
    panel.innerHTML = `
      <header class="case-header">
        <div>
          <h2 class="case-title">${testCase.name}</h2>
          <p class="case-desc">${testCase.description}</p>
        </div>
        <div class="case-status case-status--idle">未运行</div>
      </header>
      <div class="case-body"></div>
      <div class="case-terminals"></div>
    `;
    stageEl.append(panel);
    panels.set(testCase.id, panel);

    button.addEventListener('click', () => {
      void activateCase(testCase);
    });
  }

  async function activateCase(testCase) {
    for (const [caseId, button] of buttons) {
      button.classList.toggle('is-active', caseId === testCase.id);
    }
    for (const [caseId, panel] of panels) {
      panel.classList.toggle('is-hidden', caseId !== testCase.id);
    }

    if (mountedCases.has(testCase.id)) return;
    mountedCases.add(testCase.id);

    const panel = panels.get(testCase.id);
    const statusEl = panel.querySelector('.case-status');
    const bodyEl = panel.querySelector('.case-body');
    const terminalsEl = panel.querySelector('.case-terminals');

    const setStatus = (kind, text) => {
      statusEl.className = `case-status case-status--${kind}`;
      statusEl.textContent = text;
    };

    const createTerminalHost = (title, description = '') => {
      const shell = document.createElement('section');
      shell.className = 'terminal-card';
      shell.innerHTML = `
        <header class="terminal-card-header">
          <h3>${title}</h3>
          ${description ? `<p>${description}</p>` : ''}
        </header>
        <pre class="terminal-host"></pre>
      `;
      terminalsEl.append(shell);
      return shell.querySelector('.terminal-host');
    };

    setStatus('pending', '初始化中');
    try {
      await testCase.mount({
        ...context,
        root: bodyEl,
        setStatus,
        createTerminalHost,
      });
      setStatus('ready', '已就绪');
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : String(error));
    }
  }

  if (cases[0]) {
    void activateCase(cases[0]);
  }
}
