// Property Panel - UI for editing keyframe properties
export class PropertyPanel {
    constructor(keyframeManager, cesiumManager, animationController) {
        this.keyframeManager = keyframeManager;
        this.cesiumManager = cesiumManager;
        this.animationController = animationController;

        this.initializeElements();
        this.bindEvents();
        this.updateUI();

        // Listen to keyframe selection
        this.keyframeManager.on('keyframeSelected', (kf) => {
            this.updateUI();
        });

        // Listen to timeline seek
        window.addEventListener('timelineSeek', (e) => {
            this.updateCameraFromInterpolation(e.detail.time);
        });
    }

    initializeElements() {
        // Position inputs
        this.latitudeInput = document.getElementById('input-latitude');
        this.longitudeInput = document.getElementById('input-longitude');
        this.heightInput = document.getElementById('input-height');

        // Orientation inputs
        this.headingInput = document.getElementById('input-heading');
        this.headingSlider = document.getElementById('input-heading-slider');
        this.pitchInput = document.getElementById('input-pitch');
        this.pitchSlider = document.getElementById('input-pitch-slider'); // New Pitch slider
        // Roll removed
        this.rollInput = null; // Disable roll input

        // Camera inputs
        this.fovInput = document.getElementById('input-fov');
        this.fovValue = document.getElementById('fov-value'); // Corrected ID

        // Interpolation
        this.interpolationSelect = document.getElementById('select-interpolation');

        // Buttons
        this.addButton = document.getElementById('btn-add-keyframe');
        this.updateButton = document.getElementById('btn-update-keyframe');
        this.deleteButton = document.getElementById('btn-delete-keyframe');
    }

