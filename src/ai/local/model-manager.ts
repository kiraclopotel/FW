// FeelingWise - Local model manager
// Downloads, caches, loads local model. WebGPU detection.

import {
  CreateExtensionServiceWorkerMLCEngine,
  CreateMLCEngine,
  prebuiltAppConfig,
  type MLCEngineInterface,
  type InitProgressCallback,
} from '@mlc-ai/web-llm';

// Model tiers by VRAM requirement
const MODEL_TIERS = [
  { modelId: 'Phi-3.5-mini-instruct-q4f16_1-MLC', minVRAM: 6 },
  { modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', minVRAM: 4 },
  { modelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC', minVRAM: 2 },
  // WASM CPU fallback — smallest model, no GPU required
  { modelId: 'SmolLM2-135M-Instruct-q0f16-MLC', minVRAM: 0 },
];

let engine: MLCEngineInterface | null = null;
let ready = false;
let initializing = false;

async function estimateVRAM(): Promise<number> {
  try {
    // WebGPU types may not be in @types/chrome — use dynamic access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu;
    if (!gpu) return 0;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return 0;
    // maxBufferSize gives a rough VRAM estimate in bytes
    const maxBuffer = adapter.limits.maxBufferSize;
    return maxBuffer / (1024 * 1024 * 1024); // convert to GB
  } catch {
    return 0;
  }
}

function selectModel(vramGB: number): string {
  for (const tier of MODEL_TIERS) {
    if (vramGB >= tier.minVRAM) {
      return tier.modelId;
    }
  }
  return MODEL_TIERS[MODEL_TIERS.length - 1].modelId;
}

const progressCallback: InitProgressCallback = (report) => {
  console.log(`[FeelingWise] Model loading: ${report.text}`);
};

export async function initialize(): Promise<void> {
  if (ready || initializing) return;
  initializing = true;

  try {
    const vram = await estimateVRAM();
    const modelId = selectModel(vram);
    console.log(`[FeelingWise] Selected model: ${modelId} (VRAM ~${vram.toFixed(1)}GB)`);

    // In extension service worker context, use the extension-specific engine
    const isServiceWorker = typeof (globalThis as Record<string, unknown>).ServiceWorkerGlobalScope !== 'undefined' &&
      self instanceof ((globalThis as Record<string, unknown>).ServiceWorkerGlobalScope as { new(): unknown; prototype: unknown });

    if (isServiceWorker) {
      engine = await CreateExtensionServiceWorkerMLCEngine(modelId, {
        appConfig: prebuiltAppConfig,
        initProgressCallback: progressCallback,
      });
    } else {
      engine = await CreateMLCEngine(modelId, {
        appConfig: prebuiltAppConfig,
        initProgressCallback: progressCallback,
      });
    }

    ready = true;
    console.log('[FeelingWise] Model loaded successfully');
  } catch (err) {
    console.error('[FeelingWise] Model initialization failed:', err);
    ready = false;
    engine = null;
  } finally {
    initializing = false;
  }
}

export function isReady(): boolean {
  return ready;
}

export function getEngine(): MLCEngineInterface | null {
  return engine;
}
