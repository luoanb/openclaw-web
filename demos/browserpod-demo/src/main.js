import { BrowserPod } from "@leaningtech/browserpod";
import { browserPodCases } from "./caseRegistry.js";
import { PERSIST_STORAGE_KEY } from "./persistVerify.js";
import { mountCaseRunner } from "./ui/caseRunner.js";

// Initialize the Pod
// VITE_BP_APIKEY is an environmental variable containing your Api Key
// Its value is defined in the file `.env` in the project's main directory
// To get an Api Key, visit https://console.browserpod.io
const pod = await BrowserPod.boot({
  apiKey: import.meta.env.VITE_BP_APIKEY,
  storageKey: PERSIST_STORAGE_KEY,
});

const originalRun = pod.run.bind(pod);
pod.run = async (command, args, options) => {
  const runReturn = originalRun(command, args, options);
  console.log("[browserpod-demo] pod.run sync return", {
    command,
    args,
    options,
    runReturn,
    runReturnKeys:
      runReturn && typeof runReturn === "object"
        ? Object.getOwnPropertyNames(runReturn)
        : [],
  });
  console.log(await runReturn.cosProcess);

  void Promise.resolve(runReturn).then(
    (result) =>
      console.log("[browserpod-demo] pod.run awaited result", {
        command,
        args,
        result,
      }),
    (error) =>
      console.error("[browserpod-demo] pod.run rejected", {
        command,
        args,
        error,
      })
  );
  return runReturn;
};

// Hook the portal to preview the web page in an iframe
const portalIframe = document.getElementById("portal");
const urlDiv = document.getElementById("url");
pod.onPortal(({ url, port }) => {
  urlDiv.innerHTML = `Portal available at <a href="${url}">${url}</a> for local server listening on port ${port}`;
  portalIframe.src = url;
});

mountCaseRunner(document.querySelector("#case-runner"), browserPodCases, {
  pod,
  portalIframe,
  urlDiv,
});
