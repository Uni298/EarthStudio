// Timeline Editor - Visual timeline with keyframe markers
export class TimelineEditor {
    constructor(canvasId, keyframeManager, duration = 10) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.keyframeManager = keyframeManager;
        this.duration = duration; // Total duration in seconds
        this.currentTime = 0;
        this.fps = 30;

        // Visual settings
        this.isDragging = false;
        this.draggedKeyframe = null;
        this.playheadDragging = false;

        // Colors
        this.colors = {
            background: '#141824',
            ruler: '#9aa0a6',
            grid: 'rgba(255, 255, 255, 0.05)',
            snapGrid: 'rgba(255, 255, 255, 0.1)',
            playhead: '#4a9eff',
            keyframe: '#00d084',
            keyframeSelected: '#7b61ff',
            keyframeHover: '#4a9eff'
        };

        this.hoveredKeyframe = null;

        this.setupCanvas();
        this.bindEvents();
        this.render();

        // Listen to keyframe changes
        this.keyframeManager.on('keyframesChanged', () => this.render());
        this.keyframeManager.on('keyframeSelected', () => this.render());
    }

    setupCanvas() {
        const resizeCanvas = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.render();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    bindEvents() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));

        // Touch Events (iPad Support)
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Touch Event Handlers
    onTouchStart(e) {
        if (e.touches.length > 0) {
            e.preventDefault(); // Prevent scrolling
            const touch = e.touches[0];
            const mockEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0,
                shiftKey: e.shiftKey || false,
                ctrlKey: e.ctrlKey || false
            };
            this.onMouseDown(mockEvent);
        }
    }

    onTouchMove(e) {
        if (e.touches.length > 0) {
            e.preventDefault(); // Prevent scrolling
            const touch = e.touches[0];
            const mockEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                shiftKey: e.shiftKey || false,
                ctrlKey: e.ctrlKey || false
            };
            this.onMouseMove(mockEvent);
        }
    }

    onTouchEnd(e) {
        // Note: touchend doesn't usually have touches list for the ended touch
        const mockEvent = {};
        this.onMouseUp(mockEvent);
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on playhead
        const playheadX = this.timeToX(this.currentTime);
        if (Math.abs(x - playheadX) < 15 && y < this.canvas.height) { // Larger hit area
            this.playheadDragging = true;
            return;
        }

        // Check if clicking on a keyframe
        const keyframes = this.keyframeManager.getAllKeyframes();
        for (const kf of keyframes) {
            const kfX = this.timeToX(kf.time);
            const kfY = this.canvas.height - 40;

            if (Math.abs(x - kfX) < 20 && Math.abs(y - kfY) < 20) { // Larger hit area for touch
                this.isDragging = true;
                this.draggedKeyframe = kf;
                this.keyframeManager.selectKeyframe(kf);
                return;
            }
        }

        // Click on timeline to move playhead (with snap)
        let time = this.xToTime(x);

        // Snap logic
        let snapFrames = 1;
        if (e.shiftKey) snapFrames = 10;
        if (e.ctrlKey) snapFrames = this.fps;

        time = this.snapTime(time, snapFrames);
        this.setCurrentTime(time);
        this.playheadDragging = true;
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Dragging Playhead or Keyframe
        if (this.playheadDragging || (this.isDragging && this.draggedKeyframe)) {
            let time = Math.max(0, Math.min(this.duration, this.xToTime(x)));

            let snapFrames = 1;
            if (e.shiftKey) snapFrames = 10;
            if (e.ctrlKey) snapFrames = this.fps;

            time = this.snapTime(time, snapFrames);

            if (this.playheadDragging) {
                this.setCurrentTime(time);
            } else if (this.isDragging && this.draggedKeyframe) {
                this.keyframeManager.updateKeyframe(this.draggedKeyframe, { time: time });
            }
            return;
        }

        // Check for hover
        this.hoveredKeyframe = null;
        const keyframes = this.keyframeManager.getAllKeyframes();
        let cursor = 'default';

        for (const kf of keyframes) {
            const kfX = this.timeToX(kf.time);
            const kfY = this.canvas.height - 40;

            if (Math.abs(x - kfX) < 20 && Math.abs(y - kfY) < 20) {
                this.hoveredKeyframe = kf;
                cursor = 'pointer';
                break;
            }
        }

        this.canvas.style.cursor = cursor;
        this.render();
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.draggedKeyframe = null;
        this.playheadDragging = false;
        this.canvas.style.cursor = 'default';
    }

    onWheel(e) {
        // Disabled scrolling/zooming as per request to "squeeze fit"
        e.preventDefault();
    }

    // Snap time to nearest frame interval
    snapTime(time, frames = 1) {
        const frameDuration = 1 / this.fps;
        const interval = frameDuration * frames;

        // Strong snap to whole seconds
        if (Math.abs(time - Math.round(time)) < 0.15) {
            return Math.round(time);
        }

        return Math.round(time / interval) * interval;
    }

    // Force update playhead position (sync with animation)
    updatePlayhead(time) {
        this.currentTime = time;
        this.render();
    } // No auto-scroll logic needed

    timeToX(time) {
        // Fixed fit-to-width calculation
        const padding = 40; // 20px left + 20px right
        const usableWidth = this.canvas.width - padding;
        const pixelsPerSecond = usableWidth / this.duration;
        return 20 + time * pixelsPerSecond;
    }

    xToTime(x) {
        const padding = 40;
        const usableWidth = this.canvas.width - padding;
        const pixelsPerSecond = usableWidth / this.duration;
        return (x - 20) / pixelsPerSecond;
    }

    setCurrentTime(time) {
        this.currentTime = Math.max(0, Math.min(this.duration, time));
        this.render();

        // Emit event for other components
        const event = new CustomEvent('timelineSeek', { detail: { time: this.currentTime } });
        window.dispatchEvent(event);
    }

    setDuration(duration) {
        this.duration = duration;
        this.render();
    }

    setFPS(fps) {
        this.fps = fps;
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGrid();

        // Draw time ruler
        this.drawRuler();

        // Draw keyframes
        this.drawKeyframes();

        // Draw playhead
        this.drawPlayhead();
    }

    // Scrollbar method removed


    drawGrid() {
        const ctx = this.ctx;
        const height = this.canvas.height;

        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;

        // Vertical grid lines (every second)
        for (let i = 0; i <= this.duration; i++) {
            const x = this.timeToX(i);
            if (x >= 0 && x <= this.canvas.width) {
                ctx.beginPath();
                ctx.moveTo(x, 30);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }
    }

    drawRuler() {
        const ctx = this.ctx;
        const width = this.canvas.width;

        ctx.fillStyle = this.colors.ruler;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';

        // Draw time markers
        for (let i = 0; i <= this.duration; i++) {
            const x = this.timeToX(i);
            if (x >= 0 && x <= width) {
                // Draw tick
                ctx.beginPath();
                ctx.moveTo(x, 20);
                ctx.lineTo(x, 30);
                ctx.stroke();

                // Draw time label
                const minutes = Math.floor(i / 60);
                const seconds = i % 60;
                const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                ctx.fillText(label, x, 15);
            }
        }

        // Draw frame markers (smaller ticks)
        const frameInterval = 1 / this.fps;
        for (let t = 0; t <= this.duration; t += frameInterval) {
            const x = this.timeToX(t);
            if (x >= 0 && x <= width) {
                ctx.beginPath();
                ctx.moveTo(x, 25);
                ctx.lineTo(x, 30);
                ctx.strokeStyle = 'rgba(154, 160, 166, 0.3)';
                ctx.stroke();
            }
        }
    }

    drawKeyframes() {
        const ctx = this.ctx;
        const keyframes = this.keyframeManager.getAllKeyframes();
        const y = this.canvas.height - 40;

        keyframes.forEach(kf => {
            const x = this.timeToX(kf.time);

            if (x < 0 || x > this.canvas.width) return;

            // Determine color
            let color = this.colors.keyframe;
            if (kf === this.keyframeManager.selectedKeyframe) {
                color = this.colors.keyframeSelected;
            } else if (kf === this.hoveredKeyframe) {
                color = this.colors.keyframeHover;
            }

            // Draw different shapes based on interpolation type
            ctx.fillStyle = color;
            ctx.beginPath();

            const size = 12; // Increased size

            switch (kf.interpolationType) {
                case 'linear':
                    // Diamond (◆)
                    ctx.moveTo(x, y - size);
                    ctx.lineTo(x + size, y);
                    ctx.lineTo(x, y + size);
                    ctx.lineTo(x - size, y);
                    break;

                case 'easeIn':
                    // Triangle Right (▶)
                    ctx.moveTo(x - size + 4, y - size);
                    ctx.lineTo(x + size - 2, y);
                    ctx.lineTo(x - size + 4, y + size);
                    break;

                case 'easeOut':
                    // Triangle Left (◀)
                    ctx.moveTo(x + size - 4, y - size);
                    ctx.lineTo(x - size + 2, y);
                    ctx.lineTo(x + size - 4, y + size);
                    break;

                case 'bezier':
                    // Square (■)
                    ctx.rect(x - size + 2, y - size + 2, (size - 2) * 2, (size - 2) * 2);
                    break;

                case 'easeInOut':
                default:
                    // Circle (●)
                    ctx.arc(x, y, size - 2, 0, Math.PI * 2);
                    break;
            }

            ctx.closePath();
            ctx.fill();

            // Draw outline
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }

    drawPlayhead() {
        const ctx = this.ctx;
        const x = this.timeToX(this.currentTime);
        const height = this.canvas.height;

        // Draw line
        ctx.strokeStyle = this.colors.playhead;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw handle
        ctx.fillStyle = this.colors.playhead;
        ctx.beginPath();
        ctx.arc(x, 30, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw time label
        ctx.fillStyle = this.colors.playhead;
        ctx.font = 'bold 11px Inter, monospace';
        ctx.textAlign = 'center';
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = Math.floor(this.currentTime % 60);
        const ms = Math.floor((this.currentTime % 1) * 1000);
        const label = `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;

        // Background for label
        const labelWidth = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.fillRect(x - labelWidth / 2, height - 18, labelWidth, 16);

        ctx.fillStyle = this.colors.playhead;
        ctx.fillText(label, x, height - 6);
    }

    getCurrentTime() {
        return this.currentTime;
    }
}

export default TimelineEditor;