    bindEvents() {
        this.latitudeInput.addEventListener('input', () => this.onPropertyChange());
        this.longitudeInput.addEventListener('input', () => this.onPropertyChange());
        this.heightInput.addEventListener('input', () => this.onPropertyChange());
        this.headingInput.addEventListener('input', () => this.onPropertyChange());
        this.pitchInput.addEventListener('input', () => this.onPropertyChange());
        // this.rollInput.addEventListener('input', () => this.onPropertyChange()); // Removed

        // FOV listener (moved here logic-wise)
        this.fovInput.addEventListener('input', () => {
            this.fovValue.textContent = this.fovInput.value + '°';
            this.onPropertyChange();
        });

        // Add keyframe button
        this.addButton.addEventListener('click', () => {
            this.addKeyframe();
        });

        // Capture current camera button (新機能: 現在のカメラ位置を取得)
        const captureButton = document.createElement('button');
        captureButton.className = 'btn-secondary';
        captureButton.innerHTML = '<span class="icon">📷</span> 現在のカメラ位置を取得';
        captureButton.style.marginBottom = '8px';
        captureButton.addEventListener('click', () => {
            this.captureCurrentCamera();
        });

        // Insert before add button
        this.addButton.parentElement.insertBefore(captureButton, this.addButton);

        // Update UI when camera moves (ユーザーが地球を動かしたら表示を更新)
        let updateTimeout;
        const updateFromCamera = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                if (!this.animationController.getIsPlaying()) {
                    this.updateUIFromCamera();
                }
            }, 100);
        };

        // Listen to camera changes
        if (this.cesiumManager.getViewer()) {
            this.cesiumManager.getViewer().camera.changed.addEventListener(updateFromCamera);
        }

        // Sync Pitch slider and number
        this.pitchSlider.addEventListener('input', (e) => {
            this.pitchInput.value = e.target.value;
            this.onPropertyChange();
        });

        this.pitchInput.addEventListener('input', (e) => {
            this.pitchSlider.value = e.target.value;
        });

        // Sync Heading slider and number
        this.headingSlider.addEventListener('input', (e) => {
            this.headingInput.value = e.target.value;
            this.onPropertyChange();
        });

        this.headingInput.addEventListener('input', (e) => {
            this.headingSlider.value = e.target.value;
        });

        // Update keyframe button
        this.updateButton.addEventListener('click', () => {
            this.updateKeyframe();
        });

        // Delete keyframe button
        this.deleteButton.addEventListener('click', () => {
            this.deleteKeyframe();
        });
    }

    updateCameraFromInputs() {
        const cameraData = {
            latitude: parseFloat(this.latitudeInput.value),
            longitude: parseFloat(this.longitudeInput.value),
            height: parseFloat(this.heightInput.value),
            heading: parseFloat(this.headingInput.value),
            pitch: parseFloat(this.pitchInput.value),
            roll: 0 // Default roll to 0 since input is removed
        };

        this.cesiumManager.setCameraPosition(cameraData);
        this.cesiumManager.setFOV(parseFloat(this.fovInput.value));
    }

    onPropertyChange() {
        if (!this.animationController.getIsPlaying()) {
            this.updateCameraFromInputs();
        }
    }

    updateCameraFromInterpolation(time) {
        const cameraData = this.keyframeManager.interpolateAt(time);
        this.cesiumManager.setCameraPosition(cameraData);
        this.cesiumManager.setFOV(cameraData.fov);

        // Update inputs to show interpolated values
        this.latitudeInput.value = cameraData.latitude.toFixed(4);
        this.longitudeInput.value = cameraData.longitude.toFixed(4);
        this.heightInput.value = Math.round(cameraData.height);
        this.headingInput.value = Math.round(cameraData.heading);
        this.headingSlider.value = Math.round(cameraData.heading); // Sync
        this.pitchInput.value = Math.round(cameraData.pitch);
        this.pitchSlider.value = Math.round(cameraData.pitch); // Sync
        // Roll ignored
        this.fovInput.value = Math.round(cameraData.fov);
        this.fovValue.textContent = Math.round(cameraData.fov) + '°';
    }

    addKeyframe() {
        const currentTime = this.animationController.getCurrentTime();

        const cameraData = {
            latitude: parseFloat(this.latitudeInput.value),
            longitude: parseFloat(this.longitudeInput.value),
            height: parseFloat(this.heightInput.value),
            heading: parseFloat(this.headingInput.value),
            pitch: parseFloat(this.pitchInput.value),
            roll: 0, // Default roll
            fov: parseFloat(this.fovInput.value)
        };

        const interpolationType = this.interpolationSelect.value;

        // Import Keyframe class
        import('./keyframe-manager.js').then(module => {
            const keyframe = new module.Keyframe(currentTime, cameraData, interpolationType);
            this.keyframeManager.addKeyframe(keyframe);
            this.keyframeManager.selectKeyframe(keyframe);
        });
    }

    updateKeyframe() {
        const selectedKeyframe = this.keyframeManager.selectedKeyframe;
        if (!selectedKeyframe) return;

        const newData = {
            latitude: parseFloat(this.latitudeInput.value),
            longitude: parseFloat(this.longitudeInput.value),
            height: parseFloat(this.heightInput.value),
            heading: parseFloat(this.headingInput.value),
            pitch: parseFloat(this.pitchInput.value),
            roll: 0, // Default roll
            fov: parseFloat(this.fovInput.value),
            interpolationType: this.interpolationSelect.value
        };

        this.keyframeManager.updateKeyframe(selectedKeyframe, newData);
    }

    deleteKeyframe() {
        const selectedKeyframe = this.keyframeManager.selectedKeyframe;
        if (!selectedKeyframe) return;

        this.keyframeManager.removeKeyframe(selectedKeyframe);
    }

    updateUI() {
        const selectedKeyframe = this.keyframeManager.selectedKeyframe;

        if (selectedKeyframe) {
            // Populate inputs with keyframe data
            this.latitudeInput.value = selectedKeyframe.latitude.toFixed(4);
            this.longitudeInput.value = selectedKeyframe.longitude.toFixed(4);
            this.heightInput.value = Math.round(selectedKeyframe.height);
            this.headingInput.value = Math.round(selectedKeyframe.heading);
            this.headingSlider.value = Math.round(selectedKeyframe.heading); // Sync
            this.pitchInput.value = Math.round(selectedKeyframe.pitch);
            this.pitchSlider.value = Math.round(selectedKeyframe.pitch); // Sync
            // Roll ignored
            this.fovInput.value = Math.round(selectedKeyframe.fov);
            this.fovValue.textContent = Math.round(selectedKeyframe.fov) + '°';
            this.interpolationSelect.value = selectedKeyframe.interpolationType;

            // Enable update and delete buttons
            this.updateButton.disabled = false;
            this.deleteButton.disabled = false;
        } else {
            // Get current camera position
            const cameraData = this.cesiumManager.getCameraPosition();
            if (cameraData) {
                this.latitudeInput.value = cameraData.latitude.toFixed(4);
                this.longitudeInput.value = cameraData.longitude.toFixed(4);
                this.heightInput.value = Math.round(cameraData.height);
                this.headingInput.value = Math.round(cameraData.heading);
                this.headingSlider.value = Math.round(cameraData.heading); // Sync
                this.pitchInput.value = Math.round(cameraData.pitch);
                this.pitchSlider.value = Math.round(cameraData.pitch); // Sync
                // Roll ignored
                this.fovInput.value = Math.round(cameraData.fov);
                this.fovValue.textContent = Math.round(cameraData.fov) + '°';
            }

            // Disable update and delete buttons
            this.updateButton.disabled = true;
            this.deleteButton.disabled = true;
        }
    }

    // Capture current camera position (新機能)
    captureCurrentCamera() {
        const cameraData = this.cesiumManager.getCameraPosition();
        if (cameraData) {
            this.latitudeInput.value = cameraData.latitude.toFixed(4);
            this.longitudeInput.value = cameraData.longitude.toFixed(4);
            this.heightInput.value = Math.round(cameraData.height);
            this.headingInput.value = Math.round(cameraData.heading);
            this.headingSlider.value = Math.round(cameraData.heading); // Sync
            this.pitchInput.value = Math.round(cameraData.pitch);
            this.pitchSlider.value = Math.round(cameraData.pitch); // Sync
            // Roll ignored
            this.fovInput.value = Math.round(cameraData.fov);
            this.fovValue.textContent = Math.round(cameraData.fov) + '°';

            // Show notification
            this.showNotification('カメラ位置を取得しました');
        }
    }

    // Update UI from camera (カメラが動いたら表示を更新)
    updateUIFromCamera() {
        if (this.keyframeManager.selectedKeyframe) return; // キーフレーム選択中は更新しない

        const cameraData = this.cesiumManager.getCameraPosition();
        if (cameraData) {
            this.latitudeInput.value = cameraData.latitude.toFixed(4);
            this.longitudeInput.value = cameraData.longitude.toFixed(4);
            this.heightInput.value = Math.round(cameraData.height);
            this.headingInput.value = Math.round(cameraData.heading);
            this.headingSlider.value = Math.round(cameraData.heading); // Sync
            this.pitchInput.value = Math.round(cameraData.pitch);
            this.pitchSlider.value = Math.round(cameraData.pitch); // Sync
            // Roll ignored
            this.fovInput.value = Math.round(cameraData.fov);
            this.fovValue.textContent = Math.round(cameraData.fov) + '°';
        }
    }

    // Show notification
    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #4a9eff, #7b61ff);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(74, 158, 255, 0.4);
            z-index: 1000;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

export default PropertyPanel;
