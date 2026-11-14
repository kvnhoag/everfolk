import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { parseArgs, probe } from "../load-probe.mjs";

test("probe bounds duration, rate and unsafe credential URLs", () => {
  assert.throws(() => parseArgs(["--url", "https://user:secret@example.test/image.png"]));
  assert.throws(() => parseArgs(["--url", "https://example.test/a", "--seconds", "61"]));
  assert.throws(() => parseArgs(["--url", "https://example.test/a", "--rps", "1000"]));
  assert.throws(() => parseArgs(["--url", "file:///etc/passwd"]));
});

test("probe uses exact cache key, reads bodies and reports failures", async () => {
  const paths = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    response.setHeader("CF-Cache-Status", "HIT");
    response.writeHead(paths.length === 1 ? 200 : 404);
    response.end("12345");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const result = await probe({ url: `http://127.0.0.1:${server.address().port}/image.png?v=1`, seconds: 1, rps: 2, concurrency: 2, timeoutMs: 500 });
    assert.equal(result.completed, 2);
    assert.equal(result.failures, 1);
    assert.equal(result.receivedBytes, 10);
    assert.equal(result.cacheStatuses.HIT, 2);
    assert.deepEqual(paths, ["/image.png?v=1", "/image.png?v=1"]);
    assert.ok(result.successfulResponseP95Ms >= 0);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
