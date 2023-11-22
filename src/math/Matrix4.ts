class Matrix4 {
    public readonly buffer: number[];

    // prettier-ignore
    constructor(n11: number = 1, n12: number = 0, n13: number = 0, n14: number = 0, 
                n21: number = 0, n22: number = 1, n23: number = 0, n24: number = 0, 
                n31: number = 0, n32: number = 0, n33: number = 1, n34: number = 0, 
                n41: number = 0, n42: number = 0, n43: number = 0, n44: number = 1) {
        this.buffer = [
            n11, n12, n13, n14, 
            n21, n22, n23, n24, 
            n31, n32, n33, n34, 
            n41, n42, n43, n44
        ];
    }

    equals(m: Matrix4): boolean {
        if (this.buffer.length !== m.buffer.length) {
            return false;
        }
        if (this.buffer === m.buffer) {
            return true;
        }
        for (let i = 0; i < this.buffer.length; i++) {
            if (this.buffer[i] !== m.buffer[i]) {
                return false;
            }
        }
        return true;
    }

    multiply(m: Matrix4): Matrix4 {
        const a = this.buffer;
        const b = m.buffer;
        return new Matrix4(
            b[0] * a[0] + b[1] * a[4] + b[2] * a[8] + b[3] * a[12],
            b[0] * a[1] + b[1] * a[5] + b[2] * a[9] + b[3] * a[13],
            b[0] * a[2] + b[1] * a[6] + b[2] * a[10] + b[3] * a[14],
            b[0] * a[3] + b[1] * a[7] + b[2] * a[11] + b[3] * a[15],
            b[4] * a[0] + b[5] * a[4] + b[6] * a[8] + b[7] * a[12],
            b[4] * a[1] + b[5] * a[5] + b[6] * a[9] + b[7] * a[13],
            b[4] * a[2] + b[5] * a[6] + b[6] * a[10] + b[7] * a[14],
            b[4] * a[3] + b[5] * a[7] + b[6] * a[11] + b[7] * a[15],
            b[8] * a[0] + b[9] * a[4] + b[10] * a[8] + b[11] * a[12],
            b[8] * a[1] + b[9] * a[5] + b[10] * a[9] + b[11] * a[13],
            b[8] * a[2] + b[9] * a[6] + b[10] * a[10] + b[11] * a[14],
            b[8] * a[3] + b[9] * a[7] + b[10] * a[11] + b[11] * a[15],
            b[12] * a[0] + b[13] * a[4] + b[14] * a[8] + b[15] * a[12],
            b[12] * a[1] + b[13] * a[5] + b[14] * a[9] + b[15] * a[13],
            b[12] * a[2] + b[13] * a[6] + b[14] * a[10] + b[15] * a[14],
            b[12] * a[3] + b[13] * a[7] + b[14] * a[11] + b[15] * a[15],
        );
    }

    clone(): Matrix4 {
        const e = this.buffer;
        // prettier-ignore
        return new Matrix4(
            e[0], e[1], e[2], e[3], 
            e[4], e[5], e[6], e[7], 
            e[8], e[9], e[10], e[11], 
            e[12], e[13], e[14], e[15]
        );
    }

    static identity(): Matrix4 {
        return new Matrix4();
    }

    static invert(a: Matrix4): Matrix4 {
        const a00 = a.buffer[0],
            a01 = a.buffer[1],
            a02 = a.buffer[2],
            a03 = a.buffer[3];
        const a10 = a.buffer[4],
            a11 = a.buffer[5],
            a12 = a.buffer[6],
            a13 = a.buffer[7];
        const a20 = a.buffer[8],
            a21 = a.buffer[9],
            a22 = a.buffer[10],
            a23 = a.buffer[11];
        const a30 = a.buffer[12],
            a31 = a.buffer[13],
            a32 = a.buffer[14],
            a33 = a.buffer[15];

        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

        if (!det) {
            return Matrix4.identity();
        }
        det = 1.0 / det;

        const out = new Matrix4();

        out.buffer[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out.buffer[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out.buffer[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out.buffer[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out.buffer[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out.buffer[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out.buffer[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out.buffer[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out.buffer[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out.buffer[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out.buffer[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out.buffer[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out.buffer[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out.buffer[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out.buffer[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out.buffer[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

        return out;
    }
}

export { Matrix4 };
