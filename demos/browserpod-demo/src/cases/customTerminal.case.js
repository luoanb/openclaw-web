export const customTerminalCase = {
  id: "custom-terminal",
  name: "自定义终端",
  description:
    "验证 createCustomTerminal 的 onOutput 输出流、handle 形态与 stdin write 边界。",
  async mount(ctx) {
    ctx.root.innerHTML = `
      <p class="case-hint">
        该用例专注 <code>pod.createCustomTerminal</code>：通过 <code>onOutput</code> 接管终端字节流，
        并在下方「输出镜像」区域实时展示；同时探测 custom terminal handle 是否暴露可写 stdin。
        结论以页面日志与 Console 中 <code>[custom-terminal]</code> 记录为准。
        步骤 3 为<strong>边界复现</strong>（非反复试错）：验证 <code>write</code> 能否写入
        <code>pod.run</code> 前台进程的 stdin；项目已定结论为<strong>不可用</strong>，见
        <code>interactive-terminal</code> 与 specs。
      </p>
      <div class="case-actions">
        <button type="button" id="probe-custom-api" class="persist-btn">1. 探测 API 与 handle</button>
        <button type="button" id="run-output-stream" class="persist-btn">2. 捕获 stdout/stderr 流</button>
        <button type="button" id="run-stdin-probe" class="persist-btn">3. 探测 stdin write</button>
        <button type="button" id="clear-stream" class="persist-btn">清空输出镜像</button>
      </div>
      <section class="custom-terminal-mirror" aria-label="自定义终端输出镜像">
        <header class="custom-terminal-mirror-header">
          <h3>输出镜像（onOutput）</h3>
          <p>下方为 <code>onOutput</code> 收到的原始 chunk 解码结果，按到达顺序拼接展示。</p>
        </header>
        <pre id="custom-terminal-stream" class="custom-terminal-stream persist-detail"></pre>
      </section>
      <pre id="custom-terminal-result" class="persist-detail"></pre>
    `;

    const streamEl = ctx.root.querySelector("#custom-terminal-stream");
    const resultEl = ctx.root.querySelector("#custom-terminal-result");
    const buttons = [...ctx.root.querySelectorAll("button")];
    const outputChunks = [];

    const append = (message) => {
      resultEl.textContent = `${resultEl.textContent}${resultEl.textContent ? "\n" : ""}${message}`;
    };

    const appendStream = (text) => {
      outputChunks.push(text);
      streamEl.textContent += text;
    };

    const setRunning = (running, label = "运行中") => {
      for (const button of buttons) button.disabled = running;
      ctx.setStatus(running ? "pending" : "ready", running ? label : "已就绪");
    };

    append("准备完成。建议按 1 → 2 → 3 顺序运行；详细对象结构见 Console。");

    ctx.root.querySelector("#clear-stream").addEventListener("click", () => {
      outputChunks.length = 0;
      streamEl.textContent = "";
      append("输出镜像已清空。");
    });

    ctx.root
      .querySelector("#probe-custom-api")
      .addEventListener("click", () => {
        append(
          formatSection("createCustomTerminal API 探测", [
            `typeof pod.createCustomTerminal: ${typeof ctx.pod.createCustomTerminal}`,
            `pod own keys: ${describeKeys(ctx.pod)}`,
            `pod proto keys: ${describeKeys(Object.getPrototypeOf(ctx.pod))}`,
          ])
        );
        console.log("[custom-terminal] API probe", {
          hasCreateCustomTerminal:
            typeof ctx.pod.createCustomTerminal === "function",
          podKeys: describeKeys(ctx.pod),
        });
      });

    ctx.root
      .querySelector("#run-output-stream")
      .addEventListener("click", async () => {
        setRunning(true, "捕获中");
        append(
          formatSection("输出流捕获", [
            "命令：sh -c + printf，分别写 stdout 与 stderr（避开 BrowserPod [node:https:] 对 node -e 的限制）",
            "echo: true（观察 stream 是否混入 echo / 控制序列）",
          ])
        );

        try {
          const customTerminal = await createCustomTerminalOrThrow(
            ctx.pod,
            appendStream,
            append
          );
          append(`custom handle keys: ${describeKeys(customTerminal)}`);
          append(
            `custom input writers: ${describeWriterCandidates(customTerminal)}`
          );

          await withTimeout(
            ctx.pod.run(
              "sh",
              [
                "-c",
                'printf "custom-stdout\\n"; printf "custom-stderr\\n" 1>&2',
              ],
              { echo: true, terminal: customTerminal, cwd: "/home/user" }
            ),
            15000,
            "output stream run timeout after 15000ms"
          );

          const combined = outputChunks.join("");
          append(`chunk count: ${outputChunks.length}`);
          append(`stdout seen: ${combined.includes("custom-stdout")}`);
          append(`stderr seen: ${combined.includes("custom-stderr")}`);
          append(`combined stream length: ${combined.length}`);
          append(`combined preview: ${JSON.stringify(combined.slice(0, 500))}`);
          console.log("[custom-terminal] output stream result", {
            chunkCount: outputChunks.length,
            chunks: [...outputChunks],
            combined,
          });
        } catch (error) {
          append(formatError("output-stream", error));
          console.error("[custom-terminal] output stream error", error);
          ctx.setStatus(
            "error",
            error instanceof Error ? error.message : String(error)
          );
        } finally {
          setRunning(false);
        }
      });

    ctx.root
      .querySelector("#run-stdin-probe")
      .addEventListener("click", async () => {
        setRunning(true, "stdin 探测中");
        append(
          formatSection("stdin write 边界复现", [
            "原理：pod.run(..., { terminal: customTerminal }) 启动的前台 sh 在 read 阻塞；",
            "      handle.write 若接入进程 stdin，onOutput 应出现 __BP_VAL__:custom_ok。",
            "命令：sh -lc read -t 5；echo: false。",
            "已定结论（interactive-terminal / specs）：custom terminal 仅宜 onOutput 接管输出，勿依赖 write 喂 stdin。",
          ])
        );

        try {
          const customTerminal = await createCustomTerminalOrThrow(
            ctx.pod,
            appendStream,
            append,
            {
              logOutput: false,
            }
          );
          const writer = findInputWriter(customTerminal);

          if (!writer) {
            append("stdin: unsupported - handle 无 write 等候选");
            console.warn("[custom-terminal] stdin probe: no writer candidate");
            return;
          }

          const probeStartIndex = outputChunks.length;
          const getProbeText = () =>
            outputChunks.slice(probeStartIndex).join("");

          append(`stdin: writer=${writer.label}；等待 prompt 后 write 一次`);
          const stdinRun = ctx.pod.run(
            "sh",
            [
              "-lc",
              '{ printf "custom-stdin> "; IFS= read -r -t 5 line; printf "\\n__BP_EXIT__:%s\\n__BP_VAL__:%s\\n" "$?" "$line"; }',
            ],
            { echo: false, terminal: customTerminal, cwd: "/home/user" }
          );

          const gotPrompt = await waitForStreamPattern(
            () => getProbeText(),
            /custom-stdin> /,
            6000
          );
          append(`见到 prompt: ${gotPrompt.ok}`);
          await writeCandidate(writer, "custom_ok\n");

          await waitForStreamPattern(
            () => getProbeText(),
            /__BP_VAL__:custom_ok|__BP_EXIT__:\d+/,
            7000
          );
          void settlePodRun(stdinRun, 1000);

          const combined = getProbeText();
          const probe = parseStdinProbeResult(combined);
          append(
            `结论: programmatic stdin ${probe.stdinOk ? "可用（意外）" : "不可用"}`
          );
          append(`- onOutput 见 prompt: ${probe.sawPrompt}`);
          append(`- onOutput 见 __BP_EXIT__:<数字>: ${probe.scriptCompleted}`);
          append(`- onOutput 见 __BP_VAL__:custom_ok: ${probe.stdinOk}`);
          if (
            !probe.stdinOk &&
            probe.sawPrompt &&
            combined.includes("custom_ok")
          ) {
            append(
              "- 解释: 流里可见 custom_ok，但 read 未输出 __BP_VAL__:custom_ok → write 未进入进程 stdin（多为 PTY 回显）"
            );
          }
          if (!probe.stdinOk) {
            append(
              "- 与 interactive-terminal / specs 一致：输出用 onOutput，运行中 stdin 用默认终端"
            );
          }
          ctx.setStatus(
            "ready",
            probe.stdinOk ? "stdin 可用" : "stdin 不可用（预期）"
          );
          console.log("[custom-terminal] stdin probe result", {
            ...probe,
            combined,
            writer: writer.label,
          });
        } catch (error) {
          append(formatError("stdin-probe", error));
          console.error("[custom-terminal] stdin probe error", error);
          ctx.setStatus(
            "error",
            error instanceof Error ? error.message : String(error)
          );
        } finally {
          setRunning(false);
        }
      });
  },
};

