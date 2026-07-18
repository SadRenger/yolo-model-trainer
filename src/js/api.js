/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Mock API Stubs (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  var DELAY = 300;

  function delay(ms) {
    ms = ms || DELAY;
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  App.api = {
    checkEnvironment: function() {
      return delay().then(function() { return {
        python: { ready: true, version: '3.13.2' },
        pytorch: { ready: true, version: '2.6.0+cu124', cuda_available: true },
        gpu: [{ name: 'NVIDIA GeForce RTX 4070 Ti SUPER', vram_total: '16 GB', vram_available: '14.2 GB' }],
        disk: { system_free: '156.3 GB', output_free: '890.2 GB' },
        all_ready: true,
      };});
    },

    checkDataset: function(path) {
      return delay(800).then(function() { return {
        valid: true, image_count: 2450, class_count: 8,
        classes: ['button_blue','button_red','icon_close','icon_menu','text_title','bar_health','bar_mana','minimap'],
      };});
    },

    checkModel: function(path) {
      return delay(500).then(function() { return {
        valid: true, architecture: 'YOLOv8n', param_count: '3.2M', file_size: '6.2 MB', input_size: 640,
      };});
    },

    startTraining: function(config) {
      return delay().then(function() { return { task_id: 'task_' + Date.now(), status: 'started' }; });
    },

    getTaskHistory: function() {
      return delay().then(function() { return [
        { id: 'task_001', name: '游戏按钮检测_v2', date: '2026-07-17 14:30', status: 'completed', mAP50: '0.876', epochs: 100 },
        { id: 'task_002', name: 'UI元素检测_v1', date: '2026-07-16 09:15', status: 'stopped', mAP50: '0.743', epochs: 65 },
        { id: 'task_003', name: '图标识别实验', date: '2026-07-15 22:00', status: 'error', mAP50: '0.512', epochs: 30 },
        { id: 'task_004', name: '按钮检测_v3', date: '2026-07-14 11:45', status: 'completed', mAP50: '0.921', epochs: 150 },
        { id: 'task_005', name: '场景分割测试', date: '2026-07-13 16:20', status: 'completed', mAP50: '0.834', epochs: 80 },
      ];});
    },

    getSettings: function() {
      return delay(200).then(function() { return { output_directory: 'C:\\Users\\User\\YOLO_Output', log_level: 'detailed' }; });
    },

    saveSettings: function(settings) {
      return delay().then(function() { return { saved: true }; });
    },

    runInference: function(config) {
      return delay(800).then(function() { return {
        total_detections: 5, inference_time_ms: 124, input_resolution: '1920x1080', inference_resolution: '640x384',
        detections: [
          { class: 'button_blue', confidence: 0.94, bbox: [120, 340, 180, 380] },
          { class: 'button_red', confidence: 0.89, bbox: [350, 340, 410, 378] },
          { class: 'icon_close', confidence: 0.97, bbox: [890, 22, 910, 42] },
          { class: 'text_title', confidence: 0.82, bbox: [200, 80, 600, 120] },
          { class: 'bar_health', confidence: 0.91, bbox: [50, 200, 250, 220] },
        ],
      };});
    }
  };
})();
