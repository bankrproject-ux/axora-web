type WebGpuApi = {
  requestAdapter: () => Promise<unknown | null>;
};

type NavigatorWithWebGpu = Navigator & {
  gpu?: WebGpuApi;
};

export type GpuSupport =
  | { supported: true; reason: null }
  | { supported: false; reason: string };

export async function checkGpuSupport(): Promise<GpuSupport> {
  const gpuApi = (navigator as NavigatorWithWebGpu).gpu;

  if (!gpuApi) {
    return {
      supported: false,
      reason: "This browser or device does not support WebGPU.",
    };
  }

  try {
    const adapter = await gpuApi.requestAdapter();

    if (!adapter) {
      return {
        supported: false,
        reason: "No compatible GPU adapter was found.",
      };
    }

    return { supported: true, reason: null };
  } catch {
    return {
      supported: false,
      reason: "WebGPU could not initialize on this device.",
    };
  }
}
