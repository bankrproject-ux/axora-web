export type GpuMiningResult = {
  nonce: number;
  hash: `0x${string}`;
  blockId: `0x${string}`;
};

export type GpuProgress = {
  hashes: number;
  hashesPerSecond: number;
};

const WORKGROUP_SIZE = 64;
const BATCH_SIZE = 65_536;

const shaderCode = /* wgsl */ `
const K = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
  0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
  0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
  0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
  0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
  0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
  0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
  0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
  0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
);

struct Params {
  baseNonce: u32,
};

@group(0) @binding(0) var<storage, read> challenge: array<u32, 8>;
@group(0) @binding(1) var<storage, read_write> output: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: Params;

fn rotr(x: u32, n: u32) -> u32 {
  return (x >> n) | (x << (32u - n));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let nonce = params.baseNonce + gid.x;

  var w: array<u32, 64>;
  for (var i = 0u; i < 8u; i += 1u) {
    w[i] = challenge[i];
  }

  w[8] = nonce;
  w[9] = 0x80000000u;
  for (var i = 10u; i < 15u; i += 1u) {
    w[i] = 0u;
  }
  w[15] = 288u;

  for (var i = 16u; i < 64u; i += 1u) {
    let s0 = rotr(w[i - 15u], 7u) ^ rotr(w[i - 15u], 18u) ^ (w[i - 15u] >> 3u);
    let s1 = rotr(w[i - 2u], 17u) ^ rotr(w[i - 2u], 19u) ^ (w[i - 2u] >> 10u);
    w[i] = w[i - 16u] + s0 + w[i - 7u] + s1;
  }

  var a = 0x6a09e667u;
  var b = 0xbb67ae85u;
  var c = 0x3c6ef372u;
  var d = 0xa54ff53au;
  var e = 0x510e527fu;
  var f = 0x9b05688cu;
  var g = 0x1f83d9abu;
  var h = 0x5be0cd19u;

  for (var i = 0u; i < 64u; i += 1u) {
    let s1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
    let choice = (e & f) ^ ((~e) & g);
    let temp1 = h + s1 + choice + K[i] + w[i];
    let s0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
    let majority = (a & b) ^ (a & c) ^ (b & c);
    let temp2 = s0 + majority;

    h = g;
    g = f;
    f = e;
    e = d + temp1;
    d = c;
    c = b;
    b = a;
    a = temp1 + temp2;
  }

  let h0 = a + 0x6a09e667u;
  let h1 = b + 0xbb67ae85u;
  let h2 = c + 0x3c6ef372u;
  let h3 = d + 0xa54ff53au;
  let h4 = e + 0x510e527fu;
  let h5 = f + 0x9b05688cu;
  let h6 = g + 0x1f83d9abu;
  let h7 = h + 0x5be0cd19u;

  if (h0 < 0x01000000u) {
    let claim = atomicCompareExchangeWeak(&output[0], 0u, 1u);
    if (claim.exchanged) {
      atomicStore(&output[1], nonce);
      atomicStore(&output[2], h0);
      atomicStore(&output[3], h1);
      atomicStore(&output[4], h2);
      atomicStore(&output[5], h3);
      atomicStore(&output[6], h4);
      atomicStore(&output[7], h5);
      atomicStore(&output[8], h6);
      atomicStore(&output[9], h7);
    }
  }
}
`;

function wordsToHash(words: Uint32Array): `0x${string}` {
  const hex = Array.from(words)
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
  return `0x${hex}`;
}

export async function mineWithGpu(
  onProgress: (progress: GpuProgress) => void,
  signal: AbortSignal,
): Promise<GpuMiningResult> {
  const gpuApi = (navigator as Navigator & { gpu?: any }).gpu;

  if (!gpuApi) {
    throw new Error("This browser or device does not support WebGPU.");
  }

  const adapter = await gpuApi.requestAdapter();
  if (!adapter) {
    throw new Error("No compatible GPU adapter was found.");
  }

  const device = await adapter.requestDevice();

  const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
  const challengeWords = new Uint32Array(8);
  const view = new DataView(challengeWords.buffer);

  for (let index = 0; index < 8; index += 1) {
    const offset = index * 4;
    challengeWords[index] =
      (challengeBytes[offset]! << 24) |
      (challengeBytes[offset + 1]! << 16) |
      (challengeBytes[offset + 2]! << 8) |
      challengeBytes[offset + 3]!;
    view.setUint32(offset, challengeWords[index]!, true);
  }

  const challengeBuffer = device.createBuffer({
    size: 32,
    usage: 0x0080 | 0x0008,
  });
  device.queue.writeBuffer(challengeBuffer, 0, challengeWords);

  const outputBuffer = device.createBuffer({
    size: 40,
    usage: 0x0080 | 0x0004 | 0x0008,
  });
  const readBuffer = device.createBuffer({
    size: 40,
    usage: 0x0001 | 0x0008,
  });
  const paramsBuffer = device.createBuffer({
    size: 4,
    usage: 0x0040 | 0x0008,
  });

  const module = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: challengeBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  let baseNonce = 0;
  let totalHashes = 0;
  let lastReport = performance.now();
  let lastHashes = 0;

  try {
    while (!signal.aborted) {
      device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([baseNonce]));
      device.queue.writeBuffer(outputBuffer, 0, new Uint32Array(10));

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(BATCH_SIZE / WORKGROUP_SIZE);
      pass.end();

      encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, 40);
      device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(1);

      const values = new Uint32Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap();

      totalHashes += BATCH_SIZE;

      if (values[0] === 1) {
        const nonce = values[1]!;
        const hash = wordsToHash(values.slice(2, 10));
        return { nonce, hash, blockId: hash };
      }

      const now = performance.now();
      if (now - lastReport >= 250) {
        const intervalHashes = totalHashes - lastHashes;
        const seconds = (now - lastReport) / 1000;
        onProgress({
          hashes: totalHashes,
          hashesPerSecond: Math.round(intervalHashes / seconds),
        });
        lastReport = now;
        lastHashes = totalHashes;
      }

      baseNonce = (baseNonce + BATCH_SIZE) >>> 0;
    }

    throw new DOMException("GPU mining stopped.", "AbortError");
  } finally {
    challengeBuffer.destroy();
    outputBuffer.destroy();
    readBuffer.destroy();
    paramsBuffer.destroy();
    device.destroy();
  }
}
