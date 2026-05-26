import { CustomTerminalCommandRunner } from "../../../../packages/browserpod/src/command/browserpodCommand.impl.ts";

const TIMEOUT_SENTINEL = "__WEB_CLAW_COMMAND_RUNNER_TIMEOUT_DONE__";

export const packageCommandRunnerCase = {
  id: "package-command-runner",
  name: "Package Command Runner",
  description:
    "用真实 BrowserPod 验证 packages/browserpod 的 CustomTerminalCommandRunner 轻量 ok/code/output 结果。",
  async mount(ctx) {
    ctx.root.innerHTML = `
      <p class="case-hint">
        该用例直接 import <code>packages/browserpod/src/command/browserpodCommand.impl.ts</code>
        中的 <code>CustomTerminalCommandRunner</code>，不是 mock 单测。它用于验证 package adapter
        对真实 <code>pod.createCustomTerminal</code> 与 <code>pod.run</code> 的行为假设。
      </p>
      <div class="case-actions">
        <button type="button" id="run-success-probe" class="persist-btn">1. 运行成功探测</button>
        <button type="button" id="run-timeout-probe" class="persist-btn">2. 运行 timeout 探测</button>
        <button type="button" id="clear-command-runner-probe" class="persist-btn">清空结果</button>
      </div>
      <pre id="package-command-runner-summary" class="persist-detail"></pre>
      <pre id="package-command-runner-result" class="persist-detail"></pre>
    `;

    const summaryEl = ctx.root.querySelector("#package-command-runner-summary");
    const resultEl = ctx.root.querySelector("#package-command-runner-result");
    const buttons = [...ctx.root.querySelectorAll("button")];
    const runner = new CustomTerminalCommandRunner();

    const append = (message) => {
      resultEl.textContent = `${resultEl.textContent}${resultEl.textContent ? "\n" : ""}${message}`;
    };
    const setSummary = (label, value) => {
      summaryEl.textContent = `${label}\n${JSON.stringify(value, null, 2)}`;
    };

    const setRunning = (running, label = "运行中") => {
      for (const button of buttons) button.disabled = running;
      ctx.setStatus(running ? "pending" : "ready", running ? label : "已就绪");
    };

    append("准备完成。建议先运行成功探测，再运行 timeout 探测。");

    ctx.root
      .querySelector("#clear-command-runner-probe")
      .addEventListener("click", () => {
        summaryEl.textContent = "";
        resultEl.textContent = "";
        append("结果已清空。");
      });

    ctx.root
      .querySelector("#run-success-probe")
      .addEventListener("click", async () => {
        setRunning(true, "成功探测中");
        append(
          formatSection("成功探测", [
            "目标：真实 CustomTerminalCommandRunner 应通过 onOutput 捕获 stdout/stderr，并返回 ok/code/output。",
            "命令：sh -lc；echo: false；cwd: /home/user。",
          ])
        );

        try {
          const script = [
            'printf "package-runner-stdout\\n"',
            'printf "package-runner-stderr\\n" 1>&2',
          ].join("; ");

          const result = await runner.run(ctx.pod, "sh", ["-lc", script], {
            cwd: "/home/user",
            timeoutMs: 12_000,
          });
          const checks = {
            ok: result.ok,
            code: result.code,
            stdoutSeen: result.output.includes("package-runner-stdout"),
            stderrSeen: result.output.includes("package-runner-stderr"),
            outputLength: result.output.length,
            outputPreview: result.output.slice(0, 800),
          };

          append(JSON.stringify(checks, null, 2));
          setSummary("Latest success probe", checks);
          console.log("[package-command-runner] success probe result", {
            result,
            checks,
          });
          console.log("[package-command-runner] success probe checks", JSON.stringify(checks));
          ctx.setStatus(
            checks.ok && checks.stdoutSeen && checks.stderrSeen
              ? "ready"
              : "error",
            "成功探测完成"
          );
        } catch (error) {
          append(formatError("success-probe", error));
          console.error("[package-command-runner] success probe error", error);
          ctx.setStatus("error", error instanceof Error ? error.message : String(error));
        } finally {
          setRunning(false);
        }
      });

    ctx.root
      .querySelector("#run-timeout-probe")
      .addEventListener("click", async () => {
        setRunning(true, "timeout 探测中");
        append(
          formatSection("timeout 探测", [
            "目标：进程未及时结束时，runner 返回 ok: false 且 code: timeout。",
            "命令先输出 PACKAGE_TIMEOUT_STARTED，再 sleep，timeoutMs: 1000。",
          ])
        );

        try {
          const script = [
            'printf "PACKAGE_TIMEOUT_STARTED\\n"',
            "sleep 5",
            `printf "${TIMEOUT_SENTINEL}\\n"`,
          ].join("; ");

          const result = await runner.run(ctx.pod, "sh", ["-lc", script], {
            cwd: "/home/user",
            timeoutMs: 1_000,
          });
          const checks = {
            ok: result.ok,
            code: result.code,
            startSeen: result.output.includes("PACKAGE_TIMEOUT_STARTED"),
            completionSeen: result.output.includes(TIMEOUT_SENTINEL),
            outputLength: result.output.length,
            outputPreview: result.output.slice(0, 800),
          };

          append(JSON.stringify(checks, null, 2));
          setSummary("Latest timeout probe", checks);
          console.log("[package-command-runner] timeout probe result", {
            result,
            checks,
          });
          console.log("[package-command-runner] timeout probe checks", JSON.stringify(checks));
          ctx.setStatus(!checks.ok && checks.code === "timeout" ? "ready" : "error", "timeout 探测完成");
        } catch (error) {
          append(formatError("timeout-probe", error));
          console.error("[package-command-runner] timeout probe error", error);
          ctx.setStatus("error", error instanceof Error ? error.message : String(error));
        } finally {
          setRunning(false);
        }
      });
  },
};

function formatSection(title, lines) {
  return [`\n=== ${title} ===`, ...lines].join("\n");
}

function formatError(label, error) {
  const text = error instanceof Error ? error.stack || error.message : String(error);
  return `${label} error: ${text}`;
}
