const SHELL_TIMEOUT_SECONDS = 10;

export const interactiveTerminalCase = {
  id: 'interactive-terminal',
  name: '交互终端能力',
  description: '验证运行中 stdin、长驻 sh/bash 和 createCustomTerminal 的输入输出边界。',
  async mount(ctx) {
    const terminalHost = ctx.createTerminalHost(
      '默认终端 stdin / shell 验证',
      '点击运行后请聚焦该终端并输入内容；命令会带超时保护。',
    );
    const terminal = await ctx.pod.createDefaultTerminal(terminalHost);

    ctx.root.innerHTML = `
      <p class="case-hint">
        该用例用于实测 BrowserPod 是否能支持运行中 stdin、长驻
        <code>sh</code>/<code>bash</code> 交互 shell，以及
        <code>createCustomTerminal</code> 是否能完整接管输入输出。
        结论以页面日志和终端输出为准，不预设支持。
      </p>
      <div class="case-actions">
        <button type="button" id="probe-api" class="persist-btn">1. 探测公开对象</button>
        <button type="button" id="run-stdin" class="persist-btn">2. 运行 stdin read 测试</button>
        <button type="button" id="run-sh" class="persist-btn">3. 启动 sh 交互窗口</button>
        <button type="button" id="run-bash" class="persist-btn">4. 启动 bash 交互窗口</button>
        <button type="button" id="run-custom" class="persist-btn">5. 验证 custom terminal</button>
      </div>
      <pre id="interactive-terminal-result" class="persist-detail"></pre>
    `;

    const resultEl = ctx.root.querySelector('#interactive-terminal-result');
    const buttons = [...ctx.root.querySelectorAll('button')];

    const append = (message) => {
      resultEl.textContent = `${resultEl.textContent}${resultEl.textContent ? '\n' : ''}${message}`;
    };

    const setRunning = (running) => {
      for (const button of buttons) button.disabled = running;
      ctx.setStatus(running ? 'pending' : 'ready', running ? '运行中' : '已就绪');
    };

    append('准备完成。请按步骤运行；涉及 stdin 的步骤需要在终端内输入。');

    ctx.root.querySelector('#probe-api').addEventListener('click', () => {
      append(formatSection('公开对象探测', [
        `pod own keys: ${describeKeys(ctx.pod)}`,
        `pod proto keys: ${describeKeys(Object.getPrototypeOf(ctx.pod))}`,
        `terminal own keys: ${describeKeys(terminal)}`,
        `terminal proto keys: ${describeKeys(Object.getPrototypeOf(terminal))}`,
        `typeof pod.createCustomTerminal: ${typeof ctx.pod.createCustomTerminal}`,
        `terminal input writers: ${describeWriterCandidates(terminal)}`,
      ]));
    });

    ctx.root.querySelector('#run-stdin').addEventListener('click', async () => {
      setRunning(true);
      append(formatSection('stdin read 测试', [
        '命令：sh -c read -t 8 line; echo stdin-exit/stdin-value',
        '操作：请在 8 秒内聚焦下方默认终端，输入任意文本并回车。',
      ]));

      try {
        await runWithTiming(
          ctx,
          append,
          () => ctx.pod.run(
            'sh',
            [
              '-c',
              'printf "stdin-waiting> "; IFS= read -t 8 line; code=$?; printf "\\nstdin-exit:%s\\nstdin-value:%s\\n" "$code" "$line"',
            ],
            { echo: true, terminal, cwd: '/home/user' },
          ),
          'stdin-read',
        );
      } finally {
        setRunning(false);
      }
    });

    ctx.root.querySelector('#run-sh').addEventListener('click', async () => {
      await runInteractiveShell(ctx, append, terminal, 'sh');
    });

    ctx.root.querySelector('#run-bash').addEventListener('click', async () => {
      await runInteractiveShell(ctx, append, terminal, 'bash');
    });

    ctx.root.querySelector('#run-custom').addEventListener('click', async () => {
      setRunning(true);
      append(formatSection('custom terminal 验证', [
        '目标：确认 createCustomTerminal 是否存在、onOutput 是否收到输出、是否暴露输入 writer。',
      ]));

      try {
        if (typeof ctx.pod.createCustomTerminal !== 'function') {
          append('custom-terminal: unsupported - pod.createCustomTerminal is not a function');
          return;
        }

        const outputChunks = [];
        const customTerminal = await withTimeout(ctx.pod.createCustomTerminal({
          onOutput: (chunk) => {
            outputChunks.push(String(chunk));
            append(`custom onOutput: ${JSON.stringify(String(chunk))}`);
          },
        }), 5000, 'createCustomTerminal timeout after 5000ms');

        append(`custom terminal own keys: ${describeKeys(customTerminal)}`);
        append(`custom terminal proto keys: ${describeKeys(Object.getPrototypeOf(customTerminal))}`);
        append(`custom terminal input writers: ${describeWriterCandidates(customTerminal)}`);

        await runWithTiming(
          ctx,
          append,
          () => ctx.pod.run(
            'sh',
            ['-c', 'echo custom-terminal-output'],
            { echo: true, terminal: customTerminal, cwd: '/home/user' },
          ),
          'custom-output',
        );

        const writer = findInputWriter(customTerminal);
        if (!writer) {
          append('custom stdin: unsupported - no visible input writer candidate');
        } else {
          append(`custom stdin: visible writer candidate ${writer.label}; trying guarded write.`);
          const stdinRun = ctx.pod.run(
            'sh',
            ['-c', 'printf "custom-stdin> "; IFS= read -t 5 line; code=$?; printf "\\ncustom-stdin-exit:%s\\ncustom-stdin-value:%s\\n" "$code" "$line"'],
            { echo: true, terminal: customTerminal, cwd: '/home/user' },
          );
          await delay(500);
          await writeCandidate(writer, 'custom_ok\n');
          await withTimeout(stdinRun, 8000, 'custom-stdin timeout after 8000ms');
          append('custom stdin: guarded write completed');
        }
        append(`custom output chunk count: ${outputChunks.length}`);
      } catch (error) {
        append(formatError('custom-terminal', error));
        ctx.setStatus('error', error instanceof Error ? error.message : String(error));
      } finally {
        setRunning(false);
      }
    });
  },
};

