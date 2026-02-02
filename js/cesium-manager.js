// CesiumJS Manager
export class CesiumManager {
    constructor(containerId, cesiumToken) {
        this.containerId = containerId;
        this.viewer = null;
        this.cesiumToken = cesiumToken;
        this.isCapturing = false;
    }

    // Initialize Cesium viewer
    async initialize() {
        // Set Cesium ion token (use your own token)
        if (this.cesiumToken) {
            Cesium.Ion.defaultAccessToken = this.cesiumToken;
        }

        // Create viewer
        this.viewer = new Cesium.Viewer(this.containerId, {
            terrainProvider: await Cesium.createWorldTerrainAsync(),
            terrainProvider: await Cesium.createWorldTerrainAsync(),
            // Use OpenStreetMap as a safe fallback that works without Ion token
            imageryProvider: new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/'
            }),
            baseLayerPicker: true, // Allow user to change to Bing Maps/Sentinel if they have valid token
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            vrButton: false,
            infoBox: false,
            selectionIndicator: false,
            shadows: true,
            shouldAnimate: false
        });

        // Enable camera controls (マウスで地球を操作可能に)
        this.viewer.scene.screenSpaceCameraController.enableRotate = true;
        this.viewer.scene.screenSpaceCameraController.enableZoom = true;
        this.viewer.scene.screenSpaceCameraController.enableTilt = true;
        this.viewer.scene.screenSpaceCameraController.enableLook = true;

        // Enable lighting
        this.viewer.scene.globe.enableLighting = true;

        // Enable depth test for terrain
        this.viewer.scene.globe.depthTestAgainstTerrain = true;

        // Add aspect ratio mask for video preview
        this.addAspectMask();

        // Set initial camera position (Tokyo - 陸地が見えるように)
        this.setCameraPosition({
            latitude: 35.6762,
            longitude: 139.6503,
            height: 1000000, // 1000km上空から見下ろす
            heading: 0,
            pitch: -90, // 真下を向く
            roll: 0
        });

        return this.viewer;
    }

    // Set camera position and orientation
    setCameraPosition(data) {
        if (!this.viewer) return;

        const { latitude, longitude, height, heading, pitch, roll } = data;

        this.viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
            orientation: {
                heading: Cesium.Math.toRadians(heading),
                pitch: Cesium.Math.toRadians(pitch),
                roll: Cesium.Math.toRadians(roll)
            }
        });
    }

    // Get current camera position
    getCameraPosition() {
        if (!this.viewer) return null;

        const camera = this.viewer.camera;
        const position = camera.positionCartographic;
        const heading = Cesium.Math.toDegrees(camera.heading);
        const pitch = Cesium.Math.toDegrees(camera.pitch);
        const roll = Cesium.Math.toDegrees(camera.roll);

        return {
            latitude: Cesium.Math.toDegrees(position.latitude),
            longitude: Cesium.Math.toDegrees(position.longitude),
            height: position.height,
            heading: heading,
            pitch: pitch,
            roll: roll,
            fov: Cesium.Math.toDegrees(camera.frustum.fov)
        };
    }

    // Set field of view
    setFOV(fov) {
        if (!this.viewer) return;
        this.viewer.camera.frustum.fov = Cesium.Math.toRadians(fov);
    }

    // Capture current frame as image
    captureFrame() {
        if (!this.viewer) return null;

        return new Promise((resolve) => {
            // Render the scene
            this.viewer.scene.render();

            // Get canvas and convert to blob
            const canvas = this.viewer.scene.canvas;
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    // Capture frame as data URL
    captureFrameDataURL() {
        if (!this.viewer) return null;

        this.viewer.scene.render();
        const canvas = this.viewer.scene.canvas;
        return canvas.toDataURL('image/png');
    }

    // Resize viewer
    resize() {
        if (this.viewer) {
            this.viewer.resize();
        }
    }

    // Destroy viewer
    destroy() {
        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
        }
    }

    // Get viewer instance
    getViewer() {
        return this.viewer;
    }

    // Enable/disable camera controls
    enableCameraControls(enable = true) {
        if (!this.viewer) return;

        const controller = this.viewer.scene.screenSpaceCameraController;
        controller.enableRotate = enable;
        controller.enableZoom = enable;
        controller.enableTilt = enable;
        controller.enableLook = enable;
    }

    // Add aspect ratio mask
    addAspectMask() {
        // Create mask element if not exists
        if (!document.getElementById('aspect-mask')) {
            const mask = document.createElement('div');
            mask.id = 'aspect-mask';
            mask.className = 'aspect-mask';
            mask.style.display = 'none'; // Default hidden

            // Set default 16:9
            this.updateAspectMask(16, 9);

            this.containerId = this.viewer.container.id;
            document.getElementById(this.containerId).appendChild(mask);
        }
    }

    // Update aspect ratio mask dimensions
    updateAspectMask(widthRatio, heightRatio) {
        const mask = document.getElementById('aspect-mask');
        if (!mask) return;

        const container = this.viewer.container;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRatio = containerWidth / containerHeight;
        const targetRatio = widthRatio / heightRatio;

        let width, height;

        if (containerRatio > targetRatio) {
            // Container is wider than target
            height = containerHeight;
            width = height * targetRatio;
        } else {
            // Container is taller than target
            width = containerWidth;
            height = width / targetRatio;
        }

        mask.style.width = `${width}px`;
        mask.style.height = `${height}px`;
    }

    // Toggle mask visibility
    toggleAspectMask(show) {
        const mask = document.getElementById('aspect-mask');
        if (mask) {
            mask.style.display = show ? 'block' : 'none';
            if (show) {
                // Update size on show
                this.updateAspectMask(16, 9);
            }
        }
    }
}

export default CesiumManager;