async function createCustomTerminalOrThrow(
  pod,
  onStreamChunk,
  append,
  options = {}
) {
  console.log(
    "createCustomTerminalOrThrow",
    pod,
    onStreamChunk,
    append,
    options
  );

  if (typeof pod.createCustomTerminal !== "function") {
    throw new Error("pod.createCustomTerminal is not a function");
  }

  const { logOutput = true } = options;
  const terminalOptions = {
    cols: 80,
    rows: 24,
    onOutput: (chunk, vt) => {
      const text = decodeTerminalChunk(chunk);
      onStreamChunk(text);
      if (logOutput) {
        append(`onOutput: ${JSON.stringify(text)} (vt=${describeValue(vt)})`);
      }
      console.log("[custom-terminal] onOutput", { chunk, vt, text });
    },
  };

  console.log("[custom-terminal] createCustomTerminal input", terminalOptions);
  const customTerminal = await withTimeout(
    pod.createCustomTerminal(terminalOptions),
    5000,
    "createCustomTerminal timeout after 5000ms"
  );
  console.log("[custom-terminal] createCustomTerminal result", customTerminal);
  return customTerminal;
}

function decodeTerminalChunk(chunk) {
  if (typeof chunk === "string") return chunk;
  // browserpod may pass views on SharedArrayBuffer; TextDecoder rejects shared buffers.
  if (chunk instanceof ArrayBuffer)
    return new TextDecoder().decode(new Uint8Array(chunk.slice(0)));
  if (ArrayBuffer.isView(chunk))
    return new TextDecoder().decode(new Uint8Array(chunk));
  return String(chunk);
}

