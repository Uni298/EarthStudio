// Animation Controller - Handles playback
export class AnimationController {
    constructor(keyframeManager, cesiumManager, timelineEditor) {
        this.keyframeManager = keyframeManager;
        this.cesiumManager = cesiumManager;
        this.timelineEditor = timelineEditor;

        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 10;
        this.fps = 30;
        this.frameInterval = 1000 / this.fps;
        this.lastFrameTime = 0;
        this.animationFrameId = null;
        this.loop = false;

        this.listeners = {
            'play': [],
            'pause': [],
            'stop': [],
            'timeUpdate': [],
            'frameUpdate': [],

'finished': []

        };
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastFrameTime = performance.now();

        // Disable camera controls during playback
        this.cesiumManager.enableCameraControls(false);

        this.animate();
        this.emit('play', { time: this.currentTime });
    }

    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;

        // Re-enable camera controls
        this.cesiumManager.enableCameraControls(true);

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.emit('pause', { time: this.currentTime });
    }

    stop() {
        this.pause();
        this.currentTime = 0;
        this.updateCamera();
        this.timelineEditor.setCurrentTime(0);
        this.emit('stop', { time: this.currentTime });
    }

    animate() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const elapsed = now - this.lastFrameTime;

        if (elapsed >= this.frameInterval) {
            this.lastFrameTime = now - (elapsed % this.frameInterval);

            // Update time
            this.currentTime += this.frameInterval / 1000;

            // Check if reached end
            if (this.currentTime >= this.duration) {
    if (this.loop) {
        this.currentTime = 0;
    } else {
        this.currentTime = this.duration;
        this.pause();
        this.emit('timeUpdate', { time: this.currentTime });
        this.emit('finished');   // ← 追加
        return;
    }
}


            // Update camera and timeline
            this.updateCamera();
            this.timelineEditor.updatePlayhead(this.currentTime);
            // this.timelineEditor.setCurrentTime(this.currentTime);

            this.emit('timeUpdate', { time: this.currentTime });
            this.emit('frameUpdate', { time: this.currentTime, frame: this.getCurrentFrame() });
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    updateCamera() {
        const cameraData = this.keyframeManager.interpolateAt(this.currentTime);
        this.cesiumManager.setCameraPosition(cameraData);
        this.cesiumManager.setFOV(cameraData.fov);
    }

    seekTo(time) {
        this.currentTime = Math.max(0, Math.min(this.duration, time));
        this.updateCamera();
        this.timelineEditor.setCurrentTime(this.currentTime);
        this.emit('timeUpdate', { time: this.currentTime });
    }

    stepForward() {
        const frameTime = 1 / this.fps;
        this.seekTo(this.currentTime + frameTime);
    }

playFromStart() {
    this.stop();
    this.play();
}

    stepBackward() {
        const frameTime = 1 / this.fps;
        this.seekTo(this.currentTime - frameTime);
    }

    setDuration(duration) {
        this.duration = duration;
        this.timelineEditor.setDuration(duration);
    }

    setFPS(fps) {
        this.fps = fps;
        this.frameInterval = 1000 / fps;
        this.timelineEditor.setFPS(fps);
    }

    setLoop(loop) {
        this.loop = loop;
    }

    getCurrentTime() {
        return this.currentTime;
    }

    getCurrentFrame() {
        return Math.floor(this.currentTime * this.fps);
    }

    getTotalFrames() {
        return Math.floor(this.duration * this.fps);
    }

    getIsPlaying() {
        return this.isPlaying;
    }
}

export default AnimationController;
