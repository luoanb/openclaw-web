import { BrowserPod } from '@leaningtech/browserpod'
import { copyFile } from './utils'
import { mountPersistVerifyUi, PERSIST_STORAGE_KEY } from './persistVerify.js'

// Initialize the Pod
// VITE_BP_APIKEY is an environmental variable containing your Api Key
// Its value is defined in the file `.env` in the project's main directory
// To get an Api Key, visit https://console.browserpod.io
const pod = await BrowserPod.boot({
  apiKey: import.meta.env.VITE_BP_APIKEY,
  storageKey: PERSIST_STORAGE_KEY,
});

// Create a Terminal
const terminal = await pod.createDefaultTerminal(document.querySelector("#console"));

mountPersistVerifyUi(document.querySelector('#persist-verify'), pod, terminal);

// Hook the portal to preview the web page in an iframe
const portalIframe = document.getElementById("portal");
const urlDiv = document.getElementById("url");
pod.onPortal(({ url, port }) => {
  urlDiv.innerHTML = `Portal available at <a href="${url}">${url}</a> for local server listening on port ${port}`;
  portalIframe.src = url;
});

// Express 示例在后台启动，避免阻塞上方的「持久化验证」面板
void (async () => {
  const homePath = "/home/user";
  const projectPath = `${homePath}/project`;
  await pod.createDirectory(projectPath);
  await copyFile(pod, "project/main.js", homePath);
  await copyFile(pod, "project/package.json", homePath);
  await pod.run("npm", ["install"], { echo: true, terminal, cwd: projectPath });
  await pod.run("node", ["main.js"], { echo: true, terminal, cwd: projectPath });
})();