async function runInteractiveShell(ctx, append, terminal, shellName) {
  const command = shellName === 'bash'
    ? `if command -v bash >/dev/null 2>&1; then echo "bash-wrapper-start"; timeout ${SHELL_TIMEOUT_SECONDS}s bash -i; echo "bash-wrapper-exit:$?"; else echo "bash-not-found"; fi`
    : `echo "sh-wrapper-start"; timeout ${SHELL_TIMEOUT_SECONDS}s sh -i; echo "sh-wrapper-exit:$?"`;

  setButtonsDisabled(ctx.root, true);
  ctx.setStatus('pending', `${shellName} 运行中`);
  append(formatSection(`${shellName} 交互窗口`, [
    `命令：sh -lc ${JSON.stringify(command)}`,
    `操作：请在 ${SHELL_TIMEOUT_SECONDS} 秒内聚焦默认终端，输入 echo ${shellName.toUpperCase()}_OK 并回车；最后可输入 exit。`,
    '判定：若终端回显命令并输出 *_OK，说明默认终端能把用户输入送入长驻 shell。',
  ]));

  try {
    await runWithTiming(
      ctx,
      append,
      () => ctx.pod.run('sh', ['-lc', command], { echo: true, terminal, cwd: '/home/user' }),
      `${shellName}-interactive`,
    );
  } finally {
    setButtonsDisabled(ctx.root, false);
    ctx.setStatus('ready', '已就绪');
  }
}

async function runWithTiming(ctx, append, run, label) {
  const startedAt = performance.now();
  try {
    const runReturn = run();
    append(`${label} run return: ${describeValue(runReturn)}`);
    append(`${label} run return keys: ${describeKeys(runReturn)}`);
    append(`${label} run return input writers: ${describeWriterCandidates(runReturn)}`);
    await withTimeout(runReturn, 15000, `${label} timeout after 15000ms`);
    append(`${label} completed in ${Math.round(performance.now() - startedAt)}ms`);
  } catch (error) {
    append(formatError(label, error));
    ctx.setStatus('error', error instanceof Error ? error.message : String(error));
  }
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function formatSection(title, lines) {
  return [`\n=== ${title} ===`, ...lines].join('\n');
}

function formatError(label, error) {
  const text = error instanceof Error ? error.stack || error.message : String(error);
  return `${label} error: ${text}`;
}

function describeValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return `${Object.prototype.toString.call(value)} typeof=${typeof value}`;
}

function describeKeys(value) {
  if (!value) return '<none>';
  const keys = new Set();
  for (const key of Object.getOwnPropertyNames(value)) keys.add(key);
  for (const key of Object.keys(value)) keys.add(key);
  return keys.size ? [...keys].sort().join(', ') : '<empty>';
}

function describeWriterCandidates(value) {
  const writer = findInputWriter(value);
  return writer ? writer.label : '<none>';
}

function findInputWriter(value) {
  if (!value) return null;
  const candidates = [
    ['write', value, value.write, 'direct'],
    ['writeInput', value, value.writeInput, 'direct'],
    ['writeStdin', value, value.writeStdin, 'direct'],
    ['input.write', value.input, value.input?.write, 'direct'],
    ['stdin.write', value.stdin, value.stdin?.write, 'direct'],
    ['input.getWriter', value.input, value.input?.getWriter, 'stream'],
    ['stdin.getWriter', value.stdin, value.stdin?.getWriter, 'stream'],
  ];

  for (const [label, owner, candidate, kind] of candidates) {
    if (typeof candidate === 'function') return { label, owner, candidate, kind };
  }
  return null;
}

async function writeCandidate(writer, input) {
  if (writer.kind === 'stream') {
    const streamWriter = writer.candidate.call(writer.owner);
    await streamWriter.write(input);
    await streamWriter.releaseLock?.();
    return;
  }
  await writer.candidate.call(writer.owner, input);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setButtonsDisabled(root, disabled) {
  for (const button of root.querySelectorAll('button')) {
    button.disabled = disabled;
  }
}
