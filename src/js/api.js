/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — API Layer (global namespace)
   Auto-detects Tauri: if available, uses invoke(); else mock data.
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  var DELAY = 300;
  var HAS_TAURI = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

  function delay(ms) {
    ms = ms || DELAY;
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  /** Invoke a Tauri command. Falls back to mock if Tauri unavailable. */
  function tauriInvoke(cmd, args) {
    if (HAS_TAURI && window.__TAURI__ && window.__TAURI__.core) {
      return window.__TAURI__.core.invoke(cmd, args);
    }
    // Fallback for older Tauri or dev without @tauri-apps/api
    return Promise.reject(new Error('Tauri API not available'));
  }

  /** Listen for a Tauri event. Falls back to mock bus. */
  function tauriListen(eventName, callback) {
    if (HAS_TAURI && window.__TAURI__ && window.__TAURI__.event) {
      return window.__TAURI__.event.listen(eventName, function(e) {
        var payload = e.payload;
        // If payload is a JSON string, parse it
        if (typeof payload === 'string') {
          try { payload = JSON.parse(payload); } catch(_) {}
        }
        callback(payload);
      });
    }
    return Promise.resolve(function() {}); // no-op unlisten
  }

  /* ═══════════ API Methods ═══════════ */

  App.api = {

    /* ── Environment Check ── */
    checkEnvironment: function() {
      if (!HAS_TAURI) {
        return delay().then(function() { return MOCK_ENV; });
      }

      return new Promise(function(resolve, reject) {
        var result = { python: {}, pytorch: {}, gpu: [], disk: {}, all_ready: false };
        var lines = [];
        var unlisten = function() {};

        tauriListen('env:check:line', function(payload) {
          lines.push(payload);
          // Parse each line and extract data
          var code = payload.code || '';
          if (code === 'E-002') { result.python = { ready: true, version: payload.python_version }; }
          if (code === 'E-003') { result.pytorch = { ready: true, version: payload.pytorch_version, cuda_available: payload.cuda_available }; }
          if (code === 'E-004') {
            result.gpu = (payload.gpus || []).map(function(g) { return { name: g.name, vram_total: g.vram_total, vram_available: '--' }; });
          }
          if (code === 'E-004W') { result.gpu = []; }
          if (code === 'E-005') { result.disk = { system_free: payload.drives ? payload.drives[0].free_gb + ' GB' : '--', output_free: '--' }; }
          if (code === 'E-006') { result.all_ready = payload.all_ready; }
        }).then(function(fn) { unlisten = fn; });

        tauriListen('env:check:completed', function() {
          unlisten();
          resolve(result);
        });

        tauriListen('env:check:error', function(payload) {
          unlisten();
          reject(new Error(payload.message || 'Environment check failed'));
        });

        tauriInvoke('check_environment').catch(function(err) {
          unlisten();
          reject(err);
        });
      });
    },

    /* ── Dataset Check ── */
    checkDataset: function(path) {
      if (!HAS_TAURI) {
        return delay(800).then(function() { return MOCK_DATASET; });
      }
      // TODO: real Tauri implementation
      return delay(800).then(function() { return MOCK_DATASET; });
    },

    /* ── Model Check ── */
    checkModel: function(path) {
      if (!HAS_TAURI) {
        return delay(500).then(function() { return MOCK_MODEL; });
      }
      // TODO: real Tauri implementation
      return delay(500).then(function() { return MOCK_MODEL; });
    },

    /* ── Training ── */
    startTraining: function(config) {
      if (!HAS_TAURI) {
        return delay().then(function() { return { task_id: 'task_' + Date.now(), status: 'started' }; });
      }
      return tauriInvoke('start_training', { config: config }).then(function(taskId) {
        return { task_id: taskId, status: 'started' };
      });
    },

    pauseTraining: function(taskId) {
      if (!HAS_TAURI) return Promise.resolve();
      return tauriInvoke('pause_training', { taskId: taskId });
    },

    resumeTraining: function(taskId) {
      if (!HAS_TAURI) return Promise.resolve();
      return tauriInvoke('resume_training', { taskId: taskId });
    },

    stopTraining: function(taskId) {
      if (!HAS_TAURI) return Promise.resolve();
      return tauriInvoke('stop_training', { taskId: taskId });
    },

    /* ── Training History ── */
    getTaskHistory: function() {
      if (!HAS_TAURI) {
        return delay().then(function() { return MOCK_HISTORY; });
      }
      return tauriInvoke('get_task_history').catch(function() {
        return []; // Return empty on error
      });
    },

    /* ── Settings ── */
    getSettings: function() {
      if (!HAS_TAURI) {
        return delay(200).then(function() { return { output_directory: 'C:\\Users\\User\\YOLO_Output', log_level: 'detailed' }; });
      }
      return tauriInvoke('get_settings');
    },

    saveSettings: function(settings) {
      if (!HAS_TAURI) return delay().then(function() { return { saved: true }; });
      return tauriInvoke('save_settings', { settings: settings });
    },

    /* ── Inference ── */
    runInference: function(config) {
      if (!HAS_TAURI) {
        return delay(800).then(function() { return MOCK_INFERENCE; });
      }
      // TODO: real Tauri implementation
      return delay(800).then(function() { return MOCK_INFERENCE; });
    }
  };

  /* ═══════════ Mock Data ═══════════ */

  var MOCK_ENV = {
    python: { ready: true, version: '3.13.2' },
    pytorch: { ready: true, version: '2.6.0+cu124', cuda_available: true },
    gpu: [{ name: 'NVIDIA GeForce RTX 4070 Ti SUPER', vram_total: '16 GB', vram_available: '14.2 GB' }],
    disk: { system_free: '156.3 GB', output_free: '890.2 GB' },
    all_ready: true,
  };

  var MOCK_DATASET = {
    valid: true, image_count: 2450, class_count: 8,
    classes: ['button_blue','button_red','icon_close','icon_menu','text_title','bar_health','bar_mana','minimap'],
  };

  var MOCK_MODEL = {
    valid: true, architecture: 'YOLOv8n', param_count: '3.2M', file_size: '6.2 MB', input_size: 640,
  };

  var MOCK_HISTORY = [
    { id: 'task_001', name: '游戏按钮检测_v2', date: '2026-07-17 14:30', status: 'completed', mAP50: '0.876', epochs: 100 },
    { id: 'task_002', name: 'UI元素检测_v1', date: '2026-07-16 09:15', status: 'stopped', mAP50: '0.743', epochs: 65 },
    { id: 'task_003', name: '图标识别实验', date: '2026-07-15 22:00', status: 'error', mAP50: '0.512', epochs: 30 },
    { id: 'task_004', name: '按钮检测_v3', date: '2026-07-14 11:45', status: 'completed', mAP50: '0.921', epochs: 150 },
    { id: 'task_005', name: '场景分割测试', date: '2026-07-13 16:20', status: 'completed', mAP50: '0.834', epochs: 80 },
  ];

  var MOCK_INFERENCE = {
    total_detections: 5, inference_time_ms: 124, input_resolution: '1920x1080', inference_resolution: '640x384',
    detections: [
      { class: 'button_blue', confidence: 0.94, bbox: [120, 340, 180, 380] },
      { class: 'button_red', confidence: 0.89, bbox: [350, 340, 410, 378] },
      { class: 'icon_close', confidence: 0.97, bbox: [890, 22, 910, 42] },
      { class: 'text_title', confidence: 0.82, bbox: [200, 80, 600, 120] },
      { class: 'bar_health', confidence: 0.91, bbox: [50, 200, 250, 220] },
    ],
  };
})();
