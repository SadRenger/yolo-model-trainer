/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Mock API Stubs
   每个函数返回 Promise<MockData>
   Rust 后端就绪后，替换为 Tauri invoke() 调用即可
   ═══════════════════════════════════════════════════ */

const DELAY = 300; // simulate network/backend latency in ms

function delay(ms = DELAY) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check system environment (Python, PyTorch, CUDA, GPU, disk).
 * @returns {Promise<object>}
 */
export async function checkEnvironment() {
  await delay();
  return {
    python: { ready: true, version: '3.13.2' },
    pytorch: { ready: true, version: '2.6.0+cu124', cuda_available: true },
    gpu: [
      { name: 'NVIDIA GeForce RTX 4070 Ti SUPER', vram_total: '16 GB', vram_available: '14.2 GB' }
    ],
    disk: { system_free: '156.3 GB', output_free: '890.2 GB' },
    all_ready: true,
  };
}

/**
 * Validate a dataset folder/ZIP path.
 * @param {string} path
 * @returns {Promise<object>}
 */
export async function checkDataset(path) {
  await delay(800);
  return {
    valid: true,
    image_count: 2450,
    class_count: 8,
    classes: ['button_blue', 'button_red', 'icon_close', 'icon_menu', 'text_title', 'bar_health', 'bar_mana', 'minimap'],
  };
}

/**
 * Validate a .pt model file.
 * @param {string} path
 * @returns {Promise<object>}
 */
export async function checkModel(path) {
  await delay(500);
  return {
    valid: true,
    architecture: 'YOLOv8n',
    param_count: '3.2M',
    file_size: '6.2 MB',
    input_size: 640,
  };
}

/**
 * Start a training task (returns immediately; progress via events).
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function startTraining(config) {
  await delay();
  return {
    task_id: 'task_' + Date.now(),
    status: 'started',
  };
}

/**
 * Get training history list.
 * @returns {Promise<Array>}
 */
export async function getTaskHistory() {
  await delay();
  return [
    { id: 'task_001', name: '游戏按钮检测_v2', date: '2026-07-17 14:30', status: 'completed', mAP50: '0.876', epochs: 100 },
    { id: 'task_002', name: 'UI元素检测_v1', date: '2026-07-16 09:15', status: 'stopped', mAP50: '0.743', epochs: 65 },
    { id: 'task_003', name: '图标识别实验', date: '2026-07-15 22:00', status: 'error', mAP50: '0.512', epochs: 30 },
    { id: 'task_004', name: '按钮检测_v3', date: '2026-07-14 11:45', status: 'completed', mAP50: '0.921', epochs: 150 },
    { id: 'task_005', name: '场景分割测试', date: '2026-07-13 16:20', status: 'completed', mAP50: '0.834', epochs: 80 },
  ];
}

/**
 * Get settings.
 * @returns {Promise<object>}
 */
export async function getSettings() {
  await delay(200);
  return {
    output_directory: 'C:\\Users\\User\\YOLO_Output',
    log_level: 'detailed',
  };
}

/**
 * Save settings.
 * @param {object} settings
 * @returns {Promise<object>}
 */
export async function saveSettings(settings) {
  await delay();
  return { saved: true };
}

/**
 * Run inference on an image.
 * @param {object} config - { modelPath, imagePath, confidence, iou, imageSize }
 * @returns {Promise<object>}
 */
export async function runInference(config) {
  await delay(800);
  return {
    total_detections: 5,
    inference_time_ms: 124,
    input_resolution: '1920x1080',
    inference_resolution: '640x384',
    detections: [
      { class: 'button_blue', confidence: 0.94, bbox: [120, 340, 180, 380] },
      { class: 'button_red', confidence: 0.89, bbox: [350, 340, 410, 378] },
      { class: 'icon_close', confidence: 0.97, bbox: [890, 22, 910, 42] },
      { class: 'text_title', confidence: 0.82, bbox: [200, 80, 600, 120] },
      { class: 'bar_health', confidence: 0.91, bbox: [50, 200, 250, 220] },
    ],
  };
}
