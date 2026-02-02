// Video Exporter - Handles frame capture and video generation
export class VideoExporter {
    constructor(cesiumManager, animationController, keyframeManager) {
        this.cesiumManager = cesiumManager;
        this.animationController = animationController;
        this.keyframeManager = keyframeManager;

        this.isExporting = false;
        this.exportProgress = 0;
        this.capturedFrames = [];

        // Use current origin to support access from other devices (e.g., iPad)
        this.serverUrl = window.location.origin;

        this.initializeUI();
    }

    initializeUI() {
        this.dialog = document.getElementById('export-dialog');
        this.btnExport = document.getElementById('btn-export');
        this.btnStartExport = document.getElementById('btn-start-export');
        this.btnServerExport = document.getElementById('btn-server-export');
        this.btnCancelExport = document.getElementById('btn-cancel-export');
        this.btnCloseDialog = document.getElementById('btn-close-dialog');

        this.resolutionSelect = document.getElementById('export-resolution');
        this.fpsSelect = document.getElementById('export-fps');
        this.qualitySelect = document.getElementById('export-quality');

        this.progressContainer = document.getElementById('export-progress');
        this.progressFill = document.getElementById('export-progress-fill');
        this.statusText = document.getElementById('export-status');
        this.percentageText = document.getElementById('export-percentage');

        // Bind events
        this.btnExport.addEventListener('click', () => this.showDialog());
        this.btnStartExport.addEventListener('click', () => this.startExport());
        this.btnServerExport.addEventListener('click', () => this.startServerExport());
        this.btnCancelExport.addEventListener('click', () => {
            this.isExporting = false; // Trigger cancellation in loop
            this.hideDialog();
        });
        this.btnCloseDialog.addEventListener('click', () => {
            if (this.isExporting) {
                if (confirm('エクスポートを中止しますか？')) {
                    this.isExporting = false;
                } else {
                    return;
                }
            }
            this.hideDialog();
        });
    }

    showDialog() {
        this.dialog.style.display = 'flex';
        this.progressContainer.style.display = 'none';
        this.exportProgress = 0;
        this.updateProgress(0, '準備完了');
    }

    hideDialog() {
        if (!this.isExporting) {
            this.dialog.style.display = 'none';
        }
    }

    async startExport() {
        if (this.isExporting) return;

        // Get export settings
        const resolution = this.resolutionSelect.value.split('x').map(Number);
        const fps = parseInt(this.fpsSelect.value);
        const quality = this.qualitySelect.value;

        const width = resolution[0];
        const height = resolution[1];
        const duration = this.animationController.duration;
        const totalFrames = Math.ceil(duration * fps);

        this.isExporting = true;
        // No longer storing frames in memory
        this.progressContainer.style.display = 'block';
        this.btnStartExport.disabled = true;

        // Hide path visualization
        if (this.pathVisualizer) {
            this.pathVisualizer.setEnabled(false);
        }

        try {
            // 1. Start Export Session
            this.updateProgress(0, 'エクスポート準備中...');
            const startResponse = await fetch(`${this.serverUrl}/export/start`, { method: 'POST' });
            if (!startResponse.ok) throw new Error('サーバー接続エラー');
            const { sessionId } = await startResponse.json();

            // Pause animation
            const wasPlaying = this.animationController.getIsPlaying();
            if (wasPlaying) {
                this.animationController.pause();
            }

            // Save original viewer size
            const viewer = this.cesiumManager.getViewer();
            const container = viewer.container;
            const originalWidth = container.style.width;
            const originalHeight = container.style.height;

            // Resize viewer
            container.style.width = width + 'px';
            container.style.height = height + 'px';
            this.cesiumManager.resize();

            // 2. Capture and Upload Loop
            for (let frame = 0; frame < totalFrames; frame++) {
                if (!this.isExporting) {
                    throw new Error('エクスポートがキャンセルされました');
                }

                const time = (frame / fps);

                // Update camera
                const cameraData = this.keyframeManager.interpolateAt(time);
                this.cesiumManager.setCameraPosition(cameraData);
                this.cesiumManager.setFOV(cameraData.fov);

                // Wait for render
                await this.waitForRender();

                // Capture and Upload (Optimized for iPad)
                // Use default toBlob (PNG)
                const canvas = this.cesiumManager.getViewer().canvas;
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

                if (!blob) throw new Error('Frame capture failed');

                // Upload binary
                const response = await fetch(`${this.serverUrl}/export/frame`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'x-session-id': sessionId,
                        'x-frame-index': frame
                    },
                    body: blob
                });

                if (!response.ok) {
                    throw new Error(`Upload failed at frame ${frame}`);
                }

                // Update progress
                const progress = ((frame + 1) / totalFrames) * 80; // First 80% is capture/upload
                this.updateProgress(progress, `フレーム処理中... (${frame + 1}/${totalFrames})`);

                // Force garbage collection hint (optional, but waiting helps)
                await new Promise(r => setTimeout(r, 20));
            }

