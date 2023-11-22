import { Matrix4 } from "./Matrix4";

class Vector3 {
    public readonly x: number;
    public readonly y: number;
    public readonly z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    equals(v: Vector3): boolean {
        if (this.x !== v.x) {
            return false;
        }
        if (this.y !== v.y) {
            return false;
        }
        if (this.z !== v.z) {
            return false;
        }

        return true;
    }

    add(v: Vector3): Vector3;
    add(v: number): Vector3;
    add(v: Vector3 | number): Vector3 {
        if (typeof v === "number") {
            return new Vector3(this.x + v, this.y + v, this.z + v);
        } else {
            return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
        }
    }

    subtract(v: Vector3): Vector3;
    subtract(v: number): Vector3;
    subtract(v: Vector3 | number): Vector3 {
        if (typeof v === "number") {
            return new Vector3(this.x - v, this.y - v, this.z - v);
        } else {
            return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
        }
    }

    multiply(v: Vector3): Vector3;
    multiply(v: number): Vector3;
    multiply(v: Vector3 | number): Vector3 {
        if (typeof v === "number") {
            return new Vector3(this.x * v, this.y * v, this.z * v);
        } else {
            return new Vector3(this.x * v.x, this.y * v.y, this.z * v.z);
        }
    }

    lerp(v: Vector3, t: number): Vector3 {
        return new Vector3(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.z + (v.z - this.z) * t);
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    distanceTo(v: Vector3): number {
        return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2);
    }

    normalize(): Vector3 {
        const length = this.length();

        return new Vector3(this.x / length, this.y / length, this.z / length);
    }

    flat(): number[] {
        return [this.x, this.y, this.z];
    }

    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    transformMat4(matrix: Matrix4): Vector3 {
        const x = this.x,
            y = this.y,
            z = this.z;
        const e = matrix.buffer;

        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);

        return new Vector3(
            (e[0] * x + e[4] * y + e[8] * z + e[12]) * w,
            (e[1] * x + e[5] * y + e[9] * z + e[13]) * w,
            (e[2] * x + e[6] * y + e[10] * z + e[14]) * w,
        );
    }

    dot(v: Vector3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    static setFromMatrixPosition(m: Matrix4): Vector3 {
        let x = 0;
        let y = 0;
        let z = 0;

        const e = m.buffer;

        x = e[12];
        y = e[13];
        z = e[14];

        return new Vector3(x, y, z);
    }
}

export { Vector3 };
