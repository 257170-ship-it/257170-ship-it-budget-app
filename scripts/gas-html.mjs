import { Script } from "node:vm";

function checksum(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16);
}

export function createBundleMarkup(source) {
  // Fail packaging before delivery if the actual bundle has invalid syntax.
  new Script(source, { filename: "budget-app.bundle.js" });
  const bytes = Buffer.from(source, "utf8");
  const payload = bytes.toString("base64").match(/.{1,120}/g).join("\n");
  // Only an ASCII payload and a small loader pass through the HTML service.
  // Length/checksum detect incomplete copying before executing any app code.
  return `<div id="app-payload" hidden>${payload}</div>
<script>
(function () {
  var status = document.getElementById('startup-status');
  try {
    var payload = document.getElementById('app-payload');
    var encoded = payload.textContent.replace(/\\s/g, '');
    var binary = atob(encoded);
    if (binary.length !== ${bytes.length}) throw new Error('Index.html內容不完整，請重新複製完整原始碼');
    var bytes = new Uint8Array(binary.length), hash = 2166136261;
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
      hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
    }
    if (hash.toString(16) !== '${checksum(bytes)}') throw new Error('Index.html內容校驗不符，請重新複製完整原始碼');
    var source = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    var script = document.createElement('script');
    script.textContent = source;
    document.body.appendChild(script);
    payload.remove();
  } catch (error) {
    status.hidden = false;
    status.textContent = '安全帳本載入失敗：' + (error.message || error) + '（GAS-B64-1）';
  }
})();
</script>`;
}