            // Restore viewer size
            container.style.width = originalWidth;
            container.style.height = originalHeight;
            this.cesiumManager.resize();

            // Reset animation
            this.animationController.seekTo(0);
            if (wasPlaying) this.animationController.play();

            // 3. Finish and Encode
            this.updateProgress(80, '動画をエンコード中... (数秒〜数分かかります)');

            const finishResponse = await fetch(`${this.serverUrl}/export/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    fps: fps,
                    quality: quality
                })
            });

            if (!finishResponse.ok) throw new Error('エンコードエラー');

            const blob = await finishResponse.blob();

            // Download video
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.updateProgress(100, 'エクスポート完了！');

            setTimeout(() => {
                this.isExporting = false;
                this.btnStartExport.disabled = false;
                this.hideDialog();
                // Restore path visualization
                if (this.pathVisualizer) {
                    this.pathVisualizer.setEnabled(true);
                }
            }, 2000);

        } catch (error) {
            console.error('Export error:', error);
            this.updateProgress(0, 'エラー: ' + error.message);
            this.isExporting = false;
            this.btnStartExport.disabled = false;

            // Restore path visualization
            if (this.pathVisualizer) {
                this.pathVisualizer.setEnabled(true);
            }

            // Restore UI if needed
            const viewer = this.cesiumManager.getViewer();
            if (viewer) {
                viewer.container.style.width = '100%';
                viewer.container.style.height = '100%';
                this.cesiumManager.resize();
            }
        }
    }

    async waitForRender() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    // Old encodeVideo replaced by streaming logic

    updateProgress(percentage, status) {
        this.exportProgress = percentage;
        this.progressFill.style.width = percentage + '%';
        this.statusText.textContent = status;
        this.percentageText.textContent = Math.round(percentage) + '%';
    }

    setPathVisualizer(visualizer) {
        this.pathVisualizer = visualizer;
    }

    async startServerExport() {
        if (this.isExporting) return;
        this.isExporting = true;
        this.progressContainer.style.display = 'block';
        this.btnStartExport.disabled = true;
        document.getElementById('btn-server-export').disabled = true;

        try {
            // 1. Initial Request
            const keyframes = this.keyframeManager.getAllKeyframes();
            const duration = this.animationController.duration;
            const fps = parseInt(this.fpsSelect.value);
            const resolution = this.resolutionSelect.value;
            const quality = this.qualitySelect.value;

            this.updateProgress(0, 'サーバー処理を開始中...');

            const startRes = await fetch(`${this.serverUrl}/export/server/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyframes, duration, fps, resolution, quality })
            });

            if (!startRes.ok) throw new Error('Server start failed');
            const { sessionId } = await startRes.json();

            // 2. Polling Loop
            await new Promise((resolve, reject) => {
                const interval = setInterval(async () => {
                    // Check cancellation
                    if (!this.isExporting) {
                        clearInterval(interval);
                        // Optional: Notify server to cancel
                        reject(new Error('Cancelled'));
                        return;
                    }

                    try {
                        const statusRes = await fetch(`${this.serverUrl}/export/server/status/${sessionId}`);
                        if (!statusRes.ok) {
                            clearInterval(interval);
                            throw new Error('Status check failed');
                        }

                        const status = await statusRes.json();

                        if (status.status === 'failed') {
                            clearInterval(interval);
                            throw new Error(status.error || 'Server processing failed');
                        }

                        this.updateProgress(status.progress, status.message);

                        if (status.status === 'completed') {
                            clearInterval(interval);

                            // 3. Download
                            this.updateProgress(100, 'ダウンロード中...');
                            window.location.href = `${this.serverUrl}/export/server/download/${sessionId}`;
                            resolve();

                            setTimeout(() => this.hideDialog(), 1000);
                        }

                    } catch (err) {
                        clearInterval(interval);
                        reject(err);
                    }
                }, 1000); // Poll every second
            });

        } catch (error) {
            console.error('Server export error:', error);
            this.updateProgress(0, 'エラー: ' + error.message);
            alert('サーバーエクスポートエラー: ' + error.message);
        } finally {
            this.isExporting = false;
            this.btnStartExport.disabled = false;
            document.getElementById('btn-server-export').disabled = false;
        }
    }
}

export default VideoExporter;