function parseStdinProbeResult(combined) {
  return {
    stdinOk: /__BP_VAL__:custom_ok/.test(combined),
    scriptCompleted: /__BP_EXIT__:\d+/.test(combined),
    sawPrompt: /custom-stdin> /.test(combined),
  };
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function waitForStreamPattern(getText, pattern, ms) {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const text = typeof getText === "function" ? getText() : getText;
      if (pattern.test(text)) {
        resolve({ ok: true, timedOut: false });
        return;
      }
      if (performance.now() - startedAt >= ms) {
        resolve({ ok: false, timedOut: true });
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

async function settlePodRun(runReturn, ms) {
  const target = runReturn?.cosProcess ?? runReturn;
  try {
    await withTimeout(Promise.resolve(target), ms, "pod.run settle timeout");
    return { ok: true, timedOut: false };
  } catch {
    return { ok: false, timedOut: true };
  }
}

function formatSection(title, lines) {
  return [`\n=== ${title} ===`, ...lines].join("\n");
}

function formatError(label, error) {
  const text =
    error instanceof Error ? error.stack || error.message : String(error);
  return `${label} error: ${text}`;
}

function describeValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return `${Object.prototype.toString.call(value)} typeof=${typeof value}`;
}

function describeKeys(value) {
  if (!value) return "<none>";
  const keys = new Set();
  for (const key of Object.getOwnPropertyNames(value)) keys.add(key);
  for (const key of Object.keys(value)) keys.add(key);
  return keys.size ? [...keys].sort().join(", ") : "<empty>";
}

function describeWriterCandidates(value) {
  const writer = findInputWriter(value);
  return writer ? writer.label : "<none>";
}

function findInputWriter(value) {
  if (!value) return null;
  const candidates = [
    ["write", value, value.write, "direct"],
    ["writeInput", value, value.writeInput, "direct"],
    ["writeStdin", value, value.writeStdin, "direct"],
    ["input.write", value.input, value.input?.write, "direct"],
    ["stdin.write", value.stdin, value.stdin?.write, "direct"],
    ["input.getWriter", value.input, value.input?.getWriter, "stream"],
    ["stdin.getWriter", value.stdin, value.stdin?.getWriter, "stream"],
  ];

  for (const [label, owner, candidate, kind] of candidates) {
    if (typeof candidate === "function")
      return { label, owner, candidate, kind };
  }
  return null;
}

async function writeCandidate(writer, input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  if (writer.kind === "stream") {
    const streamWriter = writer.candidate.call(writer.owner);
    try {
      await streamWriter.write(bytes);
    } catch {
      await streamWriter.write(input);
    }
    await streamWriter.releaseLock?.();
    return;
  }
  try {
    await writer.candidate.call(writer.owner, input);
  } catch {
    await writer.candidate.call(writer.owner, bytes);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
