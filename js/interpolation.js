// Interpolation functions for animation
export const Interpolation = {
    // Linear interpolation
    linear(t) {
        return t;
    },

    // Ease in (accelerating from zero velocity)
    easeIn(t) {
        return t * t * t;
    },

    // Ease out (decelerating to zero velocity)
    easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    // Ease in-out (accelerating then decelerating)
    easeInOut(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },

    // Cubic Bezier (customizable curve)
    bezier(t, p1 = 0.42, p2 = 0, p3 = 0.58, p4 = 1) {
        // Simplified cubic bezier calculation
        const cx = 3 * p1;
        const bx = 3 * (p3 - p1) - cx;
        const ax = 1 - cx - bx;

        const cy = 3 * p2;
        const by = 3 * (p4 - p2) - cy;
        const ay = 1 - cy - by;

        const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
        const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;

        // Newton-Raphson iteration to find t for given x
        let t2 = t;
        for (let i = 0; i < 8; i++) {
            const x = sampleCurveX(t2) - t;
            if (Math.abs(x) < 0.001) break;
            const d = (3 * ax * t2 + 2 * bx) * t2 + cx;
            if (Math.abs(d) < 0.000001) break;
            t2 -= x / d;
        }

        return sampleCurveY(t2);
    },

    // Interpolate between two values
    interpolate(a, b, t, type = 'linear') {
        const easedT = this[type] ? this[type](t) : this.linear(t);
        return a + (b - a) * easedT;
    },

    // Interpolate between two 3D positions (Cartesian3)
    interpolateCartesian3(start, end, t, type = 'linear') {
        const easedT = this[type] ? this[type](t) : this.linear(t);
        return {
            x: start.x + (end.x - start.x) * easedT,
            y: start.y + (end.y - start.y) * easedT,
            z: start.z + (end.z - start.z) * easedT
        };
    },

    // Interpolate angles (handles wrapping around 360 degrees)
    interpolateAngle(start, end, t, type = 'linear') {
        const easedT = this[type] ? this[type](t) : this.linear(t);

        // Normalize angles to -180 to 180
        const normalizeAngle = (angle) => {
            while (angle > 180) angle -= 360;
            while (angle < -180) angle += 360;
            return angle;
        };

        start = normalizeAngle(start);
        end = normalizeAngle(end);

        // Find shortest path
        let diff = end - start;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        return normalizeAngle(start + diff * easedT);
    },

    // Spherical linear interpolation (for smooth camera rotation)
    slerp(start, end, t, type = 'linear') {
        const easedT = this[type] ? this[type](t) : this.linear(t);

        // Convert to quaternions for smooth rotation
        const dot = start.x * end.x + start.y * end.y + start.z * end.z + start.w * end.w;
        const theta = Math.acos(Math.max(-1, Math.min(1, dot)));

        if (theta === 0) return start;

        const sinTheta = Math.sin(theta);
        const wa = Math.sin((1 - easedT) * theta) / sinTheta;
        const wb = Math.sin(easedT * theta) / sinTheta;

        return {
            x: wa * start.x + wb * end.x,
            y: wa * start.y + wb * end.y,
            z: wa * start.z + wb * end.z,
            w: wa * start.w + wb * end.w
        };
    }
};

export default Interpolation;
