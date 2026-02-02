// Main Application Entry Point
import CesiumManager from './cesium-manager.js';
import { KeyframeManager } from './keyframe-manager.js';
import TimelineEditor from './timeline-editor.js';
import AnimationController from './animation-controller.js';
import PropertyPanel from './property-panel.js';
import VideoExporter from './video-exporter.js';

class App {
    constructor() {
        this.cesiumToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3NDNmOTgxNi05NzE5LTRiNDEtOGQ3Ny0wMjVlMzEzMjgyMDMiLCJpZCI6Mzg1OTcwLCJpYXQiOjE3NzAwMDI1NDJ9.pUU5f6Esw-chJVbExH3DGlM-naR4tqgZAjSkAnKWxH4'; // Replace with your token

        this.init();
    }

    async init() {
        try {
            // Initialize managers
            this.keyframeManager = new KeyframeManager();
            this.cesiumManager = new CesiumManager('cesium-container', this.cesiumToken);

            // Initialize Cesium viewer
            await this.cesiumManager.initialize();
            console.log('Cesium viewer initialized');

            // Initialize timeline
            this.timelineEditor = new TimelineEditor('timeline-canvas', this.keyframeManager, 10);

            // Initialize animation controller
            this.animationController = new AnimationController(
                this.keyframeManager,
                this.cesiumManager,
                this.timelineEditor
            );

            // Initialize property panel
            this.propertyPanel = new PropertyPanel(
                this.keyframeManager,
                this.cesiumManager,
                this.animationController
            );

            // Initialize video exporter
            this.videoExporter = new VideoExporter(
                this.cesiumManager,
                this.animationController,
                this.keyframeManager
            );

            // Initialize path visualizer (New Feature)
            import('./path-visualizer.js').then(module => {
                this.pathVisualizer = new module.PathVisualizer(
                    this.cesiumManager.getViewer(),
                    this.keyframeManager
                );
                // Connect to video exporter to hide/show during export
                this.videoExporter.setPathVisualizer(this.pathVisualizer);
            });

            // Setup UI controls
            this.setupControls();
            this.setupProjectControls();

            // Setup Keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Add some default keyframes for demo
            this.addDemoKeyframes();

            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);

            // Check if it's a Cesium Ion token error
            if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
                this.showTokenError();
            } else {
                alert('初期化エラー: ' + error.message + '\n\nコンソールで詳細を確認してください。');
            }
        }
    }

    showTokenError() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(20, 24, 36, 0.98);
            border: 2px solid #ff4757;
            border-radius: 12px;
            padding: 32px;
            max-width: 600px;
            z-index: 10000;
            color: #e8eaed;
            font-family: 'Inter', sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;

        errorDiv.innerHTML = `
            <h2 style="color: #ff4757; margin-bottom: 16px; font-size: 20px;">⚠️ Cesium Ion トークンエラー</h2>
            <p style="margin-bottom: 16px; line-height: 1.6;">
                Cesium Ion APIの認証に失敗しました（401エラー）。<br>
                有効なアクセストークンを設定する必要があります。
            </p>
            <div style="background: #0a0e1a; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <p style="margin-bottom: 8px; font-weight: 600;">設定手順:</p>
                <ol style="margin-left: 20px; line-height: 1.8;">
                    <li><a href="https://ion.cesium.com/" target="_blank" style="color: #4a9eff; text-decoration: none;">Cesium Ion</a>で無料アカウントを作成</li>
                    <li>「Access Tokens」ページでトークンをコピー</li>
                    <li><code style="background: #1e2330; padding: 2px 6px; border-radius: 4px;">js/app.js</code>の11行目に貼り付け</li>
                    <li>ページをリロード</li>
                </ol>
            </div>
            <button onclick="window.open('https://ion.cesium.com/', '_blank')" 
                    style="background: linear-gradient(135deg, #4a9eff, #7b61ff); 
                           border: none; 
                           color: white; 
                           padding: 12px 24px; 
                           border-radius: 6px; 
                           cursor: pointer; 
                           font-size: 14px; 
                           font-weight: 600;
                           font-family: 'Inter', sans-serif;">
                Cesium Ionを開く →
            </button>
        `;

        document.body.appendChild(errorDiv);
    }

    setupControls() {
        // Playback controls
        const btnPlay = document.getElementById('btn-play');
        const btnPause = document.getElementById('btn-pause');
        const btnStop = document.getElementById('btn-stop');
        const btnStepBack = document.getElementById('btn-step-back');
        const btnStepForward = document.getElementById('btn-step-forward');

        btnPlay.addEventListener('click', () => {
            this.animationController.play();
            btnPlay.disabled = true;
            btnPause.disabled = false;
        });

        btnPause.addEventListener('click', () => {
            this.animationController.pause();
            btnPlay.disabled = false;
            btnPause.disabled = true;
        });

        btnStop.addEventListener('click', () => {
            this.animationController.stop();
            btnPlay.disabled = false;
            btnPause.disabled = true;
        });

        btnStepBack.addEventListener('click', () => {
            this.animationController.stepBackward();
        });

        btnStepForward.addEventListener('click', () => {
            this.animationController.stepForward();
        });

        // Video preview toggle
        const btnToggleMask = document.getElementById('btn-toggle-mask');
        let maskVisible = false;

        btnToggleMask.addEventListener('click', () => {
            maskVisible = !maskVisible;
            this.cesiumManager.toggleAspectMask(maskVisible);
            btnToggleMask.classList.toggle('active', maskVisible);

            // Handle resize to keep mask correct
            if (maskVisible) {
                window.addEventListener('resize', () => {
                    if (maskVisible) this.cesiumManager.updateAspectMask(16, 9);
                });
            }
        });

        // Timeline settings
        const selectFPS = document.getElementById('select-fps');
        const inputDuration = document.getElementById('input-duration');

        selectFPS.addEventListener('change', (e) => {
            const fps = parseInt(e.target.value);
            this.animationController.setFPS(fps);
        });

        inputDuration.addEventListener('change', (e) => {
            const duration = parseFloat(e.target.value);
            this.animationController.setDuration(duration);
        });

        // Progress slider
        const progressSlider = document.getElementById('progress-slider');
        progressSlider.addEventListener('input', (e) => {
            const progress = parseFloat(e.target.value) / 1000;
            const time = progress * this.animationController.duration;
            this.animationController.seekTo(time);
        });

        // Update progress slider during playback
        this.animationController.on('timeUpdate', (data) => {
            const progress = (data.time / this.animationController.duration) * 1000;
            progressSlider.value = progress;

            // Update time display
            const currentTimeEl = document.getElementById('current-time');
            const minutes = Math.floor(data.time / 60);
            const seconds = Math.floor(data.time % 60);
            const ms = Math.floor((data.time % 1) * 1000);
            currentTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        });

        // Update total time display
        const updateTotalTime = () => {
            const totalTimeEl = document.getElementById('total-time');
            const duration = this.animationController.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            const ms = Math.floor((duration % 1) * 1000);
            totalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        };

        updateTotalTime();
        updateTotalTime();
        inputDuration.addEventListener('change', updateTotalTime);
    }

    setupProjectControls() {
        const btnSave = document.getElementById('btn-save-project');
        const btnLoad = document.getElementById('btn-load-project');
        const inputLoad = document.getElementById('input-load-project');

        // Save Project
        btnSave.addEventListener('click', () => {
            const data = {
                version: 1.0,
                timestamp: Date.now(),
                duration: this.animationController.duration,
                fps: this.animationController.fps,
                keyframes: this.keyframeManager.getAllKeyframes()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `earth_studio_project_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Load Project
        btnLoad.addEventListener('click', () => inputLoad.click());

        inputLoad.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    if (data.keyframes) {
                        this.keyframeManager.importFromJSON(data);
                    }
                    if (data.duration) {
                        this.animationController.setDuration(data.duration);
                        document.getElementById('input-duration').value = data.duration;
                    }
                    if (data.fps) {
                        this.animationController.setFPS(data.fps);
                        document.getElementById('select-fps').value = data.fps;
                    }

                    // Seek to start
                    this.animationController.seekTo(0);

                    alert('プロジェクトを読み込みました');
                } catch (error) {
                    console.error('Project load error:', error);
                    alert('ファイルの読み込みに失敗しました: ' + error.message);
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // Reset input
        });
    }

    addDemoKeyframes() {
        // Add demo keyframes to showcase the system
        import('./keyframe-manager.js').then(module => {
            // Keyframe 1: Tokyo Tower
            const kf1 = new module.Keyframe(0, {
                latitude: 35.6586,
                longitude: 139.7454,
                height: 500,
                heading: 0,
                pitch: -45,
                roll: 0,
                fov: 60
            }, 'easeInOut');

            // Keyframe 2: Zoom out
            const kf2 = new module.Keyframe(3, {
                latitude: 35.6586,
                longitude: 139.7454,
                height: 5000,
                heading: 45,
                pitch: -60,
                roll: 0,
                fov: 50
            }, 'easeInOut');

            // Keyframe 3: Move to Shibuya
            const kf3 = new module.Keyframe(6, {
                latitude: 35.6595,
                longitude: 139.7004,
                height: 800,
                heading: 90,
                pitch: -30,
                roll: 0,
                fov: 70
            }, 'easeInOut');

            // Keyframe 4: Final position
            const kf4 = new module.Keyframe(10, {
                latitude: 35.6762,
                longitude: 139.6503,
                height: 10000,
                heading: 180,
                pitch: -75,
                roll: 0,
                fov: 45
            }, 'easeInOut');

            this.keyframeManager.addKeyframe(kf1);
            this.keyframeManager.addKeyframe(kf2);
            this.keyframeManager.addKeyframe(kf3);
            this.keyframeManager.addKeyframe(kf4);

            console.log('Demo keyframes added');
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if input focused
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (this.animationController.getIsPlaying()) {
                        this.animationController.pause();
                        // Update buttons
                        document.getElementById('btn-play').disabled = false;
                        document.getElementById('btn-pause').disabled = true;
                    } else {
                        this.animationController.play();
                        // Update buttons
                        document.getElementById('btn-play').disabled = true;
                        document.getElementById('btn-pause').disabled = false;
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    this.animationController.stop();
                    // Update buttons
                    document.getElementById('btn-play').disabled = false;
                    document.getElementById('btn-pause').disabled = true;
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    this.animationController.stepBackward();
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    this.animationController.stepForward();
                    break;
            }
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
} else {
    window.app = new App();
}
